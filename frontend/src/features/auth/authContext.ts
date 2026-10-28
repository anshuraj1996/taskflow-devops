import { createContext } from 'react';
import type { User } from '../../services/types';

export interface AuthContextValue {
  user: User | null;
  /** True while restoring the session from a stored token on first load. */
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
