export function formatRp(value: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value)}`;
}

export function formatDateId(value: string | Date): string {
  const iso = typeof value === "string" ? value : value.toISOString().slice(0, 10);
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}
