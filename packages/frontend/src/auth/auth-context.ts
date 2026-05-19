import { createContext } from "react";
import type { AuthUser } from "./types";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
}

export interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    confirmPassword: string,
    fullName?: string,
  ) => Promise<void>;
  applyAuthSuccess: (payload: {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
  }) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
export type { AuthState };
