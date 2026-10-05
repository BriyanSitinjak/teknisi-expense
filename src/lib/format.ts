export function formatRp(value: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value)}`;
}

export function technicianLabel(technician?: { code?: string; name?: string } | null) {
  return [technician?.code, technician?.name].filter(Boolean).join(" ");
}
