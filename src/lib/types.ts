export type PeriodRow = {
  id: string;
  year: number;
  month: number;
  status: string;
  tripCount: number;
  totalAmount: number;
  technician?: { code: string; name: string };
  branch?: { code: string };
};
