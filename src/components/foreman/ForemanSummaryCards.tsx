import React from "react";
import { LiveSummaryData } from "../../pages/foreman/ForemanPage";

interface Props {
  summary: LiveSummaryData | null;
  loading: boolean;
}

const ForemanSummaryCards: React.FC<Props> = ({ summary }) => {
  const isYellow = summary?.alert_level === "YELLOW";
  const isRed = summary?.alert_level === "RED";

  return (
    <div className="foreman-kpi-grid">
      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">Объект & Этап</span>
        </div>
        <div className="kpi-value">{summary?.project_name || "—"}</div>
        <div className="kpi-sub">{summary?.current_stage.name || "Котлован"}</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">Готовность ОКС</span>
          <span className="kpi-label text-green" style={{ fontSize: "14px", fontWeight: 700 }}>
            {summary?.progress_percent || 15}%
          </span>
        </div>
        <div className="kpi-progress-bar-wrap">
          <div
            className="kpi-progress-bar-fill"
            style={{ width: `${summary?.progress_percent || 15}%` }}
          />
        </div>
        <div className="kpi-sub">
          {summary?.contract_days_passed || 18} дн. из {summary?.contract_days_total || 120} дн.
        </div>
      </div>

      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">Оперативный статус</span>
        </div>
        <div>
          <div className={`status-pill ${isRed ? "pill-red" : isYellow ? "pill-yellow" : "pill-green"}`}>
            <span className="status-ping-dot" />
            <span>{isRed ? "КРАСНЫЙ (ТРЕВОГА)" : isYellow ? "ЖЕЛТЫЙ (ВНИМАНИЕ)" : "ЗЕЛЕНЫЙ (ШТАТНО)"}</span>
          </div>
        </div>
        <div className="kpi-sub">Требует оперативных мер на площадке</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">Права прораба</span>
        </div>
        <div className="kpi-value" style={{ fontSize: "15px" }}>
          План по шаблону на старте
        </div>
        <div className="kpi-sub">Арбитраж и перенос сроков заблокированы</div>
      </div>
    </div>
  );
};

export default ForemanSummaryCards;