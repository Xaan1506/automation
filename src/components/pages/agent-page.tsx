"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, CircleStop, Loader2, Pause, Play, Send, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const INITIAL_INSTRUCTION =
  "Open ASD - Hopper, find all assignment groups, open each coding question, extract the visible problem statements and organise them by assignment.";

interface AgentAction {
  id: string;
  sequence: number;
  action: string;
  summary: string;
  status: string;
  verified: boolean;
  currentUrl: string | null;
  startedAt: string;
}

interface AgentTask {
  id: string;
  instruction: string;
  status: string;
  subjectId: string | null;
  currentUrl: string | null;
  currentSubject: string | null;
  currentAssignment: string | null;
  progress: number;
  total: number;
  result: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  actions?: AgentAction[];
}

const activeStatuses = new Set(["QUEUED", "RUNNING", "PAUSED", "CANCELLING"]);

export function AgentPage() {
  const [instruction, setInstruction] = useState(INITIAL_INSTRUCTION);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      const response = await fetch("/api/agent/tasks", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load agent history.");
      const loadedTasks = data.tasks as AgentTask[];
      setTasks(loadedTasks);
      setLoadError(null);
      setSelectedTaskId((current) =>
        current && loadedTasks.some((task) => task.id === current)
          ? current
          : loadedTasks[0]?.id || null
      );
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load agent history.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSelectedTask = useCallback(async (taskId: string) => {
    try {
      const response = await fetch(`/api/agent/tasks/${taskId}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load agent activity.");
      setSelectedTask(data.task as AgentTask);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load agent activity.");
    }
  }, []);

  useEffect(() => {
    void loadTasks();
    const timer = window.setInterval(() => void loadTasks(), 3000);
    return () => window.clearInterval(timer);
  }, [loadTasks]);

  useEffect(() => {
    setSelectedTask(null);
    if (!selectedTaskId) return;
    void loadSelectedTask(selectedTaskId);
    const timer = window.setInterval(() => void loadSelectedTask(selectedTaskId), 1000);
    return () => window.clearInterval(timer);
  }, [loadSelectedTask, selectedTaskId]);

  const handleStart = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!instruction.trim() || starting) return;

    setStarting(true);
    try {
      const response = await fetch("/api/agent/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: instruction.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start the browser agent.");
      setInstruction("");
      setSelectedTaskId(data.task.id);
      await loadTasks();
      toast.success("Read-only browser task started.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the browser agent.");
    } finally {
      setStarting(false);
    }
  };

  const handleControl = async (command: "pause" | "resume" | "cancel") => {
    if (!selectedTask) return;
    try {
      const response = await fetch(`/api/agent/tasks/${selectedTask.id}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Could not ${command} the task.`);
      await loadSelectedTask(selectedTask.id);
      await loadTasks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Could not ${command} the task.`);
    }
  };

  const result = useMemo(() => {
    if (!selectedTask?.result) return null;
    try {
      return JSON.parse(selectedTask.result) as {
        assignmentsFound: number;
        questionsFound: number;
        warnings: string[];
      };
    } catch {
      return null;
    }
  }, [selectedTask?.result]);

  const isActive = selectedTask ? activeStatuses.has(selectedTask.status) : false;
  const progressValue = selectedTask?.total
    ? Math.min(100, (selectedTask.progress / selectedTask.total) * 100)
    : 0;

  return (
    <div className="p-6 space-y-5">
      <header className="flex items-start gap-3">
        <div className="rounded-xl border border-newton-primary/30 bg-newton-primary/10 p-2.5">
          <Bot className="h-5 w-5 text-newton-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Browser Agent</h1>
          <p className="mt-1 text-sm text-gray-400">
            Give the read-only agent a Newton assignment task in plain language.
          </p>
        </div>
      </header>

      <Card>
        <CardContent className="space-y-3 p-4">
          <form onSubmit={handleStart} className="space-y-3">
            <label htmlFor="agent-instruction" className="text-sm font-medium text-gray-200">
              Task instruction
            </label>
            <textarea
              id="agent-instruction"
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              maxLength={2000}
              rows={3}
              className="w-full resize-y rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white outline-none focus:border-newton-primary"
              placeholder="For example: Open ASD - Hopper and organize visible coding questions by assignment."
            />
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-xs text-gray-400">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Reads visible Newton content only; never submits or changes assignments.
              </p>
              <Button type="submit" disabled={!instruction.trim() || starting}>
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Start task
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {loadError && (
        <div role="alert" className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">
          {loadError}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(240px,0.8fr)_minmax(0,2fr)]">
        <Card className="min-h-72">
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">Task history</h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-newton-primary" />
              </div>
            ) : tasks.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No agent tasks yet.</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setSelectedTaskId(task.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selectedTaskId === task.id
                        ? "border-newton-primary/40 bg-newton-primary/10"
                        : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="block truncate text-xs text-gray-200">{task.instruction}</span>
                    <span className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                      <span>{task.status}</span>
                      <span>{new Date(task.createdAt).toLocaleString()}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-72">
          <CardContent className="space-y-4 p-4">
            {!selectedTask ? (
              <p className="py-10 text-center text-sm text-gray-500">Start or select a task to view activity.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-white">{selectedTask.status}</h2>
                      {isActive && <Loader2 className="h-4 w-4 animate-spin text-newton-primary" />}
                    </div>
                    <p className="mt-1 break-words text-xs text-gray-400">{selectedTask.instruction}</p>
                  </div>
                  <div className="flex gap-2">
                    {selectedTask.status === "RUNNING" && (
                      <Button variant="outline" size="sm" onClick={() => void handleControl("pause")}>
                        <Pause className="h-3.5 w-3.5" />
                        Pause
                      </Button>
                    )}
                    {selectedTask.status === "PAUSED" && (
                      <Button variant="outline" size="sm" onClick={() => void handleControl("resume")}>
                        <Play className="h-3.5 w-3.5" />
                        Resume
                      </Button>
                    )}
                    {isActive && selectedTask.status !== "CANCELLING" && (
                      <Button variant="destructive" size="sm" onClick={() => void handleControl("cancel")}>
                        <CircleStop className="h-3.5 w-3.5" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <div className="text-[11px] text-gray-500">Current section</div>
                    <div className="mt-1 truncate text-sm text-gray-200">{selectedTask.currentSubject || "—"}</div>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <div className="text-[11px] text-gray-500">Current assignment</div>
                    <div className="mt-1 truncate text-sm text-gray-200">{selectedTask.currentAssignment || "—"}</div>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <div className="text-[11px] text-gray-500">Current URL</div>
                    {selectedTask.currentUrl ? (
                      <a
                        href={selectedTask.currentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block truncate text-sm text-newton-primary hover:underline"
                      >
                        {selectedTask.currentUrl}
                      </a>
                    ) : (
                      <div className="mt-1 text-sm text-gray-200">—</div>
                    )}
                  </div>
                </div>

                {selectedTask.total > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Question progress</span>
                      <span>{selectedTask.progress}/{selectedTask.total}</span>
                    </div>
                    <Progress value={progressValue} className="h-1.5" />
                  </div>
                )}

                {selectedTask.errorMessage && (
                  <div role="alert" className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">
                    {selectedTask.errorMessage}
                  </div>
                )}
                {result && (
                  <p className="text-sm text-emerald-300">
                    Verified {result.assignmentsFound} assignment groups and {result.questionsFound} questions.
                  </p>
                )}

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(250px,1fr)]">
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Live browser screenshot
                    </h3>
                    <div className="flex min-h-40 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/20">
                      <img
                        key={`${selectedTask.id}-${selectedTask.updatedAt}`}
                        src={`/api/agent/tasks/${selectedTask.id}/screenshot?v=${encodeURIComponent(selectedTask.updatedAt)}`}
                        alt="Latest Newton browser screenshot"
                        className="h-auto max-h-[480px] w-full object-contain"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500">
                      Screenshots stay in this app and are not sent to the AI planner.
                    </p>
                  </section>

                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Verified action history
                    </h3>
                    <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
                      {(selectedTask.actions || []).map((action) => (
                        <div key={action.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-gray-200">{action.action.replaceAll("_", " ")}</span>
                            <span className={action.verified ? "text-[10px] text-emerald-400" : "text-[10px] text-red-400"}>
                              {action.verified ? "verified" : "not verified"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-gray-400">{action.summary}</p>
                        </div>
                      ))}
                      {(!selectedTask.actions || selectedTask.actions.length === 0) && (
                        <p className="py-6 text-center text-xs text-gray-500">No browser actions recorded yet.</p>
                      )}
                    </div>
                  </section>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
