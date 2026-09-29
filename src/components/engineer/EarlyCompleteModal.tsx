import React, { useState } from "react";
import { monitoringApi } from "../../api/monitoringApi";
import closeIcon from "../../assets/images/Close_MD.svg";
import checkIcon from "../../assets/images/Circle_Check.svg";
import "../../styles/ForemanGantt.css";

interface EarlyCompleteModalProps {
  projectId: string;
  stageId: string;
  stageName: string;
  previousIncompleteStageIds?: string[];
  nextStageId?: string;
  nextStageName?: string;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export const EarlyCompleteModal: React.FC<EarlyCompleteModalProps> = ({
  projectId,
  stageId,
  stageName,
  previousIncompleteStageIds = [],
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
      const finalComment =
        comment.trim() || "Работы завершены досрочно по акту АОСР";
      const payload = {
        actual_end_date: new Date(endDate).toISOString(),
        comment: finalComment,
      };

      // 1. Автоматически закрываем все предшествующие незавершенные этапы
      if (previousIncompleteStageIds.length > 0) {
        await Promise.all(
          previousIncompleteStageIds.map((prevId) =>
            monitoringApi
              .completeStageEarly(projectId, prevId, {
                actual_end_date: new Date(endDate).toISOString(),
                comment: `${finalComment} (автоматически закрыт перед этапом ${stageName})`,
              })
              .catch((err) => {
                console.warn(
                  `Не удалось закрыть предшествующий этап ${prevId}:`,
                  err,
                );
              }),
          ),
        );
      }

      // 2. Закрываем выбранный целевой этап
      await monitoringApi.completeStageEarly(projectId, stageId, payload);

      // 3. Запускаем следующий этап ТОЛЬКО если он ожидает старта 
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
          <button
            type="button"
            className="btn-close"
            onClick={onClose}
            title="Закрыть"
          >
            <img src={closeIcon} alt="Закрыть" className="ui-icon-sm" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="admin-form">
          <div className="modal-body">
            <div className="early-complete-banner">
              <p className="early-complete-main-text">
                Подтверждение приемки зафиксирует досрочное выполнение работ по
                акту АОСР.
              </p>

              {previousIncompleteStageIds.length > 0 && (
                <p className="early-complete-warning-text">
                  Внимание: предшествующие незавершенные подэтапы (
                  {previousIncompleteStageIds.length} шт.) будут автоматически
                  закрыты вместе с этим этапом.
                </p>
              )}

              {nextStageName && (
                <p className="early-complete-next-text">
                  Следующий запланированный этап «{nextStageName}» будет
                  автоматически переведён в работу (IN_PROGRESS).
                </p>
              )}
            </div>

            <div className="form-field">
              <label>Завершаемый подэтап СМР</label>
              <div className="early-complete-stage-name">{stageName}</div>
            </div>

            {error && (
              <div className="admin-error-message early-complete-error-box">
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
                className="foreman-custom-input early-complete-textarea"
                placeholder="Например: Акт освидетельствования скрытых работ № 14-Б/2026 от 28.09.2026..."
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
