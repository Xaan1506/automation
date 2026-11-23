"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles, Search, RefreshCw, Code2, CheckCircle2,
  XCircle, ChevronRight, Loader2, Copy, Check
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import toast from "react-hot-toast";

interface Solution {
  id: string;
  code: string;
  language: string;
  explanation: string | null;
  timeComplexity: string | null;
  spaceComplexity: string | null;
  validationStatus: string;
  passedTestCases: number;
  totalTestCases: number;
  isPreferred: boolean;
  version: number;
  createdAt: string;
  question: {
    id: string;
    title: string;
    description: string;
    assignment: {
      title: string;
      subject: { name: string; code: string | null };
    };
  };
}

export function SolutionsPage() {
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [filtered, setFiltered] = useState<Solution[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchSolutions = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch questions with solutions
      const res = await fetch("/api/questions?limit=100");
      const data = await res.json();
      const qs = data.questions || [];
      // Flatten solutions
      const sols: Solution[] = [];
      for (const q of qs) {
        for (const s of q.solutions || []) {
          sols.push({
            ...s,
            question: {
              id: q.id,
              title: q.title,
              description: q.description,
              assignment: q.assignment,
            },
          });
        }
      }
      setSolutions(sols);
    } catch {
      toast.error("Failed to load solutions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSolutions(); }, [fetchSolutions]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      solutions.filter(
        (s) =>
          (!statusFilter || s.validationStatus === statusFilter) &&
          (s.question.title.toLowerCase().includes(q) ||
           s.language.toLowerCase().includes(q) ||
           s.question.assignment.subject.name.toLowerCase().includes(q))
      )
    );
  }, [solutions, search, statusFilter]);

  const handleCopy = async (solutionId: string, code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(solutionId);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Code copied!");
  };

  const stats = {
    total: solutions.length,
    passed: solutions.filter((s) => s.validationStatus === "PASSED").length,
    partial: solutions.filter((s) => s.validationStatus === "PARTIAL").length,
    failed: solutions.filter((s) => s.validationStatus === "FAILED").length,
    pending: solutions.filter((s) => s.validationStatus === "PENDING").length,
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Solutions</h1>
          <p className="text-gray-400 text-sm mt-1">{solutions.length} solutions generated</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSolutions} loading={loading}>
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-white" },
          { label: "Passed", value: stats.passed, color: "text-green-400" },
          { label: "Partial", value: stats.partial, color: "text-yellow-400" },
          { label: "Failed", value: stats.failed, color: "text-red-400" },
        ].map((s) => (
          <Card key={s.label} className="p-3 text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Search solutions..."
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
          <option value="">All Validation Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PASSED">Passed</option>
          <option value="PARTIAL">Partial</option>
          <option value="FAILED">Failed</option>
          <option value="ERROR">Error</option>
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-newton-primary" />
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((solution) => {
          const isExpanded = expandedId === solution.id;
          const validPct = solution.totalTestCases
            ? Math.round((solution.passedTestCases / solution.totalTestCases) * 100)
            : 0;

          return (
            <Card key={solution.id} className="overflow-hidden">
              <CardContent>
                <div
                  className="flex items-start gap-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : solution.id)}
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-white text-sm">{solution.question.title}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {solution.question.assignment.subject.code || solution.question.assignment.subject.name}
                          {" · "}
                          {solution.question.assignment.title}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs bg-white/5 px-2 py-0.5 rounded font-mono text-gray-300">
                          {solution.language}
                        </span>
                        <StatusBadge status={solution.validationStatus} size="sm" />
                        <ChevronRight
                          className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        />
                      </div>
                    </div>

                    {solution.totalTestCases > 0 && (
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                          <span>{solution.passedTestCases}/{solution.totalTestCases} tests passed</span>
                          <span>{validPct}%</span>
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

                    {(solution.timeComplexity || solution.spaceComplexity) && (
                      <div className="flex gap-3 mt-2 text-[10px] text-gray-500">
                        {solution.timeComplexity && <span>⏱ {solution.timeComplexity}</span>}
                        {solution.spaceComplexity && <span>💾 {solution.spaceComplexity}</span>}
                      </div>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 border-t border-white/10 pt-4 animate-fade-in space-y-4">
                    {solution.explanation && (
                      <div>
                        <div className="text-xs font-medium text-gray-400 mb-1">Explanation</div>
                        <p className="text-xs text-gray-300 leading-relaxed">{solution.explanation}</p>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-gray-400">Code</div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => handleCopy(solution.id, solution.code)}
                        >
                          {copiedId === solution.id ? (
                            <><Check className="w-3 h-3" /> Copied!</>
                          ) : (
                            <><Copy className="w-3 h-3" /> Copy</>
                          )}
                        </Button>
                      </div>
                      <pre className="bg-black/40 rounded-lg p-4 text-xs text-green-300 font-mono overflow-x-auto max-h-80 overflow-y-auto">
                        {solution.code}
                      </pre>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!loading && filtered.length === 0 && (
        <Card className="text-center py-16">
          <CardContent>
            <Sparkles className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No solutions yet</h3>
            <p className="text-gray-400 text-sm">
              Process assignments to generate AI solutions.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
