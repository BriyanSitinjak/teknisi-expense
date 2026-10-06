"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClipboardCheck, Download, Plus, Route, Users, Wallet } from "lucide-react";
import {
  DataTable,
  FormError,
  PageMain,
  StatTile,
  StatusBadge,
} from "@/components/app-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, errorMessage, fetchList } from "@/lib/api";
import { isWritablePeriod, PERIOD_STATUS_LABEL, type SessionMe } from "@/lib/constants";
import { formatMonthId, formatRp, technicianLabel } from "@/lib/format";
import type { PeriodRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = [
  { id: "all", label: "Semua" },
  { id: "submitted", label: PERIOD_STATUS_LABEL.submitted },
  { id: "approved", label: PERIOD_STATUS_LABEL.approved },
  { id: "rejected", label: PERIOD_STATUS_LABEL.rejected },
  { id: "draft", label: PERIOD_STATUS_LABEL.draft },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["id"];
type ConfirmKind = "submit" | "withdraw" | "reopen";
type ConfirmAction = { id: string; kind: ConfirmKind; label: string };

export default function BerandaPage() {
  const [me, setMe] = useState<SessionMe | null>(null);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [reason, setReason] = useState("");
  const [acting, setActing] = useState(false);

  function load() {
    setLoading(true);
    fetchList<PeriodRow>("/api/periods?limit=500")
      .then(setPeriods)
      .catch(() => setError("Gagal memuat daftar periode"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    api<SessionMe>("/api/me").then(setMe).catch(() => undefined);
    load();
  }, []);

  function ask(action: ConfirmAction) {
    setReason("");
    setConfirm(action);
  }

  async function runConfirm() {
    if (!confirm) return;
    if (confirm.kind === "reopen" && !reason.trim()) {
      setError("Alasan wajib diisi");
      return;
    }
    setError(null);
    setActing(true);
    try {
      await api(`/api/periods/${confirm.id}/${confirm.kind}`, {
        method: "POST",
        body: JSON.stringify(confirm.kind === "reopen" ? { reason: reason.trim() } : {}),
      });
      setConfirm(null);
      setReason("");
      load();
    } catch (err) {
      const fallback =
        confirm.kind === "submit"
          ? "Gagal mengajukan"
          : confirm.kind === "withdraw"
            ? "Gagal membatalkan pengajuan"
            : "Gagal membuka periode";
      setError(errorMessage(err, fallback));
    } finally {
      setActing(false);
    }
  }

  const total = periods.reduce((sum, period) => sum + period.totalAmount, 0);
  const tripCount = periods.reduce((sum, period) => sum + period.tripCount, 0);
  const submittedCount = periods.filter((period) => period.status === "submitted").length;
  const writableCount = periods.filter((period) => isWritablePeriod(period.status)).length;
  const visible = periods.filter((period) => statusFilter === "all" || period.status === statusFilter);

  return (
    <PageMain>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {me ? `Halo, ${me.name}` : "Beranda"}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Ringkasan seluruh biaya perjalanan teknisi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            className={cn(buttonVariants({ variant: "outline" }), "h-9 rounded-full bg-white px-4")}
            href="/api/exports"
          >
            <Download className="size-4" />
            Unduh Excel
          </a>
          <Link className={cn(buttonVariants(), "h-9 rounded-full px-4")} href="/perjalanan">
            <Plus className="size-4" />
            Input perjalanan
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total biaya" value={formatRp(total)} icon={<Wallet className="size-4" />} />
        <StatTile
          label="Periode teknisi"
          value={String(periods.length)}
          icon={<Users className="size-4" />}
        />
        <StatTile label="Jumlah trip" value={String(tripCount)} icon={<Route className="size-4" />} />
        <StatTile
          label="Menunggu persetujuan"
          value={String(submittedCount)}
          icon={<ClipboardCheck className="size-4" />}
          hint={
            writableCount > 0
              ? `${writableCount} periode siap diajukan`
              : submittedCount > 0
                ? "Buka menu Menunggu persetujuan"
                : undefined
          }
        />
      </div>

      <FormError message={error} />

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => {
          const count =
            filter.id === "all" ? periods.length : periods.filter((period) => period.status === filter.id).length;
          const active = statusFilter === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              className={cn(
                "h-9 rounded-full border px-4 text-sm font-medium transition-colors",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-white text-foreground",
              )}
              onClick={() => setStatusFilter(filter.id)}
            >
              {filter.label} {count}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <DataTable
          title="Periode teknisi"
          description="Pengajuan tetap tersimpan. Menunggu bisa dibatalkan. Disetujui bisa dibuka lagi untuk trip baru, lalu diajukan ulang."
          columns={[
            "Teknisi",
            "Periode",
            "Cabang",
            "Status",
            { label: "Trip", align: "right" },
            { label: "Total", align: "right" },
            "Aksi",
          ]}
          loading={loading}
          isEmpty={!loading && visible.length === 0}
          empty={
            periods.length === 0
              ? "Belum ada perjalanan. Mulai dari menu Input perjalanan."
              : "Tidak ada periode dengan status ini."
          }
        >
          {visible.map((period) => (
            <tr key={period.id} className="border-t border-border/70">
              <td className="px-5 py-3.5">{technicianLabel(period.technician)}</td>
              <td className="px-5 py-3.5">{formatMonthId(period.year, period.month)}</td>
              <td className="px-5 py-3.5">{period.branch?.code}</td>
              <td className="px-5 py-3.5">
                <StatusBadge status={period.status} />
                {period.status === "rejected" && period.lastReason ? (
                  <p className="mt-1 max-w-56 text-xs text-muted-foreground">{period.lastReason}</p>
                ) : null}
              </td>
              <td className="px-5 py-3.5 text-right tabular-nums">{period.tripCount}</td>
              <td className="px-5 py-3.5 text-right tabular-nums">{formatRp(period.totalAmount)}</td>
              <td className="px-5 py-3.5">
                {isWritablePeriod(period.status) ? (
                  <Button
                    size="sm"
                    className="rounded-full"
                    disabled={period.tripCount < 1}
                    onClick={() =>
                      ask({
                        id: period.id,
                        kind: "submit",
                        label: technicianLabel(period.technician),
                      })
                    }
                  >
                    Ajukan
                  </Button>
                ) : null}
                {period.status === "submitted" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() =>
                      ask({
                        id: period.id,
                        kind: "withdraw",
                        label: technicianLabel(period.technician),
                      })
                    }
                  >
                    Batalkan
                  </Button>
                ) : null}
                {period.status === "approved" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() =>
                      ask({
                        id: period.id,
                        kind: "reopen",
                        label: technicianLabel(period.technician),
                      })
                    }
                  >
                    Buka lagi
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </DataTable>
      </div>

      <Dialog
        open={confirm != null}
        onOpenChange={(open) => {
          if (!open && !acting) {
            setConfirm(null);
            setReason("");
          }
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {confirm?.kind === "withdraw"
                ? "Batalkan pengajuan?"
                : confirm?.kind === "reopen"
                  ? "Buka periode yang sudah disetujui?"
                  : "Ajukan periode ini?"}
            </DialogTitle>
            <DialogDescription>
              {confirm?.kind === "withdraw"
                ? `${confirm.label} tetap ada di daftar dan kembali menjadi draf. Perjalanan bisa diubah lagi.`
                : confirm?.kind === "reopen"
                  ? `${confirm.label} kembali menjadi draf. Trip yang sudah ada tetap tersimpan. Tambah perjalanan baru, termasuk di tanggal yang sama, lalu ajukan lagi.`
                  : `${confirm?.label ?? "Periode ini"} masuk status menunggu. Perjalanan terkunci sampai disetujui, ditolak, atau dibatalkan.`}
            </DialogDescription>
          </DialogHeader>
          {confirm?.kind === "reopen" ? (
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Alasan membuka lagi, misalnya ada trip yang belum tercatat"
              required
            />
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirm(null)} disabled={acting}>
              Batal
            </Button>
            <Button
              type="button"
              onClick={() => void runConfirm()}
              disabled={acting || (confirm?.kind === "reopen" && !reason.trim())}
            >
              {acting ? "Memproses…" : confirm?.kind === "withdraw" ? "Batalkan pengajuan" : confirm?.kind === "reopen" ? "Buka lagi" : "Ajukan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageMain>
  );
}
