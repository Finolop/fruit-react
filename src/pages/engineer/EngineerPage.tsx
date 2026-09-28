import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../../store";

import Header from "../../components/Header";
import { ForemanObjectManager } from "../../components/foreman/ForemanObjectManager";
import { CameraManagerModal } from "../../components/foreman/CameraManagerModal";
import {
  AlertDecisionModal,
  formatAlertDetails,
} from "../../components/engineer/AlertDecisionModal";
import { CascadeShiftModal } from "../../components/engineer/CascadeShiftModal";

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
import { fetchWithAuth } from "../../api/api";

import cameraIcon from "../../assets/images/Camera.svg";
import arrowLeftIcon from "../../assets/images/Arrow_Left_MD.svg";
import arrowRightIcon from "../../assets/images/Arrow_Right_MD.svg";
import checkIcon from "../../assets/images/Circle_Check.svg";
import lockIcon from "../../assets/images/Lock.svg";

import "../../styles/EngineerConsole.css";
import "../../styles/ForemanPage.css";

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

export const EngineerPage: React.FC = () => {
  const { projectId: urlProjectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();

  const currentUser = useSelector((state: RootState) => state.auth.user);
  const isAdmin = Boolean(currentUser?.roles?.includes("admin"));
  const isEngineer = Boolean(currentUser?.roles?.includes("engineer"));
  const isReadOnly = isAdmin && !isEngineer;

  const [availableProjects, setAvailableProjects] = useState<ProjectData[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    urlProjectId || null,
  );
  const [project, setProject] = useState<ProjectData | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([]);

  const [liveSummary, setLiveSummary] = useState<LiveSummaryResponse | null>(
    null,
  );
  const [activeAlert, setActiveAlert] = useState<AlertResponse | null>(null);
  const [allOpenAlerts, setAllOpenAlerts] = useState<AlertResponse[]>([]);
  const [currentSpecialStatus, setCurrentSpecialStatus] =
    useState<SpecialStatusResponse | null>(null);

  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [isCascadeModalOpen, setIsCascadeModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);

  const [isPlanCaughtUp, setIsPlanCaughtUp] = useState(false);
  const [timeLostHours, setTimeLostHours] = useState(8);
  const [responsibleParty, setResponsibleParty] = useState(
    "Генподрядная организация / Бригада",
  );

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

  useEffect(() => {
    let isMounted = true;
    const fetchProjects = async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const res = await fetchWithAuth(`/api/v1/projects`);
        const list = await parseJsonResponse(res, null);

        if (!list || !Array.isArray(list)) {
          throw new Error(
            "Не удалось получить список объектов со строительного сервера",
          );
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

  const loadProjectData = useCallback(async () => {
    if (!selectedProjectId) {
      setProject(null);
      setSchedules([]);
      setLiveSummary(null);
      setActiveAlert(null);
      setAllOpenAlerts([]);
      return;
    }

    try {
      const [
        projRes,
        schedRes,
        eqRes,
        summaryData,
        alertData,
        specStatusData,
        alertsListRes,
      ] = await Promise.all([
        fetchWithAuth(`/api/v1/projects/${selectedProjectId}`),
        fetchWithAuth(`/api/v1/projects/${selectedProjectId}/schedules`),
        fetchWithAuth(`/api/v1/dictionaries/equipment-types`),
        engineerApi.getLiveSummary(selectedProjectId).catch(() => null),
        engineerApi.getActiveAlert(selectedProjectId).catch(() => null),
        engineerApi
          .getCurrentSpecialStatus(selectedProjectId)
          .catch(() => null),
        fetchWithAuth(
          `/api/v1/alerts?project_id=${selectedProjectId}&limit=50`,
        ).catch(() => null),
      ]);

      const projData = await parseJsonResponse(projRes, null);
      const schedData = await parseJsonResponse(schedRes, []);
      const eqData = await parseJsonResponse(eqRes, []);
      const alertsData = alertsListRes
        ? await parseJsonResponse(alertsListRes, [])
        : [];

      const fallbackProject = availableProjects.find(
        (p) => p.id === selectedProjectId,
      );
      const finalData = projData || fallbackProject;

      if (!finalData) {
        throw new Error(
          "ОКС не найден или у вас нет прав надзора по этому объекту",
        );
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

      const openAlerts = Array.isArray(alertsData)
        ? alertsData.filter((a: AlertResponse) => a.status !== "RESOLVED")
        : [];
      setAllOpenAlerts(openAlerts);
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

  // Фоновое автообновление каждые 5 секунд
  useEffect(() => {
    if (!selectedProjectId) return;

    const intervalId = setInterval(() => {
      if (document.hidden || isProcessing) return;
      loadProjectData();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [selectedProjectId, isProcessing, loadProjectData]);

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

  const handleSubmitOrangeReportAndClose = async () => {
    if (isReadOnly || !currentSpecialStatus) return;

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
        "Штрафной коридор завершен. Отчет передан в Департамент для начисления неустойки.",
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
    return (
      <div className="engineer-page">
        <Header />
        <div className="project-selector-wrapper">
          <div className="project-selector-card">
            <div className="project-selector-header">
              <h2>Объекты строительного контроля</h2>
              <p>
                За вами закреплено объектов: {availableProjects.length}.
                Выберите ОКС для перехода в пульт арбитража и контроля сроков:
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
                    <img src={arrowRightIcon} alt="" className="btn-icon-svg" />
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

  const alertLevel = (
    liveSummary?.alert_level || (activeAlert ? "RED" : "GREEN")
  ).toUpperCase();
  const specStatus = (
    liveSummary?.special_status ||
    currentSpecialStatus?.type ||
    ""
  ).toUpperCase();

  const openAlertsCount =
    allOpenAlerts.length > 0 ? allOpenAlerts.length : activeAlert ? 1 : 0;
  const activeAlertParsed = activeAlert
    ? formatAlertDetails(activeAlert)
    : null;

  return (
    <div className="engineer-page">
      <Header />

      <div className="engineer-console-root">
        {/* Баннер режима только чтения для Администратора */}
        {isReadOnly && (
          <div className="engineer-readonly-banner">
            <img src={lockIcon} alt="" className="readonly-banner-icon" />
            <div className="readonly-banner-text">
              <strong>
                Режим наблюдателя (Департамент градостроительной политики)
              </strong>
              <span>
                Вы просматриваете оперативный пульт инженера в режиме чтения.
                Изменение регламентных статусов, резолв алертов и сдвиг
                директивных графиков заблокированы.
              </span>
            </div>
          </div>
        )}

        <div className="engineer-top-nav">
          <div className="engineer-project-selector-group">
            <span className="kpi-caption kpi-caption-nav">
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

          <div className="engineer-top-nav-actions">
            <button
              type="button"
              className="btn-switch-project btn-camera-manage"
              onClick={() => setIsCameraModalOpen(true)}
              title="Управление видеокамерами объекта"
            >
              <img src={cameraIcon} alt="" className="btn-icon-svg" />
              <span>Видеокамеры</span>
            </button>

            <button
              type="button"
              className="btn-switch-project"
              onClick={handleBackToSelection}
            >
              <img src={arrowLeftIcon} alt="" className="btn-icon-svg" />
              <span>Список объектов ({availableProjects.length})</span>
            </button>
          </div>
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

        {/* 1. Сетка показателей KPI */}
        <div className="engineer-kpi-grid">
          <div className="engineer-kpi-card">
            <span className="kpi-caption">Паспорт ОКС</span>
            <h2 className="kpi-title-strong" title={project.name}>
              {project.name}
            </h2>
            <span className="kpi-sub-text">
              {project.address || "Адрес площадки не указан"}
            </span>
          </div>

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
                <span className="special-mode-badge purple">Фиолетовый</span>
              )}
              {specStatus === "ORANGE" && (
                <span className="special-mode-badge orange">Оранжевый</span>
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

          <div className="engineer-kpi-card">
            <span className="kpi-caption">Готовность ОКС</span>
            <div className="kpi-accent-value">
              {liveSummary?.physical_progress_percent ?? 0}%
            </div>
            <span className="kpi-sub-text">
              По графику: {liveSummary?.time_elapsed_percent ?? 0}% времени
            </span>
          </div>

          <div className="engineer-kpi-card">
            <span className="kpi-caption">Текущий этап СМР</span>
            <div className="kpi-accent-value">
              {liveSummary?.current_stage?.days_remaining ?? 0} дн. ост.
            </div>
            <span className="kpi-sub-text">
              {liveSummary?.current_stage?.name || "Подготовительный этап"}
            </span>
          </div>

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
              <div className="eq-unit">
                <span className="eq-unit-val eq-unit-val-plan">
                  {liveSummary?.equipment_realtime?.required_total ?? 0}
                </span>
                <span className="eq-unit-lbl">План</span>
              </div>
            </div>
            <span className="kpi-sub-text">
              Открытых алертов в очереди: <strong>{openAlertsCount}</strong>
            </span>
          </div>
        </div>

        {/* 2. Блок оперативного надзора и решений */}
        <div className="console-workflow-grid">
          {/* Левая карточка: Активный инцидент */}
          <div
            className={`console-card ${
              activeAlert && activeAlert.status !== "RESOLVED"
                ? "alert-active"
                : ""
            }`}
          >
            <div className="console-card-header">
              <h3>
                {activeAlertParsed
                  ? activeAlertParsed.title
                  : "Оперативный надзор СМР"}
              </h3>
              {openAlertsCount > 1 && (
                <span className="alert-queue-counter-tag">
                  Инцидент 1 из {openAlertsCount} в очереди
                </span>
              )}
            </div>

            {activeAlert &&
            activeAlertParsed &&
            activeAlert.status !== "RESOLVED" ? (
              <div className="alert-reason-detailed-box">
                {/* Бейджи статуса со стилизованными кружками */}
                <div className="alert-reason-tags-row">
                  <span
                    className={`alert-tag-severity ${activeAlert.severity.toLowerCase()}`}
                  >
                    <span
                      className={`status-dot ${activeAlert.severity.toLowerCase() === "red" ? "red" : "yellow"}`}
                    />
                    {activeAlert.severity === "RED"
                      ? "КРАСНЫЙ АЛЕРТ: ТРЕБУЕТСЯ РЕШЕНИЕ"
                      : "ЖЁЛТЫЙ АЛЕРТ: ВРЕМЯ НА УСТРАНЕНИЕ"}
                  </span>

                  {activeAlertParsed.isCriticalPath && (
                    <span className="incident-critical-badge">
                      КРИТИЧЕСКИЙ ПУТЬ
                    </span>
                  )}

                  {activeAlertParsed.escalateCountdown && (
                    <span className="incident-escalate-pill">
                      <span className="status-dot orange" />
                      {activeAlertParsed.escalateCountdown}
                    </span>
                  )}

                  <span className="alert-tag-time">
                    {new Date(activeAlert.triggered_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="real-alert-message">
                  <strong>Суть инцидента:</strong> {activeAlertParsed.message}
                </div>

                <div className="real-alert-risk">
                  <strong>Оценка последствий:</strong>{" "}
                  {activeAlertParsed.riskHint}
                </div>

                <div className="scenario-confirm-bar">
                  <button
                    type="button"
                    className="btn-confirm-scenario-trigger"
                    disabled={isReadOnly}
                    onClick={() => setIsDecisionModalOpen(true)}
                  >
                    <img
                      src={checkIcon}
                      alt=""
                      className="btn-icon-svg btn-icon-white"
                    />
                    <span>
                      {isReadOnly
                        ? "Режим чтения (Департамент)"
                        : "Принять решение по инциденту"}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="console-card-desc">
                Критических нарушений на объекте не зафиксировано. В случае
                простоя техники или дефицита система откроет инцидент.
              </p>
            )}
          </div>

          {/* Правая карточка: Статус и управление сроками */}
          {specStatus === "PURPLE" ? (
            <div className="console-card purple-active">
              <div className="console-card-header">
                <h3>Активен Фиолетовый статус (Форс-мажор)</h3>
              </div>
              <p className="console-card-desc">
                Оформляются документы на компенсацию сроков. После подписания
                дополнительного соглашения инженер может актуализировать даты
                всех зависимых этапов.
              </p>
              <button
                type="button"
                className="action-trigger-btn purple"
                disabled={isReadOnly}
                onClick={() => setIsCascadeModalOpen(true)}
              >
                {isReadOnly
                  ? "Сдвиг сроков доступен только инженеру"
                  : "Выполнить каскадный сдвиг сроков"}
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
                  "ru-RU",
                )}
                .
              </p>

              <div className="orange-report-form">
                <label className="report-checkbox-label">
                  <input
                    type="checkbox"
                    disabled={isReadOnly}
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
                        disabled={isReadOnly}
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
                        disabled={isReadOnly}
                        value={responsibleParty}
                        onChange={(e) => setResponsibleParty(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <button
                  type="button"
                  className="action-trigger-btn orange"
                  disabled={isReadOnly || isProcessing}
                  onClick={handleSubmitOrangeReportAndClose}
                >
                  {isReadOnly
                    ? "Закрытие доступно только инженеру"
                    : isProcessing
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
                disabled={isReadOnly}
                onClick={() => setIsCascadeModalOpen(true)}
              >
                {isReadOnly
                  ? "Перенос доступен только инженеру"
                  : "Каскадный перенос этапов"}
              </button>
            </div>
          )}
        </div>

        {/* 3. Диаграмма Ганта объекта */}
        <div className="console-gantt-container">
          <h3 className="console-gantt-title">
            Директивный график выполнения работ
          </h3>
          <ForemanObjectManager
            project={project}
            schedules={schedules}
            equipmentTypes={equipmentTypes}
            reloadSchedules={loadProjectData}
            hideTopBar={true}
            isEngineer={!isReadOnly}
            isReadOnly={isReadOnly}
          />
        </div>
      </div>

      {/* Модальное окно вынесения решения по инциденту */}
      {isDecisionModalOpen && activeAlert && !isReadOnly && (
        <AlertDecisionModal
          alert={activeAlert}
          projectId={selectedProjectId!}
          onClose={() => setIsDecisionModalOpen(false)}
          onSuccess={loadProjectData}
        />
      )}

      {/* Модальное окно каскадного сдвига сроков */}
      {isCascadeModalOpen && selectedProjectId && !isReadOnly && (
        <CascadeShiftModal
          projectId={selectedProjectId}
          schedules={schedules}
          onClose={() => setIsCascadeModalOpen(false)}
          onSuccess={loadProjectData}
        />
      )}

      {/* Модальное окно видеокамер площадки */}
      {isCameraModalOpen && selectedProjectId && (
        <CameraManagerModal
          projectId={selectedProjectId}
          onClose={() => setIsCameraModalOpen(false)}
          isReadOnly={isReadOnly}
        />
      )}
    </div>
  );
};

export default EngineerPage;
