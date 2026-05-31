import { useState, useMemo } from "react";
import { Zap, RefreshCw, Clock, CheckCircle, XCircle, Loader } from "lucide-react";
import { MOCK_JOBS, type Job } from "@/lib/mock";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function StatusIcon({ status }: { status: Job["status"] }) {
  if (status === "completed") return <CheckCircle size={15} className="text-[#4ade80]" />;
  if (status === "failed")    return <XCircle    size={15} className="text-[#f87171]" />;
  if (status === "running")   return <Loader     size={15} className="text-[#60a5fa] animate-spin" />;
  return <Clock size={15} className="text-[#facc15]" />;
}

function StatusBadge({ status }: { status: Job["status"] }) {
  const map: Record<string, { v: "success"|"danger"|"warning"|"info"; l: string }> = {
    completed: { v: "success", l: "Concluído" },
    failed:    { v: "danger",  l: "Falhou"    },
    running:   { v: "info",    l: "Rodando"   },
    waiting:   { v: "warning", l: "Aguardando"},
  };
  const { v, l } = map[status];
  return <Badge variant={v}>{l}</Badge>;
}

export function JobsPage() {
  const [queue, setQueue]     = useState("all");
  const [status, setStatus]   = useState("all");

  const filtered = useMemo(() =>
    MOCK_JOBS.filter((j) => {
      if (queue !== "all" && j.queue !== queue) return false;
      if (status !== "all" && j.status !== status) return false;
      return true;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [queue, status]
  );

  const counts = {
    running:   MOCK_JOBS.filter((j) => j.status === "running").length,
    waiting:   MOCK_JOBS.filter((j) => j.status === "waiting").length,
    completed: MOCK_JOBS.filter((j) => j.status === "completed").length,
    failed:    MOCK_JOBS.filter((j) => j.status === "failed").length,
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-white">Jobs</h1>
        <p className="text-sm text-white/35 mt-1">Fila de background jobs</p>
      </div>

      {/* Contadores rápidos */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Rodando",    value: counts.running,   color: "#60a5fa" },
          { label: "Aguardando", value: counts.waiting,   color: "#facc15" },
          { label: "Concluídos", value: counts.completed, color: "#4ade80" },
          { label: "Falhas",     value: counts.failed,    color: "#f87171" },
        ].map((s) => (
          <div key={s.label} className="bg-[#0e0f14] border border-white/[0.07] rounded-sm px-4 py-3 flex items-center gap-3">
            <span className="text-2xl font-black" style={{ color: s.color }}>{s.value}</span>
            <span className="text-xs text-white/35 uppercase tracking-wider">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-5">
        <Select value={queue} onChange={(e) => setQueue(e.target.value)}>
          <option value="all">Todas as filas</option>
          <option value="emails">emails</option>
          <option value="cron">cron</option>
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Todos os status</option>
          <option value="running">Rodando</option>
          <option value="waiting">Aguardando</option>
          <option value="completed">Concluídos</option>
          <option value="failed">Falhas</option>
        </Select>
      </div>

      {/* Tabela */}
      <div className="bg-[#0e0f14] border border-white/[0.07] rounded-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["", "Job", "Fila", "Tentativas", "Status", "Criado", "Concluído"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/25">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filtered.map((job) => (
              <tr key={job.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-5 py-3.5 w-8"><StatusIcon status={job.status} /></td>
                <td className="px-5 py-3.5">
                  <p className="text-sm text-white/80 font-mono">{job.name}</p>
                  {job.data.to && <p className="text-xs text-white/30 mt-0.5">{job.data.to}</p>}
                  {job.data.error && <p className="text-[10px] text-[#f87171] mt-0.5 font-mono">{job.data.error}</p>}
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-sm font-mono">{job.queue}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-sm text-white/50">{job.attempts}/{job.maxAttempts}</span>
                </td>
                <td className="px-5 py-3.5"><StatusBadge status={job.status} /></td>
                <td className="px-5 py-3.5">
                  <span className="text-xs text-white/30">
                    {formatDistanceToNow(new Date(job.createdAt), { locale: ptBR, addSuffix: true })}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-xs text-white/30">
                    {job.finishedAt
                      ? formatDistanceToNow(new Date(job.finishedAt), { locale: ptBR, addSuffix: true })
                      : "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
