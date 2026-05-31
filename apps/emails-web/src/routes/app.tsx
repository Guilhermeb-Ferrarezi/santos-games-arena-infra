import { useEffect, useState } from "react";
import { createRouter, RouterProvider, createRoute, createRootRoute, Outlet, redirect } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { DashboardPage } from "./dashboard";
import { EmailsPage } from "./emails";
import { UsersPage } from "./users";
import { JobsPage } from "./jobs";
import { WorkersPage } from "./workers";
import type { AdminUser } from "@/store/auth";
import { ShieldAlert, Loader } from "lucide-react";

// ─── Auth check ──────────────────────────────────────────────────────────────

const AUTH_URL = import.meta.env.VITE_AUTH_API_URL ?? "https://auth.santos-games.com";

async function fetchCurrentUser(): Promise<AdminUser | null> {
  try {
    const res = await fetch(`${AUTH_URL}/api/auth/session`, { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.user) return null;
    return { id: data.user.id, login: data.user.login, email: data.user.email, role: data.user.role ?? "user" };
  } catch {
    return null;
  }
}

// ─── Router ──────────────────────────────────────────────────────────────────

function AppShell() {
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
    window.location.href = `${AUTH_URL}?redirect=${encodeURIComponent(window.location.href)}`;
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
        <a href={`https://prime.santos-games.com`} className="text-xs text-[#f86d83] hover:underline mt-2">
          Voltar para a plataforma
        </a>
      </div>
    );
  }

  return <Layout user={user!}><Outlet /></Layout>;
}

const rootRoute   = createRootRoute({ component: AppShell });
const indexRoute  = createRoute({ getParentRoute: () => rootRoute, path: "/",        component: DashboardPage });
const emailsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/emails",  component: EmailsPage   });
const usersRoute  = createRoute({ getParentRoute: () => rootRoute, path: "/users",   component: UsersPage    });
const jobsRoute   = createRoute({ getParentRoute: () => rootRoute, path: "/jobs",    component: JobsPage     });
const workersRoute= createRoute({ getParentRoute: () => rootRoute, path: "/workers", component: WorkersPage  });

const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, emailsRoute, usersRoute, jobsRoute, workersRoute]),
});

declare module "@tanstack/react-router" {
  interface Register { router: typeof router; }
}

export function App() {
  return <RouterProvider router={router} />;
}
