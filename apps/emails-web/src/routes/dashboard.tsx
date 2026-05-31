import { useQuery } from "@tanstack/react-query";
import { Mail, CheckCircle, XCircle, Clock, Cpu, TrendingUp, Loader } from "lucide-react";
import { fetchStats, fetchLogs } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function StatCard({ icon: Icon, label, value, sub, color = "#f86d83", loading }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string; loading?: boolean;
}) {
  return (
    <div className="bg-[#0e0f14] border border-white/[0.07] rounded-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-white/35 uppercase tracking-widest font-semibold mb-2">{label}</p>
          {loading
            ? <div className="h-9 w-12 bg-white/5 rounded-sm animate-pulse" />
            : <p className="text-3xl font-black" style={{ color }}>{value}</p>
          }
          {sub && <p className="text-xs text-white/30 mt-1">{sub}</p>}
        </div>
        <div className="w-9 h-9 rounded-sm flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
    </div>
  );
}

const TYPE_LABEL: Record<string, string> = {
  "welcome":            "Boas-vindas",
  "password-reset":     "Reset de senha",
  "login-notification": "Notif. de acesso",
  "password-changed":   "Senha alterada",
  "email-change":       "Troca de e-mail",
};

export function DashboardPage() {
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["stats"],
    queryFn:  fetchStats,
    refetchInterval: 30_000,
  });

  const { data: recentData, isLoading: loadingRecent } = useQuery({
    queryKey: ["logs", 1, "", "all", "all"],
    queryFn:  () => fetchLogs({ page: 1, limit: 6 }),
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-white">Dashboard</h1>
        <p className="text-sm text-white/35 mt-1">Visão geral do sistema de e-mails</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <StatCard icon={CheckCircle} label="Enviados"  value={stats?.sent    ?? "—"} color="#4ade80" loading={loadingStats} />
        <StatCard icon={XCircle}    label="Falhas"     value={stats?.failed  ?? "—"} color="#f87171" loading={loadingStats} />
      </div>
      <div className="grid grid-cols-2 gap-4 mb-8">
        <StatCard icon={Clock}      label="Pendentes"  value={stats?.pending ?? "—"} color="#facc15" loading={loadingStats} />
        <StatCard icon={Mail}       label="Total logs" value={stats?.total   ?? "—"} color="#a78bfa" loading={loadingStats} />
      </div>

      <div className="bg-[#0e0f14] border border-white/[0.07] rounded-sm">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-2">
          <TrendingUp size={14} className="text-[#f86d83]" />
          <h2 className="text-sm font-bold text-white">Atividade recente</h2>
        </div>

        {loadingRecent && (
          <div className="flex items-center justify-center py-12">
            <Loader size={18} className="text-[#f86d83] animate-spin" />
          </div>
        )}

        {!loadingRecent && recentData?.data.length === 0 && (
          <div className="text-center py-12 text-white/20 text-sm">Nenhum e-mail enviado ainda.</div>
        )}

        <div className="divide-y divide-white/[0.04]">
          {recentData?.data.map((log) => (
            <div key={log.id} className="px-6 py-3.5 flex items-center gap-4">
              <div className="w-8 h-8 rounded-sm bg-white/5 flex items-center justify-center shrink-0">
                <Mail size={14} className="text-white/30" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/80 truncate">
                  {TYPE_LABEL[log.emailType]} → <span className="text-white/50">{log.to}</span>
                </p>
                <p className="text-xs text-white/30 mt-0.5">
                  {log.sentAt ? formatDistanceToNow(new Date(log.sentAt), { locale: ptBR, addSuffix: true }) : "—"}
                </p>
              </div>
              <Badge variant={log.status === "sent" ? "success" : log.status === "failed" ? "danger" : "warning"}>
                {log.status === "sent" ? "Enviado" : log.status === "failed" ? "Falhou" : "Pendente"}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
