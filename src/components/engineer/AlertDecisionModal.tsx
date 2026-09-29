import React, { useState } from "react";
import {
  engineerApi,
  AlertResponse,
  AlertResolveRequest,
} from "../../api/apiEngineer";
import closeIcon from "../../assets/images/Close_MD.svg";
import checkIcon from "../../assets/images/Circle_Check.svg";
import alertTriangleIcon from "../../assets/images/Triangle_Warning.svg";
import "../../styles/EngineerConsole.css";

interface Props {
  alert: AlertResponse;
  projectId: string;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

type ScenarioType =
  | "FALSE_ALARM"
  | "SPECIAL_STATUS_OPEN"
  | "FORCE_MAJEURE_CASCADE";

const TECH_NAMES: Record<string, string> = {
  truck: "бортовой грузовик",
  concrete_mixer: "автобетоносмеситель (миксер)",
  dump_truck: "самосвал",
  bulldozer: "бульдозер",
  excavator: "экскаватор",
  mobile_crane: "автокран",
  road_roller: "каток",
  drilling_rig: "буровая установка",
  pump_truck: "автобетононасос",
};

const TRIGGER_TITLES: Record<string, string> = {
  EQUIPMENT_IDLE: "Простой строительной техники",
  DEFICIT_TRUCK: "Дефицит бортовых грузовиков",
  DEFICIT_CONCRETE_MIXER: "Отсутствие автобетоносмесителей",
  DEFICIT_DUMP_TRUCK: "Нехватка самосвалов под вывоз",
  DEFICIT_BULLDOZER: "Отсутствие бульдозера на участке",
  DEFICIT_EXCAVATOR: "Отсутствие экскаватора на объекте",
  DEFICIT_MOBILE_CRANE: "Отсутствие монтажного автокрана",
  EQUIPMENT_DEFICIT: "Дефицит строительной техники",
  EQUIPMENT_MISMATCH: "Несогласованная машина на площадке",
  EQUIPMENT_SURPLUS: "Логистическая скученность техники",
  WORK_OFF_SCHEDULE: "Работы вне утверждённого графика",
  UNAUTHORIZED_START: "Самовольный старт работ без ордера",
  NOISE_VIOLATION: "Нарушение закона о тишине (23:00 - 07:00)",
  DELAYED: "Срыв директивного срока этапа",
};

export const formatAlertDetails = (alert: AlertResponse) => {
  const details = alert.details || {};
  const rawMsg = details.message || "";
  const isCriticalPath = Boolean(details.is_critical_path);

  const title = TRIGGER_TITLES[alert.trigger_type] || alert.trigger_type;

  let cleanMessage = rawMsg;
  Object.entries(TECH_NAMES).forEach(([slug, ruName]) => {
    const reg = new RegExp(`['"]?${slug}['"]?`, "gi");
    cleanMessage = cleanMessage.replace(reg, `«${ruName}»`);
  });

  const deficitMatch = cleanMessage.match(
    /Нехватка:\s*нужно\s*(\d+)\s*(.+?),\s*обнаружено\s*(\d+)/i,
  );
  if (deficitMatch) {
    const [, need, tech, found] = deficitMatch;
    cleanMessage = `По графику требуется ${need} ед. (${tech.trim()}), фактически зафиксировано: ${found} ед.`;
  } else if (/Простой техники/i.test(cleanMessage)) {
    cleanMessage = cleanMessage.replace(
      /Простой техники \((\d+)\s*ед\.\)/i,
      "Зафиксирован технологический простой $1 ед. техники в рабочей зоне",
    );
  }

  let escalateCountdown = "";
  if (alert.escalate_at && alert.severity === "YELLOW") {
    try {
      const diffMins = Math.round(
        (new Date(alert.escalate_at).getTime() - Date.now()) / (1000 * 60),
      );
      if (diffMins > 0) {
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        escalateCountdown = `До автоэскалации в Красный: ${hours} ч. ${mins} мин.`;
      } else {
        escalateCountdown = "Время на устранение истекло";
      }
    } catch {}
  }

  return {
    title,
    message: cleanMessage || "Отклонение от директивных параметров",
    isCriticalPath,
    escalateCountdown,
  };
};

export const AlertDecisionModal: React.FC<Props> = ({
  alert,
  projectId: _projectId,
  onClose,
  onSuccess,
}) => {
  const [scenario, setScenario] = useState<ScenarioType>("FALSE_ALARM");
  const [reason, setReason] = useState("");
  const [deadlineHours, setDeadlineHours] = useState<number>(24);
  const [responsibleParty, setResponsibleParty] = useState("");
  const [documentRef, setDocumentRef] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");

  const alertInfo = formatAlertDetails(alert);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorText("Обязательно укажите причину решения");
      return;
    }

    setIsSubmitting(true);
    setErrorText("");

    try {
      let targetDeadline: string | undefined = undefined;
      let fullComment = reason.trim();

      if (scenario === "SPECIAL_STATUS_OPEN") {
        targetDeadline = new Date(
          Date.now() + deadlineHours * 60 * 60 * 1000,
        ).toISOString();
        if (responsibleParty.trim()) {
          fullComment += ` (Ответственный подрядчик: ${responsibleParty.trim()})`;
        }
      } else if (scenario === "FORCE_MAJEURE_CASCADE") {
        if (documentRef.trim()) {
          fullComment += ` [Акт/Документ: ${documentRef.trim()}]`;
        }
      }

      const payload: AlertResolveRequest = {
        action_taken: scenario,
        engineer_comment: fullComment,
        evidence_frame_ids: alert.trigger_frame_id
          ? [alert.trigger_frame_id]
          : [],
        target_deadline: targetDeadline,
      };

      await engineerApi.resolveAlert(alert.id, payload);
      await onSuccess();
      onClose();
    } catch (err: any) {
      setErrorText(err.message || "Ошибка сохранения решения");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-window alert-decision-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="alert-decision-form">
          {/* Шапка модального окна */}
          <div className="modal-header">
            <div className="decision-header-info">
              <div className="decision-icon-badge">
                <img
                  src={alertTriangleIcon}
                  alt=""
                  className="modal-icon-svg"
                />
              </div>
              <div className="decision-header-text">
                <h3>Решение по инциденту на объекте</h3>
                <p>
                  Фиксация процессуального постановления надзора в журнале Audit
                  Trail
                </p>
              </div>
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
              <div className="admin-error-message">{errorText}</div>
            )}

            {/* Карточка инцидента */}
            <div className="incident-summary-card">
              <div className="incident-summary-top">
                <span
                  className={`incident-severity-badge ${alert.severity.toLowerCase()}`}
                >
                  <span
                    className={`status-dot ${alert.severity.toLowerCase() === "red" ? "red" : "yellow"}`}
                  />
                  {alert.severity === "RED"
                    ? "КРАСНЫЙ АЛЕРТ: ТРЕБУЕТСЯ РЕШЕНИЕ"
                    : "ЖЁЛТЫЙ АЛЕРТ: ВРЕМЯ НА УСТРАНЕНИЕ"}
                </span>

                <span className="incident-type-tag">{alertInfo.title}</span>

                {alertInfo.isCriticalPath && (
                  <span className="incident-critical-badge">
                    КРИТИЧЕСКИЙ ПУТЬ
                  </span>
                )}

                {alertInfo.escalateCountdown && (
                  <span className="incident-escalate-pill">
                    <span className="status-dot orange" />
                    {alertInfo.escalateCountdown}
                  </span>
                )}
              </div>

              <div className="real-alert-message">
                <strong>Суть инцидента:</strong> {alertInfo.message}
              </div>
            </div>

            {/* 3 кнопки выбора решения со статусными точками */}
            <div className="form-field">
              <label>Выберите регламентное решение *</label>
              <div className="decision-mode-selector">
                <button
                  type="button"
                  className={`mode-btn green ${scenario === "FALSE_ALARM" ? "active" : ""}`}
                  onClick={() => setScenario("FALSE_ALARM")}
                >
                  <span className="status-dot green" />
                  <span>1. Сброс (Ложная тревога)</span>
                </button>

                <button
                  type="button"
                  className={`mode-btn orange ${scenario === "SPECIAL_STATUS_OPEN" ? "active" : ""}`}
                  onClick={() => setScenario("SPECIAL_STATUS_OPEN")}
                >
                  <span className="status-dot orange" />
                  <span>2. Штрафной коридор (Вина строителей)</span>
                </button>

                <button
                  type="button"
                  className={`mode-btn purple ${scenario === "FORCE_MAJEURE_CASCADE" ? "active" : ""}`}
                  onClick={() => setScenario("FORCE_MAJEURE_CASCADE")}
                >
                  <span className="status-dot purple" />
                  <span>3. Форс-мажор</span>
                </button>
              </div>
            </div>

            {/* Сценарий 1: Зеленый сброс */}
            {scenario === "FALSE_ALARM" && (
              <div className="decision-tab-content green">
                <div className="form-field">
                  <label>Причина отмены алерта инспектором *</label>
                  <textarea
                    className="foreman-custom-input large-reason-area"
                    placeholder="Например: Технологический перерыв бетонирования по карте захватки / блик оптической линзы камеры / техника находилась в закрытом ангаре разгрузки..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                  />
                  <small className="field-hint">
                    Алерт аннулируется в базе. Светофор объекта возвращается в
                    штатный зелёный режим. Штрафы не начисляются.
                  </small>
                </div>
              </div>
            )}

            {/* Сценарий 2: Оранжевый статус */}
            {scenario === "SPECIAL_STATUS_OPEN" && (
              <div className="decision-tab-content orange">
                <div className="form-field">
                  <label>
                    Суть нарушения и основания наложения штрафного статуса *
                  </label>
                  <textarea
                    className="foreman-custom-input large-reason-area"
                    placeholder="Например: Срыв выхода ночной смены механизаторов / отсутствие дизельного топлива на площадке / подрядчик самовольно снял самосвалы на соседний объект..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row-2col">
                  <div className="form-field">
                    <label>Время на нагон графика (часов) *</label>
                    <input
                      type="number"
                      min="1"
                      max="168"
                      value={deadlineHours}
                      onChange={(e) =>
                        setDeadlineHours(
                          Math.max(1, parseInt(e.target.value, 10) || 1),
                        )
                      }
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label>Ответственная подрядная организация</label>
                    <input
                      type="text"
                      placeholder="ООО «МонолитСтрой» / Субподрядчик земляных работ"
                      value={responsibleParty}
                      onChange={(e) => setResponsibleParty(e.target.value)}
                    />
                  </div>
                </div>

                <small className="field-hint">
                  Сроки сдачи директивно НЕ двигаются. Включается счётчик
                  потерянных часов для итогового акта неустойки.
                </small>
              </div>
            )}

            {/* Сценарий 3: Фиолетовый статус */}
            {scenario === "FORCE_MAJEURE_CASCADE" && (
              <div className="decision-tab-content purple">
                <div className="form-field">
                  <label>Обоснование внешнего форс-мажора *</label>
                  <textarea
                    className="foreman-custom-input large-reason-area"
                    placeholder="Например: Штормовое предупреждение МЧС с запретом высотных работ / перекрытие МКАД полицией / подтопление ливнем городских коллекторов Мосводоканала..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                  />
                </div>

                <div className="form-field">
                  <label>
                    Реквизиты подтверждающего акта / справки ведомств
                  </label>
                  <input
                    type="text"
                    placeholder="Справка Росгидромета № 18-П / Письмо ЦОДД / Акт сетевой компании"
                    value={documentRef}
                    onChange={(e) => setDocumentRef(e.target.value)}
                  />
                </div>

                <small className="field-hint">
                  Вина со строителей снимается. Открывается право на каскадный
                  перенос сроков через допсоглашение.
                </small>
              </div>
            )}
          </div>

          {/* Фиксированный подвал */}
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
              className={`btn-gantt-success ${
                scenario === "SPECIAL_STATUS_OPEN"
                  ? "btn-orange"
                  : scenario === "FORCE_MAJEURE_CASCADE"
                    ? "btn-purple"
                    : "btn-green"
              }`}
              disabled={isSubmitting}
            >
              <img
                src={checkIcon}
                alt=""
                className="btn-icon-svg btn-icon-white"
              />
              <span>
                {isSubmitting
                  ? "Регистрация..."
                  : scenario === "FALSE_ALARM"
                    ? "Отменить алерт (Зелёный режим)"
                    : scenario === "SPECIAL_STATUS_OPEN"
                      ? "Утвердить штрафной коридор"
                      : "Зафиксировать форс-мажор"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
