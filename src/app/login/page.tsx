"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Globe, LogIn, Mail, ShieldCheck, X } from "lucide-react";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [flowId, setFlowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/login")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) router.replace("/");
      })
      .catch(() => {});
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Could not start browser login (${res.status}).`);
      } else {
        setFlowId(data.flowId);
      }
    } catch {
      setError("Could not connect to the local authentication service.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!flowId) return;
    setVerifying(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", flowId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Newton authentication is not verified (${res.status}).`);
        return;
      }

      toast.success("Newton session verified and saved securely.");
      router.replace("/");
      router.refresh();
    } catch {
      setError("Could not verify the Newton browser session.");
    } finally {
      setVerifying(false);
    }
  };

  const handleCancel = async () => {
    if (!flowId) return;
    setLoading(true);
    try {
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", flowId }),
      });
      setFlowId(null);
      setError(null);
    } catch {
      setError("Could not close the Newton browser session.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-newton-dark flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-xl bg-newton-primary/20 border border-newton-primary/40 items-center justify-center mb-2">
            <Globe className="w-6 h-6 text-newton-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Newton Assignment AI</h1>
          <p className="text-sm text-gray-400">
            Sign in on Newton School to process and scan your assignments
          </p>
        </div>

        <Card className="border-white/10 bg-newton-darker/90 backdrop-blur-md shadow-2xl">
          <CardHeader>
            <CardTitle className="text-lg text-white">Sign In</CardTitle>
            <CardDescription className="text-xs text-gray-400">
              Newton handles your password, Google SSO, and any 2FA in its own browser page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {!flowId ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    Newton Account Email
                  </label>
                  <Input
                    type="email"
                    placeholder="student@newtonschool.co"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="bg-white/5 border-white/15"
                  />
                </div>

                <Button type="submit" className="w-full" loading={loading}>
                  <LogIn className="w-4 h-4" />
                  Open Newton Sign In
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-newton-primary/30 bg-newton-primary/10 p-3 text-sm text-gray-200">
                  <div className="mb-1 flex items-center gap-2 font-medium text-white">
                    <ShieldCheck className="h-4 w-4 text-newton-primary" />
                    Complete sign-in in the visible browser
                  </div>
                  <p className="text-xs text-gray-300">
                    Finish any Newton or Google sign-in and 2FA steps. Then open your Newton courses or
                    dashboard and verify it here. The session is not saved until that page is verified.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={handleVerify}
                    loading={verifying}
                    disabled={loading}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Verify Newton Session
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={loading || verifying}
                    aria-label="Cancel browser login"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-xs text-gray-500">
          Newton Assignment AI · Automated Subject & Assignment Processing
        </div>
      </div>
    </div>
  );
}
