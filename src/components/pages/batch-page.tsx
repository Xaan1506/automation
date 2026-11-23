"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useSelectionStore } from "@/store/selection-store";
import {
  Layers, RefreshCw, Plus, Play, Pause, StopCircle,
  RotateCcw, ChevronRight, Loader2, AlertCircle, CheckCircle2,
  Clock, FileText, HelpCircle
} from "lucide-react";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import toast from "react-hot-toast";

interface Batch {
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
  _count: { assignments: number; jobs: number };
}

export function BatchPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const router = useRouter();

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/batches");
      const data = await res.json();
      setBatches(data.batches || []);
    } catch {
      toast.error("Failed to load batches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  const handleAction = async (batchId: string, action: string) => {
    setActioningId(batchId);
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, batchId }),
      });
      const data = await res.json();
      if (data.error) toast.error(data.error);
      else {
        toast.success(data.message);
        setTimeout(fetchBatches, 1000);
      }
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Batch Processing</h1>
          <p className="text-gray-400 text-sm mt-1">Manage multi-subject batch processing jobs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchBatches} loading={loading}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => router.push("/batch/new")}>
            <Plus className="w-3.5 h-3.5" />
            New Batch
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-newton-primary" />
        </div>
      )}

      <div className="space-y-4">
        {batches.map((batch) => {
          const pct = batch.totalQuestions
            ? Math.round((batch.processedCount / batch.totalQuestions) * 100)
            : 0;
          const isActioning = actioningId === batch.id;

          return (
            <Card key={batch.id}>
              <CardContent>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{batch.name}</span>
                      <StatusBadge status={batch.status} />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Created {formatRelativeTime(batch.createdAt)}
                      {batch.startedAt && ` · Started ${formatRelativeTime(batch.startedAt)}`}
                      {batch.completedAt && ` · Completed ${formatRelativeTime(batch.completedAt)}`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {batch.status === "PENDING" && (
                      <Button size="sm" variant="success" loading={isActioning} onClick={() => handleAction(batch.id, "start")}>
                        <Play className="w-3.5 h-3.5" />
                        Start
                      </Button>
                    )}
                    {batch.status === "RUNNING" && (
                      <>
                        <Button size="sm" variant="warning" loading={isActioning} onClick={() => handleAction(batch.id, "pause")}>
                          <Pause className="w-3.5 h-3.5" />
                          Pause
                        </Button>
                        <Button size="sm" variant="destructive" loading={isActioning} onClick={() => handleAction(batch.id, "cancel")}>
                          <StopCircle className="w-3.5 h-3.5" />
                          Cancel
                        </Button>
                      </>
                    )}
                    {batch.status === "PAUSED" && (
                      <Button size="sm" loading={isActioning} onClick={() => handleAction(batch.id, "resume")}>
                        <Play className="w-3.5 h-3.5" />
                        Resume
                      </Button>
                    )}
                    {(batch.status === "FAILED" || batch.failedCount > 0) && (
                      <Button size="sm" variant="outline" loading={isActioning} onClick={() => handleAction(batch.id, "retry")}>
                        <RotateCcw className="w-3.5 h-3.5" />
                        Retry Failed
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Assignments", value: batch.totalAssignments, icon: FileText, color: "text-blue-400" },
                    { label: "Questions", value: batch.totalQuestions, icon: HelpCircle, color: "text-yellow-400" },
                    { label: "Processed", value: batch.processedCount, icon: CheckCircle2, color: "text-green-400" },
                    { label: "Failed", value: batch.failedCount, icon: AlertCircle, color: "text-red-400" },
                  ].map((m) => (
                    <div key={m.label} className="glass-card p-3 text-center">
                      <m.icon className={`w-4 h-4 ${m.color} mx-auto mb-1`} />
                      <div className={`text-lg font-bold ${m.color}`}>{m.value}</div>
                      <div className="text-[10px] text-gray-500">{m.label}</div>
                    </div>
                  ))}
                </div>

                {batch.totalQuestions > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Progress</span>
                      <span>{pct}%</span>
                    </div>
                    <Progress value={pct} />
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => router.push(`/queue?batchId=${batch.id}`)}
                  >
                    View Queue
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!loading && batches.length === 0 && (
        <Card className="text-center py-16">
          <CardContent>
            <Layers className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No batches yet</h3>
            <p className="text-gray-400 text-sm mb-6">
              Select subjects and assignments to create a processing batch.
            </p>
            <Button onClick={() => router.push("/batch/new")}>
              <Plus className="w-4 h-4" />
              Create New Batch
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
