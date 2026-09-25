import React from "react";
import { LiveSummaryData } from "../../pages/foreman/ForemanPage";

interface Props {
  summary: LiveSummaryData | null;
}

const GanttProgressCard: React.FC<Props> = () => {
  return (
    <div className="foreman-card">
      <div className="foreman-card-header">
        <div>
          <h2 className="card-heading">Календарный ход выполнения работ</h2>
          <p className="card-subheading">Мониторинг текущего этапа графика и строительной техники</p>
        </div>
      </div>

      <div className="gantt-stage-row">
        <div className="stage-meta-head">
          <span className="stage-title">Разработка котлована (Земляные работы)</span>
          <span className="stage-days-counter">День 18 из 45</span>
        </div>
        <div className="stage-track-bar">
          <div className="stage-fill-bar" style={{ width: "40%" }} />
        </div>
      </div>

      <div className="equipment-grid-block">
        <h3 className="block-title">Фактическая техника на площадке (Камеры & AI)</h3>

        <div className="equipment-cards-grid">
          <div className="eq-status-card eq-active">
            <span className="eq-icon">🚜</span>
            <div className="eq-details">
              <span className="eq-name">Экскаватор CAT #1</span>
              <span className="eq-state text-green">● В работе (Забой)</span>
            </div>
          </div>

          <div className="eq-status-card eq-warning">
            <span className="eq-icon">🚜</span>
            <div className="eq-details">
              <span className="eq-name">Экскаватор Komatsu #2</span>
              <span className="eq-state text-orange">● Простой 45 мин (Сектор Б)</span>
            </div>
          </div>

          <div className="eq-status-card eq-danger">
            <span className="eq-icon">🚛</span>
            <div className="eq-details">
              <span className="eq-name">Самосвалы</span>
              <span className="eq-state text-red">● 1 ед. на линии (дефицит 3 ед.)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GanttProgressCard;