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
  return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value)}`;
}

export function formatMonthId(year: number, month: number) {
  return `${MONTHS_ID[month - 1] ?? month} ${year}`;
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
