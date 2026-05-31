import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white placeholder:text-white/25",
        "focus:outline-none focus:border-[#f86d83]/50 transition-colors",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
