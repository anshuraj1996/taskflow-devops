# TaskFlow on Kubernetes

## Overview

TaskFlow is deployed with the Helm chart in `deploy/helm/taskflow`. The plain manifests in `deploy/k8s` were the hand-written first version and are kept for reference.

```
ingress-nginx ──► web (nginx, 2 pods) ──/api, /health──► api (Express, 2–5 pods) ──► postgres (StatefulSet, 1 pod)
                                                          ▲
                                     migrate Job (Helm hook) ┘
```

| Concern            | How it is handled                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Schema migrations  | `migrate` Job, a `post-install,pre-upgrade` Helm hook. New API code never starts against an old schema.              |
| Config and secrets | ConfigMap for non-secret settings. Secrets come from a git-ignored `values-local.yaml`, never from Git.              |
| Health             | startup and liveness probes hit `/health/live` (process only). Readiness hits `/health/ready` (checks the database). |
| Network            | NetworkPolicies: default-deny ingress, then only ingress-nginx → web, web → api, and api and migrate → postgres.     |
| API access         | One ServiceAccount per app, with no API token mounted. A read-only `developer` Role (no Secrets).                    |
| Scaling            | HPA on the API: 2–5 pods at 70% of the CPU request.                                                                  |
| Availability       | PDB `minAvailable: 1` for api and web. Pods are spread across nodes.                                                 |
| Rollouts           | `maxUnavailable: 0`, `maxSurge: 1`, and a 5 s `preStop` sleep.                                                       |

## Deploy

Prerequisites: Minikube with a CNI that enforces NetworkPolicies (Calico), and these addons: `ingress`, `metrics-server` and `storage-provisioner-rancher`.

```powershell
helm upgrade --install taskflow deploy/helm/taskflow -n taskflow --create-namespace `
  -f deploy/helm/taskflow/values-dev.yaml -f deploy/helm/taskflow/values-local.yaml --wait
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8081:80
```

The app is then served at http://taskflow.local:8081 (with `127.0.0.1 taskflow.local` in the hosts file). Restart the port-forward after any upgrade that restarts pods.

## Failure drills

Each drill ran on a 3-node Minikube cluster (v1.35) while a probe pod requested `/health/ready` through the web Service 10 times per second. The probe ran in the `ingress-nginx` namespace, because the NetworkPolicies only let that namespace reach web.

```powershell
kubectl run probe -n ingress-nginx --image=busybox:1.36 --restart=Never -- /bin/sh -c 'ok=0; fail=0; while true; do if wget -q -T 2 -O /dev/null http://web.taskflow.svc:8080/health/ready; then ok=$((ok+1)); else fail=$((fail+1)); echo FAIL $(date +%T); fi; if [ $(((ok+fail)%50)) -eq 0 ]; then echo ok=$ok fail=$fail; fi; sleep 0.1; done'
kubectl logs -n ingress-nginx probe -f
```

### Rolling update: zero failed requests

```powershell
kubectl rollout restart deployment/api -n taskflow
kubectl rollout status deployment/api -n taskflow
```

| Setup                              | Failed requests during the rollout |
| ---------------------------------- | ---------------------------------- |
| `maxUnavailable: 0`, `maxSurge: 1` | 1 of 850 (`502 Bad Gateway`)       |
| plus a 5 s `preStop` sleep         | **0 of 800**                       |

**Why the 502 happened:** when a pod is terminated, SIGTERM and the removal from the Service endpoints happen at the same time. The API closed its listener within milliseconds, but routing still sent a request to it for a moment. The `preStop` sleep keeps the old pod serving until the endpoint change has spread, and only then sends SIGTERM.

### 1. Kill an API pod during load

```powershell
kubectl delete pod api-7b67dd5cb9-n8cjq -n taskflow
```

- The ReplicaSet created a replacement (`api-7b67dd5cb9-2knrg`) immediately.
- The other pod kept serving. The new pod got no traffic until its readiness probe passed.
- **Probe: `fail=0`.**

### 2. Stop PostgreSQL

```powershell
kubectl scale statefulset postgres -n taskflow --replicas=0
kubectl get pods -n taskflow
kubectl get endpoints api -n taskflow
kubectl scale statefulset postgres -n taskflow --replicas=1
```

| Probe result              | Meaning                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `503 Service Unavailable` | The API is alive and reports the database as down.                                           |
| `download timed out`      | The API is waiting on database connections.                                                  |
| `502 Bad Gateway`         | Readiness failed on both API pods. The `api` endpoints were empty, so nginx had no upstream. |
| `ok`                      | About 30 s after postgres came back, readiness passed and the pods rejoined the Service.     |

- API pods were `0/1` during the outage with **RESTARTS 0**. Liveness does not check the database, so there was no restart loop.
- Recovery was automatic, with no manual restart.
- The outage lasted about 2 minutes, exactly as long as the database was down. With a single postgres replica this is expected; removing it needs a replicated database (for example the CloudNativePG operator).

### 3. Drain a node

```powershell
kubectl get pods -n taskflow -o wide
kubectl drain minikube-m03 --ignore-daemonsets --delete-emptydir-data
kubectl get pods -n taskflow -o wide
kubectl uncordon minikube-m03
```

- Before the drain, the topology spread had placed the two API pods on different nodes (`minikube` and `minikube-m03`).
- The PDB (`minAvailable: 1`, allowed disruptions 1) let the API pod on `minikube-m03` be evicted. The pod on `minikube` kept serving.
- The replacement was scheduled on `minikube-m02`, because `minikube` already had an API pod and `m03` was cordoned.
- After `uncordon`, pods did not move back. Kubernetes does not rebalance running pods.
- `minikube-m02` was not drained: postgres stores its data on a `local-path` volume, which is tied to that node's disk.

### 4. Deploy a broken image

```powershell
kubectl set image deployment/api api=ghcr.io/anshuraj1996/taskflow-api:does-not-exist -n taskflow
kubectl rollout status deployment/api -n taskflow --timeout=60s
kubectl rollout undo deployment/api -n taskflow
```

- The rollout stalled: `error: timed out waiting for the condition`.
- One new pod was stuck in `ImagePullBackOff`. Both old pods stayed `1/1 Running`, because `maxUnavailable: 0` never removes an old pod before a new one is Ready.
- `rollout undo` removed the broken pod. The same two old pods kept serving, with no restarts.
- **Probe: no new failures.**
- `kubectl set image` changes the cluster outside Helm, so it is only for the drill. Real deploys go through Helm, and a bad release is undone with `helm rollback`.

### 5. Exceed the memory limit

Pushing the API over its limit with `kubectl exec` would only kill the extra process, not the container. So this drill uses a demo pod with a 64Mi limit. `tail /dev/zero` never finds a newline, so its memory grows until it hits the limit.

```powershell
@'
apiVersion: v1
kind: Pod
metadata:
  name: oom-demo
  namespace: default
spec:
  restartPolicy: Never
  containers:
    - name: oom
      image: busybox:1.36
      command: ["sh", "-c", "tail /dev/zero"]
      resources:
        requests:
          memory: 32Mi
        limits:
          memory: 64Mi
'@ | kubectl apply -f -
kubectl get pod oom-demo -n default
kubectl describe pod oom-demo -n default | Select-String "Reason|Exit Code"
```

- STATUS `OOMKilled`, `Reason: OOMKilled`, `Exit Code: 137` (128 + SIGKILL 9).
- The kernel kills the container when its memory cgroup exceeds the limit; Kubernetes only reports it. With `restartPolicy: Always` (Deployments), the pod would be restarted and end up in `CrashLoopBackOff` if it keeps happening.
- This is why every TaskFlow container has a memory limit but no CPU limit. Too much memory gets the pod killed, while too much CPU only slows it down.
