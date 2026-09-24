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
<form className="register-form" onSubmit={handleSubmit}>
        <h1 className="register-title">Регистрация</h1>

        <div className="register-fields">
          <div className="register-field">
            <label htmlFor="firstName" className="register-label">
              Имя
            </label>

            <input
              id="firstName"
              name="firstName"
              type="text"
              placeholder="Введите имя"
              className="register-input"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              required
            />
          </div>

          <div className="register-field">
            <label htmlFor="lastName" className="register-label">
              Фамилия
            </label>

            <input
              id="lastName"
              name="lastName"
              type="text"
              placeholder="Введите фамилию"
              className="register-input"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              required
            />
          </div>

          <div className="register-field">
            <label htmlFor="email" className="register-label">
              Email
            </label>

            <input
              id="email"
              name="email"
              type="email"
              placeholder="Введите email"
              className="register-input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="register-field">
            <label htmlFor="password" className="register-label">
              Пароль
            </label>

            <input
              id="password"
              name="password"
              type="password"
              placeholder="Введите пароль"
              className="register-input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
        </div>

        {error && (
          <p className="register-error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="register-button"
          disabled={isLoading}
        >
          {isLoading ? "Регистрация..." : "Зарегистрироваться"}
        </button>

        <div className="register-login-link">
          <span>Есть аккаунт?</span>

          <span
            className="register-login-link-text"
            onClick={() => navigate("/login")}
          >
            Войти
          </span>
        </div>
      </form>
    );
};
