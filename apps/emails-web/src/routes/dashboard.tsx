import { Mail, CheckCircle, XCircle, Clock, Users, TrendingUp, Zap, Cpu } from "lucide-react";
import { MOCK_LOGS, MOCK_WORKERS, MOCK_JOBS } from "@/lib/mock";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function StatCard({ icon: Icon, label, value, sub, color = "#f86d83" }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-[#0e0f14] border border-white/[0.07] rounded-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-white/35 uppercase tracking-widest font-semibold mb-2">{label}</p>
          <p className="text-3xl font-black" style={{ color }}>{value}</p>
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
  "welcome": "Boas-vindas",
  "password-reset": "Reset de senha",
  "login-notification": "Notif. de acesso",
  "password-changed": "Senha alterada",
  "email-change": "Troca de e-mail",
};

export function DashboardPage() {
  const sent    = MOCK_LOGS.filter((l) => l.status === "sent").length;
  const failed  = MOCK_LOGS.filter((l) => l.status === "failed").length;
  const pending = MOCK_LOGS.filter((l) => l.status === "pending").length;
  const workers = MOCK_WORKERS.filter((w) => w.status === "active").length;
  const recent  = [...MOCK_LOGS].sort((a, b) => b.sentAt.localeCompare(a.sentAt)).slice(0, 6);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-white">Dashboard</h1>
        <p className="text-sm text-white/35 mt-1">Visão geral do sistema de e-mails</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard icon={CheckCircle} label="Enviados"     value={sent}    sub="hoje"      color="#4ade80" />
        <StatCard icon={XCircle}    label="Falhas"        value={failed}  sub="total"     color="#f87171" />
        <StatCard icon={Clock}      label="Pendentes"     value={pending} sub="na fila"   color="#facc15" />
        <StatCard icon={Cpu}        label="Workers ativos" value={workers} sub="de 3 total" color="#f86d83" />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard icon={Mail}       label="Total de logs"  value={MOCK_LOGS.length}    color="#a78bfa" />
        <StatCard icon={Users}      label="Usuários"       value={8}                   color="#60a5fa" />
        <StatCard icon={Zap}        label="Jobs hoje"      value={MOCK_JOBS.length}    color="#f86d83" />
      </div>

      {/* Atividade recente */}
      <div className="bg-[#0e0f14] border border-white/[0.07] rounded-sm">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-2">
          <TrendingUp size={14} className="text-[#f86d83]" />
          <h2 className="text-sm font-bold text-white">Atividade recente</h2>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {recent.map((log) => (
            <div key={log.id} className="px-6 py-3.5 flex items-center gap-4">
              <div className="w-8 h-8 rounded-sm bg-white/5 flex items-center justify-center shrink-0">
                <Mail size={14} className="text-white/30" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/80 truncate">
                  {TYPE_LABEL[log.type]} → <span className="text-white/50">{log.to}</span>
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
