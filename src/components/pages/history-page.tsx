"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { History, RefreshCw, Layers, CheckCircle2, AlertCircle, Clock, ExternalLink } from "lucide-react";
import { formatDate, formatDuration, formatRelativeTime } from "@/lib/utils";
import Link from "next/link";
import toast from "react-hot-toast";

interface HistoryBatch {
  id: string;
  name: string;
  status: string;
  totalAssignments: number;
  totalQuestions: number;
  processedCount: number;
  failedCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  assignments: Array<{
    subject: { name: string; code: string | null };
    assignment: { title: string };
  }>;
}

interface HistoryJob {
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
    solutions: Array<{
      validationStatus: string;
      passedTestCases: number;
      totalTestCases: number;
    }>;
  };
}

export function HistoryPage() {
  const [batches, setBatches] = useState<HistoryBatch[]>([]);
  const [jobs, setJobs] = useState<HistoryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"batches" | "jobs">("batches");

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      setBatches(data.batches || []);
      setJobs(data.jobs || []);
    } catch {
      toast.error("Failed to load history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Execution History</h1>
          <p className="text-gray-400 text-sm mt-1">Audit log of completed batches and processed questions</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchHistory} loading={loading}>
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      <div className="flex gap-2 border-b border-white/10 pb-3">
        <button
          onClick={() => setActiveTab("batches")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "batches"
              ? "bg-newton-primary text-white"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          Batches ({batches.length})
        </button>
        <button
          onClick={() => setActiveTab("jobs")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "jobs"
              ? "bg-newton-primary text-white"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          Processed Questions ({jobs.length})
        </button>
      </div>

      {activeTab === "batches" && (
        <div className="space-y-3">
          {batches.map((batch) => {
            const duration =
              batch.startedAt && batch.completedAt
                ? new Date(batch.completedAt).getTime() - new Date(batch.startedAt).getTime()
                : null;

            return (
              <Card key={batch.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-newton-primary" />
                      <span className="font-semibold text-white text-base">{batch.name}</span>
                      <StatusBadge status={batch.status} />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Started: {batch.startedAt ? formatDate(batch.startedAt) : "Not started"} ·{" "}
                      {duration !== null && `Duration: ${formatDuration(duration)} · `}
                      Created: {formatRelativeTime(batch.createdAt)}
                    </div>
                  </div>
                  <Link href={`/queue?batchId=${batch.id}`}>
                    <Button variant="outline" size="sm" className="text-xs">
                      View Queue Logs
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                </div>

                <div className="grid grid-cols-4 gap-3 mt-4 text-center">
                  <div className="glass-card p-2">
                    <div className="text-sm font-bold text-blue-400">{batch.totalAssignments}</div>
                    <div className="text-[10px] text-gray-500">Assignments</div>
                  </div>
                  <div className="glass-card p-2">
                    <div className="text-sm font-bold text-yellow-400">{batch.totalQuestions}</div>
                    <div className="text-[10px] text-gray-500">Total Questions</div>
                  </div>
                  <div className="glass-card p-2">
                    <div className="text-sm font-bold text-green-400">{batch.processedCount}</div>
                    <div className="text-[10px] text-gray-500">Success</div>
                  </div>
                  <div className="glass-card p-2">
                    <div className="text-sm font-bold text-red-400">{batch.failedCount}</div>
                    <div className="text-[10px] text-gray-500">Failed</div>
                  </div>
                </div>

                {batch.assignments.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {batch.assignments.map((ba, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-gray-300"
                      >
                        [{ba.subject.code || ba.subject.name}] {ba.assignment.title}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
          {!loading && batches.length === 0 && (
            <Card className="text-center py-16">
              <CardContent>
                <History className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No batch history yet</h3>
                <p className="text-gray-400 text-sm">Completed processing batches will appear here.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "jobs" && (
        <div className="space-y-2">
          {jobs.map((job) => {
            const solution = job.question.solutions[0];
            const duration =
              job.startedAt && job.completedAt
                ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
                : null;

            return (
              <Card key={job.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    {job.status === "COMPLETED" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div>
                      <div className="text-sm font-medium text-white">{job.question.title}</div>
                      <div className="text-xs text-gray-500">
                        {job.question.assignment.subject.code || job.question.assignment.subject.name} ·{" "}
                        {job.question.assignment.title}
                      </div>
                      {job.errorMessage && (
                        <div className="text-xs text-red-400 mt-1 font-mono">{job.errorMessage}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 text-right">
                    {duration !== null && (
                      <span className="text-[11px] text-gray-400 font-mono">{formatDuration(duration)}</span>
                    )}
                    {solution && <StatusBadge status={solution.validationStatus} size="sm" />}
                    <StatusBadge status={job.status} size="sm" />
                  </div>
                </div>
              </Card>
            );
          })}
          {!loading && jobs.length === 0 && (
            <Card className="text-center py-16">
              <CardContent>
                <History className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No question job logs yet</h3>
                <p className="text-gray-400 text-sm">Individual processed questions will appear here.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
