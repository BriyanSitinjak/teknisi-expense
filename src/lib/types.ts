export type PeriodRow = {
  id: string;
  year: number;
  month: number;
  status: string;
  tripCount: number;
  totalAmount: number;
  lastReason?: string | null;
  technician?: { code: string; name: string };
  branch?: { code: string };
};
