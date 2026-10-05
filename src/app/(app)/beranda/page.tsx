"use client";

import { useEffect, useState } from "react";
import { DataTable, FormError, PageHeader, PageMain } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { api, errorMessage, fetchList } from "@/lib/api";
import { isWritablePeriod, PERIOD_STATUS_LABEL } from "@/lib/constants";
import { formatRp, technicianLabel } from "@/lib/format";
import type { PeriodRow } from "@/lib/types";

export default function BerandaPage() {
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  function load() {
    fetchList<PeriodRow>(`/api/periods?year=${year}&month=${month}&limit=50`)
      .then(setPeriods)
      .catch(() => setError("Gagal memuat periode bulan ini"));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(id: string) {
    setError(null);
    try {
      await api(`/api/periods/${id}/submit`, { method: "POST", body: JSON.stringify({}) });
      load();
    } catch (err) {
      setError(errorMessage(err, "Gagal mengajukan"));
    }
  }

  const total = periods.reduce((sum, period) => sum + period.totalAmount, 0);

  return (
    <PageMain>
      <PageHeader title="Beranda" description="Ringkasan bulan berjalan">
        <a
          className="mt-2 inline-block text-sm underline"
          href={`/api/exports/monthly?year=${year}&month=${month}`}
        >
          Unduh Excel bulan ini
        </a>
      </PageHeader>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-sm text-muted-foreground">Total biaya</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatRp(total)}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-sm text-muted-foreground">Periode teknisi</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{periods.length}</p>
        </div>
      </div>

      <FormError message={error} />

      <div className="mt-6">
        <DataTable
          columns={[
            "Teknisi",
            "Cabang",
            "Status",
            { label: "Trip", align: "right" },
            { label: "Total", align: "right" },
            "Aksi",
          ]}
          isEmpty={periods.length === 0}
          empty="Belum ada perjalanan bulan ini. Mulai dari menu Input perjalanan."
        >
          {periods.map((period) => (
            <tr key={period.id} className="border-t">
              <td className="px-3 py-2">
                {technicianLabel(period.technician)}
              </td>
              <td className="px-3 py-2">{period.branch?.code}</td>
              <td className="px-3 py-2">{PERIOD_STATUS_LABEL[period.status] ?? period.status}</td>
              <td className="px-3 py-2 text-right tabular-nums">{period.tripCount}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatRp(period.totalAmount)}</td>
              <td className="px-3 py-2">
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
