import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { AuthApiEnv } from "../../config/env";
import type { SessionStore } from "../session/session-store";
import type { PlatformUserRepository } from "../users/platform-user-repository";
import { createRequireAdmin } from "./admin-middleware";
import type { AuthClient, AuthClientRepository } from "./client-repository";

const redirectUriSchema = z
  .string()
  .trim()
  .url("redirect_uri must be a valid URL");

const createClientSchema = z.object({
  clientId: z.string().trim().min(1).max(64).regex(/^[a-z0-9_-]+$/i, "client_id must be alphanumeric"),
  name: z.string().trim().min(1).max(120),
  allowedRedirectUris: z.array(redirectUriSchema).min(1),
  isActive: z.boolean().optional()
});

const updateClientSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  allowedRedirectUris: z.array(redirectUriSchema).min(1).optional(),
  isActive: z.boolean().optional()
});

const clientIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

function toResponse(client: AuthClient) {
  return {
    id: client.id,
    clientId: client.clientId,
    name: client.name,
    allowedRedirectUris: client.allowedRedirectUris,
    isActive: client.isActive
  };
}

export function registerClientAdminRoutes(
  server: FastifyInstance,
  env: Pick<AuthApiEnv, "AUTH_COOKIE_NAME" | "JWT_SECRET">,
  repository: AuthClientRepository,
  users: PlatformUserRepository,
  sessions?: SessionStore
) {
  const requireAdmin = createRequireAdmin(env, users, sessions);

  server.get("/clients", { preHandler: requireAdmin }, async () => {
    const clients = await repository.listAll();
    return { clients: clients.map(toResponse) };
  });

  server.post("/clients", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = createClientSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "invalid_input", details: parsed.error.flatten() };
    }

    const existing = await repository.findByClientId(parsed.data.clientId);
    if (existing) {
      reply.code(409);
      return { error: "client_id_already_exists" };
    }

    const created = await repository.create(parsed.data);
    reply.code(201);
    return toResponse(created);
  });

  server.patch("/clients/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const params = clientIdParamSchema.safeParse(request.params);
    if (!params.success) {
      reply.code(400);
      return { error: "invalid_id" };
    }

    const body = updateClientSchema.safeParse(request.body);
    if (!body.success) {
      reply.code(400);
      return { error: "invalid_input", details: body.error.flatten() };
    }

    const updated = await repository.update(params.data.id, body.data);
    if (!updated) {
      reply.code(404);
      return { error: "not_found" };
    }

    return toResponse(updated);
  });

  server.delete("/clients/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const params = clientIdParamSchema.safeParse(request.params);
    if (!params.success) {
      reply.code(400);
      return { error: "invalid_id" };
    }

    const removed = await repository.remove(params.data.id);
    if (!removed) {
      reply.code(404);
      return { error: "not_found" };
    }

    reply.code(204);
  });
}
