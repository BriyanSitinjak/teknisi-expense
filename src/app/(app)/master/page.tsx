"use client";

import { FormEvent, useEffect, useState } from "react";
import { Building2, MapPin, Plus, Users } from "lucide-react";
import { DataTable, FormError, NativeSelect, PageMain, StatTile } from "@/components/app-ui";
import { FormStep, MasterForm } from "@/components/form-step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage, fetchList } from "@/lib/api";
import { cn, matchesQuery } from "@/lib/utils";

type Tab = "technicians" | "destinations";
type ListState = "loading" | "ready" | "error";
type StatusFilter = "all" | "active" | "inactive";
type City = { id: string; name: string };
type Technician = { id: string; code: string; name: string; isActive: boolean };
type Destination = { id: string; name: string; defaultCity: { id: string; name: string } | null };

const fieldClass = "h-9 rounded-full bg-white px-3";

function emptyListCopy(kind: "teknisi" | "tujuan", query: string, state: ListState) {
  if (state === "error") return `Gagal memuat daftar ${kind}. Coba muat ulang.`;
  if (query.trim()) return `Tidak ada ${kind} yang cocok dengan pencarian.`;
  return `Belum ada ${kind}. Tambah lewat formulir agar muncul di dropdown Input perjalanan.`;
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? parts[0]?.[1] ?? ""}`;
  return letters.toUpperCase() || "?";
}

export default function MasterPage() {
  const [tab, setTab] = useState<Tab>("technicians");
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [techState, setTechState] = useState<ListState>("loading");
  const [destState, setDestState] = useState<ListState>("loading");

  function loadTechnicians() {
    loadRows("/api/technicians?limit=100", setTechnicians, setTechState);
  }

  function loadDestinations() {
    loadRows("/api/destinations?limit=100", setDestinations, setDestState);
  }

  function loadCities() {
    fetchList<City>("/api/cities?limit=100")
      .then(setCities)
      .catch(() => undefined);
  }

  useEffect(() => {
    loadTechnicians();
    loadDestinations();
    loadCities();
  }, []);

  function focusForm() {
    const id = tab === "technicians" ? "tech-code" : "dest-city";
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  }

  const activeCount = technicians.filter((row) => row.isActive).length;

  return (
    <PageMain>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Data master</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Kelola teknisi, tujuan, dan kota. Data yang tersimpan muncul di dropdown Input
            perjalanan.
          </p>
        </div>
        <Button
          type="button"
          className="h-9 rounded-full px-4"
          onClick={() => {
            focusForm();
          }}
        >
          <Plus className="size-4" />
          {tab === "technicians" ? "Tambah teknisi" : "Tambah tujuan"}
        </Button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile
          label="Teknisi"
          value={String(technicians.length)}
          hint={technicians.length > 0 ? `${activeCount} aktif` : undefined}
          icon={<Users className="size-4" />}
        />
        <StatTile
          label="Tujuan"
          value={String(destinations.length)}
          icon={<MapPin className="size-4" />}
        />
        <StatTile
          label="Kota"
          value={String(cities.length)}
          icon={<Building2 className="size-4" />}
        />
      </div>

      <div className="mt-6 inline-flex flex-wrap gap-1 rounded-full bg-white p-1">
        <button
          type="button"
          className={cn(
            "h-9 rounded-full px-4 text-sm font-medium transition-colors",
            tab === "technicians" ? "bg-foreground text-background" : "text-muted-foreground",
          )}
          onClick={() => setTab("technicians")}
        >
          Teknisi {technicians.length}
        </button>
        <button
          type="button"
          className={cn(
            "h-9 rounded-full px-4 text-sm font-medium transition-colors",
            tab === "destinations" ? "bg-foreground text-background" : "text-muted-foreground",
          )}
          onClick={() => setTab("destinations")}
        >
          Tujuan {destinations.length}
        </button>
      </div>

      {tab === "technicians" ? (
        <TechnicianMaster
          rows={technicians}
          listState={techState}
          onReload={loadTechnicians}
        />
      ) : (
        <DestinationMaster
          rows={destinations}
          cities={cities}
          listState={destState}
          onReloadDestinations={loadDestinations}
          onCitiesChange={setCities}
        />
      )}
    </PageMain>
  );
}

function TechnicianMaster({
  rows,
  listState,
  onReload,
}: {
  rows: Technician[];
  listState: ListState;
  onReload: () => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const visible = rows.filter((row) => {
    if (status === "active" && !row.isActive) return false;
    if (status === "inactive" && row.isActive) return false;
    return matchesQuery(`${row.code} ${row.name}`, query);
  });

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
      onReload();
      requestAnimationFrame(() => document.getElementById("tech-code")?.focus());
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
      onReload();
    } catch (err) {
      setError(errorMessage(err, "Gagal mengubah status teknisi"));
    }
  }

  return (
    <section className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <DataTable
        title="Daftar teknisi"
        description="Nama dan kode yang dipakai di Input perjalanan."
        search={{ value: query, onChange: setQuery, placeholder: "Cari kode atau nama" }}
        extra={
          <NativeSelect
            aria-label="Status teknisi"
            className="w-auto"
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
          >
            <option value="all">Semua status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </NativeSelect>
        }
        columns={["Kode", "Nama", "Status", "Aksi"]}
        loading={listState === "loading"}
        isEmpty={listState !== "ready" || visible.length === 0}
        empty={emptyListCopy("teknisi", query, listState)}
      >
        {visible.map((row) => (
          <tr key={row.id} className="border-t border-border/70">
            <td className="px-5 py-3.5 font-medium">{row.code}</td>
            <td className="px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {initials(row.name)}
                </span>
                {row.name}
              </div>
            </td>
            <td className="px-5 py-3.5">
              <span
                className={cn(
                  "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  row.isActive ? "border-foreground" : "border-dashed text-muted-foreground",
                )}
              >
                {row.isActive ? "Aktif" : "Nonaktif"}
              </span>
            </td>
            <td className="px-5 py-3.5">
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => toggleActive(row)}>
                {row.isActive ? "Nonaktifkan" : "Aktifkan"}
              </Button>
            </td>
          </tr>
        ))}
      </DataTable>

      <div className="grid gap-4 xl:sticky xl:top-8">
        <MasterForm
          title="Tambah teknisi"
          description="Isi kode dan nama. Teknisi baru langsung bisa dipilih di Input perjalanan."
          onSubmit={onSubmit}
        >
          <ol className="mt-4 grid gap-5">
            <FormStep step={1} title="Kode teknisi" hint="Kode unik, misalnya JKT-001.">
              <Input
                id="tech-code"
                className={fieldClass}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Contoh: JKT-001"
                required
              />
            </FormStep>
            <FormStep step={2} title="Nama teknisi" hint="Nama yang muncul di dropdown Teknisi.">
              <Input
                id="tech-name"
                className={fieldClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                required
              />
            </FormStep>
          </ol>
          <FormError message={error} />
          <Button
            type="submit"
            className="mt-5 h-9 w-full rounded-full"
            disabled={pending || !code.trim() || !name.trim()}
          >
            {pending ? "Menyimpan…" : "Simpan teknisi"}
          </Button>
        </MasterForm>
      </div>
    </section>
  );
}

function DestinationMaster({
  rows,
  cities,
  listState,
  onReloadDestinations,
  onCitiesChange,
}: {
  rows: Destination[];
  cities: City[];
  listState: ListState;
  onReloadDestinations: () => void;
  onCitiesChange: (cities: City[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [defaultCityId, setDefaultCityId] = useState("");
  const [newCityName, setNewCityName] = useState("");
  const [addingCity, setAddingCity] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const visible = rows.filter((row) => matchesQuery(row.name, query));

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
      onCitiesChange([...cities, city].sort((a, b) => a.name.localeCompare(b.name, "id")));
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
      onReloadDestinations();
      requestAnimationFrame(() => document.getElementById("dest-city")?.focus());
    } catch (err) {
      setError(errorMessage(err, "Gagal menyimpan tujuan"));
      setPending(false);
    }
  }

  return (
    <section className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <DataTable
        title="Daftar tujuan"
        description="Tujuan dan kota default untuk Input perjalanan."
        search={{ value: query, onChange: setQuery, placeholder: "Cari tujuan" }}
        columns={["Tujuan", "Kota"]}
        loading={listState === "loading"}
        isEmpty={listState !== "ready" || visible.length === 0}
        empty={emptyListCopy("tujuan", query, listState)}
      >
        {visible.map((row) => (
          <tr key={row.id} className="border-t border-border/70">
            <td className="px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <MapPin className="size-4" />
                </span>
                {row.name}
              </div>
            </td>
            <td className="px-5 py-3.5 text-muted-foreground">{row.defaultCity?.name ?? "—"}</td>
          </tr>
        ))}
      </DataTable>

      <div className="grid gap-4 xl:sticky xl:top-8">
        <MasterForm
          title="Tambah tujuan"
          description="Pilih kota default, lalu isi nama tujuan."
          onSubmit={onSubmit}
        >
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
                      className={fieldClass}
                      value={newCityName}
                      onChange={(e) => setNewCityName(e.target.value)}
                      placeholder="Contoh: Cilegon"
                    />
                  </div>
                  <Button type="button" size="sm" className="rounded-full" onClick={() => void addCity()} disabled={pending}>
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
                className={fieldClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Dealer Karawang"
                required
              />
            </FormStep>
          </ol>
          <FormError message={error} />
          <Button type="submit" className="mt-5 h-9 w-full rounded-full" disabled={pending || !name.trim()}>
            {pending ? "Menyimpan…" : "Simpan tujuan"}
          </Button>
        </MasterForm>
      </div>
    </section>
  );
}
