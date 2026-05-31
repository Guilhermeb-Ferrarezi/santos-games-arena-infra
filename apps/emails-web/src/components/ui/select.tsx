import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white",
        "focus:outline-none focus:border-[#f86d83]/50 transition-colors cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";
