import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { RootState, AppDispatch } from '../store';
import { createAuthFetch } from '../api/apiAuth';
import { setAccessToken, clearAuth } from '../features/auth/authSlice';

export const useAuthFetch = () => {
    const dispatch = useDispatch<AppDispatch>();

    const accessToken = useSelector(
        (state: RootState) => state.auth.accessToken
    );

    const authFetch = useCallback(
        async (input: string, init: RequestInit = {}) => {
            const fetchWithAuth = createAuthFetch(
                () => accessToken,
                (token) => dispatch(setAccessToken(token)),
                () => dispatch(clearAuth())
            );

            return fetchWithAuth(input, init);
        },
        [accessToken, dispatch]
    );

    return authFetch;
};