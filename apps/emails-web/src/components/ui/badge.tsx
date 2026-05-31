import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "info" | "success" | "danger" | "warning" | "muted";

const styles: Record<BadgeVariant, string> = {
  default: "bg-[#f86d83]/[0.13] text-[#f86d83] border-[#f86d83]/25",
  info:    "bg-[#60a5fa]/[0.13] text-[#60a5fa] border-[#60a5fa]/25",
  success: "bg-[#4ade80]/[0.13] text-[#4ade80] border-[#4ade80]/25",
  danger:  "bg-[#f87171]/[0.13] text-[#f87171] border-[#f87171]/25",
  warning: "bg-[#facc15]/[0.13] text-[#facc15] border-[#facc15]/25",
  muted:   "bg-white/5 text-white/40 border-white/10",
};

export function Badge({ children, variant = "default", className }: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border rounded-sm",
      styles[variant], className
    )}>
      {children}
    </span>
  );
}
