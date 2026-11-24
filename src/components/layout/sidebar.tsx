"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  HelpCircle,
  Sparkles,
  Layers,
  ListTodo,
  History,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  Zap,
  LogOut,
  Bot,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Overview" },
  { href: "/subjects", icon: BookOpen, label: "Subjects" },
  { href: "/assignments", icon: FileText, label: "Assignments" },
  { href: "/questions", icon: HelpCircle, label: "Question Bank" },
  { href: "/agent", icon: Bot, label: "Browser Agent" },
  { href: "/solutions", icon: Sparkles, label: "AI Solutions" },
  { href: "/batch", icon: Layers, label: "Batch Processing" },
  { href: "/queue", icon: ListTodo, label: "Processing Queue" },
  { href: "/history", icon: History, label: "History" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/login", { method: "DELETE" });
      router.push("/login");
      router.refresh();
    } catch {}
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-newton-darker border-r border-white/10 transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-newton-primary/20 border border-newton-primary/30 flex items-center justify-center">
          <Zap className="w-4 h-4 text-newton-primary" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">Newton AI</div>
            <div className="text-[10px] text-gray-500">Assignment Solver</div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto flex-shrink-0 text-gray-500 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* New Batch CTA */}
      <div className="px-3 py-3 border-b border-white/10">
        <Link
          href="/batch/new"
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
            "bg-newton-primary/20 text-newton-primary border border-newton-primary/30",
            "hover:bg-newton-primary/30",
            collapsed && "justify-center px-2"
          )}
        >
          <Plus className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Create New Batch</span>}
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "nav-item",
                isActive && "active",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-white/10 space-y-2">
        <button
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-red-400/80 hover:text-red-300 hover:bg-red-500/10 transition-colors",
            collapsed && "justify-center px-0"
          )}
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
        {!collapsed ? (
          <div className="text-[10px] text-gray-600 text-center">
            Newton Assignment AI v0.1
          </div>
        ) : null}
      </div>
    </aside>
  );
}
