import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { AppDispatch, RootState } from '../../store';
import { loginThunk } from '../../features/auth/authSlice';

export const LoginForm = () => {
    const dispatch = useDispatch<AppDispatch>();

    const { isLoading, error } = useSelector(
        (state: RootState) => state.auth
    );

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (event: React.SubmitEvent) => {
        event.preventDefault();

        dispatch(
            loginThunk({
                email,
                password,
            })
        );
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2>Вход</h2>

            <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
            />

            <input
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
            />

            {error && (
                <p>{error}</p>
            )}

            <button
                type="submit"
                disabled={isLoading}
            >
                {isLoading ? 'Вход...' : 'Войти'}
            </button>
        </form>
    );
};