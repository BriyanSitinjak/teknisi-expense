export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "PERIOD_LOCKED"
  | "CONFLICT"
  | "RATE_NOT_FOUND"
  | "RATE_LIMITED";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Sesi tidak valid atau telah berakhir") {
    super("UNAUTHENTICATED", message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Anda tidak memiliki akses") {
    super("FORBIDDEN", message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Data tidak ditemukan") {
    super("NOT_FOUND", message, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Data tidak valid", fields: Record<string, string> = {}) {
    super("VALIDATION_ERROR", message, 422, fields);
  }
}

export class PeriodLockedError extends AppError {
  constructor(message = "Periode sudah dikunci") {
    super("PERIOD_LOCKED", message, 409);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Data bentrok") {
    super("CONFLICT", message, 409);
  }
}

export class RateNotFoundError extends AppError {
  constructor(message = "Tarif BBM tidak ditemukan untuk tanggal ini") {
    super("RATE_NOT_FOUND", message, 422);
  }
}

export function errorBody(error: AppError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      fields: error.fields,
    },
  };
}
