"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { CalendarDays, Check, Keyboard, MapPin, User } from "lucide-react";
import { FormError, NativeSelect, PageMain } from "@/components/app-ui";
import { FormSection } from "@/components/form-step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage, fetchList } from "@/lib/api";
import { formatExtraItem, formatIdInt, formatRp } from "@/lib/format";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string; code?: string; defaultCityId?: string | null };
type Hint = { odoStart: number | null };
type Saved = { fuelCost: number; distanceKm: number; totalAmount: number; odoGapFlagged: boolean };
type Rate = { pricePerLiter: number; kmPerLiter: number };

function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function estimatedFuelCost(distance: number, rate: Rate) {
  const kmPerLiterScaled = Math.round(rate.kmPerLiter * 100);
  return Math.round((distance * rate.pricePerLiter * 100) / kmPerLiterScaled);
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

const fieldClass = "h-9 rounded-full bg-white px-3";

function digitsOnly(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.replace(/^0+(?=\d)/, "");
}

function onDigits(setValue: (value: string) => void) {
  return (event: ChangeEvent<HTMLInputElement>) => setValue(digitsOnly(event.target.value));
}

function RupiahInput({
  id,
  value,
  onValue,
  placeholder,
}: {
  id: string;
  value: string;
  onValue: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
        Rp
      </span>
      <Input
        id={id}
        className={cn(fieldClass, "pl-9 tabular-nums")}
        inputMode="numeric"
        autoComplete="off"
        value={formatIdInt(value)}
        onChange={onDigits(onValue)}
        placeholder={placeholder}
      />
    </div>
  );
}

export default function PerjalananPage() {
  const odoEndRef = useRef<HTMLInputElement>(null);
  const [technicians, setTechnicians] = useState<Option[]>([]);
  const [cities, setCities] = useState<Option[]>([]);
  const [destinations, setDestinations] = useState<Option[]>([]);
  const [rate, setRate] = useState<Rate | null>(null);
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
  const [extraTitle, setExtraTitle] = useState("");
  const [extraValue, setExtraValue] = useState("");
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
    });
  }, []);

  useEffect(() => {
    if (!technicianId || !tripDate) {
      setOdoStart("");
      return;
    }
    let cancelled = false;
    api<Hint>(`/api/trips/odometer-hint?technicianId=${technicianId}&date=${tripDate}`)
      .then((hint) => {
        if (cancelled) return;
        setOdoStart(hint.odoStart != null ? String(hint.odoStart) : "");
      })
      .catch(() => {
        if (!cancelled) setOdoStart("");
      });
    return () => {
      cancelled = true;
    };
  }, [technicianId, tripDate]);

  useEffect(() => {
    if (!tripDate) return;
    api<Rate>(`/api/fuel-rates/effective?date=${tripDate}`)
      .then(setRate)
      .catch(() => setRate(null));
  }, [tripDate]);

  function onDestinationChange(id: string) {
    setDestinationId(id);
    const dest = destinations.find((d) => d.id === id);
    setCityId(dest?.defaultCityId ?? "");
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
          extraTitle: extraTitle.trim() || null,
          extraValue: extraValue.trim() || null,
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
      setExtraTitle("");
      setExtraValue("");
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
  const distance =
    odoStart !== "" && odoEnd !== "" && !odoInvalid ? Number(odoEnd) - Number(odoStart) : null;
  const toll = Number(tollAmount) || 0;
  const parking = Number(parkingAmount) || 0;
  const meal = Number(mealAmount) || 0;
  const fuelEstimate = distance != null && rate ? estimatedFuelCost(distance, rate) : null;
  const totalEstimate = (fuelEstimate ?? 0) + toll + parking + meal;
  const canEstimate = distance != null;
  const extraLine = formatExtraItem(extraTitle, extraValue ? formatRp(Number(extraValue)) : "");

  return (
    <PageMain>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Input perjalanan</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Ctrl+Enter menyimpan dan kembali ke Km Akhir. Teknisi dan tanggal tetap terisi.
          </p>
        </div>
        <div className="surface flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
          <Keyboard className="size-4 shrink-0" />
          Ctrl+Enter menyimpan
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            if (!odoInvalid && !pending) void save();
          }
        }}
        className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <div className="grid gap-4">
          <FormSection step={1} title="Teknisi dan tanggal">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="technician" label="Teknisi">
                <div className="relative">
                  <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <NativeSelect
                    id="technician"
                    className="pl-9"
                    value={technicianId}
                    onChange={(e) => {
                      setTechnicianId(e.target.value);
                      setOdoStart("");
                    }}
                    required
                  >
                    <option value="">Pilih teknisi</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} — {t.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </Field>
              <Field id="tripDate" label="Tanggal">
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="tripDate"
                    type="date"
                    className={cn(fieldClass, "pl-9")}
                    value={tripDate}
                    onChange={(e) => setTripDate(e.target.value)}
                    required
                  />
                </div>
              </Field>
            </div>
          </FormSection>

          <FormSection
            step={2}
            title="Tujuan dan kota"
            hint="Kota mengikuti tujuan yang dipilih."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="destination" label="Tujuan">
                <div className="relative">
                  <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <NativeSelect
                    id="destination"
                    className="pl-9"
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
              </Field>
              <Field id="city" label="Kota">
                <NativeSelect
                  id="city"
                  value={cityId}
                  onChange={(e) => setCityId(e.target.value)}
                  disabled={!destinationId}
                  required
                >
                  <option value="">{destinationId ? "Pilih kota" : "Pilih tujuan dulu"}</option>
                  {cities
                    .filter((city) => city.id === destinations.find((d) => d.id === destinationId)?.defaultCityId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </NativeSelect>
              </Field>
            </div>
          </FormSection>

          <FormSection step={3} title="Odometer">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="odoStart" label="Km Awal">
                <Input
                  id="odoStart"
                  className={cn(fieldClass, "tabular-nums")}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  value={odoStart}
                  onChange={onDigits(setOdoStart)}
                  required
                />
              </Field>
              <Field id="odoEnd" label="Km Akhir">
                <Input
                  id="odoEnd"
                  ref={odoEndRef}
                  className={cn(fieldClass, "tabular-nums")}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  value={odoEnd}
                  onChange={onDigits(setOdoEnd)}
                  required
                  aria-invalid={odoInvalid}
                />
                {odoInvalid ? (
                  <p className="text-xs text-destructive">Km akhir harus lebih besar dari km awal</p>
                ) : null}
              </Field>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-muted px-4 py-3">
                <p className="text-xs text-muted-foreground">Jarak</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {distance != null ? `${distance} km` : "—"}
                </p>
              </div>
              <div className="rounded-2xl bg-muted px-4 py-3">
                <p className="text-xs text-muted-foreground">Perkiraan BBM</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {fuelEstimate != null ? formatRp(fuelEstimate) : "—"}
                </p>
              </div>
            </div>
          </FormSection>

          <FormSection step={4} title="Biaya tambahan dan keterangan">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="toll" label="Toll">
                <RupiahInput id="toll" value={tollAmount} onValue={setTollAmount} />
              </Field>
              <Field id="parking" label="Parkir">
                <RupiahInput id="parking" value={parkingAmount} onValue={setParkingAmount} />
              </Field>
              <Field id="meal" label="Makan">
                <RupiahInput id="meal" value={mealAmount} onValue={setMealAmount} />
              </Field>
              <div className="grid gap-3 sm:col-span-3">
                <p className="text-sm text-muted-foreground">
                  Tambah di sini jika ada pengeluaran lainnya.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="extraTitle" label="Judul">
                    <Input
                      id="extraTitle"
                      className={fieldClass}
                      value={extraTitle}
                      onChange={(e) => setExtraTitle(e.target.value)}
                      placeholder="Contoh: Parkir mall"
                    />
                  </Field>
                  <Field id="extraValue" label="Nilai">
                    <RupiahInput
                      id="extraValue"
                      value={extraValue}
                      onValue={setExtraValue}
                      placeholder="15.000"
                    />
                  </Field>
                </div>
              </div>
              <div className="grid gap-1.5 sm:col-span-3">
                <Label htmlFor="notes">Keterangan</Label>
                <Input
                  id="notes"
                  className={fieldClass}
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
          </FormSection>
        </div>

        <aside className="grid gap-4 xl:sticky xl:top-8">
          <div className="surface p-5">
            <p className="text-sm font-semibold tracking-tight">Ringkasan</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Perkiraan di layar. Nominal final dihitung server saat simpan.
            </p>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">BBM{distance != null ? ` (${distance} km)` : ""}</dt>
                <dd className="tabular-nums">{fuelEstimate != null ? formatRp(fuelEstimate) : "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Toll</dt>
                <dd className="tabular-nums">{formatRp(toll)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Parkir</dt>
                <dd className="tabular-nums">{formatRp(parking)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Makan</dt>
                <dd className="tabular-nums">{formatRp(meal)}</dd>
              </div>
              {extraLine ? (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Lainnya</dt>
                  <dd className="text-right">{extraLine}</dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">Perkiraan total</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
                {canEstimate || toll + parking + meal > 0 ? formatRp(totalEstimate) : "—"}
              </p>
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
            <Button type="submit" className="mt-5 h-10 w-full rounded-full" disabled={pending || odoInvalid}>
              <Check className="size-4" />
              {pending ? "Menyimpan…" : "Simpan perjalanan"}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Atau Ctrl+Enter, lalu fokus kembali ke Km Akhir
            </p>
          </div>
        </aside>
      </form>
    </PageMain>
  );
}
