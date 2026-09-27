import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ForemanObjectManager } from "../../components/foreman/ForemanObjectManager";
import { getAuthHeaders } from "../../api/api";
import Header from "../../components/Header";
import "../../styles/ForemanPage.css";

const API_URL = process.env.REACT_APP_API_URL || "";

export interface ProjectData {
  id: string;
  name: string;
  address: string;
  type_id?: string;
  status: string;
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
  status: string;
  equipment_requirements: {
    equipment_type_id: string;
    required_count: number;
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

const ForemanPage: React.FC = () => {
  const { projectId: urlProjectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    urlProjectId || null
  );
  const [availableProjects, setAvailableProjects] = useState<ProjectData[]>([]);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (urlProjectId) {
      setSelectedProjectId(urlProjectId);
    }
  }, [urlProjectId]);

  const fetchSchedulesOnly = useCallback(async () => {
    if (!selectedProjectId) return;
    try {
      const res = await fetch(
        `${API_URL}/api/v1/projects/${selectedProjectId}/schedules`,
        { headers: getAuthHeaders() }
      );
      const data = await parseJsonResponse(res, []);
      setSchedules(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Ошибка обновления графика:", e);
    }
  }, [selectedProjectId]);

  // Загрузка доступных прорабу объектов
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

  // Загрузка паспорта ОКС, графика и справочника техники
  useEffect(() => {
    if (!selectedProjectId) {
      setProject(null);
      setSchedules([]);
      return;
    }

    let isMounted = true;

    const loadProjectDetails = async () => {
      setIsLoading(true);
      const headers = getAuthHeaders();

      try {
        const [projRes, schedRes, camerasRes, eqRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/projects/${selectedProjectId}`, { headers }),
          fetch(`${API_URL}/api/v1/projects/${selectedProjectId}/schedules`, { headers }),
          fetch(`${API_URL}/api/v1/projects/${selectedProjectId}/cameras`, { headers }),
          fetch(`${API_URL}/api/v1/dictionaries/equipment-types`, { headers }),
        ]);

        const projData = await parseJsonResponse(projRes, null);
        const schedData = await parseJsonResponse(schedRes, []);
        const camerasData = await parseJsonResponse(camerasRes, []);
        const eqData = await parseJsonResponse(eqRes, []);

        const fallbackProject = availableProjects.find((p) => p.id === selectedProjectId);
        const finalData = projData || fallbackProject;

        if (!finalData) {
          throw new Error("ОКС не найден или у вас нет доступа к объекту");
        }

        if (isMounted) {
          setProject({
            id: finalData.id,
            name: finalData.name || "Объект капитального строительства",
            address: finalData.address || "Адрес не указан",
            type_id: finalData.type_id || undefined,
            status: finalData.schedule_status || "DRAFT",
            camera_url:
              Array.isArray(camerasData) && camerasData.length > 0
                ? camerasData[0].stream_url
                : "",
          });

          setSchedules(Array.isArray(schedData) ? schedData : []);
          setEquipmentTypes(Array.isArray(eqData) ? eqData : []);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.message || "Ошибка загрузки данных объекта");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadProjectDetails();

    return () => {
      isMounted = false;
    };
  }, [selectedProjectId, availableProjects]);

  const handleSelectProject = (projId: string) => {
    setSelectedProjectId(projId);
    navigate(`/foreman/${projId}`);
  };

  const handleBackToSelection = () => {
    setSelectedProjectId(null);
    setProject(null);
    setSchedules([]);
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

  // Экран выбора ОКС из закрепленных
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
                  "За вашей учетной записью пока не закреплено ни одного объекта капитального строительства. Обратитесь к администратору департамента."}
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
                За вашей учетной записью закреплено объектов: {availableProjects.length}. Нажмите на нужную стройплощадку для перехода к графику Ганта:
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

  return (
    <div className="foreman-page">
      <Header />
      <div className="foreman-toolbar-switch">
        <button
          type="button"
          className="btn-switch-project"
          onClick={handleBackToSelection}
        >
          ← К списку объектов ({availableProjects.length})
        </button>
      </div>

      <ForemanObjectManager
        project={project}
        schedules={schedules}
        equipmentTypes={equipmentTypes}
        reloadSchedules={fetchSchedulesOnly}
      />
    </div>
  );
};

export default ForemanPage;