"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, SelectionCount } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useSelectionStore } from "@/store/selection-store";
import {
  BookOpen, Search, RefreshCw, Plus, CheckSquare2,
  Square, RotateCcw, ChevronRight, Calendar, FileText, HelpCircle, Loader2
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import Link from "next/link";
import toast from "react-hot-toast";

interface Subject {
  id: string;
  name: string;
  code: string | null;
  courseUrl: string;
  description: string | null;
  discoveryStatus: string;
  lastScannedAt: string | null;
  _count: { assignments: number };
  stats: {
    assignmentsCount: number;
    questionsCount: number;
    solutionsGenerated: number;
    validationPassed: number;
  } | null;
}

export function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [filtered, setFiltered] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<{
    subjectId: string;
    message: string;
    completed: number;
    total: number;
  } | null>(null);

  const {
    selectedSubjectIds,
    toggleSubject,
    selectAllSubjects,
    deselectAllSubjects,
    isSubjectSelected,
  } = useSelectionStore();

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/subjects?${params}`);
      const data = await res.json();
      setSubjects(data.subjects || []);
    } catch (err) {
      toast.error("Failed to load subjects");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchSubjects(); }, [fetchSubjects]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      subjects.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code?.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q)
      )
    );
  }, [subjects, search]);

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const res = await fetch("/api/subjects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(`Discovered ${data.discoveredSubjects || 0} subjects`);
        await fetchSubjects();
      }
    } catch (err) {
      toast.error("Discovery failed");
    } finally {
      setDiscovering(false);
    }
  };

  const handleRescan = async (subjectId: string) => {
    setScanningId(subjectId);
    setScanProgress({ subjectId, message: "Starting Newton portal scan", completed: 0, total: 0 });
    try {
      const res = await fetch(`/api/subjects/${subjectId}`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Newton scan failed (${res.status})`);
      }
      if (!res.body) throw new Error("Newton scan did not return progress data.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const outcome: {
        result?: { assignmentsFound: number; questionsFound: number; warnings: string[] };
        error?: string;
      } = {};

      const consumeLine = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line);
        if (event.type === "progress") {
          setScanProgress({
            subjectId,
            message: event.message,
            completed: event.completed,
            total: event.total,
          });
        } else if (event.type === "complete") {
          outcome.result = event.result;
        } else if (event.type === "error") {
          outcome.error = event.error;
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        lines.forEach(consumeLine);
        if (done) break;
      }
      consumeLine(buffer);

      if (outcome.error) throw new Error(outcome.error);
      const result = outcome.result;
      if (!result) throw new Error("Newton scan ended without a completion result.");
      if (result.warnings.length > 0) {
        toast.error(`Scan saved partially: ${result.warnings[0]}`);
      } else {
        toast.success(
          `Found ${result.assignmentsFound} groups and ${result.questionsFound} questions`
        );
      }
      await fetchSubjects();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Newton scan failed.");
    } finally {
      setScanningId(null);
      setScanProgress(null);
    }
  };

  const selectedCount = selectedSubjectIds.size;
  const allIds = filtered.map((s) => s.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedSubjectIds.has(id));

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Subjects</h1>
          <p className="text-gray-400 text-sm mt-1">Discover and manage Newton School courses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchSubjects} loading={loading}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={handleDiscover} loading={discovering}>
            <Plus className="w-3.5 h-3.5" />
            Discover Subjects
          </Button>
        </div>
      </div>

      {scanProgress && (
        <Card>
          <CardContent className="space-y-2 py-3">
            <div className="flex justify-between gap-3 text-xs text-gray-300">
              <span>{scanProgress.message}</span>
              {scanProgress.total > 0 && (
                <span>{scanProgress.completed}/{scanProgress.total}</span>
              )}
            </div>
            <Progress
              value={scanProgress.total > 0
                ? (scanProgress.completed / scanProgress.total) * 100
                : 8}
              className="h-1.5"
            />
          </CardContent>
        </Card>
      )}

      {/* Selection toolbar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-newton-primary/10 border border-newton-primary/30 animate-fade-in">
          <SelectionCount count={selectedCount} label="subjects selected" />
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" size="sm" onClick={() => deselectAllSubjects()}>
              Deselect All
            </Button>
            <Link href="/assignments">
              <Button size="sm">
                View Assignments
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Search subjects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 px-3 rounded-lg border border-white/20 bg-white/5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-newton-primary"
        >
          <option value="">All Statuses</option>
          <option value="DISCOVERED">Discovered</option>
          <option value="SCANNING">Scanning</option>
          <option value="SCANNED">Scanned</option>
          <option value="ERROR">Error</option>
        </select>
        {/* Select all / deselect all */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => allSelected ? deselectAllSubjects() : selectAllSubjects(allIds)}
        >
          {allSelected ? <CheckSquare2 className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          {allSelected ? "Deselect All" : "Select All"}
        </Button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className="glass-card p-4 animate-pulse h-48">
              <div className="h-4 bg-white/10 rounded mb-3 w-3/4" />
              <div className="h-3 bg-white/5 rounded mb-2 w-1/2" />
              <div className="h-3 bg-white/5 rounded w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Subject cards */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((subject) => {
            const isSelected = isSubjectSelected(subject.id);
            const stats = subject.stats;
            const completionPct = stats?.questionsCount
              ? Math.round((stats.solutionsGenerated / stats.questionsCount) * 100)
              : 0;

            return (
              <Card
                key={subject.id}
                className={`relative cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? "border-newton-primary/50 bg-newton-primary/5"
                    : "hover:border-white/20"
                }`}
              >
                {/* Checkbox */}
                <div
                  className="absolute top-3 right-3 cursor-pointer"
                  onClick={() => toggleSubject(subject.id)}
                >
                  {isSelected ? (
                    <CheckSquare2 className="w-5 h-5 text-newton-primary" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-500 hover:text-gray-300" />
                  )}
                </div>

                <CardContent
                  className="cursor-pointer"
                  onClick={() => toggleSubject(subject.id)}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-newton-primary/10 border border-newton-primary/20 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-5 h-5 text-newton-primary" />
                    </div>
                    <div className="min-w-0 pr-6">
                      <div className="font-semibold text-white text-sm leading-tight mb-0.5 truncate">
                        {subject.name}
                      </div>
                      {subject.code && (
                        <span className="text-xs text-newton-primary bg-newton-primary/10 px-1.5 py-0.5 rounded">
                          {subject.code}
                        </span>
                      )}
                    </div>
                  </div>

                  {subject.description && (
                    <p className="text-xs text-gray-400 mb-3 line-clamp-2">{subject.description}</p>
                  )}

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="text-center glass-card p-2">
                      <div className="text-sm font-bold text-blue-400">
                        {stats?.assignmentsCount ?? subject._count.assignments}
                      </div>
                      <div className="text-[10px] text-gray-500">Assignments</div>
                    </div>
                    <div className="text-center glass-card p-2">
                      <div className="text-sm font-bold text-yellow-400">
                        {stats?.questionsCount ?? 0}
                      </div>
                      <div className="text-[10px] text-gray-500">Questions</div>
                    </div>
                  </div>

                  {stats && stats.questionsCount > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                        <span>Solutions</span>
                        <span>{completionPct}%</span>
                      </div>
                      <Progress value={completionPct} className="h-1" />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <StatusBadge status={subject.discoveryStatus} size="sm" />
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      <Calendar className="w-3 h-3" />
                      {subject.lastScannedAt
                        ? formatRelativeTime(subject.lastScannedAt)
                        : "Never scanned"}
                    </div>
                  </div>
                </CardContent>

                {/* Footer actions */}
                <div
                  className="border-t border-white/5 px-4 py-2 flex gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-xs h-7"
                    loading={scanningId === subject.id}
                    onClick={() => handleRescan(subject.id)}
                  >
                    <RotateCcw className="w-3 h-3" />
                    Rescan
                  </Button>
                  <Link href={`/assignments?subjectId=${subject.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full text-xs h-7">
                      <FileText className="w-3 h-3" />
                      Assignments
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <Card className="text-center py-16">
          <CardContent>
            <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              {subjects.length === 0 ? "No subjects discovered" : "No subjects match your search"}
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              {subjects.length === 0
                ? "Make sure you're authenticated with Newton School, then click Discover Subjects."
                : "Try a different search term or clear the filter."}
            </p>
            {subjects.length === 0 && (
              <Button onClick={handleDiscover} loading={discovering}>
                <Plus className="w-4 h-4" />
                Discover Subjects
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
