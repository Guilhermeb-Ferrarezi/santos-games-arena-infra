import type { AuthSessionResponse } from "@santos-games/auth-contracts";
import axios from "axios";
import { z } from "zod";

const loginResponseSchema = z.object({
  authenticated: z.literal(true),
  user: z.object({
    id: z.number(),
    email: z.string(),
    login: z.string()
  })
});

export const api = axios.create({
  baseURL: import.meta.env.VITE_AUTH_API_URL ?? "",
  withCredentials: true
});

export async function getSession() {
  const response = await api.get<AuthSessionResponse>("/api/auth/session");
  return response.data;
}

export async function login(input: { identifier: string; password: string }) {
  const response = await api.post("/api/auth/login", input);
  return loginResponseSchema.parse(response.data);
}

export async function register(input: {
  email: string;
  login: string;
  password: string;
  provider?: string;
  externalAccountId?: string;
  displayName?: string;
  avatarUrl?: string;
}) {
  const response = await api.post("/api/auth/register", input);
  return loginResponseSchema.parse(response.data);
}

export async function setPassword(input: { password: string }) {
  await api.post("/api/auth/password", input);
}

export async function logout() {
  await api.post("/api/auth/logout");
}

export function startOAuth(
  provider: "google" | "discord" | "steam",
  returnTo?: string,
  entry?: "login" | "register"
) {
  const url = new URL(`${api.defaults.baseURL}/api/auth/oauth/${provider}/start`, window.location.origin);

  if (returnTo) {
    url.searchParams.set("returnTo", returnTo);
  }

  if (entry) {
    url.searchParams.set("entry", entry);
  }

  window.location.href = url.toString();
}
