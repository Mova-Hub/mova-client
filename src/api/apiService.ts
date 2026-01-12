// src/api/apiService.ts
// Utility to make authenticated API requests to the Laravel backend (Sanctum tokens).
// - Type-safe request/response
// - Graceful handling of 204/JSON/non-JSON
// - LocalStorage token helpers
// - Small helper for query strings

export const API_BASE_URL = "https://api.mova-mobility.com/api"; // fallback to current URL
// export const API_BASE_URL = "http://127.0.0.1:8000/api"; // fallback to current URL

/** Shape of an API error response from Laravel (typical). */
export interface ApiErrorPayload {
  message?: string;
  errors?: Record<string, string[] | string>;
}

/** Error thrown by apiService.request on non-2xx. */
export class ApiError extends Error {
  status: number;
  payload?: ApiErrorPayload;
  constructor(status: number, message: string, payload?: ApiErrorPayload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

/** Result returned by apiService methods. */
export type ApiResult<T> = {
  success: true;
  data: T;
  status: number;
};

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Avoid SSR crashes when localStorage isn't available. */
function hasWindow() {
  return typeof window !== "undefined";
}

const TOKEN_KEY = "authToken";

const storage = {
  getToken(): string | null {
    if (!hasWindow()) return null;
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  setToken(token: string) {
    if (!hasWindow()) return;
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch {}
  },
  removeToken() {
    if (!hasWindow()) return;
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {}
  },
};

/** Build query strings easily e.g. buildQuery({ page:1, q:"bus" }) -> "?page=1&q=bus" */
export function buildQuery(params?: Record<string, unknown>): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(
    // keep 0/false but drop null/undefined/empty string
    ([, v]) => v !== null && v !== undefined && String(v) !== ""
  );
  if (entries.length === 0) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of entries) sp.append(k, String(v));
  return `?${sp.toString()}`;
}

async function doFetch<TRes>(
  method: HttpMethod,
  path: string,
  body?: unknown
): Promise<ApiResult<TRes>> {
  const token = storage.getToken();

  const headers: HeadersInit = {
    Accept: "application/json",
  };

  // Only set JSON content-type if we actually send a body (GET/DELETE normally don't)
  const withBody = body !== undefined && body !== null;
  if (withBody) headers["Content-Type"] = "application/json";

  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: withBody ? JSON.stringify(body) : undefined,
    // credentials: "omit", // token is in Authorization header
  });

  // 204 No Content
  if (res.status === 204) {
    return { success: true, data: null as unknown as TRes, status: res.status };
  }

  const contentType = res.headers.get("content-type") ?? "";

  // JSON response
  if (contentType.includes("application/json")) {
    const json = (await res.json()) as unknown;

    if (!res.ok) {
      // Try to parse Laravel-ish error shape
      const payload = (json ?? {}) as ApiErrorPayload;
      const msg =
        payload.message ||
        `Requête API échouée (${res.status})`;
      throw new ApiError(res.status, msg, payload);
    }

    return { success: true, data: json as TRes, status: res.status };
  }

  // Non-JSON (HTML, text, etc.)
  const text = await res.text();
  if (!res.ok) {
    const msg = `Réponse inattendue (${res.status}): ${text.slice(0, 120)}`;
    throw new ApiError(res.status, msg);
  }

  // If backend ever returns text on 200 (rare), surface as-is.
  return { success: true, data: text as unknown as TRes, status: res.status };
}

/** Public API — strongly typed helpers */
export const apiService = {
  getToken: storage.getToken,
  setToken: storage.setToken,
  removeToken: storage.removeToken,

  // Generic calls (you can supply response/body types)
  get<TRes = unknown>(path: string) {
    return doFetch<TRes>("GET", path);
  },
  post<TRes = unknown, TBody = unknown>(path: string, data?: TBody) {
    return doFetch<TRes>("POST", path, data);
  },
  put<TRes = unknown, TBody = unknown>(path: string, data?: TBody) {
    return doFetch<TRes>("PUT", path, data);
  },
  patch<TRes = unknown, TBody = unknown>(path: string, data?: TBody) {
    return doFetch<TRes>("PATCH", path, data);
  },
  delete<TRes = unknown>(path: string) {
    return doFetch<TRes>("DELETE", path);
  },

};

export default apiService;
