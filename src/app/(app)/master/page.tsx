"use client";

import { FormEvent, useEffect, useState } from "react";
import { DataTable, FormError, NativeSelect, PageHeader, PageMain } from "@/components/app-ui";
import { FormStep, MasterForm } from "@/components/form-step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage, fetchList } from "@/lib/api";
import { cn, matchesQuery } from "@/lib/utils";

type Tab = "technicians" | "destinations";
type ListState = "loading" | "ready" | "error";
type City = { id: string; name: string };
type Technician = { id: string; code: string; name: string; isActive: boolean };
type Destination = { id: string; name: string; defaultCity: { id: string; name: string } | null };

function emptyListCopy(kind: "teknisi" | "tujuan", query: string, state: ListState) {
  if (state === "error") return `Gagal memuat daftar ${kind}. Coba muat ulang.`;
  if (query.trim()) return `Tidak ada ${kind} yang cocok dengan pencarian.`;
  return `Belum ada ${kind}. Tambah lewat formulir di atas agar muncul di dropdown Input perjalanan.`;
}

function loadRows<T>(path: string, setRows: (rows: T[]) => void, setState: (state: ListState) => void) {
  setState("loading");
  fetchList<T>(path)
    .then((rows) => {
      setRows(rows);
      setState("ready");
    })
    .catch(() => setState("error"));
}

export default function MasterPage() {
  const [tab, setTab] = useState<Tab>("technicians");

  return (
    <PageMain>
      <PageHeader
        title="Data master"
        description="Tambah teknisi dan tujuan di sini. Data yang tersimpan muncul di dropdown Input perjalanan."
      />

      <div className="mt-5 flex gap-2">
        <Button
          type="button"
          variant={tab === "technicians" ? "default" : "outline"}
          onClick={() => setTab("technicians")}
        >
          Teknisi
        </Button>
        <Button
          type="button"
          variant={tab === "destinations" ? "default" : "outline"}
          onClick={() => setTab("destinations")}
        >
          Tujuan
        </Button>
      </div>

      {tab === "technicians" ? <TechnicianMaster /> : <DestinationMaster />}
    </PageMain>
  );
}

function TechnicianMaster() {
  const [rows, setRows] = useState<Technician[]>([]);
  const [query, setQuery] = useState("");
  const [listState, setListState] = useState<ListState>("loading");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const visible = rows.filter((row) => matchesQuery(`${row.code} ${row.name}`, query));

  function load() {
    loadRows("/api/technicians?limit=100", setRows, setListState);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await api("/api/technicians", {
        method: "POST",
        body: JSON.stringify({ code, name }),
      });
      setCode("");
      setName("");
      setPending(false);
      load();
    } catch (err) {
      setError(errorMessage(err, "Gagal menyimpan teknisi"));
      setPending(false);
    }
  }

  async function toggleActive(row: Technician) {
    setError(null);
    try {
      await api(`/api/technicians/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      load();
    } catch (err) {
      setError(errorMessage(err, "Gagal mengubah status teknisi"));
    }
  }

  return (
    <section className="mt-6 grid gap-6">
      <MasterForm title="Tambah teknisi" onSubmit={onSubmit}>
        <ol className="mt-4 grid gap-5">
          <FormStep step={1} title="Kode teknisi" hint="Kode unik, misalnya JKT-001.">
            <Input
              id="tech-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Contoh: JKT-001"
              required
            />
          </FormStep>
          <FormStep step={2} title="Nama teknisi" hint="Nama yang muncul di dropdown Teknisi.">
            <Input
              id="tech-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Budi Santoso"
              required
            />
          </FormStep>
        </ol>
        <FormError message={error} />
        <Button type="submit" className="mt-5" disabled={pending || !code.trim() || !name.trim()}>
          {pending ? "Menyimpan…" : "Simpan teknisi"}
        </Button>
      </MasterForm>

      <DataTable
        title="Teknisi tersimpan"
        search={{ value: query, onChange: setQuery, placeholder: "Cari kode atau nama" }}
        columns={["Kode", "Nama", "Status", "Aksi"]}
        loading={listState === "loading"}
        isEmpty={listState !== "ready" || visible.length === 0}
        empty={emptyListCopy("teknisi", query, listState)}
      >
        {visible.map((row) => (
          <tr key={row.id} className="border-t">
            <td className="px-3 py-2 font-medium">{row.code}</td>
            <td className="px-3 py-2">{row.name}</td>
            <td className="px-3 py-2">
              <span
                className={cn(
                  "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium",
                  row.isActive ? "border-foreground" : "border-dashed text-muted-foreground",
                )}
              >
                {row.isActive ? "Aktif" : "Nonaktif"}
              </span>
            </td>
            <td className="px-3 py-2">
              <Button size="sm" variant="outline" onClick={() => toggleActive(row)}>
                {row.isActive ? "Nonaktifkan" : "Aktifkan"}
              </Button>
            </td>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}

function DestinationMaster() {
  const [cities, setCities] = useState<City[]>([]);
  const [rows, setRows] = useState<Destination[]>([]);
  const [query, setQuery] = useState("");
  const [listState, setListState] = useState<ListState>("loading");
  const [name, setName] = useState("");
  const [defaultCityId, setDefaultCityId] = useState("");
  const [newCityName, setNewCityName] = useState("");
  const [addingCity, setAddingCity] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const visible = rows.filter((row) => matchesQuery(row.name, query));

  function loadDestinations() {
    loadRows("/api/destinations?limit=100", setRows, setListState);
  }

  useEffect(() => {
    fetchList<City>("/api/cities?limit=100")
      .then(setCities)
      .catch(() => setError("Gagal memuat daftar kota"));
    loadDestinations();
  }, []);

  async function addCity() {
    const cityName = newCityName.trim();
    if (!cityName) {
      setError("Isi nama kota baru terlebih dahulu");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const city = await api<City>("/api/cities", {
        method: "POST",
        body: JSON.stringify({ name: cityName }),
      });
      setCities((prev) => [...prev, city].sort((a, b) => a.name.localeCompare(b.name, "id")));
      setDefaultCityId(city.id);
      setNewCityName("");
      setAddingCity(false);
      setPending(false);
    } catch (err) {
      setError(errorMessage(err, "Gagal menyimpan kota"));
      setPending(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await api("/api/destinations", {
        method: "POST",
        body: JSON.stringify({
          name,
          defaultCityId: defaultCityId || null,
        }),
      });
      setName("");
      setDefaultCityId("");
      setNewCityName("");
      setAddingCity(false);
      setPending(false);
      loadDestinations();
    } catch (err) {
      setError(errorMessage(err, "Gagal menyimpan tujuan"));
      setPending(false);
    }
  }

  return (
    <section className="mt-6 grid gap-6">
      <MasterForm title="Tambah tujuan" onSubmit={onSubmit}>
        <ol className="mt-4 grid gap-5">
          <FormStep
            step={1}
            title="Pilih kota"
            hint="Kota ini terisi otomatis saat tujuan dipilih di Input perjalanan."
          >
            <NativeSelect
              id="dest-city"
              value={defaultCityId}
              onChange={(e) => setDefaultCityId(e.target.value)}
            >
              <option value="">Pilih kota</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </NativeSelect>
            {addingCity ? (
              <div className="flex flex-wrap items-end gap-2">
                <div className="grid min-w-48 flex-1 gap-1.5">
                  <Label htmlFor="new-city">Kota baru</Label>
                  <Input
                    id="new-city"
                    value={newCityName}
                    onChange={(e) => setNewCityName(e.target.value)}
                    placeholder="Contoh: Cilegon"
                  />
                </div>
                <Button type="button" size="sm" onClick={() => void addCity()} disabled={pending}>
                  {pending ? "Menambah…" : "Tambah kota"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAddingCity(false);
                    setNewCityName("");
                  }}
                >
                  Batal
                </Button>
              </div>
            ) : (
              <button
                type="button"
                className="justify-self-start text-sm text-muted-foreground underline"
                onClick={() => setAddingCity(true)}
              >
                Kota belum ada? Tambah kota baru
              </button>
            )}
          </FormStep>
          <FormStep step={2} title="Nama tujuan" hint="Nama yang muncul di dropdown Tujuan.">
            <Input
              id="dest-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Dealer Karawang"
              required
            />
          </FormStep>
        </ol>
        <FormError message={error} />
        <Button type="submit" className="mt-5" disabled={pending || !name.trim()}>
          {pending ? "Menyimpan…" : "Simpan tujuan"}
        </Button>
      </MasterForm>

      <DataTable
        title="Tujuan tersimpan"
        search={{ value: query, onChange: setQuery, placeholder: "Cari tujuan" }}
        columns={["Tujuan", "Kota"]}
        loading={listState === "loading"}
        isEmpty={listState !== "ready" || visible.length === 0}
        empty={emptyListCopy("tujuan", query, listState)}
      >
        {visible.map((row) => (
          <tr key={row.id} className="border-t">
            <td className="px-3 py-2">{row.name}</td>
            <td className="px-3 py-2 text-muted-foreground">{row.defaultCity?.name ?? "—"}</td>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}
