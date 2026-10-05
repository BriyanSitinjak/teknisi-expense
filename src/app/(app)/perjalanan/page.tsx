"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { FormError, NativeSelect, PageHeader, PageMain } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage, fetchList } from "@/lib/api";
import { formatRp } from "@/lib/format";

type Option = { id: string; name: string; code?: string; defaultCityId?: string | null };
type Hint = { odoStart: number | null };
type Saved = { fuelCost: number; distanceKm: number; totalAmount: number; odoGapFlagged: boolean };

function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export default function PerjalananPage() {
  const odoEndRef = useRef<HTMLInputElement>(null);
  const [technicians, setTechnicians] = useState<Option[]>([]);
  const [cities, setCities] = useState<Option[]>([]);
  const [destinations, setDestinations] = useState<Option[]>([]);
  const [technicianId, setTechnicianId] = useState("");
  const [tripDate, setTripDate] = useState(todayIso);
  const [destinationId, setDestinationId] = useState("");
  const [cityId, setCityId] = useState("");
  const [odoStart, setOdoStart] = useState("");
  const [odoEnd, setOdoEnd] = useState("");
  const [tollAmount, setTollAmount] = useState("0");
  const [parkingAmount, setParkingAmount] = useState("0");
  const [mealAmount, setMealAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [recentNotes, setRecentNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [lastSaved, setLastSaved] = useState<Saved | null>(null);

  useEffect(() => {
    Promise.all([
      fetchList<Option>("/api/technicians?active=true&limit=100"),
      fetchList<Option>("/api/cities?limit=100"),
      fetchList<Option & { defaultCityId: string | null }>("/api/destinations?limit=100"),
    ]).then(([tech, city, dest]) => {
      setTechnicians(tech);
      setCities(city);
      setDestinations(dest);
      if (tech[0]) setTechnicianId(tech[0].id);
    });
  }, []);

  useEffect(() => {
    if (!technicianId || !tripDate) return;
    api<Hint>(`/api/trips/odometer-hint?technicianId=${technicianId}&date=${tripDate}`).then((hint) => {
      if (hint.odoStart != null) setOdoStart(String(hint.odoStart));
    });
  }, [technicianId, tripDate]);

  function onDestinationChange(id: string) {
    setDestinationId(id);
    const dest = destinations.find((d) => d.id === id);
    if (dest?.defaultCityId) setCityId(dest.defaultCityId);
  }

  async function save() {
    setError(null);
    setWarning(null);
    setPending(true);
    try {
      const trip = await api<Saved>("/api/trips", {
        method: "POST",
        body: JSON.stringify({
          technicianId,
          tripDate,
          cityId,
          destinationId,
          odoStart: Number(odoStart),
          odoEnd: Number(odoEnd),
          tollAmount: Number(tollAmount) || 0,
          parkingAmount: Number(parkingAmount) || 0,
          mealAmount: Number(mealAmount) || 0,
          notes: notes.trim() || null,
        }),
      });
      setLastSaved(trip);
      if (trip.odoGapFlagged) setWarning("Km awal tidak menyambung dari trip sebelumnya.");
      if (notes.trim()) {
        setRecentNotes((prev) => [notes.trim(), ...prev.filter((n) => n !== notes.trim())].slice(0, 8));
      }
      setOdoStart(odoEnd);
      setOdoEnd("");
      setTollAmount("0");
      setParkingAmount("0");
      setMealAmount("0");
      setNotes("");
      setPending(false);
      requestAnimationFrame(() => odoEndRef.current?.focus());
    } catch (err) {
      setError(errorMessage(err, "Gagal menyimpan"));
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void save();
  }

  const odoInvalid = odoStart !== "" && odoEnd !== "" && Number(odoEnd) <= Number(odoStart);

  return (
    <PageMain>
      <PageHeader
        title="Input perjalanan"
        description="Ctrl+Enter menyimpan dan kembali ke Km Akhir. Teknisi dan tanggal tetap terisi."
      />

      <form
        onSubmit={onSubmit}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            if (!odoInvalid && !pending) void save();
          }
        }}
        className="mt-6 max-w-3xl rounded-xl border border-border bg-white p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="technician">Teknisi</Label>
            <NativeSelect
              id="technician"
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
              required
            >
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} — {t.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tripDate">Tanggal</Label>
            <Input id="tripDate" type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="destination">Tujuan</Label>
            <NativeSelect
              id="destination"
              value={destinationId}
              onChange={(e) => onDestinationChange(e.target.value)}
              required
            >
              <option value="">Pilih tujuan</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="city">Kota</Label>
            <NativeSelect
              id="city"
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              required
            >
              <option value="">Pilih kota</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="odoStart">Km Awal</Label>
            <Input
              id="odoStart"
              className="tabular-nums"
              inputMode="numeric"
              value={odoStart}
              onChange={(e) => setOdoStart(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="odoEnd">Km Akhir</Label>
            <Input
              id="odoEnd"
              ref={odoEndRef}
              className="tabular-nums"
              inputMode="numeric"
              value={odoEnd}
              onChange={(e) => setOdoEnd(e.target.value)}
              required
              aria-invalid={odoInvalid}
            />
            {odoInvalid ? (
              <p className="text-xs text-destructive">Km akhir harus lebih besar dari km awal</p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="toll">Toll</Label>
            <Input id="toll" className="tabular-nums" inputMode="numeric" value={tollAmount} onChange={(e) => setTollAmount(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="parking">Parkir</Label>
            <Input id="parking" className="tabular-nums" inputMode="numeric" value={parkingAmount} onChange={(e) => setParkingAmount(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="meal">Makan</Label>
            <Input id="meal" className="tabular-nums" inputMode="numeric" value={mealAmount} onChange={(e) => setMealAmount(e.target.value)} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="notes">Keterangan</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              list="recent-notes"
            />
            <datalist id="recent-notes">
              {recentNotes.map((note) => (
                <option key={note} value={note} />
              ))}
            </datalist>
          </div>
        </div>

        <FormError message={error} />
        {warning ? (
          <p className="mt-4 text-sm font-medium" role="status">
            {warning}
          </p>
        ) : null}
        {lastSaved ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Tersimpan: {lastSaved.distanceKm} km, BBM {formatRp(lastSaved.fuelCost)}, total{" "}
            {formatRp(lastSaved.totalAmount)}
          </p>
        ) : null}

        <div className="mt-5 flex items-center gap-3">
          <Button type="submit" disabled={pending || odoInvalid}>
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
          <span className="text-xs text-muted-foreground">Ctrl+Enter</span>
        </div>
      </form>
    </PageMain>
  );
}
