import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminIdentity } from "@/lib/auth";
import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const auth = await getAdminIdentity();
  if (auth.status === "authorized") redirect("/admin");

  return (
    <main
      id="main"
      className="min-h-screen-safe flex items-center justify-center px-5 py-12"
    >
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Admin sign in</h1>
          <p className="mt-1.5 text-sm text-[color:var(--text-muted)]">
            Dashboard access is limited to allowlisted accounts.
          </p>
        </div>

        <div className="rounded-2xl border border-[color:var(--border)] bg-white p-6 shadow-sm">
          <LoginForm />
        </div>

        {/* Surfacing this distinction saves a genuinely confusing support call:
            a valid login that still can't get in is an authorization problem,
            not a password problem. */}
        {auth.status === "not_admin" ? (
          <p className="mt-4 text-center text-sm leading-relaxed text-pretty text-[color:var(--text-muted)]">
            You are signed in, but this account is not on the admin allowlist. Ask the
            owner to add your user ID to <code className="text-xs">admin_users</code>.
          </p>
        ) : null}
      </div>
    </main>
  );
}
