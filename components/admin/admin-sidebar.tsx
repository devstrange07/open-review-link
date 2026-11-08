"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, LogOut, MessageSquareText, Settings } from "lucide-react";

/**
 * Admin navigation.
 *
 * Filters are plain links rather than JS handlers, so a refresh or a
 * shared URL lands on the same view. Same for the nav itself.
 */

const NAV = [
  { href: "/admin", label: "Overview", Icon: BarChart3 },
  { href: "/admin/feedback", label: "Feedback", Icon: MessageSquareText },
  { href: "/admin/settings", label: "Settings", Icon: Settings },
] as const;

type Props = {
  email: string | null;
  signOutAction: () => Promise<void>;
};

export function AdminSidebar({ email, signOutAction }: Props) {
  const pathname = usePathname();

  return (
    <header className="border-b border-[color:var(--border)] bg-white">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <span className="text-sm font-semibold tracking-tight">Feedback</span>

        <nav aria-label="Admin" className="flex flex-1 items-center gap-1">
          {NAV.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: active ? "var(--surface-muted)" : "transparent",
                  color: active ? "var(--text)" : "var(--text-muted)",
                }}
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {email ? (
            <span className="hidden max-w-[16rem] truncate text-xs text-[color:var(--text-muted)] sm:inline">
              {email}
            </span>
          ) : null}
          <form action={signOutAction}>
            <button
              type="submit"
              className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
            >
              <LogOut aria-hidden="true" className="size-4" />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
