"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, LogIn, Lock, Mail, Globe, AlertCircle, FileCode } from "lucide-react";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cookieJson, setCookieJson] = useState("");
  const [showCookieInput, setShowCookieInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    fetch("/api/auth/login")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          router.replace("/");
        }
      })
      .catch(() => {});
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please provide both email and password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Authentication failed. Please verify credentials.");
        toast.error(data.error || "Login failed");
      } else {
        toast.success("Logged in successfully!");
        router.replace("/");
        router.refresh();
      }
    } catch {
      setError("Network or server error during sign in.");
      toast.error("Failed to connect to authentication service");
    } finally {
      setLoading(false);
    }
  };

  const handleImportCookies = async () => {
    if (!email || !cookieJson) {
      setError("Please enter your email and paste the cookie JSON array.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const parsedCookies = JSON.parse(cookieJson);
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, cookies: parsedCookies }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Failed to import session cookies.");
      } else {
        toast.success("Browser session imported!");
        router.replace("/");
        router.refresh();
      }
    } catch {
      setError("Invalid JSON format for cookies. Ensure it is a valid JSON array.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-newton-dark flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-xl bg-newton-primary/20 border border-newton-primary/40 items-center justify-center mb-2">
            <Zap className="w-6 h-6 text-newton-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Newton Assignment AI</h1>
          <p className="text-sm text-gray-400">
            Sign in with your Newton School account to process and solve assignments
          </p>
        </div>

        {/* Card */}
        <Card className="border-white/10 bg-newton-darker/90 backdrop-blur-md shadow-2xl">
          <CardHeader>
            <CardTitle className="text-lg text-white">Sign In</CardTitle>
            <CardDescription className="text-xs text-gray-400">
              Enter your credentials for learn.newtonschool.co
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {!showCookieInput ? (
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

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-gray-400" />
                    Password
                  </label>
                  <Input
                    type="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="bg-white/5 border-white/15"
                  />
                </div>

                <Button type="submit" className="w-full" loading={loading}>
                  <LogIn className="w-4 h-4" />
                  Sign In to Newton
                </Button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setShowCookieInput(true)}
                    className="text-xs text-newton-primary hover:underline"
                  >
                    Using Google SSO / 2FA? Import Browser Cookies
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
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
                    disabled={loading}
                    className="bg-white/5 border-white/15"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-gray-400" />
                    Session Cookies (JSON)
                  </label>
                  <textarea
                    rows={4}
                    placeholder='[{"name": "session_id", "value": "..."}, ...]'
                    value={cookieJson}
                    onChange={(e) => setCookieJson(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-white/5 p-2 text-xs font-mono text-gray-300 focus:outline-none focus:ring-1 focus:ring-newton-primary"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowCookieInput(false)}
                    disabled={loading}
                  >
                    Back to Password
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={handleImportCookies}
                    loading={loading}
                  >
                    Import & Continue
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer info */}
        <div className="text-center text-xs text-gray-500">
          Newton Assignment AI · Automated Subject & Assignment Processing
        </div>
      </div>
    </div>
  );
}
