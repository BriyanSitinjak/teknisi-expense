import { WRITABLE_PERIOD_STATUSES } from "@/lib/constants";
import { prisma } from "@/server/db/prisma";
import type { SessionUser } from "@/server/auth/session";
import { branchScope } from "@/server/auth/middleware";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PeriodLockedError,
  ValidationError,
} from "@/server/errors";

type PeriodAction = "submit" | "approve" | "reject" | "reopen";

const TRANSITIONS: Record<
  PeriodAction,
  { from: string[]; to: "submitted" | "approved" | "rejected" | "draft"; roles: SessionUser["role"][] }
> = {
  submit: { from: ["draft", "rejected"], to: "submitted", roles: ["hr", "admin"] },
  approve: { from: ["submitted"], to: "approved", roles: ["branch_head", "admin"] },
  reject: { from: ["submitted"], to: "rejected", roles: ["branch_head", "admin"] },
  reopen: { from: ["approved"], to: "draft", roles: ["branch_head", "admin"] },
};

export function assertPeriodWritable(status: string) {
  if (!WRITABLE_PERIOD_STATUSES.includes(status as (typeof WRITABLE_PERIOD_STATUSES)[number])) {
    throw new PeriodLockedError();
  }
}

export async function getPeriodForUser(id: string, user: SessionUser) {
  const period = await prisma.expensePeriod.findFirst({
    where: { id, ...branchScope(user) },
    include: {
      technician: { select: { id: true, code: true, name: true } },
      branch: { select: { id: true, code: true, name: true } },
    },
  });

  if (!period) {
    throw new NotFoundError();
  }

  return period;
}

export async function transitionPeriod(
  id: string,
  action: PeriodAction,
  user: SessionUser,
  reason?: string,
) {
  const spec = TRANSITIONS[action];
  if (!spec.roles.includes(user.role)) {
    throw new ForbiddenError();
  }

  if ((action === "reject" || action === "reopen") && !reason?.trim()) {
    throw new ValidationError("Alasan wajib diisi", { reason: "Alasan wajib diisi" });
  }

  return prisma.$transaction(async (tx) => {
    const period = await tx.expensePeriod.findFirst({
      where: { id, ...branchScope(user) },
    });

    if (!period) {
      throw new NotFoundError();
    }

    if (!spec.from.includes(period.status)) {
      throw new ConflictError("Status periode tidak memungkinkan aksi ini");
    }

    if (action === "submit") {
      const tripCount = await tx.trip.count({ where: { periodId: period.id } });
      if (tripCount < 1) {
        throw new ValidationError("Periode harus punya minimal satu perjalanan");
      }
    }

    const updated = await tx.expensePeriod.update({
      where: { id: period.id },
      data: { status: spec.to },
      include: {
        technician: { select: { id: true, code: true, name: true } },
        branch: { select: { id: true, code: true, name: true } },
      },
    });

    await tx.periodEvent.create({
      data: {
        periodId: period.id,
        eventType: action === "reopen" ? "reopened" : action === "submit" ? "submitted" : action === "approve" ? "approved" : "rejected",
        actorId: user.id,
        reason: reason?.trim() || null,
      },
    });

    return updated;
  });
}

export function serializePeriod(
  period: {
    id: string;
    technicianId: string;
    branchId: string;
    periodYear: number;
    periodMonth: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    technician?: { id: string; code: string; name: string };
    branch?: { id: string; code: string; name: string };
    _count?: { trips: number };
  },
  totals?: { tripCount: number; totalAmount: number },
) {
  return {
    id: period.id,
    technicianId: period.technicianId,
    branchId: period.branchId,
    year: period.periodYear,
    month: period.periodMonth,
    status: period.status as "draft" | "submitted" | "approved" | "rejected",
    createdAt: period.createdAt.toISOString(),
    updatedAt: period.updatedAt.toISOString(),
    technician: period.technician,
    branch: period.branch,
    tripCount: totals?.tripCount ?? period._count?.trips ?? 0,
    totalAmount: totals?.totalAmount ?? 0,
  };
}
