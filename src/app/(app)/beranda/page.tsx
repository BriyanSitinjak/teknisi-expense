"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, ClipboardCheck, Download, Plus, Route, Users, Wallet } from "lucide-react";
import {
  DataTable,
  FormError,
  NativeSelect,
  PageMain,
  StatTile,
  StatusBadge,
} from "@/components/app-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { api, errorMessage, fetchList } from "@/lib/api";
import { isWritablePeriod, type SessionMe } from "@/lib/constants";
import { formatMonthId, formatRp, monthOptions, technicianLabel } from "@/lib/format";
import type { PeriodRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function BerandaPage() {
  const now = new Date();
  const year = now.getFullYear();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [me, setMe] = useState<SessionMe | null>(null);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load(selectedMonth: number) {
    setLoading(true);
    fetchList<PeriodRow>(`/api/periods?year=${year}&month=${selectedMonth}&limit=50`)
      .then(setPeriods)
      .catch(() => setError("Gagal memuat periode bulan ini"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    api<SessionMe>("/api/me").then(setMe).catch(() => undefined);
    load(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(id: string) {
    setError(null);
    try {
      await api(`/api/periods/${id}/submit`, { method: "POST", body: JSON.stringify({}) });
      load(month);
    } catch (err) {
      setError(errorMessage(err, "Gagal mengajukan"));
    }
  }

  const total = periods.reduce((sum, period) => sum + period.totalAmount, 0);
  const tripCount = periods.reduce((sum, period) => sum + period.tripCount, 0);
  const submittedCount = periods.filter((period) => period.status === "submitted").length;
  const writableCount = periods.filter((period) => isWritablePeriod(period.status)).length;

  return (
    <PageMain>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {me ? `Halo, ${me.name}` : "Beranda"}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Ringkasan biaya perjalanan teknisi {formatMonthId(year, month)}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <CalendarDays className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <NativeSelect
              className="w-auto pl-9"
              aria-label="Bulan"
              value={month}
              onChange={(event) => {
                const next = Number(event.target.value);
                setMonth(next);
                setError(null);
                load(next);
              }}
            >
              {monthOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <a
            className={cn(buttonVariants({ variant: "outline" }), "h-9 rounded-full bg-white px-4")}
            href={`/api/exports/monthly?year=${year}&month=${month}`}
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

      <div className="mt-6">
        <DataTable
          title="Periode teknisi"
          description="Periode biaya pada bulan yang dipilih."
          columns={[
            "Teknisi",
            "Cabang",
            "Status",
            { label: "Trip", align: "right" },
            { label: "Total", align: "right" },
            "Aksi",
          ]}
          loading={loading}
          isEmpty={periods.length === 0}
          empty="Belum ada perjalanan bulan ini. Mulai dari menu Input perjalanan."
        >
          {periods.map((period) => (
            <tr key={period.id} className="border-t border-border/70">
              <td className="px-5 py-3.5">{technicianLabel(period.technician)}</td>
              <td className="px-5 py-3.5">{period.branch?.code}</td>
              <td className="px-5 py-3.5">
                <StatusBadge status={period.status} />
              </td>
              <td className="px-5 py-3.5 text-right tabular-nums">{period.tripCount}</td>
              <td className="px-5 py-3.5 text-right tabular-nums">{formatRp(period.totalAmount)}</td>
              <td className="px-5 py-3.5">
                {isWritablePeriod(period.status) ? (
                  <Button size="sm" onClick={() => submit(period.id)}>
                    Ajukan
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </DataTable>
      </div>
    </PageMain>
  );
}
