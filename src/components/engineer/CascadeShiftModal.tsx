import React, { useState } from "react";
import {
  engineerApi,
  CascadeShiftRequest,
  CascadeShiftResponse,
} from "../../api/apiEngineer";
import { ScheduleItem } from "../../pages/foreman/ForemanPage";
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
  const [shiftDays, setShiftDays] = useState<number>(3);
  const [targetTimeline, setTargetTimeline] = useState<"PHANTOM" | "BASE">(
    "PHANTOM"
  );
  const [reasonComment, setReasonComment] = useState("");
  const [documentRef, setDocumentRef] = useState("");
  const [closeSpecialStatus, setCloseSpecialStatus] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [resultData, setResultData] = useState<CascadeShiftResponse | null>(
    null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromScheduleId) {
      setErrorText("Выберите этап, с которого начинается каскадный сдвиг");
      return;
    }
    if (!reasonComment.trim()) {
      setErrorText("Укажите официальное обоснование сдвига сроков");
      return;
    }
    if (!documentRef.trim()) {
      setErrorText("Укажите реквизиты документа/распоряжения");
      return;
    }

    setIsSubmitting(true);
    setErrorText("");

    try {
      const payload: CascadeShiftRequest = {
        from_schedule_id: fromScheduleId,
        shift_days: Number(shiftDays),
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
    <div className="engineer-modal-overlay">
      <div className="engineer-modal-card">
        <div className="engineer-modal-header">
          <h2>Каскадный сдвиг сроков цепочки этапов</h2>
          <p>
            Официальный перенос сроков с внесением записи в Audit Trail объекта
          </p>
        </div>

        {errorText && (
          <div className="gantt-msg-banner msg-error">{errorText}</div>
        )}

        {resultData ? (
          <div>
            <div className="gantt-msg-banner msg-success">
              Каскадный сдвиг успешно применен к цепочке этапов. Сдвинуто этапов:{" "}
              {resultData.shifted_stages_count}. Запись аудита: #
              {resultData.audit_trail_id.slice(0, 8)}.
            </div>
            <div className="engineer-modal-actions">
              <button
                type="button"
                className="btn-submit-action"
                onClick={onClose}
              >
                Закрыть
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="engineer-form-field">
              <label>Начиная с какого этапа сдвигать цепочку</label>
              <select
                value={fromScheduleId}
                onChange={(e) => setFromScheduleId(e.target.value)}
              >
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sequence_order}. {s.stage_name} —{" "}
                    {s.substage_name || "Подэтап"}
                  </option>
                ))}
              </select>
            </div>

            <div className="engineer-form-field">
              <label>Величина сдвига в днях (shift_days)</label>
              <input
                type="number"
                min="1"
                max="180"
                value={shiftDays}
                onChange={(e) => setShiftDays(parseInt(e.target.value, 10) || 1)}
                required
              />
            </div>

            <div className="engineer-form-field">
              <label>Целевая шкала времени (target_timeline)</label>
              <select
                value={targetTimeline}
                onChange={(e) =>
                  setTargetTimeline(e.target.value as "PHANTOM" | "BASE")
                }
              >
                <option value="PHANTOM">
                  PHANTOM — Прогнозный/компенсационный график (по умолчанию)
                </option>
                <option value="BASE">
                  BASE — Базовый утвержденный директивный график
                </option>
              </select>
            </div>

            <div className="engineer-form-field">
              <label>Реквизиты документа / Акта (document_reference)</label>
              <input
                type="text"
                placeholder="Приказ Департамента № 14-П от 26.09.2026 / Акт технадзора"
                value={documentRef}
                onChange={(e) => setDocumentRef(e.target.value)}
                required
              />
            </div>

            <div className="engineer-form-field">
              <label>Официальное обоснование (reason_comment)</label>
              <textarea
                placeholder="Опишите причину сдвига (неблагоприятные погодные условия, срыв поставки материалов, изменение ПСД)..."
                value={reasonComment}
                onChange={(e) => setReasonComment(e.target.value)}
                required
              />
            </div>

            <div className="engineer-form-field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={closeSpecialStatus}
                  onChange={(e) => setCloseSpecialStatus(e.target.checked)}
                />
                Автоматически закрыть текущий спецстатус объекта после сдвига
              </label>
            </div>

            <div className="engineer-modal-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="btn-submit-action"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Расчет и сдвиг..." : "Применить сдвиг сроков"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};