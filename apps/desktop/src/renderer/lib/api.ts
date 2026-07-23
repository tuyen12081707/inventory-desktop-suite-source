const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

let accessToken: string | null = null;
let refreshSession: (() => Promise<string | null>) | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly issues?: Array<{ path: string; message: string }>,
  ) {
    super(message);
  }
}

export function configureApi(options: {
  token: string | null;
  refresh: (() => Promise<string | null>) | null;
}): void {
  accessToken = options.token;
  refreshSession = options.refresh;
}

export async function publicPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) }, false);
}

export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  return request<T>(path, options, true, retry);
}

async function request<T>(
  path: string,
  options: RequestInit,
  authenticated: boolean,
  retry = false,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (authenticated && accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 401 && authenticated && retry && refreshSession) {
    const token = await refreshSession();
    if (token) return request<T>(path, options, true, false);
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      message?: string | string[];
      code?: string;
      issues?: Array<{ path: string; message: string }>;
    };
    const message = Array.isArray(payload.message)
      ? payload.message.join(', ')
      : (payload.message ?? `HTTP ${response.status}`);
    throw new ApiError(message, response.status, payload.code, payload.issues);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
