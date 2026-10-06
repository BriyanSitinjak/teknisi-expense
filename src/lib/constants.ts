export type AppRole = "hr" | "branch_head";

export type SessionMe = {
  name: string;
  role: AppRole;
};

export function homePath(role: AppRole) {
  return role === "branch_head" ? "/persetujuan" : "/beranda";
}

export const WRITABLE_PERIOD_STATUSES = ["draft", "rejected"] as const;

export function isWritablePeriod(status: string) {
  return (WRITABLE_PERIOD_STATUSES as readonly string[]).includes(status);
}

export const PERIOD_STATUS_LABEL: Record<string, string> = {
  draft: "Draf",
  submitted: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
};
