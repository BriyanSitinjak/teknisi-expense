import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function matchesQuery(value: string, query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return value.toLowerCase().includes(needle)
}
