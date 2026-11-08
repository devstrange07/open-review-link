import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminIdentity } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

/**
 * Protected layout.
 *
 * The gate lives here rather than in proxy.ts because proxy.ts cannot make
 * authorization decisions against the database on every request cheaply. A
 * layout check runs on every render of every admin page, and each API route
 * re-checks independently — so neither layer is a single point of failure.
 */
export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getAdminIdentity();

  if (auth.status === "unauthenticated") redirect("/admin/login");
  if (auth.status === "not_admin") redirect("/admin/login");

  async function signOut() {
    "use server";
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen-safe bg-[color:var(--surface-muted)]">
      <AdminSidebar email={auth.admin.email} signOutAction={signOut} />
      <main id="main" className="mx-auto w-full max-w-5xl px-4 pt-6 pb-16 sm:px-6">
        {children}
      </main>
    </div>
  );
}
