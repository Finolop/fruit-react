import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";

import {
  login,
  register,
  logout,
  refresh,
  getMe,
  AuthApiError,
} from "../../api/apiAuth";

import { User } from "../../types/auth";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isLoading: false,
  error: null,
};

export const loginThunk = createAsyncThunk(
  "auth/login",
  async (
    { email, password }: { email: string; password: string },
    { rejectWithValue },
  ) => {
    try {
      return await login(email, password);
    } catch (error) {
      if (error instanceof AuthApiError) {
        return rejectWithValue(error.message);
      }

      return rejectWithValue("Ошибка входа");
    }
  },
);

export const registerThunk = createAsyncThunk(
  "auth/register",
  async (
    {
      email,
      password,
      first_name,
      last_name,
    }: {
      email: string;
      password: string;
      first_name: string;
      last_name: string;
    },
    { rejectWithValue },
  ) => {
    try {
      return await register(email, password, first_name, last_name);
    } catch (error) {
      if (error instanceof AuthApiError) {
        return rejectWithValue(error.message);
      }

      return rejectWithValue("Ошибка регистрации");
    }
  },
);

export const restoreSessionThunk = createAsyncThunk(
  "auth/restoreSession",
  async (_, { rejectWithValue }) => {
    try {
      const { access_token } = await refresh();

      const user = await getMe(access_token);

      return {
        access_token,
        user,
      };
    } catch (error) {
      if (error instanceof AuthApiError) {
        return rejectWithValue(error.message);
      }

      return rejectWithValue("Сессия истекла");
    }
  },
);

export const logoutThunk = createAsyncThunk(
  "auth/logout",
  async (_, { rejectWithValue }) => {
    try {
      return await logout();
    } catch (error) {
      if (error instanceof AuthApiError) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue("Ошибка выхода");
    }
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState,

  reducers: {
    clearError(state) {
      state.error = null;
    },

    setAccessToken(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
    },

    clearAuth(state) {
      state.user = null;
      state.accessToken = null;
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    builder

      // LOGIN
      .addCase(loginThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })

      .addCase(loginThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.accessToken = action.payload.access_token;
        state.user = action.payload.user ?? null;
      })

      .addCase(loginThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // REGISTER
      .addCase(registerThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })

      .addCase(registerThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.accessToken = action.payload.access_token;
        state.user = action.payload.user ?? null;
      })

      .addCase(registerThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // RESTORE SESSION
      .addCase(restoreSessionThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })

      .addCase(restoreSessionThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.accessToken = action.payload.access_token;
        state.user = action.payload.user;
      })

      .addCase(restoreSessionThunk.rejected, (state) => {
        state.isLoading = false;
        state.accessToken = null;
        state.user = null;
      })

      // LOGOUT
      .addCase(logoutThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })

      .addCase(logoutThunk.fulfilled, (state) => {
        state.isLoading = false;
        state.user = null;
        state.accessToken = null;
        state.error = null;
      })

      .addCase(logoutThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, setAccessToken, clearAuth } = authSlice.actions;

export default authSlice.reducer;
