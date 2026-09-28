import {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  User,
  ApiError as ApiErrorBody,
  ErrorDetail,
} from "../types/auth";

const API_URL = process.env.REACT_APP_API_URL || "";

export class AuthApiError extends Error {
  code: string;
  details: ErrorDetail[] | null;
  status: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body?.error?.message || "Ошибка авторизации");
    this.status = status;
    this.code = body?.error?.code || "UNKNOWN_ERROR";
    this.details = body?.error?.details || null;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: any;
    try {
      body = await res.json();
    } catch {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    if (body.detail && !body.error) {
      body = {
        error: {
          message:
            typeof body.detail === "string" ? body.detail : "Validation Error",
          code: "VALIDATION_ERROR",
          details: Array.isArray(body.detail) ? body.detail : null,
        },
      };
    }
    throw new AuthApiError(res.status, body);
  }
  return res.json();
}

export const register = async (
  email: string,
  password: string,
  first_name: string,
  last_name: string,
): Promise<AuthResponse> => {
  const res = await fetch(`${API_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      email,
      password,
      first_name,
      last_name,
    } as RegisterRequest),
  });
  return handleResponse<AuthResponse>(res);
};

export const login = async (
  email: string,
  password: string,
): Promise<AuthResponse> => {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password } as LoginRequest),
  });
  return handleResponse<AuthResponse>(res);
};

export const refresh = async (): Promise<AuthResponse> => {
  const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  return handleResponse<AuthResponse>(res);
};

export const getMe = async (accessToken: string): Promise<User> => {
  const res = await fetch(`${API_URL}/api/v1/auth/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: "include",
  });
  return handleResponse<User>(res);
};

export const logout = async (): Promise<{ message: string }> => {
  const res = await fetch(`${API_URL}/api/v1/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  return handleResponse(res);
};

export const logoutAll = async (
  accessToken: string,
): Promise<{ message: string }> => {
  const res = await fetch(`${API_URL}/api/v1/auth/logout-all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: "include",
  });
  return handleResponse(res);
};