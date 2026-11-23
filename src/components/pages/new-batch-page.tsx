"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { useSelectionStore } from "@/store/selection-store";
import {
  Layers, ChevronRight, ChevronLeft, AlertTriangle,
  CheckCircle2, HelpCircle, FileText, BookOpen,
  Loader2, Settings, Play
} from "lucide-react";
import toast from "react-hot-toast";

interface SubjectWithAssignments {
  id: string;
  name: string;
  code: string | null;
  assignments: Array<{
    id: string;
    title: string;
    externalId: string;
    processingStatus: string;
    _count: { questions: number };
  }>;
}

interface BatchConfig {
  maxConcurrentAI: number;
  maxConcurrentBrowser: number;
  maxRetries: number;
}

export function NewBatchPage() {
  const router = useRouter();
  const {
    selectedSubjectIds,
    selectedAssignmentIds,
    isAssignmentSelected,
    toggleAssignment,
    selectAllAssignments,
    deselectAllAssignments,
    setBatchName,
    batchName,
    clearAll,
  } = useSelectionStore();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [subjects, setSubjects] = useState<SubjectWithAssignments[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [config, setConfig] = useState<BatchConfig>({
    maxConcurrentAI: 3,
    maxConcurrentBrowser: 2,
    maxRetries: 3,
  });

  // Fetch selected subjects with their assignments
  useEffect(() => {
    if (selectedSubjectIds.size === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const fetchAll = async () => {
      const results: SubjectWithAssignments[] = [];
      for (const subjectId of Array.from(selectedSubjectIds)) {
        try {
          const res = await fetch(`/api/subjects/${subjectId}`);
          const data = await res.json();
          if (data.subject) {
            results.push({
              id: data.subject.id,
              name: data.subject.name,
              code: data.subject.code,
              assignments: data.subject.assignments || [],
            });
          }
        } catch {}
      }
      setSubjects(results);
      setLoading(false);
    };
    fetchAll();
  }, [selectedSubjectIds]);

  // All assignment IDs across selected subjects
  const allAssignmentIds = subjects.flatMap((s) => s.assignments.map((a) => a.id));
  const selectedCount = allAssignmentIds.filter((id) => selectedAssignmentIds.has(id)).length;
  const totalQuestions = subjects
    .flatMap((s) => s.assignments)
    .filter((a) => selectedAssignmentIds.has(a.id))
    .reduce((sum, a) => sum + a._count.questions, 0);

  const handleCreateBatch = async () => {
    const assignmentIds = allAssignmentIds.filter((id) => selectedAssignmentIds.has(id));
    if (assignmentIds.length === 0) {
      toast.error("Please select at least one assignment");
      return;
    }

    setCreating(true);
    try {
      const name = batchName || `Batch ${new Date().toLocaleString("en-IN")}`;
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name,
          assignmentIds,
          config,
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        setBatchId(data.batchId);
        setStep(3);
      }
    } catch (err) {
      toast.error("Failed to create batch");
    } finally {
      setCreating(false);
    }
  };

  const handleStartBatch = async () => {
    if (!batchId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", batchId }),
      });
      const data = await res.json();
      toast.success("Batch started!");
      router.push(`/queue?batchId=${batchId}`);
    } finally {
      setCreating(false);
    }
  };

  if (selectedSubjectIds.size === 0) {
    return (
      <div className="p-6">
        <Card className="text-center py-16">
          <CardContent>
            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No subjects selected</h3>
            <p className="text-gray-400 text-sm mb-6">
              Please select subjects first, then come back to create a batch.
            </p>
            <Button onClick={() => router.push("/subjects")}>
              <BookOpen className="w-4 h-4" />
              Go to Subjects
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">Create New Batch</h1>
          <p className="text-gray-400 text-sm">Step {step} of 3</p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex gap-3">
        {[
          { n: 1, label: "Select Assignments" },
          { n: 2, label: "Configure & Review" },
          { n: 3, label: "Confirm & Start" },
        ].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              step >= n ? "bg-newton-primary text-white" : "bg-white/10 text-gray-500"
            }`}>{n}</div>
            <span className={`text-sm ${step >= n ? "text-white" : "text-gray-500"}`}>{label}</span>
            {n < 3 && <ChevronRight className="w-4 h-4 text-gray-600" />}
          </div>
        ))}
      </div>

      {/* STEP 1: Assignment Selection */}
      {step === 1 && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-newton-primary" />
            </div>
          ) : (
            subjects.map((subject) => {
              const subjectAssignmentIds = subject.assignments.map((a) => a.id);
              const allSubjSelected = subjectAssignmentIds.length > 0 &&
                subjectAssignmentIds.every((id) => selectedAssignmentIds.has(id));

              return (
                <Card key={subject.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <BookOpen className="w-4 h-4 text-newton-primary" />
                        {subject.name}
                        {subject.code && (
                          <span className="text-xs text-newton-primary bg-newton-primary/10 px-1.5 py-0.5 rounded">
                            {subject.code}
                          </span>
                        )}
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => {
                          if (allSubjSelected) deselectAllAssignments(subject.id, subjectAssignmentIds);
                          else selectAllAssignments(subjectAssignmentIds);
                        }}
                      >
                        {allSubjSelected ? "Deselect All" : "Select All"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {subject.assignments.length === 0 ? (
                        <p className="text-sm text-gray-500">No assignments found for this subject.</p>
                      ) : (
                        subject.assignments.map((assignment) => {
                          const isSelected = isAssignmentSelected(assignment.id);
                          return (
                            <label
                              key={assignment.id}
                              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                                isSelected
                                  ? "bg-newton-primary/10 border border-newton-primary/30"
                                  : "bg-white/5 hover:bg-white/10 border border-transparent"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleAssignment(assignment.id)}
                                className="w-4 h-4 accent-newton-primary"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-white truncate">
                                  {assignment.title}
                                </div>
                                <div className="text-xs text-gray-500">
                                  ID: {assignment.externalId}
                                  {" · "}
                                  {assignment._count.questions} questions
                                </div>
                              </div>
                              <StatusBadge status={assignment.processingStatus} size="sm" />
                            </label>
                          );
                        })
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}

          <div className="flex justify-between pt-2">
            <div className="text-sm text-gray-400">
              {selectedCount} assignment(s) selected · {totalQuestions} total questions
            </div>
            <Button onClick={() => setStep(2)} disabled={selectedCount === 0}>
              Next: Configure
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: Configure */}
      {step === 2 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Batch Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-gray-300 block mb-1">Batch Name</label>
                <Input
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder={`Batch ${new Date().toLocaleString("en-IN")}`}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-gray-300 block mb-1">AI Concurrency</label>
                  <Input
                    type="number"
                    min={1} max={10}
                    value={config.maxConcurrentAI}
                    onChange={(e) => setConfig({ ...config, maxConcurrentAI: parseInt(e.target.value) || 3 })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Parallel AI requests</p>
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-1">Browser Concurrency</label>
                  <Input
                    type="number"
                    min={1} max={5}
                    value={config.maxConcurrentBrowser}
                    onChange={(e) => setConfig({ ...config, maxConcurrentBrowser: parseInt(e.target.value) || 2 })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Parallel browser tasks</p>
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-1">Max Retries</label>
                  <Input
                    type="number"
                    min={0} max={10}
                    value={config.maxRetries}
                    onChange={(e) => setConfig({ ...config, maxRetries: parseInt(e.target.value) || 3 })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Retry failed jobs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Processing Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card p-3 text-center">
                  <div className="text-2xl font-bold text-newton-primary">{selectedSubjectIds.size}</div>
                  <div className="text-xs text-gray-400">Subjects Selected</div>
                </div>
                <div className="glass-card p-3 text-center">
                  <div className="text-2xl font-bold text-blue-400">{selectedCount}</div>
                  <div className="text-xs text-gray-400">Assignments Selected</div>
                </div>
                <div className="glass-card p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-400">{totalQuestions}</div>
                  <div className="text-xs text-gray-400">Total Questions</div>
                </div>
                <div className="glass-card p-3 text-center">
                  <div className="text-2xl font-bold text-purple-400">{totalQuestions * 2}</div>
                  <div className="text-xs text-gray-400">Est. API Calls</div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <h4 className="text-xs font-medium text-gray-400">Selected Assignments:</h4>
                {subjects.map((s) =>
                  s.assignments
                    .filter((a) => selectedAssignmentIds.has(a.id))
                    .map((a) => (
                      <div key={a.id} className="flex items-center gap-2 text-xs text-gray-300">
                        <FileText className="w-3 h-3 text-gray-500" />
                        <span className="text-gray-500">[{s.code || s.name}]</span>
                        {a.title}
                        <span className="text-gray-500">({a._count.questions} qs)</span>
                      </div>
                    ))
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
            <Button onClick={handleCreateBatch} loading={creating}>
              Create Batch
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Confirm & Start */}
      {step === 3 && batchId && (
        <Card className="text-center py-10">
          <CardContent className="space-y-4">
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto" />
            <h3 className="text-xl font-bold text-white">Batch Created!</h3>
            <p className="text-gray-400 text-sm">
              Batch ID: <code className="text-newton-primary font-mono text-xs">{batchId}</code>
            </p>
            <p className="text-gray-400 text-sm">
              {selectedCount} assignments · {totalQuestions} questions ready to process
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <Button variant="outline" onClick={() => router.push("/batch")}>
                View All Batches
              </Button>
              <Button onClick={handleStartBatch} loading={creating}>
                <Play className="w-4 h-4" />
                Start Processing Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
