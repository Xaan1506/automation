"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen, FileText, HelpCircle, Sparkles,
  CheckCircle2, AlertTriangle, Clock, Zap,
  TrendingUp, ArrowRight, RefreshCw
} from "lucide-react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";

interface OverviewStats {
  totalSubjects: number;
  totalAssignments: number;
  totalQuestions: number;
  processedQuestions: number;
  solutionsGenerated: number;
  validationPassed: number;
  activeBatches: number;
  pendingJobs: number;
}

interface SubjectStat {
  id: string;
  subjectId: string;
  assignmentsCount: number;
  questionsCount: number;
  solutionsGenerated: number;
  validationPassed: number;
  pendingReview: number;
  failed: number;
  updatedAt: string;
  subject: { name: string; code: string | null };
}

export function OverviewPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [subjectStats, setSubjectStats] = useState<SubjectStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState<{ authenticated: boolean; session: { email: string } | null } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, authRes] = await Promise.all([
        fetch("/api/stats"),
        fetch("/api/auth/login"),
      ]);
      const statsData = await statsRes.json();
      const authData = await authRes.json();
      setStats(statsData.overview);
      setSubjectStats(statsData.subjectStats || []);
      setAuthStatus(authData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const statCards = [
    { label: "Subjects", value: stats?.totalSubjects ?? 0, icon: BookOpen, color: "text-blue-400", href: "/subjects" },
    { label: "Assignments", value: stats?.totalAssignments ?? 0, icon: FileText, color: "text-purple-400", href: "/assignments" },
    { label: "Questions", value: stats?.totalQuestions ?? 0, icon: HelpCircle, color: "text-yellow-400", href: "/questions" },
    { label: "Solutions", value: stats?.solutionsGenerated ?? 0, icon: Sparkles, color: "text-green-400", href: "/solutions" },
    { label: "Validated", value: stats?.validationPassed ?? 0, icon: CheckCircle2, color: "text-emerald-400", href: "/solutions" },
    { label: "Pending Jobs", value: stats?.pendingJobs ?? 0, icon: Clock, color: "text-orange-400", href: "/queue" },
    { label: "Active Batches", value: stats?.activeBatches ?? 0, icon: Zap, color: "text-newton-primary", href: "/batch" },
    {
      label: "Progress",
      value: stats?.totalQuestions
        ? `${Math.round((stats.processedQuestions / stats.totalQuestions) * 100)}%`
        : "0%",
      icon: TrendingUp,
      color: "text-pink-400",
      href: "/queue",
    },
  ];

  const processedPct = stats?.totalQuestions
    ? Math.round((stats.processedQuestions / stats.totalQuestions) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Overview</h1>
          <p className="text-gray-400 text-sm mt-1">Newton Assignment AI Dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchData} loading={loading}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Link href="/batch/new">
            <Button size="sm">
              <Zap className="w-3.5 h-3.5" />
              New Batch
            </Button>
          </Link>
        </div>
      </div>

      {/* Auth Status Banner */}
      {!loading && !authStatus?.authenticated && (
        <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-orange-300">Not authenticated with Newton School</div>
              <div className="text-xs text-gray-400">Configure your credentials in Settings to discover subjects</div>
            </div>
          </div>
          <Link href="/settings">
            <Button variant="warning" size="sm">
              Configure
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {authStatus?.authenticated && (
        <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          <span className="text-sm text-green-300">
            Authenticated as <span className="font-medium">{authStatus.session?.email}</span>
          </span>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Link key={card.label} href={card.href}>
            <Card className="hover:border-white/20 transition-all cursor-pointer group">
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                  <ArrowRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {loading ? <div className="h-7 w-16 bg-white/5 rounded animate-pulse" /> : card.value}
                </div>
                <div className="text-xs text-gray-400">{card.label}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Overall Progress */}
      {stats && stats.totalQuestions > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Overall Processing Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">
                {stats.processedQuestions} of {stats.totalQuestions} questions processed
              </span>
              <span className="text-xs font-medium text-newton-primary">{processedPct}%</span>
            </div>
            <Progress value={processedPct} className="h-2" />
            <div className="flex gap-4 mt-3 text-xs">
              <span className="text-green-400">✓ {stats.validationPassed} validated</span>
              <span className="text-yellow-400">⟳ {stats.pendingJobs} pending</span>
              <span className="text-gray-400">
                {stats.totalQuestions - stats.processedQuestions} remaining
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subject Performance */}
      {subjectStats.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-white mb-3">Subject Performance</h2>
          <div className="space-y-3">
            {subjectStats.map((ss) => {
              const pct = ss.questionsCount > 0
                ? Math.round((ss.solutionsGenerated / ss.questionsCount) * 100)
                : 0;
              return (
                <Card key={ss.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white text-sm">{ss.subject.name}</span>
                        {ss.subject.code && (
                          <span className="text-xs text-newton-primary bg-newton-primary/10 px-1.5 py-0.5 rounded">
                            {ss.subject.code}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">{pct}% complete</span>
                  </div>
                  <Progress value={pct} className="h-1.5 mb-3" />
                  <div className="grid grid-cols-5 gap-2 text-center">
                    {[
                      { label: "Assignments", value: ss.assignmentsCount, color: "text-blue-400" },
                      { label: "Questions", value: ss.questionsCount, color: "text-yellow-400" },
                      { label: "Solutions", value: ss.solutionsGenerated, color: "text-purple-400" },
                      { label: "Validated", value: ss.validationPassed, color: "text-green-400" },
                      { label: "Failed", value: ss.failed, color: "text-red-400" },
                    ].map((m) => (
                      <div key={m.label} className="glass-card p-2">
                        <div className={`text-lg font-bold ${m.color}`}>{m.value}</div>
                        <div className="text-[10px] text-gray-500">{m.label}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && stats?.totalSubjects === 0 && (
        <Card className="text-center py-16">
          <CardContent>
            <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No subjects discovered yet</h3>
            <p className="text-gray-400 text-sm mb-6">
              Configure your Newton credentials and discover your subjects to get started.
            </p>
            <div className="flex gap-3 justify-center">
              <Link href="/settings">
                <Button variant="outline">Configure Credentials</Button>
              </Link>
              <Link href="/subjects">
                <Button>
                  <BookOpen className="w-4 h-4" />
                  Go to Subjects
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
