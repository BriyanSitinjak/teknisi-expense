import { z } from "@hono/zod-openapi";

export const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.record(z.string(), z.string()),
  }),
});

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const uuidParam = z.object({
  id: z.uuid(),
});

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Gunakan format YYYY-MM-DD");

export function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function jsonResponse<T extends z.ZodType>(schema: T, description: string) {
  return {
    content: {
      "application/json": { schema },
    },
    description,
  };
}

export function jsonBody<T extends z.ZodType>(schema: T) {
  return {
    content: {
      "application/json": { schema },
    },
  };
}

export function errorResponses(...statuses: Array<401 | 403 | 404 | 409 | 422 | 429>) {
  const descriptions: Record<number, string> = {
    401: "Tidak terautentikasi",
    403: "Tidak diizinkan",
    404: "Tidak ditemukan",
    409: "Bentrok atau terkunci",
    422: "Tidak valid",
    429: "Terlalu banyak permintaan",
  };

  return Object.fromEntries(
    statuses.map((status) => [
      status,
      jsonResponse(errorSchema, descriptions[status] ?? "Error"),
    ]),
  );
}
