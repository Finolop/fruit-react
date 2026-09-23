import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { AppDispatch, RootState } from "../../store";
import { loginThunk } from "../../features/auth/authSlice";

export const LoginForm = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { isLoading, error } = useSelector((state: RootState) => state.auth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const result = await dispatch(
      loginThunk({
        email,
        password,
      }),
    );

    if (loginThunk.fulfilled.match(result)) {
      navigate("/");
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <h1 className="title">Вход</h1>

      <div className="fields">
        <div className="field">
          <label className="label" htmlFor="email">
            Email
          </label>

          <input
            className="input"
            id="email"
            name="email"
            type="email"
            placeholder="Введите email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="password">
            Пароль
          </label>

          <input
            className="input"
            id="password"
            name="password"
            type="password"
            placeholder="Введите пароль"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        <div className="field-checkbox">
          <input
            className="checkbox"
            id="rememberMe"
            name="rememberMe"
            type="checkbox"
          />

          <label className="label-checkbox" htmlFor="rememberMe">
            Запомнить меня
          </label>
        </div>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <button className="button" type="submit" disabled={isLoading}>
        {isLoading ? "Вход..." : "Войти"}
      </button>
      <div className="register-link">
        <span>Нет аккаунта?</span>
        <span
          className="register-link-text"
          onClick={() => navigate("/register")}
        >
          Зарегистрироваться
        </span>
      </div>
    </form>
  );
};
