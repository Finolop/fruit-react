import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { AppDispatch, RootState } from '../../store';
import { registerThunk } from '../../features/auth/authSlice';

export const RegisterForm = () => {
    const dispatch = useDispatch<AppDispatch>();

    const { isLoading, error } = useSelector(
        (state: RootState) => state.auth
    );

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');

    const handleSubmit = (event: React.SubmitEvent) => {
        event.preventDefault();

        dispatch(
            registerThunk({
                email,
                password,
                first_name: firstName,
                last_name: lastName,
            })
        );
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2>Регистрация</h2>

            <input
                type="text"
                placeholder="Имя"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
            />

            <input
                type="text"
                placeholder="Фамилия"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
            />

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
                {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
        </form>
    );
};