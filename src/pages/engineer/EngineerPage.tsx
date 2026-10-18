import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { skipToken } from "@reduxjs/toolkit/query";

import { selectIsAdmin, selectIsEngineer } from "../../features/auth/authSlice";
import {
  useGetProjectsQuery,
  useGetProjectByIdQuery,
  useGetSchedulesQuery,
  useGetEquipmentTypesQuery,
  useGetLiveSummaryQuery,
  useGetActiveAlertQuery,
  useGetAlertsListQuery,
  useGetCurrentSpecialStatusQuery,
  useSubmitOrangeReportMutation,
  useCloseSpecialStatusWindowMutation,
  extractApiError,
  useGetCamerasQuery,
} from "../../api/rtkApi";
import Header from "../../components/Header";
import { ForemanObjectManager } from "../../components/foreman/ForemanObjectManager";
import { CameraManagerModal } from "../../components/foreman/CameraManagerModal";
import {
  AlertDecisionModal,
  formatAlertDetails,
} from "../../components/engineer/AlertDecisionModal";
import { CascadeShiftModal } from "../../components/engineer/CascadeShiftModal";

import { ProjectData } from "../foreman/ForemanPage";

import { ReactComponent as CameraIcon } from "../../assets/images/Camera.svg";
import { ReactComponent as ArrowLeftIcon } from "../../assets/images/Arrow_Left_MD.svg";
import { ReactComponent as ArrowRightIcon } from "../../assets/images/Arrow_Right_MD.svg";
import { ReactComponent as CheckIcon } from "../../assets/images/Circle_Check.svg";
import { ReactComponent as LockIcon } from "../../assets/images/Lock.svg";

import "../../styles/EngineerConsole.css";
import "../../styles/ForemanPage.css";

export const EngineerPage: React.FC = () => {
  const { projectId: urlProjectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();

  const isAdmin = useSelector(selectIsAdmin);
  const isEngineer = useSelector(selectIsEngineer);
  const isReadOnly = isAdmin && !isEngineer;

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    urlProjectId || null,
  );

  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [isCascadeModalOpen, setIsCascadeModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const { data: engineerCameras = [] } = useGetCamerasQuery(
    selectedProjectId ?? skipToken,
  );
  const [isPlanCaughtUp, setIsPlanCaughtUp] = useState(false);
  const [timeLostHours, setTimeLostHours] = useState(8);
  const [responsibleParty, setResponsibleParty] = useState(
    "Генподрядная организация / Бригада",
  );

  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (urlProjectId) {
      setSelectedProjectId(urlProjectId);
    }
  }, [urlProjectId]);

  const {
    data: availableProjects = [],
    isLoading: isLoadingProjects,
    isError: isProjectsError,
  } = useGetProjectsQuery();

  const { data: rawProject, refetch: refetchProject } = useGetProjectByIdQuery(
    selectedProjectId ?? skipToken,
  );

  const { data: schedules = [], refetch: refetchSchedules } =
    useGetSchedulesQuery(selectedProjectId ?? skipToken, {
      pollingInterval: 5000,
      skipPollingIfUnfocused: true,
    });

  const { data: equipmentTypes = [] } = useGetEquipmentTypesQuery();

  const { data: liveSummary = null, refetch: refetchSummary } =
    useGetLiveSummaryQuery(selectedProjectId ?? skipToken, {
      pollingInterval: 5000,
      skipPollingIfUnfocused: true,
    });

  const { data: activeAlert = null, refetch: refetchActiveAlert } =
    useGetActiveAlertQuery(selectedProjectId ?? skipToken, {
      pollingInterval: 5000,
      skipPollingIfUnfocused: true,
    });

  const { data: _alertsData = [], refetch: refetchAlertsList } =
    useGetAlertsListQuery(
      selectedProjectId
        ? { projectId: selectedProjectId, limit: 50 }
        : skipToken,
      {
        pollingInterval: 5000,
        skipPollingIfUnfocused: true,
      },
    );

  const { data: currentSpecialStatus = null, refetch: refetchSpecStatus } =
    useGetCurrentSpecialStatusQuery(selectedProjectId ?? skipToken, {
      pollingInterval: 5000,
      skipPollingIfUnfocused: true,
    });

  const [submitOrangeReport, { isLoading: isSubmittingOrange }] =
    useSubmitOrangeReportMutation();
  const [closeSpecialStatusWindow, { isLoading: isClosingWindow }] =
    useCloseSpecialStatusWindowMutation();

  const isProcessing = isSubmittingOrange || isClosingWindow;

  const project: ProjectData | null = useMemo(() => {
    const fallback = availableProjects.find((p) => p.id === selectedProjectId);
    const finalData = rawProject || fallback;
    if (!finalData) return null;

    return {
      id: finalData.id,
      name: finalData.name || "Объект капитального строительства",
      address: finalData.address || "Адрес не указан",
      type_id: finalData.type_id,
      status: finalData.schedule_status || finalData.status || "ACTIVE",
    };
  }, [rawProject, availableProjects, selectedProjectId]);

  const loadProjectData = useCallback(async () => {
    if (!selectedProjectId) return;
    await Promise.all([
      refetchProject(),
      refetchSchedules(),
      refetchSummary(),
      refetchActiveAlert(),
      refetchAlertsList(),
      refetchSpecStatus(),
    ]);
  }, [
    selectedProjectId,
    refetchProject,
    refetchSchedules,
    refetchSummary,
    refetchActiveAlert,
    refetchAlertsList,
    refetchSpecStatus,
  ]);

  const handleSelectProject = (projId: string) => {
    setSelectedProjectId(projId);
    navigate(`/engineer/${projId}`);
  };

  const handleBackToSelection = () => {
    setSelectedProjectId(null);
    navigate("/engineer");
  };

  const handleSubmitOrangeReportAndClose = async () => {
    if (isReadOnly || !currentSpecialStatus || !selectedProjectId) return;

    setStatusMessage(null);

    try {
      await submitOrangeReport({
        windowId: currentSpecialStatus.id,
        projectId: selectedProjectId,
        payload: {
          is_plan_caught_up: isPlanCaughtUp,
          time_lost_hours: Number(timeLostHours),
          responsible_party: responsibleParty,
          summary_meta: {
            closed_by: "Инженер ПТО",
            timestamp: new Date().toISOString(),
          },
        },
      }).unwrap();

      await closeSpecialStatusWindow({
        windowId: currentSpecialStatus.id,
        projectId: selectedProjectId,
        comment:
          "Штрафной коридор завершен. Отчет передан в Департамент для начисления неустойки.",
      }).unwrap();

      setStatusMessage({
        type: "success",
        text: "Оранжевый спецстатус закрыт, штрафной отчет зарегистрирован.",
      });
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: extractApiError(err, "Ошибка отправки штрафного отчета"),
      });
    }
  };

  if (isLoadingProjects) {
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
                    <ArrowRightIcon className="btn-icon-svg" />
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
              {isProjectsError
                ? "Ошибка подключения к реестру"
                : "Не удалось загрузить данные выбранного объекта"}
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

  const activeAlertParsed = activeAlert
    ? formatAlertDetails(activeAlert)
    : null;

  return (
    <div className="engineer-page">
      <Header />

      <div className="engineer-console-root">
        {isReadOnly && (
          <div className="engineer-readonly-banner">
            <LockIcon className="readonly-banner-icon" />
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
              <CameraIcon className="btn-icon-svg" />
              <span>Видеокамеры ({engineerCameras.length})</span>
            </button>

            <button
              type="button"
              className="btn-switch-project"
              onClick={handleBackToSelection}
            >
              <ArrowLeftIcon className="btn-icon-svg" />
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
            <span className="kpi-caption">Техника на объекте</span>
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
              {activeAlert ? "Зафиксировано отклонение" : "Отклонений нет"}
            </span>
          </div>
        </div>

        <div className="console-workflow-grid">
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
              {activeAlert && activeAlert.severity === "RED" && (
                <span className="alert-queue-counter-tag">
                  Критическое нарушение
                </span>
              )}
            </div>

            {activeAlert &&
            activeAlertParsed &&
            activeAlert.status !== "RESOLVED" ? (
              <div className="alert-reason-detailed-box">
                <div className="alert-reason-tags-row">
                  <span
                    className={`alert-tag-severity ${activeAlert.severity.toLowerCase()}`}
                  >
                    <span
                      className={`status-dot ${
                        activeAlert.severity.toLowerCase() === "red"
                          ? "red"
                          : "yellow"
                      }`}
                    />
                    {activeAlert.severity === "RED"
                      ? "Красный уровень: требуется решение"
                      : "Предупреждение: время на устранение"}
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
                  <strong>Суть нарушения:</strong> {activeAlertParsed.message}
                </div>

                <div className="scenario-confirm-bar">
                  <button
                    type="button"
                    className="btn-confirm-scenario-trigger"
                    disabled={isReadOnly}
                    onClick={() => setIsDecisionModalOpen(true)}
                  >
                    <CheckIcon className="btn-icon-svg" />
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
                простоя техники или дефицита система сформирует инцидент.
              </p>
            )}
          </div>

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

      {isDecisionModalOpen && activeAlert && !isReadOnly && (
        <AlertDecisionModal
          alert={activeAlert}
          projectId={selectedProjectId!}
          onClose={() => setIsDecisionModalOpen(false)}
          onSuccess={loadProjectData}
        />
      )}

      {isCascadeModalOpen && selectedProjectId && !isReadOnly && (
        <CascadeShiftModal
          projectId={selectedProjectId}
          schedules={schedules}
          onClose={() => setIsCascadeModalOpen(false)}
          onSuccess={loadProjectData}
        />
      )}

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