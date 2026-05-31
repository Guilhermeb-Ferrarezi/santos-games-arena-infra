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

export type TemplateMeta = {
  name: string;
  label: string;
  vars: { key: string; label: string; default: string }[];
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

export function fetchTemplates(): Promise<TemplateMeta[]> {
  return get("/api/admin/templates");
}

export function fetchTemplatePreviewUrl(name: string, vars: Record<string, string>): string {
  const q = new URLSearchParams(vars);
  return `/api/admin/templates/${name}?${q}`;
}

export function testTemplate(name: string, body: Record<string, string>): Promise<{ ok: boolean }> {
  return post(`/api/admin/templates/${name}/test`, body);
}
