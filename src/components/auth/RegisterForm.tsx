import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { AppDispatch, RootState } from '../../store';
import { registerThunk } from '../../features/auth/authSlice';
import '../../styles/RegisterForm.css';

export const RegisterForm = () => {
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();

    const { isLoading, error } = useSelector(
        (state: RootState) => state.auth
    );

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');

    const handleSubmit = async (event: React.SubmitEvent) => {
        event.preventDefault();

        const result = await dispatch(
            registerThunk({
                email,
                password,
                first_name: firstName,
                last_name: lastName,
            })
        );

        if (registerThunk.fulfilled.match(result)) {
            navigate('/');
        }
    };

    return (
<form className="form" onSubmit={handleSubmit}>
        <h1 className="title">Регистрация</h1>

        <div className="fields">
          <div className="field">
            <label htmlFor="firstName" className="label">
              Имя
            </label>

            <input
              id="firstName"
              name="firstName"
              type="text"
              placeholder="Введите имя"
              className="input"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="lastName" className="label">
              Фамилия
            </label>

            <input
              id="lastName"
              name="lastName"
              type="text"
              placeholder="Введите фамилию"
              className="input"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="email" className="label">
              Email
            </label>

            <input
              id="email"
              name="email"
              type="email"
              placeholder="Введите email"
              className="input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password" className="label">
              Пароль
            </label>

            <input
              id="password"
              name="password"
              type="password"
              placeholder="Введите пароль"
              className="input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="button"
          disabled={isLoading}
        >
          {isLoading ? "Регистрация..." : "Зарегистрироваться"}
        </button>

        <div className="login-link">
          <span>Есть аккаунт?</span>

          <span
            className="login-link-text"
            onClick={() => navigate("/login")}
          >
            Войти
          </span>
        </div>
      </form>
    );
};
