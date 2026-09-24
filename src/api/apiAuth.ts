import {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  User,
  ApiError as ApiErrorBody,
  ErrorDetail,
} from "../types/auth";

const API_URL = '';

export class AuthApiError extends Error {
  code: string;
  details: ErrorDetail[] | null;
  status: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.status = status;
    this.code = body.error.code;
    this.details = body.error.details;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: ApiErrorBody;
    try {
      body = await res.json();
    } catch {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
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
  const res = await fetch(`${API_URL}/api/auth/register`, {
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
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password } as LoginRequest),
  });
  return handleResponse<AuthResponse>(res);
};

export const refresh = async (): Promise<AuthResponse> => {
  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  return handleResponse<AuthResponse>(res);
};

export const getMe = async (accessToken: string): Promise<User> => {
  const res = await fetch(`${API_URL}/api/auth/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: "include",
  });
  return handleResponse<User>(res);
};

export const logout = async (): Promise<{ message: string }> => {
  const res = await fetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  return handleResponse(res);
};

export const logoutAll = async (
  accessToken: string,
): Promise<{ message: string }> => {
  const res = await fetch(`${API_URL}/api/auth/logout-all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: "include",
  });
  return handleResponse(res);
};

type AccessTokenGetter = () => string | null;
type AccessTokenSetter = (token: string) => void;

//  При 401 один раз пытается обновить access_token через /api/auth/refresh
export const createAuthFetch = (
  getAccessToken: AccessTokenGetter,
  setAccessToken: AccessTokenSetter,
  onRefreshFail: () => void,
) => {
  return async function authFetch(
    input: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const attempt = async (): Promise<Response> => {
      const token = getAccessToken();
      return fetch(`${API_URL}${input}`, {
        ...init,
        credentials: "include",
        headers: {
          ...(init.headers || {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    };

    let res = await attempt();

    if (res.status === 401) {
      try {
        const refreshed = await refresh();
        setAccessToken(refreshed.access_token);
        res = await attempt();
      } catch {
        onRefreshFail();
        return res;
      }
    }

    return res;
  };
};
