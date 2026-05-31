import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  page: number;
  pages: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
};

export function Pagination({ page, pages, total, limit, onChange }: Props) {
  if (pages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <span className="text-xs text-white/30">
        {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="w-7 h-7 flex items-center justify-center rounded-sm text-white/40 hover:text-white/80 hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={14} />
        </button>

        {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
          let p: number;
          if (pages <= 7) {
            p = i + 1;
          } else if (page <= 4) {
            p = i + 1 === 7 ? pages : i + 1;
          } else if (page >= pages - 3) {
            p = i === 0 ? 1 : pages - 6 + i;
          } else {
            const mid = [1, page - 1, page, page + 1, pages];
            p = [1, page - 1, page, page + 1, pages, -1, -1][i] ?? -1;
            if (i === 1 && page - 1 > 2) p = -1;
            if (i === 3 && page + 1 < pages - 1) p = -1;
            void mid;
          }
          if (p === -1) {
            return <span key={i} className="w-7 h-7 flex items-center justify-center text-white/20 text-xs">…</span>;
          }
          return (
            <button
              key={i}
              onClick={() => onChange(p)}
              className={`w-7 h-7 flex items-center justify-center rounded-sm text-xs font-medium transition-colors ${
                p === page
                  ? "bg-[#f86d83]/15 text-[#f86d83]"
                  : "text-white/40 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              {p}
            </button>
          );
        })}

        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= pages}
          className="w-7 h-7 flex items-center justify-center rounded-sm text-white/40 hover:text-white/80 hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
