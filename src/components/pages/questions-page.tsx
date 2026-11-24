"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  HelpCircle, Search, RefreshCw, Sparkles, CheckCircle2,
  Code2, ChevronRight, Loader2, AlertTriangle
} from "lucide-react";
import { formatRelativeTime, truncate } from "@/lib/utils";
import toast from "react-hot-toast";

interface Question {
  id: string;
  externalId: string;
  title: string;
  description: string;
  questionUrl: string;
  language: string | null;
  difficulty: string | null;
  portalStatus: string | null;
  scoreLabel: string | null;
  topics: string | null;
  inputFormat: string | null;
  outputFormat: string | null;
  constraints: string | null;
  sampleInput: string | null;
  sampleOutput: string | null;
  examples: string | null;
  starterCode: string | null;
  processingStatus: string;
  discoveredAt: string;
  lastProcessedAt: string | null;
  _count: { testCases: number; solutions: number };
  solutions: Array<{
    id: string;
    code: string;
    language: string;
    validationStatus: string;
    passedTestCases: number;
    totalTestCases: number;
  }>;
  assignment: {
    id: string;
    title: string;
    subject: { name: string; code: string | null };
  };
}

function parseTopicLabels(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((label): label is string => typeof label === "string")
      : [];
  } catch {
    return [];
  }
}

export function QuestionsPage() {
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get("assignmentId");
  const subjectId = searchParams.get("subjectId");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [filtered, setFiltered] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (assignmentId) params.set("assignmentId", assignmentId);
      if (subjectId) params.set("subjectId", subjectId);
      if (statusFilter) params.set("status", statusFilter);
      if (languageFilter) params.set("language", languageFilter);

      const res = await fetch(`/api/questions?${params}`);
      const data = await res.json();
      setQuestions(data.questions || []);
    } catch {
      toast.error("Failed to load questions");
    } finally {
      setLoading(false);
    }
  }, [assignmentId, subjectId, statusFilter, languageFilter]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      questions.filter(
        (qu) =>
          qu.title.toLowerCase().includes(q) ||
          qu.description.toLowerCase().includes(q) ||
          qu.assignment.title.toLowerCase().includes(q)
      )
    );
  }, [questions, search]);

  const handleProcess = async (questionId: string) => {
    setProcessingId(questionId);
    try {
      const res = await fetch(`/api/questions/${questionId}`, { method: "POST" });
      const data = await res.json();
      toast.success("Processing started");
      // Poll for completion
      setTimeout(() => fetchQuestions(), 5000);
    } catch {
      toast.error("Failed to start processing");
    } finally {
      setProcessingId(null);
    }
  };

  const languages = Array.from(new Set(questions.map((q) => q.language).filter(Boolean)));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Question Bank</h1>
          <p className="text-gray-400 text-sm mt-1">
            {questions.length} questions discovered
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchQuestions} loading={loading}>
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Search questions..."
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
          <option value="AI_PROCESSING">Processing</option>
          <option value="SOLUTION_GENERATED">Solution Ready</option>
          <option value="VALIDATED">Validated</option>
          <option value="REQUIRES_REVIEW">Needs Review</option>
          <option value="FAILED">Failed</option>
        </select>
        {languages.length > 0 && (
          <select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-white/20 bg-white/5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-newton-primary"
          >
            <option value="">All Languages</option>
            {languages.map((l) => (
              <option key={l} value={l!}>{l}</option>
            ))}
          </select>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-newton-primary" />
        </div>
      )}

      {/* Questions list */}
      {!loading && (
        <div className="space-y-3">
          {filtered.map((question) => {
            const solution = question.solutions[0];
            const isExpanded = expandedId === question.id;
            const validPct = solution?.totalTestCases
              ? Math.round((solution.passedTestCases / solution.totalTestCases) * 100)
              : 0;
            const topicLabels = parseTopicLabels(question.topics);
            const problemDetails = [
              ["Input format", question.inputFormat],
              ["Output format", question.outputFormat],
              ["Constraints", question.constraints],
              ["Sample input", question.sampleInput],
              ["Sample output", question.sampleOutput],
              ["Examples", question.examples],
              ["Starter code", question.starterCode],
            ].filter((detail): detail is [string, string] => Boolean(detail[1]));

            return (
              <Card
                key={question.id}
                className="overflow-hidden transition-all"
              >
                <CardContent>
                  <div
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : question.id)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <HelpCircle className="w-4 h-4 text-yellow-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-white text-sm">{question.title}</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            {question.assignment.subject.code || question.assignment.subject.name}
                            {" · "}
                            {question.assignment.title}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {question.language && (
                            <span className="text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded font-mono">
                              {question.language}
                            </span>
                          )}
                          {question.difficulty && (
                            <span className="text-xs text-gray-300 bg-white/5 px-2 py-0.5 rounded">
                              {question.difficulty}
                            </span>
                          )}
                          {question.scoreLabel && (
                            <span className="text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                              {question.scoreLabel}
                            </span>
                          )}
                          <StatusBadge status={question.processingStatus} size="sm" />
                          <ChevronRight
                            className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          />
                        </div>
                      </div>

                      <p className="text-xs text-gray-400 mt-2 line-clamp-2">
                        {truncate(question.description, 200)}
                      </p>

                      <div className="flex items-center gap-4 mt-2">
                        {question.portalStatus && (
                          <span className="text-[10px] text-gray-500">
                            Portal status: {question.portalStatus}
                          </span>
                        )}
                        {topicLabels.map((topic) => (
                          <span key={topic} className="text-[10px] text-newton-primary">
                            {topic}
                          </span>
                        ))}
                        <span className="text-[10px] text-gray-500">
                          {question._count.solutions} solution(s)
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {question._count.testCases} test cases
                        </span>
                        {question.lastProcessedAt && (
                          <span className="text-[10px] text-gray-500">
                            Processed {formatRelativeTime(question.lastProcessedAt)}
                          </span>
                        )}
                      </div>

                      {solution && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-gray-500">
                              Validation: {solution.passedTestCases}/{solution.totalTestCases} tests passed
                            </span>
                            <span className="text-[10px] text-gray-500">{validPct}%</span>
                          </div>
                          <Progress
                            value={validPct}
                            className="h-1"
                            indicatorClassName={
                              validPct === 100 ? "from-green-500 to-green-600" :
                              validPct > 50 ? "from-yellow-500 to-yellow-600" :
                              "from-red-500 to-red-600"
                            }
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 border-t border-white/10 pt-4 animate-fade-in space-y-4">
                      <div>
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <span className="text-sm font-medium text-white">Visible problem statement</span>
                          <a
                            href={question.questionUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-newton-primary hover:underline"
                          >
                            Open in Newton
                          </a>
                        </div>
                        <pre className="whitespace-pre-wrap bg-black/30 rounded-lg p-4 text-xs text-gray-300 font-sans max-h-80 overflow-y-auto">
                          {question.description}
                        </pre>
                      </div>
                      {problemDetails.map(([label, value]) => (
                        <div key={label}>
                          <div className="text-xs font-medium text-gray-400 mb-1">{label}</div>
                          <pre className="whitespace-pre-wrap bg-black/30 rounded-lg p-3 text-xs text-gray-300 font-mono overflow-x-auto">
                            {value}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Expanded: show locally generated solution code */}
                  {isExpanded && solution && (
                    <div className="mt-4 border-t border-white/10 pt-4 animate-fade-in">
                      <div className="flex items-center gap-2 mb-2">
                        <Code2 className="w-4 h-4 text-newton-primary" />
                        <span className="text-sm font-medium text-white">Solution ({solution.language})</span>
                        <StatusBadge status={solution.validationStatus} size="sm" />
                      </div>
                      <pre className="bg-black/40 rounded-lg p-4 text-xs text-green-300 font-mono overflow-x-auto max-h-80 overflow-y-auto">
                        {solution.code}
                      </pre>
                    </div>
                  )}

                  {isExpanded && !solution && (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        No solution generated yet
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleProcess(question.id)}
                        loading={processingId === question.id}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Generate Solution
                      </Button>
                    </div>
                  )}
                </CardContent>

                {/* Footer */}
                <div className="border-t border-white/5 px-4 py-2 flex gap-2 justify-end">
                  {!solution && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      loading={processingId === question.id}
                      onClick={() => handleProcess(question.id)}
                    >
                      <Sparkles className="w-3 h-3" />
                      Generate Solution
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <Card className="text-center py-16">
          <CardContent>
            <HelpCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No questions found</h3>
            <p className="text-gray-400 text-sm">
              Extract questions from assignments to populate the question bank.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
