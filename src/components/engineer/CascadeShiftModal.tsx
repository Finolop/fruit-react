import React, { useState } from "react";
import {
  engineerApi,
  CascadeShiftRequest,
  CascadeShiftResponse,
} from "../../api/apiEngineer";
import { ScheduleItem } from "../../pages/foreman/ForemanPage";

import trendingUpIcon from "../../assets/images/Arrow_Up_Right_LG.svg";
import trendingDownIcon from "../../assets/images/Arrow_Down_Right_LG.svg";
import closeIcon from "../../assets/images/Close_MD.svg";
import checkIcon from "../../assets/images/Circle_Check.svg";

import "../../styles/EngineerPage.css";

interface Props {
  projectId: string;
  schedules: ScheduleItem[];
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

const PRESET_DAYS = [1, 3, 5, 7, 14, 30];

export const CascadeShiftModal: React.FC<Props> = ({
  projectId,
  schedules,
  onClose,
  onSuccess,
}) => {
  const [fromScheduleId, setFromScheduleId] = useState<string>(
    schedules[0]?.id || "",
  );
  const [shiftDirection, setShiftDirection] = useState<"DELAY" | "CATCHUP">(
    "DELAY",
  );
  const [daysCount, setDaysCount] = useState<number>(3);
  const [targetTimeline, setTargetTimeline] = useState<"PHANTOM" | "BASE">(
    "PHANTOM",
  );
  const [reasonComment, setReasonComment] = useState("");
  const [documentRef, setDocumentRef] = useState("");
  const [closeSpecialStatus, setCloseSpecialStatus] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [resultData, setResultData] = useState<CascadeShiftResponse | null>(
    null,
  );

  const finalShiftDays =
    shiftDirection === "DELAY"
      ? Math.abs(daysCount || 1)
      : -Math.abs(daysCount || 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromScheduleId) {
      setErrorText("Выберите этап, с которого начинается каскадный перенос");
      return;
    }
    if (!reasonComment.trim()) {
      setErrorText("Укажите обоснование корректировки сроков");
      return;
    }
    if (!documentRef.trim()) {
      setErrorText("Укажите реквизиты распоряжения или акта технадзора");
      return;
    }

    setIsSubmitting(true);
    setErrorText("");

    try {
      const payload: CascadeShiftRequest = {
        from_schedule_id: fromScheduleId,
        shift_days: finalShiftDays,
        target_timeline: targetTimeline,
        reason_comment: reasonComment.trim(),
        document_reference: documentRef.trim(),
        close_special_status: closeSpecialStatus,
      };

      const res = await engineerApi.cascadeShift(projectId, payload);
      setResultData(res);
      await onSuccess();
    } catch (err: any) {
      setErrorText(err.message || "Ошибка выполнения сдвига сроков");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-window cascade-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {resultData ? (
          <div className="cascade-modal-content-wrapper">
            <div className="modal-header">
              <div className="cascade-modal-title-wrap">
                <h3>Каскадный перенос сроков</h3>
                <p>Результат автоматического пересчёта цепочки СМР</p>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
                title="Закрыть"
              >
                <img src={closeIcon} alt="✕" className="ui-icon-sm" />
              </button>
            </div>

            <div className="modal-body">
              <div className="cascade-result-card">
                <div className="cascade-result-header">
                  <div className="cascade-result-icon">✓</div>
                  <div>
                    <h4>Каскадный пересчет успешно зафиксирован</h4>
                    <p>Запись внесена в журнал аудита объекта (Audit Trail)</p>
                  </div>
                </div>

                <div className="cascade-result-metrics">
                  <div className="result-metric-item">
                    <span className="result-metric-label">
                      Скорректировано этапов
                    </span>
                    <span className="result-metric-val">
                      {resultData.shifted_stages_count}
                    </span>
                  </div>

                  <div className="result-metric-item">
                    <span className="result-metric-label">Прежняя сдача</span>
                    <span className="result-metric-val prev">
                      {formatDate(resultData.old_estimated_completion)}
                    </span>
                  </div>

                  <div className="result-metric-item">
                    <span className="result-metric-label">Новая сдача</span>
                    <span className="result-metric-val next">
                      {formatDate(resultData.new_estimated_completion)}
                    </span>
                  </div>
                </div>

                <div className="cascade-audit-pill">
                  <span>Запись аудита:</span>
                  <code>{resultData.audit_trail_id}</code>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-gantt-success"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={onClose}
              >
                Вернуться к графику
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="cascade-modal-form">
            <div className="modal-header">
              <div className="cascade-modal-title-wrap">
                <h3>Каскадный перенос сроков</h3>
                <p>Автоматический пересчёт цепочки зависимых этапов СМР</p>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
                title="Закрыть"
              >
                <img src={closeIcon} alt="✕" className="ui-icon-sm" />
              </button>
            </div>

            <div className="modal-body">
              {errorText && (
                <div className="admin-error-message" style={{ margin: 0 }}>
                  {errorText}
                </div>
              )}

              {/* 1. Направление сдвига */}
              <div className="form-field">
                <label>Характер корректировки сроков *</label>
                <div className="shift-direction-toggle">
                  <button
                    type="button"
                    className={`shift-dir-btn ${
                      shiftDirection === "DELAY" ? "active-delay" : ""
                    }`}
                    onClick={() => setShiftDirection("DELAY")}
                  >
                    <div className="shift-dir-header">
                      <img
                        src={trendingUpIcon}
                        alt=""
                        className="btn-icon-svg"
                      />
                      <span>Перенос вправо (Задержка)</span>
                    </div>
                    <span className="shift-sign-badge">+{daysCount} дн.</span>
                  </button>

                  <button
                    type="button"
                    className={`shift-dir-btn ${
                      shiftDirection === "CATCHUP" ? "active-catchup" : ""
                    }`}
                    onClick={() => setShiftDirection("CATCHUP")}
                  >
                    <div className="shift-dir-header">
                      <img
                        src={trendingDownIcon}
                        alt=""
                        className="btn-icon-svg"
                      />
                      <span>Сдвиг влево (Опережение)</span>
                    </div>
                    <span className="shift-sign-badge">-{daysCount} дн.</span>
                  </button>
                </div>
              </div>

              {/* 2. Выбор этапа-триггера */}
              <div className="form-field">
                <label>Начиная с какого этапа сдвигать цепочку *</label>
                <select
                  value={fromScheduleId}
                  onChange={(e) => setFromScheduleId(e.target.value)}
                  required
                >
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sequence_order}. {s.stage_name} —{" "}
                      {s.substage_name || "Подэтап"}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Количество дней и быстрые пресеты */}
              <div className="form-field">
                <div className="days-label-row">
                  <label>
                    {shiftDirection === "DELAY"
                      ? "Количество дней переноса:"
                      : "Количество дней сокращения:"}
                  </label>
                  <span className="days-counter-pill">
                    {shiftDirection === "DELAY"
                      ? `+${daysCount}`
                      : `-${daysCount}`}{" "}
                    дн.
                  </span>
                </div>

                <input
                  type="number"
                  min="1"
                  max="180"
                  value={daysCount}
                  onChange={(e) =>
                    setDaysCount(Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                  required
                />

                <div className="preset-days-row">
                  <span className="preset-hint">Быстрый выбор:</span>
                  {PRESET_DAYS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`preset-day-chip ${daysCount === d ? "active" : ""}`}
                      onClick={() => setDaysCount(d)}
                    >
                      {d} дн.
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Целевая шкала */}
              <div className="form-field">
                <label>Целевая шкала графика (target_timeline) *</label>
                <select
                  value={targetTimeline}
                  onChange={(e) =>
                    setTargetTimeline(e.target.value as "PHANTOM" | "BASE")
                  }
                >
                  <option value="PHANTOM">
                    PHANTOM — Компенсационный / прогнозный график (по умолчанию)
                  </option>
                  <option value="BASE">
                    BASE — Директивный базовый график Департамента
                  </option>
                </select>
              </div>

              {/* 5. Документ-основание */}
              <div className="form-field">
                <label>
                  Реквизиты распоряжения / Акта (document_reference) *
                </label>
                <input
                  type="text"
                  placeholder="Например: Распоряжение № 14-Р от 28.09.2026 или Акт технадзора"
                  value={documentRef}
                  onChange={(e) => setDocumentRef(e.target.value)}
                  required
                />
              </div>

              {/* 6. Обоснование */}
              <div className="form-field">
                <label>Официальное обоснование (reason_comment) *</label>
                <textarea
                  className="foreman-custom-input"
                  style={{ height: "60px", minHeight: "50px" }}
                  placeholder="Укажите технологическую причину (погодные условия, срыв поставок, допсоглашение)..."
                  value={reasonComment}
                  onChange={(e) => setReasonComment(e.target.value)}
                  required
                />
              </div>

              {/* 7. Компактный Toggle Switch */}
              <div
                className={`cascade-toggle-card ${
                  closeSpecialStatus ? "active" : ""
                }`}
                onClick={() => setCloseSpecialStatus(!closeSpecialStatus)}
              >
                <div className="cascade-toggle-info">
                  <span className="cascade-toggle-title">
                    Снять активный спецстатус
                  </span>
                  <span className="cascade-toggle-desc">
                    Автоматически закрыть окно форс-мажора / штрафа после
                    каскадного сдвига
                  </span>
                </div>

                <div className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={closeSpecialStatus}
                    onChange={(e) => setCloseSpecialStatus(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="toggle-slider" />
                </div>
              </div>
            </div>

            {/* Зафиксированный подвал (всегда видим на экране) */}
            <div className="modal-footer">
              <button
                type="button"
                className="btn-gantt-secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="btn-gantt-success"
                disabled={isSubmitting}
              >
                <img
                  src={checkIcon}
                  alt=""
                  className="btn-icon-svg btn-icon-white"
                />
                <span>
                  {isSubmitting
                    ? "Выполняется расчёт..."
                    : shiftDirection === "DELAY"
                      ? `Сдвинуть цепочку (+${daysCount} дн.)`
                      : `Сдвинуть цепочку (-${daysCount} дн.)`}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
