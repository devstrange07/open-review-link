"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/shared/button";
import { InlineMessage } from "@/components/shared/inline-message";

/**
 * Admin sign-in.
 *
 * Session cookies are httpOnly and set by the server, so after a successful
 * call we only need `router.replace` plus a refresh so the protected layout
 * re-renders with the new session.
 */
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const payload: unknown = await response.json().catch(() => null);
      const parsed = payload as
        { success: true } | { success: false; error: { message: string } } | null;

      if (!response.ok || !parsed || parsed.success !== true) {
        setError(
          parsed && parsed.success === false
            ? parsed.error.message
            : "Sign-in failed. Please try again.",
        );
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          inputMode="email"
          required
          className="field"
          autoFocus
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          className="field"
        />
      </div>

      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}

      <Button type="submit" fullWidth loading={submitting} loadingLabel="Signing in">
        {submitting ? "Signing in" : "Sign in"}
      </Button>
    </form>
  );
}
