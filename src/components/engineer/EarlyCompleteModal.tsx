import React, { useState } from "react";
import { monitoringApi } from "../../api/monitoringApi";

interface EarlyCompleteModalProps {
  projectId: string;
  stageId: string;
  stageName: string;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export const EarlyCompleteModal: React.FC<EarlyCompleteModalProps> = ({
  projectId,
  stageId,
  stageName,
  onClose,
  onSuccess,
}) => {
  const [comment, setComment] = useState("");
  const [endDate, setEndDate] = useState(
    new Date().toISOString().substring(0, 10)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      await monitoringApi.completeStageEarly(projectId, stageId, {
        actual_end_date: new Date(endDate).toISOString(),
        comment: comment.trim() || "Работы завершены досрочно по акту АОСР",
      });
      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Не удалось закрыть этап");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="gantt-modal-backdrop">
      <div className="gantt-modal-window">
        <div className="gantt-modal-header">
          <h3>Досрочное закрытие этапа (АОСР)</h3>
          <button type="button" className="gantt-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="gantt-modal-body">
            <div className="gantt-modal-alert">
              Внимание: подтверждение приемки автоматически пересчитает график проекта влево и освободит закрепленную технику.
            </div>

            <p className="gantt-modal-desc">
              Приемка работ по подэтапу: <br />
              <strong>{stageName}</strong>
            </p>

            {error && (
              <div className="gantt-msg-banner msg-error">
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="modal-date" className="gantt-modal-label">
                Фактическая дата приемки (по АОСР):
              </label>
              <input
                id="modal-date"
                type="date"
                className="gantt-form-input"
                value={endDate}
                max={new Date().toISOString().substring(0, 10)}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="modal-comment" className="gantt-modal-label">
                Номер АОСР и комментарий технадзора:
              </label>
              <textarea
                id="modal-comment"
                className="gantt-form-input"
                rows={3}
                placeholder="Укажите реквизиты акта освидетельствования скрытых работ..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          </div>

          <div className="gantt-modal-footer">
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
              {isSubmitting ? "Сохранение..." : "Подтвердить приемку"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};