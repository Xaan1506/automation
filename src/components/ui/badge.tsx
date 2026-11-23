import * as React from "react";
import { cn, getStatusColor, getStatusLabel } from "@/lib/utils";

interface BadgeProps {
  status: string;
  className?: string;
  size?: 'sm' | 'default';
}

export function StatusBadge({ status, className, size = 'default' }: BadgeProps) {
  return (
    <span
      className={cn(
        "status-badge border",
        getStatusColor(status),
        size === 'sm' && "text-[10px] px-1.5 py-0",
        className
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
      </span>
      {getStatusLabel(status)}
    </span>
  );
}

interface SelectionCountProps {
  count: number;
  label?: string;
  className?: string;
}

export function SelectionCount({ count, label = "selected", className }: SelectionCountProps) {
  if (count === 0) return null;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
      "bg-newton-primary/20 text-newton-primary border border-newton-primary/30",
      className
    )}>
      {count} {label}
    </span>
  );
}
