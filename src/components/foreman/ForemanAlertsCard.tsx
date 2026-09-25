import React, { useState } from "react";

interface Props {
  projectId: string;
  onAlertResolved: () => void;
}

const ForemanAlertsCard: React.FC<Props> = ({ onAlertResolved }) => {
  const [resolved, setResolved] = useState(false);

  const handleResolve = () => {
    setResolved(true);
    onAlertResolved();
  };

  return (
    <div className="foreman-card alerts-sidebar-panel">
      <div className="sidebar-alert-head">
        <h3 className="card-heading">Оперативные предупреждения</h3>
        <span className="badge-alert-count">1 активно</span>
      </div>

      {!resolved ? (
        <div className="alert-card-actionable">
          <div className="alert-card-top">
            <span className="alert-num">Предупреждение #41</span>
            <span className="alert-badge-yellow">ЖЕЛТЫЙ</span>
          </div>

          <h4 className="alert-card-subject">Простой техники без движения</h4>
          <p className="alert-card-text">
            Экскаватор Komatsu простаивает 45 минут в секторе Б.
          </p>

          <div className="escalation-timer-box">
            <span className="timer-icon">⏳</span>
            <div>
              <strong>Эскалация через 23ч 15мин</strong>
              <p>Если простой превысит 24 часа — статус автоматически эскалируется в КРАСНЫЙ инженеру технадзора.</p>
            </div>
          </div>

          <button
            type="button"
            className="btn-resolve-alert"
            onClick={handleResolve}
          >
            ✓ Отметить ликвидацию простоя
          </button>
        </div>
      ) : (
        <div className="alert-card-cleared">
          <span className="cleared-icon">✓</span>
          <p>Отметка о ликвидации простоя отправлена. Инцидент закрыт.</p>
        </div>
      )}

      <div className="foreman-notice-card">
        <span className="notice-icon">ℹ</span>
        <p>
          Красные алерты прорабу не выводятся, чтобы исключить конфликт интересов. На них реагирует независимый Инженер технадзора.
        </p>
      </div>
    </div>
  );
};

export default ForemanAlertsCard;