"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api, isApiError } from "@/lib/api";
import { formatRp } from "@/lib/format";
import { PERIOD_STATUS_LABEL } from "@/lib/constants";

type Period = {
  id: string;
  year: number;
  month: number;
  status: string;
  tripCount: number;
  totalAmount: number;
  technician?: { code: string; name: string };
  branch?: { code: string };
};

export default function BerandaPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  function load() {
    api<{ data: Period[] }>(`/api/periods?year=${year}&month=${month}&limit=50`)
      .then((res) => setPeriods(res.data))
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
      setError(isApiError(err) ? err.message : "Gagal mengajukan");
    }
  }

  const total = periods.reduce((sum, p) => sum + p.totalAmount, 0);

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Beranda</h1>
      <p className="mt-1 text-sm text-muted-foreground">Ringkasan bulan berjalan</p>
      <a
        className="mt-2 inline-block text-sm underline"
        href={`/api/exports/monthly?year=${year}&month=${month}`}
      >
        Unduh Excel bulan ini
      </a>

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

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Teknisi</th>
              <th className="px-3 py-2 font-medium">Cabang</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Trip</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
              <th className="px-3 py-2 font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {periods.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  Belum ada perjalanan bulan ini. Mulai dari menu Input perjalanan.
                </td>
              </tr>
            ) : (
              periods.map((period) => (
                <tr key={period.id} className="border-t">
                  <td className="px-3 py-2">
                    {period.technician?.code} {period.technician?.name}
                  </td>
                  <td className="px-3 py-2">{period.branch?.code}</td>
                  <td className="px-3 py-2">{PERIOD_STATUS_LABEL[period.status] ?? period.status}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{period.tripCount}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatRp(period.totalAmount)}</td>
                  <td className="px-3 py-2">
                    {period.status === "draft" || period.status === "rejected" ? (
                      <Button size="sm" onClick={() => submit(period.id)}>
                        Ajukan
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
