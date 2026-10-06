"use client";

import { useEffect, useState } from "react";
import { DataTable, FormError, PageHeader, PageMain } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { api, errorMessage, fetchList } from "@/lib/api";
import { formatMonthId, formatRp, technicianLabel } from "@/lib/format";
import type { PeriodRow } from "@/lib/types";

export default function PersetujuanPage() {
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});

  function load() {
    fetchList<PeriodRow>("/api/periods?status=submitted&limit=100")
      .then(setPeriods)
      .catch(() => setError("Gagal memuat antrian persetujuan"));
  }

  useEffect(() => {
    load();
  }, []);

  async function act(id: string, action: "approve" | "reject") {
    setError(null);
    try {
      await api(`/api/periods/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ reason: reasonById[id] }),
      });
      load();
    } catch (err) {
      setError(errorMessage(err, "Aksi gagal"));
    }
  }

  return (
    <PageMain>
      <PageHeader title="Menunggu persetujuan" description="Periode yang sudah diajukan HR" />
      <FormError message={error} />

      <div className="mt-6">
        <DataTable
          columns={[
            "Teknisi",
            "Periode",
            { label: "Total", align: "right" },
            "Alasan tolak",
            "Aksi",
          ]}
          isEmpty={periods.length === 0}
          empty="Tidak ada periode menunggu persetujuan."
        >
          {periods.map((period) => (
            <tr key={period.id} className="border-t">
              <td className="px-5 py-3.5">
                {technicianLabel(period.technician)}
              </td>
              <td className="px-5 py-3.5">{formatMonthId(period.year, period.month)}</td>
              <td className="px-5 py-3.5 text-right tabular-nums">{formatRp(period.totalAmount)}</td>
              <td className="px-5 py-3.5">
                <input
                  className="h-8 w-full rounded-lg border border-input px-2 text-sm"
                  value={reasonById[period.id] ?? ""}
                  onChange={(e) =>
                    setReasonById((prev) => ({ ...prev, [period.id]: e.target.value }))
                  }
                />
              </td>
              <td className="px-5 py-3.5">
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => act(period.id, "approve")}>
                    Setujui
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => act(period.id, "reject")}>
                    Tolak
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>
    </PageMain>
  );
}
