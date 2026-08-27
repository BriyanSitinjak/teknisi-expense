import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { Prisma } from "@/generated/prisma/client";
import type { AppEnv } from "@/server/app-env";
import { attachSession } from "@/server/auth/middleware";
import { AppError, ConflictError, errorBody, ValidationError } from "@/server/errors";
import { authRoutes } from "@/server/routes/auth";
import { branchRoutes } from "@/server/routes/branches";
import { cityRoutes } from "@/server/routes/cities";
import { destinationRoutes } from "@/server/routes/destinations";
import { exportRoutes } from "@/server/routes/exports";
import { fuelRateRoutes } from "@/server/routes/fuel-rates";
import { healthRoutes } from "@/server/routes/health";
import { periodRoutes } from "@/server/routes/periods";
import { technicianRoutes } from "@/server/routes/technicians";
import { tripRoutes } from "@/server/routes/trips";

function flattenZod(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_root";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

export const app = new OpenAPIHono<AppEnv>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        errorBody(new ValidationError("Data tidak valid", flattenZod(result.error))),
        422,
      );
    }
  },
}).basePath("/api");

app.use("*", attachSession);

app.route("/", healthRoutes);
app.route("/", authRoutes);
app.route("/", branchRoutes);
app.route("/", cityRoutes);
app.route("/", destinationRoutes);
app.route("/", technicianRoutes);
app.route("/", fuelRateRoutes);
app.route("/", periodRoutes);
app.route("/", tripRoutes);
app.route("/", exportRoutes);

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "Teknisi Expense API",
    version: "0.1.0",
    description: "Biaya operasional teknisi — PT KSA, Divisi Wood Finishing",
  },
});

app.get("/docs", swaggerUI({ url: "/api/openapi.json" }));

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(errorBody(err), err.status as 400);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return c.json(errorBody(new ConflictError()), 409);
  }

  console.error(err);
  return c.json(
    {
      error: {
        code: "INTERNAL",
        message: "Terjadi kesalahan pada server",
        fields: {},
      },
    },
    500,
  );
});

app.notFound((c) => {
  return c.json(errorBody(new AppError("NOT_FOUND", "Data tidak ditemukan", 404)), 404);
});
