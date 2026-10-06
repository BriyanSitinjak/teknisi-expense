"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ClipboardCheck,
  Database,
  LayoutDashboard,
  LogOut,
  Map,
} from "lucide-react";
import { LoadingScreen } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import type { AppRole, SessionMe } from "@/lib/constants";
import { cn } from "@/lib/utils";

const NAV: Array<{
  href: string;
  label: string;
  roles: AppRole[];
  icon: typeof LayoutDashboard;
}> = [
  { href: "/beranda", label: "Beranda", roles: ["hr"], icon: LayoutDashboard },
  { href: "/perjalanan", label: "Input perjalanan", roles: ["hr"], icon: Map },
  { href: "/master", label: "Data master", roles: ["hr"], icon: Database },
  { href: "/persetujuan", label: "Menunggu persetujuan", roles: ["hr", "branch_head"], icon: ClipboardCheck },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<SessionMe | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);

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
  const initial = me.name.trim().charAt(0).toUpperCase() || "U";

  return (
    <div className="flex min-h-full flex-1 bg-background">
      <aside className="flex w-64 shrink-0 flex-col bg-white">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-foreground text-sm font-semibold text-background">
            K
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">PT KSA</p>
            <p className="truncate text-xs text-muted-foreground">Biaya teknisi</p>
          </div>
        </div>
        <p className="px-5 pb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Menu navigasi
        </p>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {links.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-full px-3 py-2.5 text-sm transition-colors duration-150",
                  active
                    ? "bg-foreground font-medium text-background"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3">
          <div className="flex items-center gap-3 rounded-2xl bg-muted px-3 py-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-medium text-background">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{me.name}</p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmLogout(true)}
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-white hover:text-foreground"
              aria-label="Keluar"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
        <Dialog open={confirmLogout} onOpenChange={setConfirmLogout}>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Keluar dari akun?</DialogTitle>
              <DialogDescription>
                Sesi Anda akan berakhir. Anda perlu masuk kembali untuk melanjutkan.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmLogout(false)}>
                Batal
              </Button>
              <Button type="button" onClick={logout}>
                Keluar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
