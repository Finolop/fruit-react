import React, { useState, useEffect } from "react";
import {
  engineerApi,
  AlertResponse,
  FrameItemResponse,
  AlertResolveRequest,
} from "../../api/apiEngineer";
import "../../styles/EngineerPage.css";

interface Props {
  alert: AlertResponse;
  projectId: string;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

const RESOLVE_SCENARIOS = [
  {
    value: "SPECIAL_STATUS_OPEN",
    label: "Сценарий 1: Устранение простоя (Открытие спецстатуса / штрафного коридора)",
  },
  {
    value: "FORCE_MAJEURE_CASCADE",
    label: "Сценарий 2: Признание форс-мажора (Основание для каскадного сдвига)",
  },
  {
    value: "FALSE_ALARM",
    label: "Сценарий 3: Ложное срабатывание детекции (Штраф не выставляется)",
  },
];

export const AlertResolverModal: React.FC<Props> = ({
  alert,
  projectId,
  onClose,
  onSuccess,
}) => {
  const [scenario, setScenario] = useState<string>("SPECIAL_STATUS_OPEN");
  const [comment, setComment] = useState("");
  const [deadline, setDeadline] = useState("");
  const [frames, setFrames] = useState<FrameItemResponse[]>([]);
  const [selectedFrameIds, setSelectedFrameIds] = useState<string[]>([]);
  const [isLoadingFrames, setIsLoadingFrames] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    // Дефолтный дедлайн: +24 часа от текущего момента
    const nextDay = new Date(Date.now() + 24 * 60 * 60 * 1000);
    setDeadline(nextDay.toISOString().slice(0, 16));

    // Если алерт был вызван конкретным кадром, сразу отмечаем его
    if (alert.trigger_frame_id) {
      setSelectedFrameIds([alert.trigger_frame_id]);
    }

    const loadFrames = async () => {
      try {
        const data = await engineerApi.getProjectFrames(projectId, 24);
        setFrames(Array.isArray(data) ? data : []);
      } catch (e: any) {
        console.error("Ошибка загрузки кадров для улик:", e);
      } finally {
        setIsLoadingFrames(false);
      }
    };

    loadFrames();
  }, [projectId, alert.trigger_frame_id]);

  const toggleFrameSelection = (frameId: string) => {
    setSelectedFrameIds((prev) =>
      prev.includes(frameId)
        ? prev.filter((id) => id !== frameId)
        : [...prev, frameId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      setErrorText("Обязательно укажите экспертное заключение инженера");
      return;
    }

    setIsSubmitting(true);
    setErrorText("");

    try {
      const payload: AlertResolveRequest = {
        action_taken: scenario,
        engineer_comment: comment.trim(),
        evidence_frame_ids: selectedFrameIds,
      };

      if (scenario !== "FALSE_ALARM" && deadline) {
        payload.target_deadline = new Date(deadline).toISOString();
      }

      await engineerApi.resolveAlert(alert.id, payload);
      await onSuccess();
      onClose();
    } catch (err: any) {
      setErrorText(err.message || "Ошибка закрытия инцидента");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="engineer-modal-overlay">
      <div className="engineer-modal-card">
        <div className="engineer-modal-header">
          <h2>Реакция инженера на красный алерт</h2>
          <p>
            Инцидент #{alert.id.slice(0, 8)} • Тип: {alert.trigger_type}
          </p>
        </div>

        {errorText && (
          <div className="gantt-msg-banner msg-error">{errorText}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="engineer-form-field">
            <label>Сценарий резолва инцидента</label>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
            >
              {RESOLVE_SCENARIOS.map((sc) => (
                <option key={sc.value} value={sc.value}>
                  {sc.label}
                </option>
              ))}
            </select>
          </div>

          {scenario !== "FALSE_ALARM" && (
            <div className="engineer-form-field">
              <label>Контрольный дедлайн на устранение (target_deadline)</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                required
              />
            </div>
          )}

          <div className="engineer-form-field">
            <label>Официальный комментарий инженера ПТО</label>
            <textarea
              placeholder="Укажите причину нарушения, предпринятые меры или обоснование форс-мажора..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
            />
          </div>

          <div className="engineer-form-field">
            <label>
              Кадры-улики с нейросетевой детекцией ({selectedFrameIds.length}{" "}
              выбрано)
            </label>
            {isLoadingFrames ? (
              <p className="metric-subtext">Загрузка галереи снимков...</p>
            ) : frames.length === 0 ? (
              <p className="metric-subtext">Снимков с камер пока нет</p>
            ) : (
              <div className="evidence-selection-grid">
                {frames.map((frame) => {
                  const isSelected = selectedFrameIds.includes(frame.id);
                  return (
                    <div
                      key={frame.id}
                      className={`evidence-thumb-card ${
                        isSelected ? "selected" : ""
                      }`}
                      onClick={() => toggleFrameSelection(frame.id)}
                    >
                      <img
                        src={frame.image_url || frame.image_path}
                        alt="Кадр детекции"
                        className="evidence-thumb-img"
                      />
                      {isSelected && (
                        <span className="evidence-check-badge">✓</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
              className="btn-submit-action danger"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Регистрация..." : "Утвердить решение инженера"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};