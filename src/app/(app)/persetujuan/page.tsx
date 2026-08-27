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

export default function PersetujuanPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});

  function load() {
    api<{ data: Period[] }>("/api/periods?status=submitted&limit=100")
      .then((res) => setPeriods(res.data))
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
      setError(isApiError(err) ? err.message : "Aksi gagal");
    }
  }

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Menunggu persetujuan</h1>
      <p className="mt-1 text-sm text-muted-foreground">Periode yang sudah diajukan HR</p>
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Teknisi</th>
              <th className="px-3 py-2 font-medium">Periode</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
              <th className="px-3 py-2 font-medium">Alasan tolak</th>
              <th className="px-3 py-2 font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {periods.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  Tidak ada periode menunggu persetujuan.
                </td>
              </tr>
            ) : (
              periods.map((period) => (
                <tr key={period.id} className="border-t">
                  <td className="px-3 py-2">
                    {period.technician?.code} {period.technician?.name}
                  </td>
                  <td className="px-3 py-2">
                    {String(period.month).padStart(2, "0")}/{period.year} ·{" "}
                    {PERIOD_STATUS_LABEL[period.status]}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatRp(period.totalAmount)}</td>
                  <td className="px-3 py-2">
                    <input
                      className="h-8 w-full rounded-lg border border-input px-2 text-sm"
                      value={reasonById[period.id] ?? ""}
                      onChange={(e) =>
                        setReasonById((prev) => ({ ...prev, [period.id]: e.target.value }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => act(period.id, "approve")}>
                        Setujui
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => act(period.id, "reject")}
                      >
                        Tolak
                      </Button>
                    </div>
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
