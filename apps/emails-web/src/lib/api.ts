export type EmailLog = {
  id: string;
  emailType: "welcome" | "password-reset" | "login-notification" | "password-changed" | "email-change";
  to: string;
  login: string;
  status: "sent" | "failed" | "pending";
  sentAt: string;
  errorMsg?: string;
  resendId?: string;
};

export type UserSummary = {
  login: string;
  email: string;
  emailCount: number;
  lastEmailAt: string;
  lastEmailType: EmailLog["emailType"];
};

export type TemplateVar = { key: string; label: string; default: string };

export type TemplateMeta = {
  id?: string;
  name: string;
  label: string;
  subject?: string;
  body?: string;
  vars: TemplateVar[];
  isSystem: boolean;
  schedulable: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type Stats = {
  sent: number;
  failed: number;
  pending: number;
  total: number;
};

export type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}

export function fetchStats(): Promise<Stats> {
  return get("/api/admin/stats");
}

export function fetchLogs(params: {
  page: number;
  limit?: number;
  search?: string;
  type?: string;
  status?: string;
}): Promise<Paginated<EmailLog>> {
  const q = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit ?? 20),
    search: params.search ?? "",
    type: params.type ?? "all",
    status: params.status ?? "all",
  });
  return get(`/api/admin/logs?${q}`);
}

export function fetchUsers(params: {
  page: number;
  limit?: number;
  search?: string;
}): Promise<Paginated<UserSummary>> {
  const q = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit ?? 20),
    search: params.search ?? "",
  });
  return get(`/api/admin/users?${q}`);
}

export type PlatformUser = {
  id: number;
  login: string;
  email: string;
  avatarUrl?: string;
};

export function fetchPlatformUsers(params: {
  page: number;
  limit?: number;
  search?: string;
}): Promise<Paginated<PlatformUser>> {
  const q = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit ?? 10),
    search: params.search ?? "",
  });
  return get(`/api/admin/platform-users?${q}`);
}

export function fetchTemplates(): Promise<TemplateMeta[]> {
  return get("/api/admin/templates");
}

export function fetchTemplatePreviewUrl(name: string, vars: Record<string, string>): string {
  const q = new URLSearchParams(vars);
  return `/api/admin/templates/${name}/preview?${q}`;
}

export function testTemplate(name: string, body: Record<string, string>): Promise<{ ok: boolean }> {
  return post(`/api/admin/templates/${name}/test`, body);
}

export function createTemplate(t: Pick<TemplateMeta, "name"|"label"|"subject"|"body"|"vars">): Promise<TemplateMeta> {
  return post("/api/admin/templates", t);
}

export function updateTemplate(name: string, t: Pick<TemplateMeta, "label"|"subject"|"body"|"vars">): Promise<{ ok: boolean }> {
  return fetch(`/api/admin/templates/${name}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(t),
  }).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
}

export async function deleteTemplate(name: string): Promise<void> {
  const r = await fetch(`/api/admin/templates/${name}`, { method: "DELETE" });
  if (!r.ok) throw new Error(String(r.status));
}

// ── Agendamentos ─────────────────────────────────────────────────────────────

export type ScheduledEmail = {
  id: string;
  templateName: string;
  templateVars: Record<string, string>;
  to: string;
  scheduledFor: string;
  status: "pending" | "sent" | "failed" | "cancelled";
  createdAt: string;
  sentAt?: string;
  errorMsg?: string;
};

export function fetchScheduled(params: {
  page: number;
  limit?: number;
  status?: string;
}): Promise<Paginated<ScheduledEmail>> {
  const q = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit ?? 20),
    status: params.status ?? "all",
  });
  return get(`/api/admin/scheduled?${q}`);
}

export function createScheduled(body: {
  templateName: string;
  templateVars: Record<string, string>;
  to: string;
  scheduledFor: string;
}): Promise<ScheduledEmail> {
  return post("/api/admin/scheduled", body);
}

export async function cancelScheduled(id: string): Promise<void> {
  const r = await fetch(`/api/admin/scheduled/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error(`${r.status}`);
}
