import { Mail, Users, Cpu, LayoutDashboard, Zap, LogOut, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminUser } from "@/store/auth";
import { navigate, usePathContext } from "@/routes/app";

const NAV = [
  { to: "/",        label: "Dashboard",  icon: LayoutDashboard },
  { to: "/emails",  label: "Emails",     icon: Mail },
  { to: "/users",   label: "Usuários",   icon: Users },
  { to: "/jobs",    label: "Jobs",       icon: Zap },
  { to: "/workers", label: "Workers",    icon: Cpu },
];

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: React.ElementType }) {
  const pathname = usePathContext();
  const active = to === "/" ? pathname === "/" : pathname.startsWith(to);

  return (
    <button
      onClick={() => navigate(to)}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-colors group text-left",
        active
          ? "bg-[#f86d83]/10 text-[#f86d83]"
          : "text-white/40 hover:text-white/80 hover:bg-white/5"
      )}
    >
      <Icon size={16} className={cn(active ? "text-[#f86d83]" : "text-white/30 group-hover:text-white/60")} />
      {label}
      {active && <ChevronRight size={12} className="ml-auto text-[#f86d83]/50" />}
    </button>
  );
}

export function Layout({ user, children }: { user: AdminUser; children: React.ReactNode }) {
  function logout() {
    document.cookie = "sga_auth=; Max-Age=0; domain=.santos-games.com; path=/";
    window.location.href = "https://auth.santos-games.com";
  }

  return (
    <div className="min-h-screen bg-[#06070a] flex text-white" style={{ fontFamily: "Inter, sans-serif" }}>
      <aside className="w-56 shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="h-14 flex items-center px-4 border-b border-white/[0.06]">
          <span className="font-black text-sm tracking-widest uppercase" style={{ fontFamily: "Barlow Condensed, sans-serif" }}>
            <span className="text-[#f86d83]">SGA</span>
            <span className="text-white/40 ml-1.5">Email</span>
          </span>
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map((item) => <NavItem key={item.to} {...item} />)}
        </nav>

        <div className="p-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-7 h-7 rounded-sm bg-[#f86d83]/20 flex items-center justify-center text-[#f86d83] text-xs font-bold uppercase">
              {user.login[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white/80 truncate">{user.login}</p>
              <p className="text-[10px] text-white/30 truncate">{user.email}</p>
            </div>
            <button onClick={logout} className="text-white/20 hover:text-white/60 transition-colors">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}
