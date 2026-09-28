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

import "../../styles/EngineerPage.css";

interface Props {
  projectId: string;
  schedules: ScheduleItem[];
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export const CascadeShiftModal: React.FC<Props> = ({
  projectId,
  schedules,
  onClose,
  onSuccess,
}) => {
  const [fromScheduleId, setFromScheduleId] = useState<string>(
    schedules[0]?.id || ""
  );
  const [shiftDirection, setShiftDirection] = useState<"DELAY" | "CATCHUP">("DELAY");
  const [daysCount, setDaysCount] = useState<number>(3);
  const [targetTimeline, setTargetTimeline] = useState<"PHANTOM" | "BASE">("PHANTOM");
  const [reasonComment, setReasonComment] = useState("");
  const [documentRef, setDocumentRef] = useState("");
  const [closeSpecialStatus, setCloseSpecialStatus] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [resultData, setResultData] = useState<CascadeShiftResponse | null>(null);

  const finalShiftDays =
    shiftDirection === "DELAY"
      ? Math.abs(daysCount || 1)
      : -Math.abs(daysCount || 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromScheduleId) {
      setErrorText("Выберите этап, с которого начинается каскадный сдвиг");
      return;
    }
    if (!reasonComment.trim()) {
      setErrorText("Укажите официальное обоснование корректировки сроков");
      return;
    }
    if (!documentRef.trim()) {
      setErrorText("Укажите реквизиты документа / распоряжения");
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window" style={{ maxWidth: "620px" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Корректировка сроков этапов</h3>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--color-text-secondary)" }}>
              Каскадный сдвиг цепочки работ с фиксацией в журнале Audit Trail
            </p>
          </div>
          <button type="button" className="btn-close" onClick={onClose}>
            <img src={closeIcon} alt="Закрыть" className="ui-icon-sm" />
          </button>
        </div>

        {errorText && (
          <div className="admin-error-message" style={{ margin: "0 0 16px" }}>
            {errorText}
          </div>
        )}

        {resultData ? (
          <div>
            <div className="admin-success-message" style={{ margin: "0 0 16px" }}>
              Каскадный расчет успешно выполнен. Обновлено зависимых этапов:{" "}
              <strong>{resultData.shifted_stages_count}</strong>. Новая плановая дата сдачи:{" "}
              <strong>
                {new Date(resultData.new_estimated_completion).toLocaleDateString("ru-RU")}
              </strong>
              . Запись аудита: #{resultData.audit_trail_id.slice(0, 8)}.
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-gantt-secondary"
                onClick={onClose}
              >
                Закрыть
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="admin-form">
            <div className="modal-body" style={{ maxHeight: "calc(80vh - 120px)" }}>
              {/* Выбор направления: Задержка (+) или Догон (-) */}
              <div className="form-field">
                <label>Характер корректировки сроков *</label>
                <div className="shift-direction-toggle">
                  <button
                    type="button"
                    className={`shift-dir-btn ${shiftDirection === "DELAY" ? "active-delay" : ""}`}
                    onClick={() => setShiftDirection("DELAY")}
                  >
                    <div className="shift-dir-header">
                      <img src={trendingUpIcon} alt="" className="btn-icon-svg" />
                      <span>Перенос вправо (Задержка / Простой)</span>
                    </div>
                    <span className="shift-sign-badge">+ {daysCount} дн.</span>
                  </button>

                  <button
                    type="button"
                    className={`shift-dir-btn ${shiftDirection === "CATCHUP" ? "active-catchup" : ""}`}
                    onClick={() => setShiftDirection("CATCHUP")}
                  >
                    <div className="shift-dir-header">
                      <img src={trendingDownIcon} alt="" className="btn-icon-svg" />
                      <span>Сдвиг влево (Опережение / Компенсация)</span>
                    </div>
                    <span className="shift-sign-badge">- {daysCount} дн.</span>
                  </button>
                </div>
              </div>

              <div className="form-field">
                <label>Начиная с какого этапа корректировать цепочку *</label>
                <select
                  value={fromScheduleId}
                  onChange={(e) => setFromScheduleId(e.target.value)}
                  required
                >
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sequence_order}. {s.stage_name} — {s.substage_name || "Подэтап"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>
                  {shiftDirection === "DELAY"
                    ? "Количество дней задержки (+дней):"
                    : "Количество дней сокращения / нагона (-дней):"}
                </label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={daysCount}
                  onChange={(e) => setDaysCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  required
                />
              </div>

              <div className="form-field">
                <label>Целевая шкала графика (target_timeline) *</label>
                <select
                  value={targetTimeline}
                  onChange={(e) => setTargetTimeline(e.target.value as "PHANTOM" | "BASE")}
                >
                  <option value="PHANTOM">
                    PHANTOM — Компенсационный / прогнозный график (по умолчанию)
                  </option>
                  <option value="BASE">
                    BASE — Директивный базовый график Департамента
                  </option>
                </select>
              </div>

              <div className="form-field">
                <label>Реквизиты распоряжения / Акта (document_reference) *</label>
                <input
                  type="text"
                  placeholder="Распоряжение № 12-Р от 27.09.2026 / Акт технадзора"
                  value={documentRef}
                  onChange={(e) => setDocumentRef(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label>Официальное обоснование (reason_comment) *</label>
                <textarea
                  className="foreman-custom-input"
                  style={{ height: "70px", minHeight: "70px" }}
                  placeholder="Укажите причину (дополнительные смены, компенсация погодных условий, изменение ПСД)..."
                  value={reasonComment}
                  onChange={(e) => setReasonComment(e.target.value)}
                  required
                />
              </div>

              {/* Чекбокс со смещением вправо */}
              <div className="form-field">
                <label className="checkbox-row-aligned">
                  <span className="checkbox-text-content">
                    <strong>Снять активный спецстатус</strong>
                    <small>Автоматически закрыть окно форс-мажора / штрафа после пересчета</small>
                  </span>
                  <input
                    type="checkbox"
                    className="styled-right-checkbox"
                    checked={closeSpecialStatus}
                    onChange={(e) => setCloseSpecialStatus(e.target.checked)}
                  />
                </label>
              </div>
            </div>

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
                className="btn-gantt-success btn-theme-accent"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? "Расчёт цепочки..."
                  : shiftDirection === "DELAY"
                  ? `Применить задержку (+${daysCount} дн.)`
                  : `Применить догон (-${daysCount} дн.)`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};