import { create } from "zustand";

export type AdminUser = {
  id: number;
  login: string;
  email: string;
  role: string;
};

type AuthState = {
  user: AdminUser | null;
  status: "loading" | "authenticated" | "unauthenticated" | "forbidden";
  setUser: (user: AdminUser | null) => void;
  setStatus: (s: AuthState["status"]) => void;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: "loading",
  setUser: (user) => set({ user }),
  setStatus: (status) => set({ status }),
}));
