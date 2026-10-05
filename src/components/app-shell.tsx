"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoadingScreen } from "@/components/app-ui";
import { api } from "@/lib/api";
import type { AppRole, SessionMe } from "@/lib/constants";
import { cn } from "@/lib/utils";

const NAV: Array<{ href: string; label: string; roles: AppRole[] }> = [
  { href: "/beranda", label: "Beranda", roles: ["hr"] },
  { href: "/perjalanan", label: "Input perjalanan", roles: ["hr"] },
  { href: "/master", label: "Data master", roles: ["hr"] },
  { href: "/persetujuan", label: "Menunggu persetujuan", roles: ["hr", "branch_head"] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<SessionMe | null>(null);

  useEffect(() => {
    api<SessionMe>("/api/me")
      .then(setMe)
      .catch(() => router.replace("/login"));
  }, [router]);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (!me) {
    return <LoadingScreen />;
  }

  const links = NAV.filter((item) => item.roles.includes(me.role));

  return (
    <div className="flex min-h-full flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-white">
        <div className="border-b border-border px-4 py-4">
          <p className="text-xs text-muted-foreground">PT KSA</p>
          <p className="font-semibold leading-tight">Biaya Teknisi</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm",
                pathname === item.href || pathname.startsWith(`${item.href}/`)
                  ? "bg-foreground font-medium text-background"
                  : "text-foreground hover:bg-muted",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-3 text-sm">
          <p className="truncate font-medium">{me.name}</p>
          <a href="/api/docs" className="mt-1 block text-muted-foreground hover:text-foreground">
            Dokumentasi API
          </a>
          <button
            type="button"
            onClick={logout}
            className="mt-1 text-muted-foreground hover:text-foreground"
          >
            Keluar
          </button>
        </div>
      </aside>
      <div className="min-w-0 flex-1 bg-zinc-50">{children}</div>
    </div>
  );
}
