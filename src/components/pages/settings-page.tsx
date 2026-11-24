"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, Cpu, Sliders, CheckCircle2, AlertTriangle, LogIn } from "lucide-react";
import toast from "react-hot-toast";
import { DEFAULT_NEWTON_BASE_URL } from "@/lib/newton-defaults";

export function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState({
    newtonEmail: "",
    newtonBaseUrl: DEFAULT_NEWTON_BASE_URL,
    aiModel: "llama-3.3-70b-versatile",
    maxConcurrentAI: 3,
    maxConcurrentBrowser: 2,
    maxRetries: 3,
  });

  const [saving, setSaving] = useState(false);
  const [authStatus, setAuthStatus] = useState<{
    authenticated: boolean;
    session: { email: string; updatedAt: string } | null;
  } | null>(null);

  const fetchAuth = async () => {
    try {
      const res = await fetch("/api/auth/login");
      const data = await res.json();
      setAuthStatus(data);
    } catch {}
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.settings) {
        setSettings((prev) => ({ ...prev, ...data.settings }));
      }
    } catch {}
  };

  useEffect(() => {
    fetchAuth();
    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Settings saved successfully");
      } else {
        toast.error("Failed to save settings");
      }
    } catch {
      toast.error("Error saving settings");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/login", { method: "DELETE" });
      toast.success("Logged out");
      fetchAuth();
      router.push("/login");
      router.refresh();
    } catch {}
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings & Configuration</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your Newton School connection and batch worker limits</p>
      </div>

      {/* Auth Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4 text-newton-primary" />
            Newton School Authentication
          </CardTitle>
          <CardDescription>
            Authenticate your account to enable dynamic course and assignment discovery
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {authStatus?.authenticated ? (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <div>
                  <div className="text-sm font-semibold text-green-300">Active Newton School Session</div>
                  <div className="text-xs text-gray-400">
                    Logged in as <span className="text-white font-medium">{authStatus.session?.email}</span>
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
              <div className="text-xs text-yellow-200">
                Not connected. Sign in through Newton's visible browser page; Newton handles your password, SSO, and 2FA.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="text-xs font-medium text-gray-300 block mb-1">Newton Account Email</label>
              <Input
                type="email"
                placeholder="student@newtonschool.co"
                value={settings.newtonEmail}
                onChange={(e) => setSettings({ ...settings, newtonEmail: e.target.value })}
              />
            </div>
            <Button size="sm" onClick={() => router.push("/login")}>
              <LogIn className="w-3.5 h-3.5" />
              Sign In in Newton Browser
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI Processing Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" />
            AI & Model Configuration
          </CardTitle>
          <CardDescription>
            Configure the AI provider with environment variables for solution and test case generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-400">
            Set <code>GROQ_API_KEY</code> in <code>.env.local</code>. API keys are not stored in the database.
            OpenAI is also supported with <code>AI_PROVIDER=openai</code> and <code>OPENAI_API_KEY</code>.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-300 block mb-1">Active AI Model</label>
              <p className="text-sm text-gray-300 py-2">{settings.aiModel}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Concurrency and Retries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            Queue & Batch Limits
          </CardTitle>
          <CardDescription>
            System defaults for parallel operations and failure resilience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-300 block mb-1">Concurrent AI Requests</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={settings.maxConcurrentAI}
                onChange={(e) => setSettings({ ...settings, maxConcurrentAI: parseInt(e.target.value) || 3 })}
              />
              <span className="text-[10px] text-gray-500">Default: 3</span>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-300 block mb-1">Concurrent Browser Tasks</label>
              <Input
                type="number"
                min={1}
                max={5}
                value={settings.maxConcurrentBrowser}
                onChange={(e) => setSettings({ ...settings, maxConcurrentBrowser: parseInt(e.target.value) || 2 })}
              />
              <span className="text-[10px] text-gray-500">Default: 2</span>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-300 block mb-1">Max Retries</label>
              <Input
                type="number"
                min={0}
                max={10}
                value={settings.maxRetries}
                onChange={(e) => setSettings({ ...settings, maxRetries: parseInt(e.target.value) || 3 })}
              />
              <span className="text-[10px] text-gray-500">Default: 3 (exponential backoff)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSaveSettings} loading={saving}>
          Save All Settings
        </Button>
      </div>
    </div>
  );
}
