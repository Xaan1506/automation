"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ListTodo, RefreshCw, Loader2, Clock, AlertCircle, CheckCircle2
} from "lucide-react";
import { formatDuration, formatRelativeTime } from "@/lib/utils";
import toast from "react-hot-toast";

interface Job {
  id: string;
  stage: string;
  status: string;
  retryCount: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  question: {
    id: string;
    title: string;
    assignment: {
      title: string;
      subject: { name: string; code: string | null };
    };
  };
  batch: { id: string; name: string; status: string } | null;
}

interface QueueSummary {
  status: string;
  _count: { _all: number };
}

const STAGE_LABELS: Record<string, string> = {
  QUEUED: "Queued",
  EXTRACTING: "Extracting",
  GENERATING_SOLUTION: "Generating Solution",
  GENERATING_TESTS: "Generating Tests",
  VALIDATING: "Validating",
  SAVING: "Saving",
  COMPLETED: "Done",
};

const STAGE_PROGRESS: Record<string, number> = {
  QUEUED: 0,
  EXTRACTING: 15,
  GENERATING_SOLUTION: 40,
  GENERATING_TESTS: 65,
  VALIDATING: 85,
  SAVING: 95,
  COMPLETED: 100,
};

export function QueuePage() {
  const searchParams = useSearchParams();
  const batchId = searchParams.get("batchId");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [summary, setSummary] = useState<QueueSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (batchId) params.set("batchId", batchId);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/queue?${params}`);
      const data = await res.json();
      setJobs(data.jobs || []);
      setSummary(data.summary || []);
    } catch {
      toast.error("Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, [batchId, statusFilter]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  // Auto-refresh every 3s when active jobs exist
  useEffect(() => {
    if (!autoRefresh) return;
    const hasActive = jobs.some((j) => j.status === "RUNNING" || j.status === "PENDING");
    if (!hasActive) return;
    const interval = setInterval(fetchQueue, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, jobs, fetchQueue]);

  const summaryMap = Object.fromEntries(summary.map((s) => [s.status, s._count._all]));

  const statusColors: Record<string, string> = {
    PENDING: "text-gray-400",
    RUNNING: "text-blue-400",
    COMPLETED: "text-green-400",
    FAILED: "text-red-400",
    CANCELLED: "text-gray-500",
    RETRYING: "text-yellow-400",
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Processing Queue</h1>
          <p className="text-gray-400 text-sm mt-1">
            {batchId ? `Batch: ${batchId}` : "All processing jobs"}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-newton-primary"
            />
            Auto-refresh
          </label>
          <Button variant="outline" size="sm" onClick={fetchQueue} loading={loading}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex gap-3 flex-wrap">
        {Object.entries(summaryMap).map(([status, count]) => (
          <button
            key={status}
            onClick={() => setStatusFilter(statusFilter === status ? "" : status)}
            className={`glass-card px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === status ? "border-newton-primary/50 bg-newton-primary/10" : ""
            } ${statusColors[status] || "text-gray-400"}`}
          >
            {status.charAt(0) + status.slice(1).toLowerCase()}: {count}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 px-3 rounded-lg border border-white/20 bg-white/5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-newton-primary"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="RUNNING">Running</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
          <option value="RETRYING">Retrying</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-newton-primary" />
        </div>
      )}

      <div className="space-y-2">
        {jobs.map((job) => {
          const duration = job.startedAt
            ? job.completedAt
              ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
              : Date.now() - new Date(job.startedAt).getTime()
            : null;

          const progress = STAGE_PROGRESS[job.stage] || 0;

          return (
            <Card key={job.id} className="p-3">
              <div className="flex items-start gap-3">
                {/* Status icon */}
                <div className="mt-0.5 flex-shrink-0">
                  {job.status === "RUNNING" && (
                    <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  )}
                  {job.status === "COMPLETED" && (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  )}
                  {job.status === "FAILED" && (
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  )}
                  {(job.status === "PENDING" || job.status === "RETRYING") && (
                    <Clock className="w-5 h-5 text-gray-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <div className="text-sm font-medium text-white truncate">
                        {job.question.title}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {job.question.assignment.subject.code || job.question.assignment.subject.name}
                        {" · "}
                        {job.question.assignment.title}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {job.retryCount > 0 && (
                        <span className="text-[10px] text-yellow-400">↻{job.retryCount}</span>
                      )}
                      <StatusBadge status={job.status} size="sm" />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[10px] text-gray-500 mb-2">
                    <span>Stage: {STAGE_LABELS[job.stage] || job.stage}</span>
                    {duration !== null && <span>⏱ {formatDuration(duration)}</span>}
                    {job.batch && <span>Batch: {job.batch.name}</span>}
                    <span>Queued {formatRelativeTime(job.createdAt)}</span>
                  </div>

                  {job.status === "RUNNING" && (
                    <div>
                      <Progress value={progress} className="h-1" />
                    </div>
                  )}

                  {job.errorMessage && (
                    <div className="mt-1 text-xs text-red-400 bg-red-500/10 rounded px-2 py-1">
                      {job.errorMessage}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {!loading && jobs.length === 0 && (
        <Card className="text-center py-16">
          <CardContent>
            <ListTodo className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Queue is empty</h3>
            <p className="text-gray-400 text-sm">Start a batch to see processing jobs here.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
