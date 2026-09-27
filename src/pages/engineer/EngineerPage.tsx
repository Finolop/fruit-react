import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../../components/Header";
import { ForemanObjectManager } from "../../components/foreman/ForemanObjectManager";
import { FramesGallery } from "../../components/monitoring/FramesGallery";
import {
  engineerApi,
  LiveSummaryResponse,
  AlertResponse,
  SpecialStatusResponse,
} from "../../api/apiEngineer";
import {
  ProjectData,
  EquipmentType,
  ScheduleItem,
} from "../foreman/ForemanPage";
import { getAuthHeaders } from "../../api/api";
import { CascadeShiftModal } from "../../components/engineer/CascadeShiftModal";
import "../../styles/EngineerConsole.css";
import "../../styles/ForemanPage.css";

const API_URL = process.env.REACT_APP_API_URL || "";

const parseJsonResponse = async (res: Response, fallback: any = null) => {
  if (!res.ok) return fallback;
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return fallback;
    }
  }
  return fallback;
};

const EngineerPage: React.FC = () => {
  const { projectId: urlProjectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();

  const [availableProjects, setAvailableProjects] = useState<ProjectData[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    urlProjectId || null
  );
  const [project, setProject] = useState<ProjectData | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([]);

  // Состояния оперативного надзора
  const [liveSummary, setLiveSummary] = useState<LiveSummaryResponse | null>(null);
  const [activeAlert, setActiveAlert] = useState<AlertResponse | null>(null);
  const [currentSpecialStatus, setCurrentSpecialStatus] =
    useState<SpecialStatusResponse | null>(null);

  // Форма штрафного отчета
  const [isPlanCaughtUp, setIsPlanCaughtUp] = useState(false);
  const [timeLostHours, setTimeLostHours] = useState(8);
  const [responsibleParty, setResponsibleParty] = useState(
    "Бригада монолитчиков (Подрядчик)"
  );

  // Модальные окна и индикаторы
  const [isCascadeModalOpen, setIsCascadeModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (urlProjectId) {
      setSelectedProjectId(urlProjectId);
    }
  }, [urlProjectId]);

  // Загрузка списка закрепленных за инженером объектов
  useEffect(() => {
    let isMounted = true;
    const fetchProjects = async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const res = await fetch(`${API_URL}/api/v1/projects`, {
          headers: getAuthHeaders(),
        });
        const list = await parseJsonResponse(res, null);

        if (!list || !Array.isArray(list)) {
          throw new Error("Не удалось получить список объектов со строительного сервера");
        }

        if (isMounted) {
          setAvailableProjects(list);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.message || "Ошибка подключения к реестру");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchProjects();
    return () => {
      isMounted = false;
    };
  }, []);

  // Загрузка детальных данных выбранного объекта
  const loadProjectData = useCallback(async () => {
    if (!selectedProjectId) {
      setProject(null);
      setSchedules([]);
      setLiveSummary(null);
      return;
    }

    try {
      const headers = getAuthHeaders();
      const [projRes, schedRes, eqRes, summaryData, alertData, specStatusData] =
        await Promise.all([
          fetch(`${API_URL}/api/v1/projects/${selectedProjectId}`, { headers }),
          fetch(`${API_URL}/api/v1/projects/${selectedProjectId}/schedules`, {
            headers,
          }),
          fetch(`${API_URL}/api/v1/dictionaries/equipment-types`, { headers }),
          engineerApi.getLiveSummary(selectedProjectId).catch(() => null),
          engineerApi.getActiveAlert(selectedProjectId).catch(() => null),
          engineerApi.getCurrentSpecialStatus(selectedProjectId).catch(() => null),
        ]);

      const projData = await parseJsonResponse(projRes, null);
      const schedData = await parseJsonResponse(schedRes, []);
      const eqData = await parseJsonResponse(eqRes, []);

      const fallbackProject = availableProjects.find((p) => p.id === selectedProjectId);
      const finalData = projData || fallbackProject;

      if (!finalData) {
        throw new Error("ОКС не найден или у вас нет прав надзора по этому объекту");
      }

      setProject({
        id: finalData.id,
        name: finalData.name || "Объект капитального строительства",
        address: finalData.address || "Адрес не указан",
        type_id: finalData.type_id,
        status: finalData.schedule_status || "ACTIVE",
      });

      setSchedules(Array.isArray(schedData) ? schedData : []);
      setEquipmentTypes(Array.isArray(eqData) ? eqData : []);
      setLiveSummary(summaryData);
      setActiveAlert(alertData);
      setCurrentSpecialStatus(specStatusData);
    } catch (e: any) {
      console.error("Ошибка загрузки данных инженера:", e);
      setStatusMessage({
        type: "error",
        text: "Не удалось обновить статус мониторинга",
      });
    }
  }, [selectedProjectId, availableProjects]);

  useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

  const handleSelectProject = (projId: string) => {
    setSelectedProjectId(projId);
    navigate(`/engineer/${projId}`);
  };

  const handleBackToSelection = () => {
    setSelectedProjectId(null);
    setProject(null);
    setSchedules([]);
    setLiveSummary(null);
    navigate("/engineer");
  };

  // 3 сценария реакции на красный алерт
  const handleResolveAlertScenario = async (
    scenario: "FORCE_MAJEURE_CASCADE" | "SPECIAL_STATUS_OPEN" | "FALSE_ALARM",
    explanation: string
  ) => {
    if (!activeAlert) return;

    setIsProcessing(true);
    setStatusMessage(null);

    try {
      const nextDay = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      await engineerApi.resolveAlert(activeAlert.id, {
        action_taken: scenario,
        engineer_comment: explanation,
        evidence_frame_ids: activeAlert.trigger_frame_id
          ? [activeAlert.trigger_frame_id]
          : [],
        target_deadline: scenario === "FALSE_ALARM" ? undefined : nextDay,
      });

      setStatusMessage({
        type: "success",
        text: `Решение принято: ${explanation}. Статус объекта переведен.`,
      });

      await loadProjectData();
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Ошибка применения решения инженера",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Закрытие оранжевого окна со штрафным отчетом
  const handleSubmitOrangeReportAndClose = async () => {
    if (!currentSpecialStatus) return;

    setIsProcessing(true);
    setStatusMessage(null);

    try {
      await engineerApi.submitOrangeReport(currentSpecialStatus.id, {
        is_plan_caught_up: isPlanCaughtUp,
        time_lost_hours: Number(timeLostHours),
        responsible_party: responsibleParty,
        summary_meta: {
          closed_by: "Инженер ПТО",
          timestamp: new Date().toISOString(),
        },
      });

      await engineerApi.closeSpecialStatusWindow(
        currentSpecialStatus.id,
        "Штрафной коридор завершен. Отчет передан в Департамент для начисления неустойки."
      );

      setStatusMessage({
        type: "success",
        text: "Оранжевый спецстатус закрыт, штрафной отчет зарегистрирован.",
      });

      await loadProjectData();
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Ошибка отправки штрафного отчета",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="engineer-page">
        <Header />
        <div className="foreman-content">
          <div className="empty-state-container">
            <h2 className="empty-state-title">Загрузка данных...</h2>
            <p className="empty-state-description">
              Синхронизация закрепленных объектов инженера технадзора
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedProjectId) {
    if (availableProjects.length === 0) {
      return (
        <div className="engineer-page">
          <Header />
          <div className="foreman-content">
            <div className="empty-state-container">
              <h2 className="empty-state-title">ОКС не назначен</h2>
              <p className="empty-state-description">
                {errorMessage ||
                  "За вашей учетной записью пока не закреплено ни одного объекта контроля. Обратитесь к администратору департамента для выдачи прав технадзора."}
              </p>
              <button
                type="button"
                className="foreman-primary-button"
                onClick={() => window.location.reload()}
              >
                Обновить данные
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="engineer-page">
        <Header />
        <div className="project-selector-wrapper">
          <div className="project-selector-card">
            <div className="project-selector-header">
              <h2>Объекты строительного контроля</h2>
              <p>
                За вами закреплено объектов: {availableProjects.length}. Выберите ОКС для перехода в пульт арбитража и контроля сроков:
              </p>
            </div>

            <div className="project-selector-list">
              {availableProjects.map((p) => (
                <div
                  key={p.id}
                  className="project-selector-item"
                  onClick={() => handleSelectProject(p.id)}
                >
                  <div className="project-selector-info">
                    <span className="project-selector-name">{p.name}</span>
                    <span className="project-selector-address">
                      {p.address || "Адрес площадки не указан"}
                    </span>
                  </div>
                  <div className="project-selector-actions">
                    <span className="project-selector-badge">
                      {p.status || "ACTIVE"}
                    </span>
                    <span className="project-selector-arrow">→</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="engineer-page">
        <Header />
        <div className="foreman-content">
          <div className="empty-state-container">
            <h2 className="empty-state-title">Ошибка загрузки ОКС</h2>
            <p className="empty-state-description">
              {errorMessage || "Не удалось загрузить данные выбранного объекта"}
            </p>
            <button
              type="button"
              className="foreman-primary-button"
              onClick={handleBackToSelection}
            >
              Вернуться к списку объектов
            </button>
          </div>
        </div>
      </div>
    );
  }

  const alertLevel = (liveSummary?.alert_level || "GREEN").toUpperCase();
  const specStatus = (
    liveSummary?.special_status ||
    currentSpecialStatus?.type ||
    ""
  ).toUpperCase();

  return (
    <div className="engineer-page">
      <Header />

      <div className="engineer-console-root">
        {/* Верхняя навигационная панель инженера */}
        <div className="engineer-top-nav">
          <div className="engineer-project-selector-group">
            <span className="kpi-caption" style={{ margin: 0 }}>
              Объект контроля:
            </span>
            <select
              className="engineer-project-dropdown"
              value={selectedProjectId}
              onChange={(e) => handleSelectProject(e.target.value)}
            >
              {availableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.address ? `(${p.address})` : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn-switch-project"
            onClick={handleBackToSelection}
          >
            ← Список объектов ({availableProjects.length})
          </button>
        </div>

        {statusMessage && (
          <div
            className={`gantt-msg-banner ${
              statusMessage.type === "success" ? "msg-success" : "msg-error"
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {/* 1. СЕТКА ИЗ 5 НЕЗАВИСИМЫХ КАРТОЧЕК KPI */}
        <div className="engineer-kpi-grid">
          {/* Карточка 1: Объект */}
          <div className="engineer-kpi-card">
            <span className="kpi-caption">Паспорт ОКС</span>
            <h2 className="kpi-title-strong" title={project.name}>
              {project.name}
            </h2>
            <span className="kpi-sub-text">
              {project.address || "Адрес площадки не указан"}
            </span>
          </div>

          {/* Карточка 2: Оперативный статус и Спецрежим */}
          <div className="engineer-kpi-card">
            <span className="kpi-caption">Статус контроля ОКС</span>
            <div className="status-badge-row">
              <span
                className={`traffic-light-badge ${
                  alertLevel === "RED"
                    ? "red"
                    : alertLevel === "YELLOW"
                    ? "yellow"
                    : "green"
                }`}
              >
                {alertLevel}
              </span>

              {specStatus === "PURPLE" && (
                <span className="special-mode-badge purple">
                  Фиолетовый
                </span>
              )}
              {specStatus === "ORANGE" && (
                <span className="special-mode-badge orange">
                  Оранжевый
                </span>
              )}
            </div>
            <span className="kpi-sub-text">
              {specStatus === "PURPLE"
                ? "Форс-мажор: оформление ДС"
                : specStatus === "ORANGE"
                ? "Штрафной коридор"
                : alertLevel === "RED"
                ? "Требуется решение инженера"
                : "Штатный режим надзора"}
            </span>
          </div>

          {/* Карточка 3: Готовность */}
          <div className="engineer-kpi-card">
            <span className="kpi-caption">Готовность ОКС</span>
            <div className="kpi-accent-value">
              {liveSummary?.physical_progress_percent ?? 0}%
            </div>
            <span className="kpi-sub-text">
              По графику: {liveSummary?.time_elapsed_percent ?? 0}% времени
            </span>
          </div>

          {/* Карточка 4: Текущий этап */}
          <div className="engineer-kpi-card">
            <span className="kpi-caption">Текущий этап СМР</span>
            <div className="kpi-accent-value">
              {liveSummary?.current_stage?.days_remaining ?? 0} дн. ост.
            </div>
            <span className="kpi-sub-text">
              {liveSummary?.current_stage?.name || "Подготовительный этап"}
            </span>
          </div>

          {/* Карточка 5: Техника и очередь инцидентов */}
          <div className="engineer-kpi-card">
            <span className="kpi-caption">Техника и Инциденты</span>
            <div className="console-eq-row">
              <div className="eq-unit">
                <span className="eq-unit-val">
                  {liveSummary?.equipment_realtime?.active_count ?? 0}
                </span>
                <span className="eq-unit-lbl">В работе</span>
              </div>
              <div className="eq-unit">
                <span className="eq-unit-val idle">
                  {liveSummary?.equipment_realtime?.idle_count ?? 0}
                </span>
                <span className="eq-unit-lbl">Простой</span>
              </div>
            </div>
            <span className="kpi-sub-text">
              {activeAlert && activeAlert.status !== "RESOLVED"
                ? "Алертов в очереди: 1"
                : "Активных алертов: 0"}
            </span>
          </div>
        </div>

        {/* 2. Блок рабочих сценариев инженера */}
        <div className="console-workflow-grid">
          {activeAlert && activeAlert.status !== "RESOLVED" ? (
            <div className="console-card alert-active">
              <div className="console-card-header">
                <h3>Зафиксирован критический алерт: {activeAlert.trigger_type}</h3>
              </div>
              <p className="console-card-desc">
                Нейросеть зафиксировала нарушение на объекте. По регламенту ТЗ
                инженер обязан выбрать один из 3 сценариев реагирования:
              </p>

              <div className="incident-options-list">
                <button
                  type="button"
                  className="incident-btn-option opt-purple"
                  disabled={isProcessing}
                  onClick={() =>
                    handleResolveAlertScenario(
                      "FORCE_MAJEURE_CASCADE",
                      "Внешний фактор / Форс-мажор. Сроки будут сдвинуты каскадно."
                    )
                  }
                >
                  <span className="opt-title">
                    1. Форс-мажор (Внешний фактор) [Фиолетовый статус]
                  </span>
                  <span className="opt-desc">
                    Причина не зависит от строителей (затор на МКАД, погода).
                    Отмена тревоги, перевод в фиолетовый статус для оформления бумаг.
                  </span>
                </button>

                <button
                  type="button"
                  className="incident-btn-option opt-orange"
                  disabled={isProcessing}
                  onClick={() =>
                    handleResolveAlertScenario(
                      "SPECIAL_STATUS_OPEN",
                      "Вина строительной бригады. Установлен коридор устранения."
                    )
                  }
                >
                  <span className="opt-title">
                    2. Проступок бригады [Оранжевый статус]
                  </span>
                  <span className="opt-desc">
                    Тревога подтверждена. Сроки не сдвигаются. Запускается окно 48ч,
                    чтобы подрядчик догнал план, иначе начисляется неустойка.
                  </span>
                </button>

                <button
                  type="button"
                  className="incident-btn-option opt-green"
                  disabled={isProcessing}
                  onClick={() =>
                    handleResolveAlertScenario(
                      "FALSE_ALARM",
                      "Сброс ложного срабатывания под ответственность инженера."
                    )
                  }
                >
                  <span className="opt-title">3. Сброс / Ложный сигнал</span>
                  <span className="opt-desc">
                    Ошибка классификации техники или штатное технологическое
                    окно. Запись сохраняется в аудите.
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="console-card">
              <div className="console-card-header">
                <h3>Оперативный надзор СМР</h3>
              </div>
              <p className="console-card-desc">
                Критических нарушений не зафиксировано. В случае отклонений от
                графика или простоя техники система уведомит инженера для принятия мер.
              </p>
            </div>
          )}

          {specStatus === "PURPLE" ? (
            <div className="console-card purple-active">
              <div className="console-card-header">
                <h3>Активен Фиолетовый статус (Форс-мажор)</h3>
              </div>
              <p className="console-card-desc">
                Оформляются документы на компенсацию сроков. После подписания
                дополнительного соглашения инженер может актуализировать даты всех
                зависимых этапов.
              </p>
              <button
                type="button"
                className="action-trigger-btn purple"
                onClick={() => setIsCascadeModalOpen(true)}
              >
                Выполнить каскадный сдвиг сроков
              </button>
            </div>
          ) : specStatus === "ORANGE" && currentSpecialStatus ? (
            <div className="console-card orange-active">
              <div className="console-card-header">
                <h3>Активен Оранжевый статус (Штрафной коридор)</h3>
              </div>
              <p className="console-card-desc">
                Подрядчику выделено время на ликвидацию отставания. Контрольный
                срок:{" "}
                {new Date(currentSpecialStatus.target_deadline).toLocaleString(
                  "ru-RU"
                )}
                .
              </p>

              <div className="orange-report-form">
                <label className="report-checkbox-label">
                  <input
                    type="checkbox"
                    checked={isPlanCaughtUp}
                    onChange={(e) => setIsPlanCaughtUp(e.target.checked)}
                  />
                  Подрядчик ликвидировал отставание и догнал график?
                </label>

                {!isPlanCaughtUp && (
                  <>
                    <div className="report-input-row">
                      <label>Потерянное время стройки (часов):</label>
                      <input
                        type="number"
                        min="1"
                        value={timeLostHours}
                        onChange={(e) =>
                          setTimeLostHours(parseInt(e.target.value, 10) || 1)
                        }
                      />
                    </div>

                    <div className="report-input-row">
                      <label>Виновная сторона (для расчета неустойки):</label>
                      <input
                        type="text"
                        value={responsibleParty}
                        onChange={(e) => setResponsibleParty(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <button
                  type="button"
                  className="action-trigger-btn orange"
                  disabled={isProcessing}
                  onClick={handleSubmitOrangeReportAndClose}
                >
                  {isProcessing
                    ? "Фиксация..."
                    : "Закрыть окно и отправить штрафной отчет"}
                </button>
              </div>
            </div>
          ) : (
            <div className="console-card">
              <div className="console-card-header">
                <h3>Корректировка сроков</h3>
              </div>
              <p className="console-card-desc">
                Каскадный сдвиг сроков доступен при наличии согласованного
                распорядительного акта или активации форс-мажорного статуса.
              </p>
              <button
                type="button"
                className="action-trigger-btn"
                onClick={() => setIsCascadeModalOpen(true)}
              >
                Каскадный перенос этапов
              </button>
            </div>
          )}
        </div>

        {/* 3. Галерея снимков видеомониторинга */}
        {selectedProjectId && (
          <FramesGallery projectId={selectedProjectId} />
        )}

        {/* 4. Диаграмма Ганта объекта */}
        <div className="console-gantt-container">
          <h3 className="console-gantt-title">Директивный график выполнения работ</h3>
          <ForemanObjectManager
            project={project}
            schedules={schedules}
            equipmentTypes={equipmentTypes}
            reloadSchedules={loadProjectData}
            hideTopBar={true}
            isEngineer={true}
          />
        </div>
      </div>

      {/* Модальное окно каскадного сдвига */}
      {isCascadeModalOpen && selectedProjectId && (
        <CascadeShiftModal
          projectId={selectedProjectId}
          schedules={schedules}
          onClose={() => setIsCascadeModalOpen(false)}
          onSuccess={loadProjectData}
        />
      )}
    </div>
  );
};

export default EngineerPage;