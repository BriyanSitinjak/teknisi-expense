const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function formatRp(value: number): string {
  return `Rp ${formatIdInt(value)}`;
}

export function formatIdInt(value: number | string): string {
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(digits));
}

export function formatMonthId(year: number, month: number) {
  return `${MONTHS_ID[month - 1] ?? month} ${year}`;
}

export function formatDateId(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const name = MONTHS_ID[(month ?? 0) - 1];
  if (!year || !day || !name) return iso;
  return `${day} ${name.slice(0, 3)} ${year}`;
}

export function formatKm(value: number) {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value)} km`;
}

export function monthOptions() {
  return MONTHS_ID.map((label, index) => ({ value: index + 1, label }));
}

export function technicianLabel(technician?: { code?: string; name?: string } | null) {
  return [technician?.code, technician?.name].filter(Boolean).join(" ");
}

export function formatExtraItem(title?: string | null, value?: string | null) {
  const heading = title?.trim() ?? "";
  const body = value?.trim() ?? "";
  if (!heading && !body) return "";
  if (heading && body) return `${heading}: ${body}`;
  return heading || body;
}

export function formatTripKeterangan(
  notes?: string | null,
  extraTitle?: string | null,
  extraValue?: string | null,
) {
  return [notes?.trim(), formatExtraItem(extraTitle, extraValue)].filter(Boolean).join(" · ");
}
