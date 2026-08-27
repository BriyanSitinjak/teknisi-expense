export const WRITABLE_PERIOD_STATUSES = ["draft", "rejected"] as const;

export const PERIOD_STATUS_LABEL: Record<string, string> = {
  draft: "Draf",
  submitted: "Diajukan",
  approved: "Disetujui",
  rejected: "Ditolak",
};
