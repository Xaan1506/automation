"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, SelectionCount } from "@/components/ui/badge";
import { useSelectionStore } from "@/store/selection-store";
import {
  FileText, Search, RefreshCw, CheckSquare2, Square,
  ChevronRight, Calendar, HelpCircle, Loader2, Download, Plus
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import Link from "next/link";
import toast from "react-hot-toast";

interface Assignment {
  id: string;
  externalId: string;
  title: string;
  assignmentUrl: string;
  description: string | null;
  processingStatus: string;
  discoveredAt: string;
  lastProcessedAt: string | null;
  _count: { questions: number };
  subject: { id: string; name: string; code: string | null };
}

const STATUS_ICONS: Record<string, string> = {
  NOT_PROCESSED: "⚪",
  QUESTIONS_EXTRACTED: "🔵",
  AI_PROCESSING: "🟡",
  SOLUTIONS_GENERATED: "🟣",
  VALIDATION_COMPLETED: "🟢",
  REQUIRES_REVIEW: "🟠",
  FAILED: "🔴",
};

export function AssignmentsPage() {
  const searchParams = useSearchParams();
  const subjectIdParam = searchParams.get("subjectId");

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [filtered, setFiltered] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [extractingId, setExtractingId] = useState<string | null>(null);

  const {
    selectedSubjectIds,
    selectedAssignmentIds,
    toggleAssignment,
    selectAllAssignments,
    deselectAllAssignments,
    isAssignmentSelected,
  } = useSelectionStore();

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      // If we have a subject filter from URL, use it
      if (subjectIdParam) {
        params.append("subjectId", subjectIdParam);
      } else if (selectedSubjectIds.size > 0) {
        // Show assignments for all selected subjects
        for (const id of Array.from(selectedSubjectIds)) {
          params.append("subjectId", id);
        }
      }

      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/assignments?${params}`);
      const data = await res.json();
      setAssignments(data.assignments || []);
    } catch (err) {
      toast.error("Failed to load assignments");
    } finally {
      setLoading(false);
    }
  }, [subjectIdParam, selectedSubjectIds, statusFilter]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      assignments.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.subject.name.toLowerCase().includes(q) ||
          a.externalId.includes(q)
      )
    );
  }, [assignments, search]);

  const handleExtractQuestions = async (assignmentId: string) => {
    setExtractingId(assignmentId);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/questions`, { method: "POST" });
      const data = await res.json();
      if (data.error) toast.error(data.error);
      else {
        toast.success(`Extracted ${data.discovered} questions`);
        await fetchAssignments();
      }
    } finally {
      setExtractingId(null);
    }
  };

  const selectedCount = selectedAssignmentIds.size;
  const allIds = filtered.map((a) => a.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedAssignmentIds.has(id));

  // Group by subject
  const grouped = filtered.reduce<Record<string, { subject: Assignment["subject"]; items: Assignment[] }>>(
    (acc, a) => {
      if (!acc[a.subject.id]) acc[a.subject.id] = { subject: a.subject, items: [] };
      acc[a.subject.id].items.push(a);
      return acc;
    },
    {}
  );

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Assignments</h1>
          <p className="text-gray-400 text-sm mt-1">
            {selectedSubjectIds.size > 0
              ? `From ${selectedSubjectIds.size} selected subject(s)`
              : "All assignments"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAssignments} loading={loading}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          {selectedCount > 0 && (
            <Link href="/batch/new">
              <Button size="sm">
                <ChevronRight className="w-3.5 h-3.5" />
                Process Selected ({selectedCount})
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Selection toolbar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-newton-primary/10 border border-newton-primary/30 animate-fade-in">
          <SelectionCount count={selectedCount} label="assignments selected" />
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" size="sm" onClick={() => deselectAllAssignments()}>
              Deselect All
            </Button>
            <Link href="/batch/new">
              <Button size="sm">
                Create Batch
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Subjects filter hint */}
      {selectedSubjectIds.size === 0 && !subjectIdParam && (
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-300 flex items-center gap-2">
          <FileText className="w-4 h-4 flex-shrink-0" />
          <span>Select subjects on the <Link href="/subjects" className="underline">Subjects page</Link> to filter assignments, or browse all below.</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Search assignments..."
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
          <option value="NOT_PROCESSED">Not Processed</option>
          <option value="QUESTIONS_EXTRACTED">Questions Extracted</option>
          <option value="AI_PROCESSING">AI Processing</option>
          <option value="SOLUTIONS_GENERATED">Solutions Generated</option>
          <option value="VALIDATION_COMPLETED">Validated</option>
          <option value="REQUIRES_REVIEW">Needs Review</option>
          <option value="FAILED">Failed</option>
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => allSelected ? deselectAllAssignments(undefined, allIds) : selectAllAssignments(allIds)}
        >
          {allSelected ? <CheckSquare2 className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          {allSelected ? "Deselect All" : "Select All"}
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-newton-primary" />
        </div>
      )}

      {/* Grouped assignment cards */}
      {!loading && Object.values(grouped).map(({ subject, items }) => (
        <div key={subject.id} className="space-y-3">
          {/* Subject header */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{subject.name}</span>
              {subject.code && (
                <span className="text-xs text-newton-primary bg-newton-primary/10 px-1.5 py-0.5 rounded">
                  {subject.code}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500">({items.length} assignments)</div>
            <div className="flex-1 h-px bg-white/5" />
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                const ids = items.map((a) => a.id);
                const allSel = ids.every((id) => selectedAssignmentIds.has(id));
                if (allSel) deselectAllAssignments(subject.id, ids);
                else selectAllAssignments(ids);
              }}
            >
              Select all in {subject.code || "subject"}
            </Button>
          </div>

          {/* Assignment cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map((assignment) => {
              const isSelected = isAssignmentSelected(assignment.id);

              return (
                <Card
                  key={assignment.id}
                  className={`relative transition-all duration-200 ${
                    isSelected ? "border-newton-primary/50 bg-newton-primary/5" : "hover:border-white/20"
                  }`}
                >
                  {/* Checkbox */}
                  <div
                    className="absolute top-3 right-3 cursor-pointer"
                    onClick={() => toggleAssignment(assignment.id)}
                  >
                    {isSelected ? (
                      <CheckSquare2 className="w-5 h-5 text-newton-primary" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-500 hover:text-gray-300" />
                    )}
                  </div>

                  <CardContent
                    className="cursor-pointer pr-10"
                    onClick={() => toggleAssignment(assignment.id)}
                  >
                    <div className="flex items-start gap-3 mb-2">
                      <span className="text-lg">{STATUS_ICONS[assignment.processingStatus] || "⚪"}</span>
                      <div className="min-w-0">
                        <div className="font-medium text-white text-sm truncate">{assignment.title}</div>
                        <div className="text-[11px] text-gray-500">ID: {assignment.externalId}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <HelpCircle className="w-3 h-3" />
                        {assignment._count.questions} questions
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Calendar className="w-3 h-3" />
                        {formatRelativeTime(assignment.discoveredAt)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <StatusBadge status={assignment.processingStatus} size="sm" />
                      {assignment.lastProcessedAt && (
                        <span className="text-[10px] text-gray-500">
                          Processed {formatRelativeTime(assignment.lastProcessedAt)}
                        </span>
                      )}
                    </div>
                  </CardContent>

                  {/* Footer */}
                  <div
                    className="border-t border-white/5 px-4 py-2 flex gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-xs h-7"
                      loading={extractingId === assignment.id}
                      onClick={() => handleExtractQuestions(assignment.id)}
                    >
                      <Download className="w-3 h-3" />
                      Extract Questions
                    </Button>
                    <Link href={`/questions?assignmentId=${assignment.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full text-xs h-7">
                        <HelpCircle className="w-3 h-3" />
                        View Questions
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <Card className="text-center py-16">
          <CardContent>
            <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No assignments found</h3>
            <p className="text-gray-400 text-sm mb-6">
              {selectedSubjectIds.size > 0
                ? "No assignments found for selected subjects."
                : "Select subjects or discover assignments from Newton."}
            </p>
            <Link href="/subjects">
              <Button>Go to Subjects</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
