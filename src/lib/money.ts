export function toMoneyInt(value: unknown): number {
  if (typeof value === "number") return value;
  return Number(value);
}
