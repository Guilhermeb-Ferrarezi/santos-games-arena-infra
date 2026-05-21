import type { AuthClient, AuthClientRepository } from "./client-repository";

export type ResolvedClient = {
  client: AuthClient;
  redirectUri: string;
};

export type ClientValidationError =
  | { reason: "missing_client_id" }
  | { reason: "missing_redirect_uri" }
  | { reason: "unknown_client" }
  | { reason: "inactive_client" }
  | { reason: "invalid_redirect_uri" };

export type ClientValidationResult =
  | { ok: true; resolved: ResolvedClient }
  | { ok: false; error: ClientValidationError };

function normalizeUri(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function matchesAllowedRedirect(
  candidate: string,
  allowed: readonly string[]
): boolean {
  const normalizedCandidate = normalizeUri(candidate);
  return allowed.some((allowedUri) => normalizeUri(allowedUri) === normalizedCandidate);
}

export async function resolveClientRedirect(
  repository: AuthClientRepository,
  input: { clientId?: string | null; redirectUri?: string | null }
): Promise<ClientValidationResult> {
  const clientId = input.clientId?.trim();
  const redirectUri = input.redirectUri?.trim();

  if (!clientId) {
    return { ok: false, error: { reason: "missing_client_id" } };
  }

  if (!redirectUri) {
    return { ok: false, error: { reason: "missing_redirect_uri" } };
  }

  const client = await repository.findByClientId(clientId);

  if (!client) {
    return { ok: false, error: { reason: "unknown_client" } };
  }

  if (!client.isActive) {
    return { ok: false, error: { reason: "inactive_client" } };
  }

  if (!matchesAllowedRedirect(redirectUri, client.allowedRedirectUris)) {
    return { ok: false, error: { reason: "invalid_redirect_uri" } };
  }

  return { ok: true, resolved: { client, redirectUri } };
}
