import { Cpu, CheckCircle, Pause, StopCircle, Activity } from "lucide-react";
import { MOCK_WORKERS, type Worker } from "@/lib/mock";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function StatusBadge({ status }: { status: Worker["status"] }) {
  if (status === "active")  return <Badge variant="success">Ativo</Badge>;
  if (status === "idle")    return <Badge variant="warning">Ocioso</Badge>;
  return <Badge variant="danger">Parado</Badge>;
}

function StatusDot({ status }: { status: Worker["status"] }) {
  const color = status === "active" ? "#4ade80" : status === "idle" ? "#facc15" : "#f87171";
  return (
    <span className="relative flex h-2.5 w-2.5">
      {status === "active" && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ background: color }} />
      )}
      <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: color }} />
    </span>
  );
}

export function WorkersPage() {
  const active  = MOCK_WORKERS.filter((w) => w.status === "active").length;
  const idle    = MOCK_WORKERS.filter((w) => w.status === "idle").length;
  const stopped = MOCK_WORKERS.filter((w) => w.status === "stopped").length;
  const total   = MOCK_WORKERS.reduce((s, w) => s + w.processed, 0);
  const failed  = MOCK_WORKERS.reduce((s, w) => s + w.failed, 0);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-white">Workers</h1>
        <p className="text-sm text-white/35 mt-1">Status em tempo real dos workers</p>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        {[
          { label: "Ativos",      value: active,  color: "#4ade80" },
          { label: "Ociosos",     value: idle,    color: "#facc15" },
          { label: "Parados",     value: stopped, color: "#f87171" },
          { label: "Processados", value: total,   color: "#a78bfa" },
          { label: "Falhas",      value: failed,  color: "#f87171" },
        ].map((s) => (
          <div key={s.label} className="bg-[#0e0f14] border border-white/[0.07] rounded-sm px-4 py-4 text-center">
            <p className="text-3xl font-black mb-1" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-white/30 uppercase tracking-widest">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Workers */}
      <div className="grid gap-4">
        {MOCK_WORKERS.map((w) => (
          <div key={w.id} className="bg-[#0e0f14] border border-white/[0.07] rounded-sm p-6">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <StatusDot status={w.status} />
                <div>
                  <h3 className="text-base font-bold text-white font-mono">{w.name}</h3>
                  <p className="text-xs text-white/30 mt-0.5">
                    fila: <span className="text-white/50 font-mono">{w.queue}</span> · iniciado{" "}
                    {formatDistanceToNow(new Date(w.startedAt), { locale: ptBR, addSuffix: true })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={w.status} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/[0.03] rounded-sm p-4 text-center">
                <p className="text-2xl font-black text-white">{w.processed}</p>
                <p className="text-[10px] text-white/30 uppercase tracking-wider mt-1">Processados</p>
              </div>
              <div className="bg-white/[0.03] rounded-sm p-4 text-center">
                <p className="text-2xl font-black text-[#f87171]">{w.failed}</p>
                <p className="text-[10px] text-white/30 uppercase tracking-wider mt-1">Falhas</p>
              </div>
              <div className="bg-white/[0.03] rounded-sm p-4 text-center">
                <p className="text-2xl font-black text-[#4ade80]">
                  {w.processed > 0 ? `${(((w.processed - w.failed) / w.processed) * 100).toFixed(1)}%` : "—"}
                </p>
                <p className="text-[10px] text-white/30 uppercase tracking-wider mt-1">Sucesso</p>
              </div>
            </div>

            {/* Barra de sucesso */}
            <div className="mt-4">
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: w.processed > 0 ? `${((w.processed - w.failed) / w.processed) * 100}%` : "0%",
                    background: w.failed === 0 ? "#4ade80" : "#f86d83",
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
