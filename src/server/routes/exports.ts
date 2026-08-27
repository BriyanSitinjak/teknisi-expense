import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppEnv } from "@/server/app-env";
import { requireAuth } from "@/server/auth/middleware";
import { exportMonthly } from "@/server/services/export";
import { errorResponses } from "@/server/openapi";

const exportRoute = createRoute({
  method: "get",
  path: "/exports/monthly",
  tags: ["Exports"],
  middleware: [requireAuth],
  request: {
    query: z.object({
      year: z.coerce.number().int().min(2000),
      month: z.coerce.number().int().min(1).max(12),
      branchId: z.uuid().optional(),
    }),
  },
  responses: {
    200: {
      description: "Berkas Excel",
      content: {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
          schema: { type: "string", format: "binary" },
        },
      },
    },
    ...errorResponses(401, 404, 422),
  },
});

export const exportRoutes = new OpenAPIHono<AppEnv>().openapi(exportRoute, async (c) => {
  const user = c.get("user");
  const { year, month, branchId } = c.req.valid("query");
  const { buffer, filename } = await exportMonthly(user, year, month, branchId);
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
