import type { FastifyInstance } from "fastify";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { AuthApiEnv } from "../../config/env";
import type { PlatformUserRepository } from "../users/platform-user-repository";
import type { SessionStore } from "../session/session-store";
import { verifySessionToken } from "../session/session-token";

type Env = Pick<AuthApiEnv, "AUTH_COOKIE_NAME" | "JWT_SECRET" | "R2_ENDPOINT" | "R2_ACCESS_KEY_ID" | "R2_SECRET_ACCESS_KEY" | "R2_BUCKET" | "R2_PUBLIC_URL">;

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function registerAvatarRoutes(
  server: FastifyInstance,
  env: Env,
  users: PlatformUserRepository,
  sessions?: SessionStore,
) {
  if (!env.R2_ENDPOINT || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET || !env.R2_PUBLIC_URL) {
    return; // R2 não configurado — rotas não registradas
  }

  const s3 = new S3Client({
    endpoint: env.R2_ENDPOINT,
    region: "auto",
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  server.post("/avatar", async (request, reply) => {
    const token = (request.cookies as Record<string, string>)[env.AUTH_COOKIE_NAME];
    if (!token) return reply.code(401).send({ error: "unauthorized" });

    const session = await verifySessionToken(token, env);
    if (!session) return reply.code(401).send({ error: "unauthorized" });
    if (sessions && session.sessionId && !(await sessions.exists(session.sessionId))) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const data = await (request as any).file({ limits: { fileSize: MAX_BYTES } });
    if (!data) return reply.code(400).send({ error: "no_file", message: "Nenhum arquivo enviado." });

    const mime: string = data.mimetype ?? "";
    if (!ALLOWED_MIME.includes(mime)) {
      return reply.code(400).send({ error: "invalid_type", message: "Tipo de arquivo não permitido. Use JPG, PNG, WebP ou GIF." });
    }

    const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const key = `users/${session.userId}/avatar.${ext}`;

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk as Buffer);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.byteLength > MAX_BYTES) {
      return reply.code(400).send({ error: "file_too_large", message: "Arquivo maior que 5 MB." });
    }

    await s3.send(new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mime,
      CacheControl: "public, max-age=31536000",
    }));

    const avatarUrl = `${env.R2_PUBLIC_URL!.replace(/\/$/, "")}/${key}`;
    await users.updateAvatarUrl(session.userId, avatarUrl);

    return { success: true, avatarUrl };
  });
}
