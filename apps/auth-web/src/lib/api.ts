import axios from "axios";
import { z } from "zod";

type AuthSessionResponse = {
  authenticated: boolean;
  user: {
    id: number;
    email: string;
    login: string;
  } | null;
  needsPasswordSetup?: boolean;
};

const loginResponseSchema = z.object({
  authenticated: z.literal(true),
  user: z.object({
    id: z.number(),
    email: z.string(),
    login: z.string()
  }),
  redirectUri: z.string().url().optional()
});

const passwordResponseSchema = z.object({
  success: z.literal(true),
  redirectUri: z.string().url().optional()
});

const clientResponseSchema = z.object({
  ok: z.literal(true),
  client: z.object({
    clientId: z.string(),
    name: z.string()
  }),
  redirectUri: z.string().url()
});

export type ClientLookupResult = z.infer<typeof clientResponseSchema>["client"] & {
  redirectUri: string;
};

export type ClientFlow = {
  clientId: string;
  redirectUri: string;
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_AUTH_API_URL ?? "",
  withCredentials: true
});

export async function getSession() {
  const response = await api.get<AuthSessionResponse>("/api/auth/session");
  return response.data;
}

export async function lookupClient(
  input: { clientId: string; redirectUri: string }
): Promise<ClientLookupResult> {
  const response = await api.get("/api/auth/client", {
    params: { client_id: input.clientId, redirect_uri: input.redirectUri }
  });
  const parsed = clientResponseSchema.parse(response.data);
  return { ...parsed.client, redirectUri: parsed.redirectUri };
}

export async function login(
  input: { identifier: string; password: string } & Partial<ClientFlow>
) {
  const response = await api.post("/api/auth/login", input);
  return loginResponseSchema.parse(response.data);
}

export async function register(
  input: {
    email: string;
    login: string;
    password: string;
    provider?: string;
    externalAccountId?: string;
    displayName?: string;
    avatarUrl?: string;
  } & Partial<ClientFlow>
) {
  const response = await api.post("/api/auth/register", input);
  return loginResponseSchema.parse(response.data);
}

export async function setPassword(
  input: { password: string } & Partial<ClientFlow>
) {
  const response = await api.post("/api/auth/password", input);
  return passwordResponseSchema.parse(response.data);
}

export async function logout() {
  await api.post("/api/auth/logout");
}

export function startOAuth(
  provider: "google" | "discord" | "steam",
  options: {
    returnTo?: string;
    entry?: "login" | "register";
    clientId?: string;
    redirectUri?: string;
  } = {}
) {
  const url = new URL(`${api.defaults.baseURL}/api/auth/oauth/${provider}/start`, window.location.origin);

  if (options.returnTo) {
    url.searchParams.set("returnTo", options.returnTo);
  }

  if (options.entry) {
    url.searchParams.set("entry", options.entry);
  }

  if (options.clientId) {
    url.searchParams.set("client_id", options.clientId);
  }

  if (options.redirectUri) {
    url.searchParams.set("redirect_uri", options.redirectUri);
  }

  window.location.href = url.toString();
}
