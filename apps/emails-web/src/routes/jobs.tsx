import { Zap } from "lucide-react";

export function JobsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-white">Jobs</h1>
        <p className="text-sm text-white/35 mt-1">Fila de background jobs</p>
      </div>

      <div className="bg-[#0e0f14] border border-white/[0.07] rounded-sm flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 rounded-sm bg-white/5 flex items-center justify-center">
          <Zap size={22} className="text-white/20" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-white/40">Sistema de filas não configurado</p>
          <p className="text-xs text-white/20 mt-1">Os e-mails são enviados de forma síncrona no momento.</p>
        </div>
      </div>
    </div>
  );
}
