import { getToken } from "./auth";

export interface AccountSummary {
  id: number;
  email: string;
  createdAt?: string;
}

export interface CharacterSummary {
  id: number;
  name: string;
  level: number;
  createdAt: string;
}

export interface LoginResponse {
  token: string;
  account: AccountSummary;
}

export interface CharactersListResponse {
  characters: CharacterSummary[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail?: string,
  ) {
    super(detail ?? code);
  }
}

async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: "PARSE_ERROR", raw: text };
    }
  }

  if (!res.ok) {
    const errObj = (body as { error?: string; message?: string }) ?? {};
    throw new ApiError(res.status, errObj.error ?? "UNKNOWN_ERROR", errObj.message);
  }

  return body as T;
}

export function register(email: string, password: string): Promise<AccountSummary> {
  return jsonRequest<AccountSummary>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return jsonRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function listCharacters(): Promise<CharactersListResponse> {
  return jsonRequest<CharactersListResponse>("/characters/");
}

export function createCharacter(name: string): Promise<CharacterSummary> {
  return jsonRequest<CharacterSummary>("/characters/", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}
