export type ApiError = {
  status: number;
  code?: string;
  message: string;
  fields?: Record<string, string>;
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const error: ApiError = {
      status: res.status,
      code: body?.error?.code,
      message: body?.error?.message ?? "Permintaan gagal",
      fields: body?.error?.fields,
    };
    throw error;
  }

  return body as T;
}

export function isApiError(error: unknown): error is ApiError {
  return Boolean(error && typeof error === "object" && "status" in error && "message" in error);
}

export function errorMessage(error: unknown, fallback: string) {
  return isApiError(error) ? error.message : fallback;
}

export async function fetchList<T>(path: string): Promise<T[]> {
  const res = await api<{ data: T[] }>(path);
  return res.data;
}
