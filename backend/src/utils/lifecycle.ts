/**
 * Process-wide lifecycle flags. The readiness probe reports "not ready"
 * as soon as shutdown begins so load balancers stop sending new traffic.
 */
let shuttingDown = false;

export const lifecycle = {
  isShuttingDown: () => shuttingDown,
  beginShutdown: () => {
    shuttingDown = true;
  },
};
