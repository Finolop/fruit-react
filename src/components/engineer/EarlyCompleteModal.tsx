import React, { useState } from "react";
import {
  useCompleteStageEarlyMutation,
  useStartStageMutation,
} from "../../api/rtkApi";
import { ReactComponent as CloseIcon } from "../../assets/images/Close_MD.svg";
import { ReactComponent as CheckIcon } from "../../assets/images/Circle_Check.svg";
import "../../styles/ForemanGantt.css";

interface EarlyCompleteModalProps {
  projectId: string;
  stageId: string;
  stageName: string;
  previousIncompleteStageIds?: string[];
  nextStageId?: string;
  nextStageName?: string;
  onClose: () => void;
  onSuccess?: () => Promise<void> | void;
}

const getLocalDateInputString = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const dateInputToSafeIso = (dateStr: string): string => {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) {
    return new Date().toISOString();
  }
  const now = new Date();
  const safeDate = new Date(
    year,
    month - 1,
    day,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
  );
  return safeDate.toISOString();
};

export const EarlyCompleteModal: React.FC<EarlyCompleteModalProps> = ({
  projectId,
  stageId,
  stageName,
  previousIncompleteStageIds = [],
  nextStageId,
  nextStageName,
  onClose,
}) => {
  const todayStr = getLocalDateInputString();
  const [comment, setComment] = useState("");
  const [endDate, setEndDate] = useState(todayStr);
  const [error, setError] = useState("");

  const [completeStageEarly, { isLoading: isCompleting }] =
    useCompleteStageEarlyMutation();
  const [startStage, { isLoading: isStarting }] = useStartStageMutation();

  const isSubmitting = isCompleting || isStarting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const finalComment =
        comment.trim() || "Работы завершены досрочно по акту АОСР";
      const safeIsoDate = dateInputToSafeIso(endDate);

      // Последовательное закрытие предшествующих этапов без состояния гонки
      if (previousIncompleteStageIds.length > 0) {
        for (const prevId of previousIncompleteStageIds) {
          try {
            await completeStageEarly({
              projectId,
              scheduleId: prevId,
              actual_end_date: safeIsoDate,
              comment: `${finalComment} (автоматически закрыт перед этапом ${stageName})`,
            }).unwrap();
          } catch (prevErr) {
            console.warn(`Предшествующий этап ${prevId} пропущен:`, prevErr);
          }
        }
      }

      // Закрываем целевой этап
      await completeStageEarly({
        projectId,
        scheduleId: stageId,
        actual_end_date: safeIsoDate,
        comment: finalComment,
      }).unwrap();

      // Запуск следующего этапа, если он запланирован
      if (nextStageId) {
        try {
          await startStage({
            projectId,
            scheduleId: nextStageId,
          }).unwrap();
        } catch (startErr: any) {
          console.warn(
            "Следующий этап не удалось автоматически запустить:",
            startErr,
          );
        }
      }

      onClose();
    } catch (err: any) {
      setError(err?.data?.detail || err?.message || "Не удалось закрыть этап");
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
            <CloseIcon className="ui-icon-sm" />
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
                  автоматически переведён в статус «В работе».
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
                max={todayStr}
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
              <CheckIcon className="btn-icon-svg" />
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
