import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../../components/Header";
import { ForemanObjectManager } from "../../components/foreman/ForemanObjectManager";
import { CameraManagerModal } from "../../components/foreman/CameraManagerModal";
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

import cameraIcon from "../../assets/images/Camera.svg";
import arrowLeftIcon from "../../assets/images/Arrow_Left_MD.svg";
import arrowRightIcon from "../../assets/images/Arrow_Right_MD.svg";
import alertTriangleIcon from "../../assets/images/Triangle_Warning.svg";
import checkIcon from "../../assets/images/Circle_Check.svg";
import closeIcon from "../../assets/images/Close_MD.svg";

import "../../styles/EngineerConsole.css";
import "../../styles/ForemanPage.css";

const API_URL = process.env.REACT_APP_API_URL || "";

type ResolutionScenario =
  | "FORCE_MAJEURE_CASCADE"
  | "SPECIAL_STATUS_OPEN"
  | "FALSE_ALARM";

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

// Словарь понятных названий строительной техники
const TECH_NAMES: Record<string, string> = {
  bulldozer: "Бульдозер",
  dump_truck: "Самосвал",
  excavator: "Экскаватор",
  mobile_crane: "Автокран",
  truck: "Бортовой грузовик",
  concrete_mixer: "Автобетоносмеситель (миксер)",
  road_roller: "Каток",
  drilling_rig: "Буровая установка",
  pump_truck: "Автобетононасос",
};

export const EngineerPage: React.FC = () => {
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
  const [allOpenAlerts, setAllOpenAlerts] = useState<AlertResponse[]>([]);
  const [currentSpecialStatus, setCurrentSpecialStatus] =
    useState<SpecialStatusResponse | null>(null);

  // Выбранный сценарий и модалка предупреждения
  const [selectedScenario, setSelectedScenario] =
    useState<ResolutionScenario>("SPECIAL_STATUS_OPEN");
  const [warningModalOpen, setWarningModalOpen] = useState(false);

  // Форма штрафного отчета
  const [isPlanCaughtUp, setIsPlanCaughtUp] = useState(false);
  const [timeLostHours, setTimeLostHours] = useState(8);
  const [responsibleParty, setResponsibleParty] = useState(
    "Бригада монолитчиков (Подрядчик)"
  );

  // Модальные окна
  const [isCascadeModalOpen, setIsCascadeModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
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
      const headers = getAuthHeaders();
      const [projRes, schedRes, eqRes, summaryData, alertData, specStatusData, alertsListRes] =
        await Promise.all([
          fetch(`${API_URL}/api/v1/projects/${selectedProjectId}`, { headers }),
          fetch(`${API_URL}/api/v1/projects/${selectedProjectId}/schedules`, { headers }),
          fetch(`${API_URL}/api/v1/dictionaries/equipment-types`, { headers }),
          engineerApi.getLiveSummary(selectedProjectId).catch(() => null),
          engineerApi.getActiveAlert(selectedProjectId).catch(() => null),
          engineerApi.getCurrentSpecialStatus(selectedProjectId).catch(() => null),
          fetch(`${API_URL}/api/v1/alerts?project_id=${selectedProjectId}&limit=20`, { headers }).catch(() => null),
        ]);

      const projData = await parseJsonResponse(projRes, null);
      const schedData = await parseJsonResponse(schedRes, []);
      const eqData = await parseJsonResponse(eqRes, []);
      const alertsData = alertsListRes ? await parseJsonResponse(alertsListRes, []) : [];

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

  const executeResolveAlert = async () => {
    if (!activeAlert) {
      setWarningModalOpen(false);
      return;
    }

    setIsProcessing(true);
    setStatusMessage(null);
    setWarningModalOpen(false);

    let explanation = "";
    if (selectedScenario === "FORCE_MAJEURE_CASCADE") {
      explanation = "Внешний фактор / Форс-мажор. Сроки будут сдвинуты каскадно.";
    } else if (selectedScenario === "SPECIAL_STATUS_OPEN") {
      explanation = "Вина строительной бригады. Установлен коридор устранения на 48 часов.";
    } else {
      explanation = "Сброс ложного срабатывания детекции под личную ответственность инженера.";
    }

    try {
      const nextDay = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      await engineerApi.resolveAlert(activeAlert.id, {
        action_taken: selectedScenario,
        engineer_comment: explanation,
        evidence_frame_ids: activeAlert.trigger_frame_id ? [activeAlert.trigger_frame_id] : [],
        target_deadline: selectedScenario === "FALSE_ALARM" ? undefined : nextDay,
      });

      setStatusMessage({
        type: "success",
        text: `Решение надзора зарегистрировано: ${explanation}`,
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

  // Человекопонятный разбор причины алерта
  const parsedAlertInfo = useMemo(() => {
    if (!activeAlert) return null;

    const t = (activeAlert.trigger_type || "").toUpperCase();
    const details = activeAlert.details || {};
    const rawEq = details.equipment_type || details.type || "";
    const eqName = TECH_NAMES[rawEq.toLowerCase()] || rawEq || "Строительная техника";
    const idleMins = details.idle_minutes || details.duration_minutes || 30;
    const requiredCnt = details.required_count ?? 1;
    const detectedCnt = details.detected_count ?? 0;
    const missingCnt = details.missing_count ?? Math.max(0, requiredCnt - detectedCnt);
    const stage = details.stage_name || details.substage_name || "Текущий этап СМР";

    let title = "Зафиксировано регламентное отклонение";
    let explanation = "Видеоаналитика зафиксировала нарушение технологического процесса.";
    let categoryTag = "Общий инцидент";

    if (t.includes("IDLE")) {
      title = `Критический простой: ${eqName}`;
      explanation = `Единица техники «${eqName}» находится без движения более ${idleMins} минут в секторе выполнения работ этапа «${stage}» (смещение трекера менее 15px). Превышен допустимый технологический интервал.`;
      categoryTag = "Простой техники (IDLE)";
    } else if (t.includes("DEFICIT")) {
      title = `Дефицит обязательной техники: ${eqName}`;
      explanation = `На активном этапе «${stage}» зафиксировано ${detectedCnt} из ${requiredCnt} обязательных единиц техники «${eqName}» (нехватка: ${missingCnt} ед.). Темп работ не соответствует графику.`;
      categoryTag = "Дефицит на объекте";
    } else if (t.includes("MISMATCH")) {
      title = `Несогласованная техника на объекте: ${eqName}`;
      explanation = `На объекте обнаружена машина «${eqName}», не входящая ни в обязательный, ни в допустимый перечень для текущего этапа «${stage}». Риск захламления стройплощадки.`;
      categoryTag = "Нарушение стройгенплана";
    } else if (t.includes("OFF_SCHEDULE") || t.includes("DELAY")) {
      title = `Отклонение от директивного графика: ${stage}`;
      explanation = `Зафиксировано отставание от утвержденных сроков либо самовольное ведение работ без открытия этапа в системе мониторинга.`;
      categoryTag = "Срыв директивных сроков";
    }

    return {
      title,
      explanation,
      categoryTag,
      eqName,
      stage,
      triggeredAt: new Date(activeAlert.triggered_at).toLocaleString("ru-RU"),
      severity: activeAlert.severity,
    };
  }, [activeAlert]);

  // Расчет реальной потребности в технике по активным этапам
  const realEquipmentTotals = useMemo(() => {
    const activeStages = schedules.filter((s) => s.status === "IN_PROGRESS");
    const stagesToCount = activeStages.length > 0 ? activeStages : schedules.slice(0, 1);

    let requiredSum = 0;
    stagesToCount.forEach((s) => {
      (s.equipment_requirements || []).forEach((r: any) => {
        if (r.is_required !== false) {
          requiredSum += Number(r.required_count || r.count || 1);
        }
      });
    });

    const activeCount = liveSummary?.equipment_realtime?.active_count ?? (activeAlert ? 0 : requiredSum);
    const idleCount = liveSummary?.equipment_realtime?.idle_count ?? (activeAlert?.trigger_type?.includes("IDLE") ? 1 : 0);
    const totalRequired = liveSummary?.equipment_realtime?.required_total || (requiredSum > 0 ? requiredSum : 2);

    return { activeCount, idleCount, totalRequired };
  }, [schedules, liveSummary, activeAlert]);

  const getWarningDetails = () => {
    switch (selectedScenario) {
      case "FORCE_MAJEURE_CASCADE":
        return {
          title: "Подтверждение признания форс-мажора (Фиолетовый статус)",
          badge: "Фиолетовый режим",
          badgeClass: "purple",
          warning:
            "Внимание! Признание форс-мажора снимет вину со строительной бригады и остановит автоматическое начисление штрафных санкций. Сроки директивного графика будут подлежать каскадному сдвигу на основании допсоглашения. Данное решение необратимо фиксируется в Audit Trail.",
        };
      case "SPECIAL_STATUS_OPEN":
        return {
          title: "Подтверждение вины подрядчика (Оранжевый статус)",
          badge: "Оранжевый коридор",
          badgeClass: "orange",
          warning:
            "Внимание! Будет открыт штрафной коридор на 48 часов. Сроки сдачи объекта директивно НЕ сдвигаются. Каждая минута дальнейшего простоя будет суммироваться в счётчик удержания неустойки для итогового акта.",
        };
      case "FALSE_ALARM":
        return {
          title: "Подтверждение сброса инцидента (Ложная тревога)",
          badge: "Сброс в зелёный",
          badgeClass: "green",
          warning:
            "Внимание! Вы подтверждаете, что детекция техники была ошибочной или на объекте имело место согласованное технологическое окно. Тревога будет аннулирована под вашу персональную ответственность инженера технадзора.",
        };
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
                За вами закреплено объектов: {availableProjects.length}. Выберите
                ОКС для перехода в пульт арбитража и контроля сроков:
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
                    <span className="project-selector-badge">{p.status || "ACTIVE"}</span>
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

  const alertLevel = (liveSummary?.alert_level || (activeAlert ? "RED" : "GREEN")).toUpperCase();
  const specStatus = (
    liveSummary?.special_status ||
    currentSpecialStatus?.type ||
    ""
  ).toUpperCase();

  const warningData = getWarningDetails();
  const openAlertsCount = allOpenAlerts.length > 0 ? allOpenAlerts.length : activeAlert ? 1 : 0;

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

          <div className="engineer-top-nav-actions">
            <button
              type="button"
              className="btn-switch-project btn-camera-manage"
              onClick={() => setIsCameraModalOpen(true)}
              title="Добавление и удаление видеокамер объекта"
            >
              <img src={cameraIcon} alt="" className="btn-icon-svg" />
              <span>Управление видеокамерами</span>
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

        {/* 1. СЕТКА ИЗ 5 КАРТОЧЕК KPI */}
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
                  {realEquipmentTotals.activeCount}
                </span>
                <span className="eq-unit-lbl">В работе</span>
              </div>
              <div className="eq-unit">
                <span className="eq-unit-val idle">
                  {realEquipmentTotals.idleCount}
                </span>
                <span className="eq-unit-lbl">Простой</span>
              </div>
              <div className="eq-unit">
                <span className="eq-unit-val" style={{ color: "#475569" }}>
                  {realEquipmentTotals.totalRequired}
                </span>
                <span className="eq-unit-lbl">План</span>
              </div>
            </div>
            <span className="kpi-sub-text">
              Открытых алертов в очереди: <strong>{openAlertsCount}</strong>
            </span>
          </div>
        </div>

        {/* 2. Блок рабочих сценариев инженера */}
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
                {parsedAlertInfo ? parsedAlertInfo.title : "Оперативный надзор СМР"}
              </h3>
            </div>

            {parsedAlertInfo ? (
              <div className="alert-reason-detailed-box">
                <div className="alert-reason-tags-row">
                  <span className="alert-tag-category">{parsedAlertInfo.categoryTag}</span>
                  <span className="alert-tag-time">Фиксация: {parsedAlertInfo.triggeredAt}</span>
                  <span className="alert-tag-stage">Этап: {parsedAlertInfo.stage}</span>
                </div>
                <p className="alert-reason-text-desc">
                  {parsedAlertInfo.explanation}
                </p>
                <div className="alert-decision-prompt">
                  Выберите регламентный сценарий арбитража для перевода статуса объекта:
                </div>
              </div>
            ) : (
              <p className="console-card-desc">
                Критических нарушений на объекте не зафиксировано. В случае простоя техники или отставания от графика система оповестит инженера.
              </p>
            )}

            {/* Выбор из трех сценариев */}
            <div className="incident-options-list">
              <div
                className={`incident-btn-option opt-purple ${
                  selectedScenario === "FORCE_MAJEURE_CASCADE" ? "selected" : ""
                }`}
                onClick={() => setSelectedScenario("FORCE_MAJEURE_CASCADE")}
              >
                <div className="opt-radio-row">
                  <input
                    type="radio"
                    name="scenario"
                    checked={selectedScenario === "FORCE_MAJEURE_CASCADE"}
                    onChange={() => setSelectedScenario("FORCE_MAJEURE_CASCADE")}
                  />
                  <span className="opt-title">
                    1. Форс-мажор (Внешний фактор) [Фиолетовый статус]
                  </span>
                </div>
                <span className="opt-desc">
                  Причина не зависит от строителей (затор на МКАД, погодный коллапс).
                  Освобождение от штрафов, каскадный сдвиг сроков через допсоглашение.
                </span>
              </div>

              <div
                className={`incident-btn-option opt-orange ${
                  selectedScenario === "SPECIAL_STATUS_OPEN" ? "selected" : ""
                }`}
                onClick={() => setSelectedScenario("SPECIAL_STATUS_OPEN")}
              >
                <div className="opt-radio-row">
                  <input
                    type="radio"
                    name="scenario"
                    checked={selectedScenario === "SPECIAL_STATUS_OPEN"}
                    onChange={() => setSelectedScenario("SPECIAL_STATUS_OPEN")}
                  />
                  <span className="opt-title">
                    2. Проступок бригады [Оранжевый статус]
                  </span>
                </div>
                <span className="opt-desc">
                  Тревога подтверждена. Сроки директивно не сдвигаются. Запуск
                  штрафного коридора на 48 часов для ликвидации отставания.
                </span>
              </div>

              <div
                className={`incident-btn-option opt-green ${
                  selectedScenario === "FALSE_ALARM" ? "selected" : ""
                }`}
                onClick={() => setSelectedScenario("FALSE_ALARM")}
              >
                <div className="opt-radio-row">
                  <input
                    type="radio"
                    name="scenario"
                    checked={selectedScenario === "FALSE_ALARM"}
                    onChange={() => setSelectedScenario("FALSE_ALARM")}
                  />
                  <span className="opt-title">
                    3. Сброс / Ложный сигнал [Штатный режим]
                  </span>
                </div>
                <span className="opt-desc">
                  Ложное срабатывание классификатора техники или технологическое
                  окно. Инцидент аннулируется с записью в аудит.
                </span>
              </div>
            </div>

            {/* Кнопка подтверждения */}
            <div className="scenario-confirm-bar">
              <button
                type="button"
                className="btn-confirm-scenario-trigger"
                disabled={
                  isProcessing ||
                  !activeAlert ||
                  activeAlert.status === "RESOLVED"
                }
                onClick={() => setWarningModalOpen(true)}
              >
                <img src={checkIcon} alt="" className="btn-icon-svg btn-icon-white" />
                <span>
                  {activeAlert && activeAlert.status !== "RESOLVED"
                    ? "Подтвердить решение надзора"
                    : "Решений в очереди нет (активных алертов: 0)"}
                </span>
              </button>
            </div>
          </div>

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
                {new Date(currentSpecialStatus.target_deadline).toLocaleString("ru-RU")}.
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
            isEngineer={true}
          />
        </div>
      </div>

      {/* Модальное окно с предупреждением при подтверждении статуса */}
      {warningModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setWarningModalOpen(false)}
        >
          <div className="modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="warning-modal-title-row">
                <img src={alertTriangleIcon} alt="" className="modal-icon-svg" />
                <h3>Подтверждение регламентного решения</h3>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={() => setWarningModalOpen(false)}
              >
                <img src={closeIcon} alt="Закрыть" className="ui-icon-sm" />
              </button>
            </div>

            <div className="modal-body">
              <div className="warning-modal-summary">
                <span className={`special-mode-badge ${warningData.badgeClass}`}>
                  {warningData.badge}
                </span>
                <p className="warning-title-text">{warningData.title}</p>
              </div>

              <div className="warning-alert-box">{warningData.warning}</div>

              <p className="warning-note-text">
                Запись о принятом решении с таймстемпом и вашим идентификатором
                будет внесена в журнал аудита объекта капитального строительства.
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-gantt-secondary"
                onClick={() => setWarningModalOpen(false)}
                disabled={isProcessing}
              >
                Отмена
              </button>

              <button
                type="button"
                className="btn-gantt-success warning-confirm-btn"
                onClick={executeResolveAlert}
                disabled={isProcessing}
              >
                <img src={checkIcon} alt="" className="btn-icon-svg btn-icon-white" />
                <span>{isProcessing ? "Фиксация в аудите..." : "Да, подтверждаю решение"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно каскадного сдвига */}
      {isCascadeModalOpen && selectedProjectId && (
        <CascadeShiftModal
          projectId={selectedProjectId}
          schedules={schedules}
          onClose={() => setIsCascadeModalOpen(false)}
          onSuccess={loadProjectData}
        />
      )}

      {/* Модальное окно управления видеокамерами */}
      {isCameraModalOpen && selectedProjectId && (
        <CameraManagerModal
          projectId={selectedProjectId}
          onClose={() => setIsCameraModalOpen(false)}
        />
      )}
    </div>
  );
};

export default EngineerPage;