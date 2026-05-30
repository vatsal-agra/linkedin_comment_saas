// Typed API client for the LinkedIn Replier backend.

const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const TOKEN_KEY = "lr_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string): void {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function extractDetail(j: unknown, fallback: string): string {
  if (j && typeof j === "object" && "detail" in j) {
    const d = (j as { detail: unknown }).detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d.length && typeof d[0] === "object" && d[0] && "msg" in d[0]) {
      return (d[0] as { msg: string }).msg;
    }
    return JSON.stringify(d);
  }
  return fallback;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  auth = true
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const t = getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection or API URL.");
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = extractDetail(await res.json(), res.statusText);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---- Types -------------------------------------------------------------
export interface TokenResponse {
  access_token: string;
  token_type: string;
  onboarded: boolean;
}
export interface User {
  id: number;
  email: string;
  onboarded: boolean;
}
export interface KeysStatus {
  apify_set: boolean;
  gemini_set: boolean;
  telegram_bot_set: boolean;
  telegram_chat_set: boolean;
}
export interface Settings {
  gemini_model: string;
  relevance_threshold: number;
  posts_per_profile: number;
  max_drafts_per_account: number;
  schedule_hour: number;
  schedule_minute: number;
  timezone: string;
  enabled: boolean;
  profile_text: string;
  style_samples: string;
  last_run_at: string | null;
  keys: KeysStatus;
}
export interface Profile {
  id: number;
  url: string;
  created_at: string;
}
export interface Run {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: string;
  trigger: string;
  posts_fetched: number;
  drafts_count: number;
  message: string;
}
export interface ChatOption {
  chat_id: string;
  type: string;
  name: string;
}

// ---- Endpoints ---------------------------------------------------------
export const api = {
  signup: (email: string, password: string) =>
    request<TokenResponse>("POST", "/auth/signup", { email, password }, false),
  login: (email: string, password: string) =>
    request<TokenResponse>("POST", "/auth/login", { email, password }, false),
  me: () => request<User>("GET", "/auth/me"),

  getSettings: () => request<Settings>("GET", "/settings"),
  updateSettings: (patch: Partial<Settings>) =>
    request<Settings>("PUT", "/settings", patch),
  updateKeys: (keys: {
    apify_key?: string;
    gemini_key?: string;
    telegram_bot_token?: string;
    telegram_chat_id?: string;
  }) => request<Settings>("PUT", "/settings/keys", keys),

  listProfiles: () => request<Profile[]>("GET", "/profiles"),
  addProfile: (url: string) => request<Profile>("POST", "/profiles", { url }),
  addBulk: (urls: string[]) =>
    request<Profile[]>("POST", "/profiles/bulk", { urls }),
  suggestProfiles: () =>
    request<{ urls: string[] }>("POST", "/profiles/suggest"),
  deleteProfile: (id: number) =>
    request<{ message: string }>("DELETE", `/profiles/${id}`),

  listRuns: () => request<Run[]>("GET", "/runs"),
  nextRun: () => request<{ next_run_at: string | null }>("GET", "/runs/next"),
  triggerTest: () => request<{ message: string }>("POST", "/runs/test"),
  resetSeenPosts: () => request<{ message: string }>("DELETE", "/runs/seen-posts"),

  discoverChatId: (bot_token: string) =>
    request<{ chats: ChatOption[] }>("POST", "/telegram/discover-chat-id", {
      bot_token,
    }),
};
