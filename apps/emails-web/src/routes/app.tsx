import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { DashboardPage } from "./dashboard";
import { EmailsPage } from "./emails";
import { UsersPage } from "./users";
import { JobsPage } from "./jobs";
import { WorkersPage } from "./workers";
import { TemplatesPage } from "./templates";
import type { AdminUser } from "@/store/auth";
import { ShieldAlert, Loader } from "lucide-react";

const AUTH_URL = import.meta.env.VITE_AUTH_API_URL ?? "https://auth.santos-games.com";

async function getSession(): Promise<any> {
  const r = await fetch(`${AUTH_URL}/api/auth/session`, { credentials: "include" });
  return r.ok ? r.json() : null;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const r = await fetch(`${AUTH_URL}/api/auth/refresh`, { method: "POST", credentials: "include" });
    return r.ok;
  } catch {
    return false;
  }
}

async function fetchCurrentUser(): Promise<AdminUser | null> {
  try {
    let data = await getSession();

    // JWT expirado mas refresh token ainda válido → renova
    if (!data?.authenticated) {
      const ok = await tryRefresh();
      if (ok) data = await getSession();
    }

    if (!data?.authenticated || !data.user) return null;

    const roleNum: number = data.user.role;
    const role = roleNum === 1 ? "admin" : "user";
    return { id: data.user.id, login: data.user.login, email: data.user.email, role };
  } catch {
    return null;
  }
}

// ─── Simple router ────────────────────────────────────────────────────────────

function usePathname() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  useEffect(() => {
    const handler = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);
  return pathname;
}

export function navigate(to: string) {
  window.history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function usePathContext() {
  return usePathname();
}

function Router() {
  const pathname = usePathname();
  if (pathname.startsWith("/emails"))    return <EmailsPage />;
  if (pathname.startsWith("/users"))     return <UsersPage />;
  if (pathname.startsWith("/jobs"))      return <JobsPage />;
  if (pathname.startsWith("/workers"))   return <WorkersPage />;
  if (pathname.startsWith("/templates")) return <TemplatesPage />;
  return <DashboardPage />;
}

// ─── App root ─────────────────────────────────────────────────────────────────

export function App() {
  const [user, setUser]     = useState<AdminUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "forbidden" | "unauth">("loading");

  useEffect(() => {
    fetchCurrentUser().then((u) => {
      if (!u) return setStatus("unauth");
      if (u.role?.toLowerCase() !== "admin") return setStatus("forbidden");
      setUser(u);
      setStatus("ok");
    });
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#06070a] flex items-center justify-center">
        <Loader size={24} className="text-[#f86d83] animate-spin" />
      </div>
    );
  }

  if (status === "unauth") {
    const params = new URLSearchParams({ client_id: "sga-emails-web", redirect_uri: window.location.origin });
    window.location.href = `${AUTH_URL}?${params}`;
    return null;
  }

  if (status === "forbidden") {
    return (
      <div className="min-h-screen bg-[#06070a] flex flex-col items-center justify-center gap-4" style={{ fontFamily: "Inter, sans-serif" }}>
        <ShieldAlert size={40} className="text-[#f87171]" />
        <div className="text-center">
          <p className="text-lg font-bold text-white">Acesso negado</p>
          <p className="text-sm text-white/40 mt-1">Esta área é exclusiva para administradores.</p>
        </div>
        <a href="https://prime.santos-games.com" className="text-xs text-[#f86d83] hover:underline mt-2">
          Voltar para a plataforma
        </a>
      </div>
    );
  }

  return (
    <Layout user={user!}>
      <Router />
    </Layout>
  );
}
