export type EmailLog = {
  id: string;
  to: string;
  login: string;
  type: "welcome" | "password-reset" | "login-notification" | "password-changed" | "email-change";
  status: "sent" | "failed" | "pending";
  sentAt: string;
  errorMsg?: string;
};

export type Job = {
  id: string;
  name: string;
  status: "running" | "waiting" | "completed" | "failed";
  queue: string;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  finishedAt?: string;
  data: Record<string, string>;
};

export type Worker = {
  id: string;
  name: string;
  queue: string;
  status: "active" | "idle" | "stopped";
  processed: number;
  failed: number;
  startedAt: string;
};

export type UserSummary = {
  id: number;
  login: string;
  email: string;
  emailCount: number;
  lastEmailAt: string;
  lastEmailType: EmailLog["type"];
};

export const MOCK_USERS: UserSummary[] = [
  { id: 1, login: "guilherme",    email: "guibferrarezi@gmail.com",   emailCount: 12, lastEmailAt: "2026-05-30T22:30:00Z", lastEmailType: "login-notification" },
  { id: 2, login: "willian",      email: "willian@santos-games.com",  emailCount:  7, lastEmailAt: "2026-05-30T20:10:00Z", lastEmailType: "welcome" },
  { id: 3, login: "gabriel_123",  email: "gabriel@gmail.com",         emailCount:  3, lastEmailAt: "2026-05-29T15:40:00Z", lastEmailType: "password-reset" },
  { id: 4, login: "player_404",   email: "player404@hotmail.com",     emailCount:  1, lastEmailAt: "2026-05-28T09:00:00Z", lastEmailType: "welcome" },
  { id: 5, login: "sniper_king",  email: "sniper@gmail.com",          emailCount:  5, lastEmailAt: "2026-05-27T18:20:00Z", lastEmailType: "password-changed" },
  { id: 6, login: "ana_cs",       email: "ana@santos-games.com",      emailCount:  2, lastEmailAt: "2026-05-26T11:00:00Z", lastEmailType: "email-change" },
  { id: 7, login: "renanplay",    email: "renan@outlook.com",         emailCount:  8, lastEmailAt: "2026-05-25T22:00:00Z", lastEmailType: "login-notification" },
  { id: 8, login: "zecard",       email: "ze@gmail.com",              emailCount:  0, lastEmailAt: "",                   lastEmailType: "welcome" },
];

export const MOCK_LOGS: EmailLog[] = [
  { id: "1", to: "guibferrarezi@gmail.com",  login: "guilherme",   type: "login-notification",  status: "sent",   sentAt: "2026-05-30T22:30:00Z" },
  { id: "2", to: "guibferrarezi@gmail.com",  login: "guilherme",   type: "welcome",              status: "sent",   sentAt: "2026-05-30T10:00:00Z" },
  { id: "3", to: "willian@santos-games.com", login: "willian",     type: "welcome",              status: "sent",   sentAt: "2026-05-30T20:10:00Z" },
  { id: "4", to: "gabriel@gmail.com",        login: "gabriel_123", type: "password-reset",       status: "sent",   sentAt: "2026-05-29T15:40:00Z" },
  { id: "5", to: "player404@hotmail.com",    login: "player_404",  type: "welcome",              status: "failed", sentAt: "2026-05-28T09:00:00Z", errorMsg: "550 Mailbox not found" },
  { id: "6", to: "sniper@gmail.com",         login: "sniper_king", type: "password-changed",     status: "sent",   sentAt: "2026-05-27T18:20:00Z" },
  { id: "7", to: "ana@santos-games.com",     login: "ana_cs",      type: "email-change",         status: "sent",   sentAt: "2026-05-26T11:00:00Z" },
  { id: "8", to: "renan@outlook.com",        login: "renanplay",   type: "login-notification",  status: "sent",   sentAt: "2026-05-25T22:00:00Z" },
  { id: "9", to: "guibferrarezi@gmail.com",  login: "guilherme",   type: "password-reset",       status: "pending", sentAt: "2026-05-30T23:00:00Z" },
  { id:"10", to: "ze@gmail.com",             login: "zecard",      type: "welcome",              status: "failed", sentAt: "2026-05-24T08:00:00Z", errorMsg: "Connection timeout" },
];

export const MOCK_JOBS: Job[] = [
  { id: "j1", name: "send-welcome",              queue: "emails",   status: "completed", attempts: 1, maxAttempts: 3, createdAt: "2026-05-30T22:28:00Z", finishedAt: "2026-05-30T22:28:02Z", data: { to: "willian@santos-games.com", login: "willian" } },
  { id: "j2", name: "send-login-notification",   queue: "emails",   status: "running",   attempts: 1, maxAttempts: 3, createdAt: "2026-05-30T22:30:00Z", data: { to: "renan@outlook.com", login: "renanplay" } },
  { id: "j3", name: "send-password-reset",       queue: "emails",   status: "waiting",   attempts: 0, maxAttempts: 3, createdAt: "2026-05-30T23:00:00Z", data: { to: "guibferrarezi@gmail.com", login: "guilherme" } },
  { id: "j4", name: "send-welcome",              queue: "emails",   status: "failed",    attempts: 3, maxAttempts: 3, createdAt: "2026-05-28T09:00:00Z", finishedAt: "2026-05-28T09:00:10Z", data: { to: "player404@hotmail.com", error: "550 Mailbox not found" } },
  { id: "j5", name: "cleanup-expired-tokens",    queue: "cron",     status: "completed", attempts: 1, maxAttempts: 1, createdAt: "2026-05-30T22:00:00Z", finishedAt: "2026-05-30T22:00:01Z", data: {} },
  { id: "j6", name: "send-welcome",              queue: "emails",   status: "failed",    attempts: 3, maxAttempts: 3, createdAt: "2026-05-24T08:00:00Z", finishedAt: "2026-05-24T08:00:12Z", data: { to: "ze@gmail.com", error: "Connection timeout" } },
];

export const MOCK_WORKERS: Worker[] = [
  { id: "w1", name: "email-worker-1", queue: "emails", status: "active", processed: 847, failed: 6, startedAt: "2026-05-30T12:00:00Z" },
  { id: "w2", name: "email-worker-2", queue: "emails", status: "idle",   processed: 831, failed: 4, startedAt: "2026-05-30T12:00:00Z" },
  { id: "w3", name: "cron-worker-1",  queue: "cron",   status: "active", processed: 120, failed: 0, startedAt: "2026-05-30T12:00:00Z" },
];
