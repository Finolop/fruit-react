import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ForemanObjectManager } from "../../components/foreman/ForemanObjectManager";
import {
  getAuthHeaders,
  getLiveSummary,
  LiveSummaryResponse,
} from "../../api/api";
import Header from "../../components/Header";
import "../../styles/ForemanPage.css";
import arrowLeftIcon from "../../assets/images/Arrow_Left_MD.svg";
import arrowRightIcon from "../../assets/images/Arrow_Right_MD.svg";

const API_URL = process.env.REACT_APP_API_URL || "";

export interface ProjectData {
  id: string;
  name: string;
  address: string;
  type_id?: string;
  status: string;
  schedule_status?: string;
  camera_url?: string;
}

export interface EquipmentType {
  id: string;
  code: string;
  name: string;
}

export interface ScheduleItem {
  id: string;
  project_id: string;
  stage_name: string;
  substage_name: string;
  sequence_order: number;
  base_start_date: string;
  base_end_date: string;
  phantom_start_date?: string;
  phantom_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  status: string;
  equipment_requirements: {
    equipment_type?: string;
    equipment_type_id?: string;
    required_count?: number;
    count?: number;
    is_required?: boolean;
  }[];
}

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

export const ForemanPage: React.FC = () => {
  const { projectId: urlProjectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    urlProjectId || null,
  );
  const [availableProjects, setAvailableProjects] = useState<ProjectData[]>([]);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([]);
  const [liveSummary, setLiveSummary] = useState<LiveSummaryResponse | null>(
    null,
  );

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [idleResolvedText, setIdleResolvedText] = useState<string>("");

  useEffect(() => {
    if (urlProjectId) {
      setSelectedProjectId(urlProjectId);
    }
  }, [urlProjectId]);

  // Загрузка паспорта ОКС, графиков и статуса (вызывается также при reloadSchedules)
  const loadProjectDetails = useCallback(async () => {
    if (!selectedProjectId) {
      setProject(null);
      setSchedules([]);
      setLiveSummary(null);
      return;
    }

    const headers = getAuthHeaders();
    try {
      const [projRes, schedRes, camerasRes, eqRes, summaryData] =
        await Promise.all([
          fetch(`${API_URL}/api/v1/projects/${selectedProjectId}`, { headers }),
          fetch(`${API_URL}/api/v1/projects/${selectedProjectId}/schedules`, {
            headers,
          }),
          fetch(`${API_URL}/api/v1/projects/${selectedProjectId}/cameras`, {
            headers,
          }),
          fetch(`${API_URL}/api/v1/dictionaries/equipment-types`, { headers }),
          getLiveSummary(selectedProjectId).catch(() => null),
        ]);

      const projData = await parseJsonResponse(projRes, null);
      const schedData = await parseJsonResponse(schedRes, []);
      const camerasData = await parseJsonResponse(camerasRes, []);
      const eqData = await parseJsonResponse(eqRes, []);

      if (projData) {
        setProject({
          id: projData.id,
          name: projData.name || "Объект капитального строительства",
          address: projData.address || "Адрес не указан",
          type_id: projData.type_id || undefined,
          status: projData.schedule_status || projData.status || "DRAFT",
          schedule_status:
            projData.schedule_status || projData.status || "DRAFT",
          camera_url:
            Array.isArray(camerasData) && camerasData.length > 0
              ? camerasData[0].stream_url
              : "",
        });
      }

      setSchedules(Array.isArray(schedData) ? schedData : []);
      setEquipmentTypes(Array.isArray(eqData) ? eqData : []);
      setLiveSummary(summaryData);
    } catch (err: any) {
      console.error("Ошибка обновления данных ОКС:", err);
    }
  }, [selectedProjectId]);

  // Первичная загрузка списка доступных объектов
  useEffect(() => {
    let isMounted = true;

    const fetchProjects = async () => {
      setIsLoading(true);
      setErrorMessage("");
      const headers = getAuthHeaders();

      try {
        const res = await fetch(`${API_URL}/api/v1/projects`, { headers });
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

  useEffect(() => {
    loadProjectDetails();
  }, [loadProjectDetails]);

  const handleSelectProject = (projId: string) => {
    setSelectedProjectId(projId);
    navigate(`/foreman/${projId}`);
  };

  const handleBackToSelection = () => {
    setSelectedProjectId(null);
    setProject(null);
    setSchedules([]);
    setLiveSummary(null);
    navigate("/foreman");
  };

  if (isLoading) {
    return (
      <div className="foreman-page">
        <Header />
        <div className="foreman-content">
          <div className="empty-state-container">
            <h2 className="empty-state-title">Загрузка данных...</h2>
            <p className="empty-state-description">
              Получаем информацию об объектах строительства
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedProjectId) {
    if (availableProjects.length === 0) {
      return (
        <div className="foreman-page">
          <Header />
          <div className="foreman-content">
            <div className="empty-state-container">
              <h2 className="empty-state-title">ОКС не назначен</h2>
              <p className="empty-state-description">
                {errorMessage ||
                  "За вашей учетной записью пока не закреплено ни одного объекта капитального строительства."}
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
      <div className="foreman-page">
        <Header />
        <div className="project-selector-wrapper">
          <div className="project-selector-card">
            <div className="project-selector-header">
              <h2>Выберите объект строительства</h2>
              <p>
                За вашей учетной записью закреплено объектов:{" "}
                {availableProjects.length}. Нажмите на нужную стройплощадку для
                перехода к графику Ганта:
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
                      {p.address || "Адрес не указан"}
                    </span>
                  </div>
                  <div className="project-selector-actions">
                    <span className="project-selector-badge">
                      {p.status || "DRAFT"}
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
      <div className="foreman-page">
        <Header />
        <div className="foreman-content">
          <div className="empty-state-container">
            <h2 className="empty-state-title">Ошибка загрузки ОКС</h2>
            <p className="empty-state-description">{errorMessage}</p>
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

  return (
    <div className="foreman-page">
      <Header />

      <div className="foreman-toolbar-switch">
        <div className="foreman-project-selector-group">
          <span className="kpi-caption" style={{ marginBottom: 0 }}>
            Стройплощадка:
          </span>
          <select
            className="foreman-project-dropdown"
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
          <img src={arrowLeftIcon} alt="" className="btn-icon-svg" />
          <span>Реестр строек ({availableProjects.length})</span>
        </button>
      </div>

      <div className="foreman-kpi-container">
        <div className="foreman-kpi-grid">
          <div className="foreman-kpi-card">
            <span className="kpi-caption">Объект и текущий этап</span>
            <h2 className="kpi-title-strong">{project.name}</h2>
            <span className="kpi-sub-text">
              {liveSummary?.current_stage?.name || "Подготовительный этап"}
            </span>
          </div>

          <div className="foreman-kpi-card">
            <span className="kpi-caption">Готовность ОКС</span>
            <div className="kpi-accent-value">
              {liveSummary?.physical_progress_percent ?? 0}%
            </div>
            <span className="kpi-sub-text">
              Пройдено {liveSummary?.time_elapsed_percent ?? 0}% директивного
              времени
            </span>
          </div>

          <div className="foreman-kpi-card">
            <span className="kpi-caption">Оперативный статус</span>
            <div>
              <span
                className={`foreman-traffic-badge ${
                  alertLevel === "RED"
                    ? "red"
                    : alertLevel === "YELLOW"
                      ? "yellow"
                      : "green"
                }`}
              >
                {alertLevel === "YELLOW"
                  ? "Желтый (Внимание)"
                  : alertLevel === "RED"
                    ? "Красный (Эскалация)"
                    : "Зеленый (В норме)"}
              </span>
            </div>
            <span className="kpi-sub-text">
              {alertLevel === "YELLOW"
                ? "Требуются оперативные меры на площадке"
                : alertLevel === "RED"
                  ? "Передано на арбитраж инженеру технадзора"
                  : "Отклонений по графику и технике нет"}
            </span>
          </div>

          <div className="foreman-kpi-card">
            <span className="kpi-caption">Полномочия прораба</span>
            <div className="kpi-title-strong">
              {project.status === "ACTIVE" ||
              project.schedule_status === "ACTIVE"
                ? "График зафиксирован"
                : "Формирование графика"}
            </div>
            <span className="kpi-sub-text">
              {project.status === "ACTIVE" ||
              project.schedule_status === "ACTIVE"
                ? "Редактирование закрыто, ведется видеомониторинг"
                : "Настройте сроки и технику до утверждения"}
            </span>
          </div>
        </div>

        {alertLevel === "YELLOW" && (
          <div className="foreman-alert-banner">
            <div className="foreman-alert-content">
              <span className="foreman-alert-title">
                Предупреждение: обнаружен простой или дефицит техники
              </span>
              <p className="foreman-alert-desc">
                Единицы техники простаивают в секторе производства работ. Если
                простой превысит регламентный норматив, статус объекта
                автоматически эскалируется в Красный инженеру технадзора.
              </p>
            </div>

            <button
              type="button"
              className="btn-foreman-resolve-idle"
              onClick={() => {
                setIdleResolvedText(
                  "Отметка о ликвидации простоя принята. Проверьте возобновление работы техники.",
                );
              }}
            >
              Отметить ликвидацию простоя
            </button>
          </div>
        )}

        {idleResolvedText && (
          <div className="gantt-msg-banner msg-success" style={{ margin: 0 }}>
            {idleResolvedText}
          </div>
        )}
      </div>

      <ForemanObjectManager
        project={project}
        schedules={schedules}
        equipmentTypes={equipmentTypes}
        reloadSchedules={loadProjectDetails}
      />
    </div>
  );
};

export default ForemanPage;
