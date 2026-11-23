import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  SubjectStatus,
  AssignmentStatus,
  QuestionStatus,
  ValidationStatus,
  BatchStatus,
  JobStatus,
  JobStage,
} from "./constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "Never";
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "Never";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    // Assignment / Question statuses
    [AssignmentStatus.NOT_PROCESSED]: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    [AssignmentStatus.QUESTIONS_EXTRACTED]: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    [AssignmentStatus.AI_PROCESSING]: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    [AssignmentStatus.SOLUTIONS_GENERATED]: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    [AssignmentStatus.VALIDATION_COMPLETED]: "bg-green-500/20 text-green-400 border-green-500/30",
    [AssignmentStatus.REQUIRES_REVIEW]: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    [AssignmentStatus.FAILED]: "bg-red-500/20 text-red-400 border-red-500/30",
    [QuestionStatus.VALIDATED]: "bg-green-500/20 text-green-400 border-green-500/30",
    [QuestionStatus.VALIDATION_IN_PROGRESS]: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    // Batch / Job statuses
    [BatchStatus.PENDING]: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    [BatchStatus.RUNNING]: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    [BatchStatus.PAUSED]: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    [BatchStatus.COMPLETED]: "bg-green-500/20 text-green-400 border-green-500/30",
    [BatchStatus.CANCELLED]: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    [JobStatus.RETRYING]: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    // Validation
    [ValidationStatus.PASSED]: "bg-green-500/20 text-green-400 border-green-500/30",
    [ValidationStatus.PARTIAL]: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    [ValidationStatus.ERROR]: "bg-red-500/20 text-red-400 border-red-500/30",
    // Subject
    [SubjectStatus.DISCOVERED]: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    [SubjectStatus.SCANNING]: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    [SubjectStatus.SCANNED]: "bg-green-500/20 text-green-400 border-green-500/30",
  };
  return colors[status] || "bg-gray-500/20 text-gray-400 border-gray-500/30";
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    [AssignmentStatus.NOT_PROCESSED]: "Not Processed",
    [AssignmentStatus.QUESTIONS_EXTRACTED]: "Extracted",
    [AssignmentStatus.AI_PROCESSING]: "AI Processing",
    [AssignmentStatus.SOLUTIONS_GENERATED]: "Solutions Ready",
    [AssignmentStatus.VALIDATION_COMPLETED]: "Validated",
    [AssignmentStatus.REQUIRES_REVIEW]: "Needs Review",
    [AssignmentStatus.FAILED]: "Failed",
    [BatchStatus.PENDING]: "Pending",
    [BatchStatus.RUNNING]: "Running",
    [BatchStatus.PAUSED]: "Paused",
    [BatchStatus.COMPLETED]: "Completed",
    [BatchStatus.CANCELLED]: "Cancelled",
    [SubjectStatus.DISCOVERED]: "Discovered",
    [SubjectStatus.SCANNING]: "Scanning",
    [SubjectStatus.SCANNED]: "Scanned",
    [ValidationStatus.PASSED]: "Passed",
    [ValidationStatus.PARTIAL]: "Partial",
    [ValidationStatus.ERROR]: "Error",
    [JobStatus.RETRYING]: "Retrying",
    [QuestionStatus.VALIDATED]: "Validated",
    [QuestionStatus.VALIDATION_IN_PROGRESS]: "Validating",
  };
  return labels[status] || status;
}

export async function sha256(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function exponentialBackoff(retryCount: number, baseMs = 1000, maxMs = 30000): number {
  const delay = Math.min(baseMs * Math.pow(2, retryCount), maxMs);
  return delay + Math.random() * 1000; // jitter
}
