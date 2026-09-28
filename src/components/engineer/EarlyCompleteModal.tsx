import React, { useState } from "react";
import { monitoringApi } from "../../api/monitoringApi";
import closeIcon from "../../assets/images/Close_MD.svg";
import checkIcon from "../../assets/images/Circle_Check.svg";

interface EarlyCompleteModalProps {
  projectId: string;
  stageId: string;
  stageName: string;
  nextStageId?: string;
  nextStageName?: string;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export const EarlyCompleteModal: React.FC<EarlyCompleteModalProps> = ({
  projectId,
  stageId,
  stageName,
  nextStageId,
  nextStageName,
  onClose,
  onSuccess,
}) => {
  const [comment, setComment] = useState("");
  const [endDate, setEndDate] = useState(
    new Date().toISOString().substring(0, 10),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      // 1. Досрочно закрываем текущий этап
      await monitoringApi.completeStageEarly(projectId, stageId, {
        actual_end_date: new Date(endDate).toISOString(),
        comment: comment.trim() || "Работы завершены досрочно по акту АОСР",
      });

      // 2. Если есть следующий запланированный этап, автоматически переводим его в работу
      if (nextStageId) {
        try {
          await monitoringApi.startStage(projectId, nextStageId);
        } catch (startErr: any) {
          console.warn(
            "Следующий этап не удалось автоматически запустить:",
            startErr,
          );
        }
      }

      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Не удалось закрыть этап");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Досрочное закрытие этапа (АОСР)</h3>
          <button type="button" className="btn-close" onClick={onClose}>
            <img src={closeIcon} alt="Закрыть" className="ui-icon-sm" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="admin-form">
          <div className="modal-body">
            <div
              className="admin-success-message"
              style={{ margin: 0, fontSize: "13px", lineHeight: "1.4" }}
            >
              Подтверждение приемки зафиксирует досрочное выполнение этапа и
              освободит технику.
              {nextStageName && (
                <div style={{ marginTop: "6px", fontWeight: 600 }}>
                  Следующий этап «{nextStageName}» будет автоматически переведён
                  в работу (IN_PROGRESS).
                </div>
              )}
            </div>

            <div className="form-field">
              <label>Завершаемый подэтап СМР</label>
              <div
                style={{
                  fontWeight: 600,
                  color: "var(--color-text)",
                  fontSize: "14px",
                }}
              >
                {stageName}
              </div>
            </div>

            {error && (
              <div className="admin-error-message" style={{ margin: 0 }}>
                {error}
              </div>
            )}

            <div className="form-field">
              <label htmlFor="modal-date">
                Фактическая дата приемки (по АОСР) *
              </label>
              <input
                id="modal-date"
                type="date"
                value={endDate}
                max={new Date().toISOString().substring(0, 10)}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="modal-comment">
                Номер АОСР и комментарий технадзора
              </label>
              <textarea
                id="modal-comment"
                className="foreman-custom-input"
                style={{ height: "80px", minHeight: "80px" }}
                placeholder="Например: Акт освидетельствования скрытых работ № 14-Б/2026 от 27.09.2026..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
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
              className="btn-gantt-success"
              disabled={isSubmitting}
            >
              <img src={checkIcon} alt="" className="btn-icon-svg" />
              <span>
                {isSubmitting ? "Сохранение..." : "Подтвердить приемку"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
