import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setUnauthorizedHandler, tokenStorage } from '../../services/api';
import { authService, type AuthResponse } from '../../services/taskflow';
import type { User } from '../../services/types';
import { AuthContext, type AuthContextValue } from './authContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(() => tokenStorage.get() !== null);

  const clearSession = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    return () => setUnauthorizedHandler(undefined);
  }, [clearSession]);

  useEffect(() => {
    if (!tokenStorage.get()) return;
    authService
      .me()
      .then(setUser)
      .catch(() => clearSession())
      .finally(() => setInitializing(false));
  }, [clearSession]);

  const startSession = useCallback((result: AuthResponse) => {
    tokenStorage.set(result.accessToken);
    setUser(result.user);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      login: async (email, password) => startSession(await authService.login(email, password)),
      register: async (name, email, password) =>
        startSession(await authService.register(name, email, password)),
      logout: async () => {
        await authService.logout().catch(() => undefined);
        clearSession();
      },
    }),
    [user, initializing, startSession, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
