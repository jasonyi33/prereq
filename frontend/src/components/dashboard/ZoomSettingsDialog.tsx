"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { flaskApi } from "@/lib/api";

interface ZoomSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
}

export default function ZoomSettingsDialog({ open, onOpenChange, teacherId }: ZoomSettingsDialogProps) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [hasSecret, setHasSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
  const webhookUrl = `${appUrl}/webhook/${teacherId}`;
  const oauthUrl = `${appUrl}/auth/${teacherId}`;

  // Load current credentials on open
  useEffect(() => {
    if (!open || !teacherId) return;
    setSaved(false);
    setError("");
    flaskApi
      .get(`/api/teachers/${teacherId}/zoom-credentials`)
      .then((data: { zoom_client_id: string; has_secret: boolean }) => {
        setClientId(data.zoom_client_id || "");
        setHasSecret(data.has_secret);
        setClientSecret("");
      })
      .catch(() => {});
  }, [open, teacherId]);

  async function handleSave() {
    if (!clientId.trim() || !clientSecret.trim()) {
      setError("Both Client ID and Client Secret are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await flaskApi.put(`/api/teachers/${teacherId}/zoom-credentials`, {
        zoom_client_id: clientId.trim(),
        zoom_client_secret: clientSecret.trim(),
      });
      setHasSecret(true);
      setSaved(true);
      setClientSecret("");

      // Invalidate credential cache on the server
      try {
        await fetch(`/api/zoom/clear-cache?teacherId=${teacherId}`, { method: "POST" });
      } catch {
        // Best effort — cache will be stale until next restart
      }
    } catch (err: any) {
      setError(err.message || "Failed to save credentials");
    } finally {
      setSaving(false);
    }
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Zoom RTMS Settings</DialogTitle>
          <DialogDescription>
            Connect your Zoom account for live meeting transcription.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Credentials */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-700">
              1. Enter your Zoom app credentials
            </h3>
            <p className="text-xs text-slate-500">
              Create a &quot;General App&quot; at{" "}
              <a href="https://marketplace.zoom.us" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                marketplace.zoom.us
              </a>
              {" "}and enable the RTMS scope.
            </p>
            <div className="space-y-2">
              <div>
                <span className="text-xs font-medium text-slate-600">Client ID</span>
                <Input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Your Zoom Client ID"
                  className="mt-1"
                />
              </div>
              <div>
                <span className="text-xs font-medium text-slate-600">
                  Client Secret {hasSecret && !clientSecret && <span className="text-emerald-600">(saved)</span>}
                </span>
                <Input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={hasSecret ? "Enter new secret to update" : "Your Zoom Client Secret"}
                  className="mt-1"
                />
              </div>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
              {saving ? "Saving..." : saved ? "Saved!" : "Save Credentials"}
            </Button>
          </div>

          {/* Step 2: URLs to paste into Zoom */}
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-medium text-slate-700">
              2. Configure your Zoom app
            </h3>
            <p className="text-xs text-slate-500">
              Save credentials above first, then copy these URLs into your Zoom app settings.
            </p>

            <div className="space-y-2">
              <div>
                <span className="text-xs font-medium text-slate-600">Webhook URL</span>
                <p className="text-[10px] text-slate-400 mb-1">
                  Paste in Event Subscription → Notification endpoint URL. Subscribe to <code className="bg-slate-100 px-1 rounded">meeting.rtms_started</code> and <code className="bg-slate-100 px-1 rounded">meeting.rtms_stopped</code>.
                </p>
                <div className="flex gap-2">
                  <Input value={webhookUrl} readOnly className="text-xs font-mono bg-slate-50" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(webhookUrl, "webhook")}
                    className="shrink-0"
                  >
                    {copiedField === "webhook" ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-slate-600">OAuth Redirect URL</span>
                <p className="text-[10px] text-slate-400 mb-1">
                  Paste in OAuth → Redirect URL for your General App.
                </p>
                <div className="flex gap-2">
                  <Input value={oauthUrl} readOnly className="text-xs font-mono bg-slate-50" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(oauthUrl, "oauth")}
                    className="shrink-0"
                  >
                    {copiedField === "oauth" ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
