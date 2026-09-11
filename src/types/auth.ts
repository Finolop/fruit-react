export interface User {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    roles: string[];
    created_at: string;
}

export interface AuthResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    user?: User;
}

export interface RegisterRequest {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface ErrorDetail {
    field: string;
    message: string;
}

export interface ApiError {
    error: {
        code: string;
        message: string;
        details: ErrorDetail[] | null;
    };
}
