import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../store";
import { restoreSessionThunk } from "../features/auth/authSlice";
import Header from "../components/Header";

import { ReactComponent as ClockIcon } from "../assets/images/Clock.svg";
import { ReactComponent as CheckIcon } from "../assets/images/Circle_Check.svg";
import "../styles/HomePage.css";

const HomePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Автоматическая проверка роли каждые 5 секунд
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) {
        dispatch(restoreSessionThunk());
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [dispatch]);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  return (
    <div className="foreman-page">
      <Header />
      <main className="home-pending-container">
        <div className="home-pending-card">
          <div className="home-pending-icon-wrap">
            <ClockIcon className="home-pending-icon" />
          </div>

          <div className="home-pending-badge">
            <span className="status-dot orange" />
            <span>Доступ на согласовании</span>
          </div>

          <h1 className="home-pending-title">
            Профиль ожидает подтверждения допуска
          </h1>
          <p className="home-pending-desc">
            Ваша учётная запись успешно зарегистрирована в системе «Аргус —
            СМР». Для работы с объектами капитального строительства и графиками
            работ ожидается подтверждение полномочий администратором
            Департамента.
          </p>

          {user && (
            <div className="home-user-meta-box">
              <div className="home-meta-item">
                <span className="home-meta-label">Сотрудник</span>
                <span className="home-meta-val bold">
                  {user.first_name} {user.last_name}
                </span>
              </div>

              <div className="home-meta-item">
                <span className="home-meta-label">Email учётной записи</span>
                <div className="home-meta-action-row">
                  <span className="home-meta-val">{user.email}</span>
                  <button
                    type="button"
                    className="btn-copy-chip"
                    onClick={() => handleCopy(user.email, "email")}
                    title="Скопировать Email"
                  >
                    {copiedField === "email" ? (
                      <>
                        <CheckIcon className="ui-icon-xs text-green" />
                        <span className="text-green">Скопировано</span>
                      </>
                    ) : (
                      "Копировать"
                    )}
                  </button>
                </div>
              </div>
              <div className="home-meta-item">
                <span className="home-meta-label">Статус допуска</span>
                <span className="home-meta-role-tag">Ожидает назначения</span>
              </div>
            </div>
          )}

          <div className="home-auto-sync-hint">
            <span className="pulse-indicator-dot" />
            <span>Синхронизация статуса в реальном времени</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HomePage;
