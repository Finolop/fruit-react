import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { skipToken } from "@reduxjs/toolkit/query";

import { selectIsAdmin, selectIsForeman } from "../../features/auth/authSlice";
import {
  useGetProjectsQuery,
  useGetProjectByIdQuery,
  useGetSchedulesQuery,
  useGetCamerasQuery,
  useGetEquipmentTypesQuery,
  useGetLiveSummaryQuery,
} from "../../api/rtkApi";
import { ForemanObjectManager } from "../../components/foreman/ForemanObjectManager";
import Header from "../../components/Header";

import { ReactComponent as ArrowLeftIcon } from "../../assets/images/Arrow_Left_MD.svg";
import { ReactComponent as ArrowRightIcon } from "../../assets/images/Arrow_Right_MD.svg";
import { ReactComponent as LockIcon } from "../../assets/images/Lock.svg";

import "../../styles/ForemanPage.css";

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
  is_critical_path?: boolean;
  allowed_equipment?: string[];
  alerts_and_risks?: string | null;
  equipment_requirements: {
    equipment_type?: string;
    equipment_type_id?: string;
    required_count?: number;
    count?: number;
    is_required?: boolean;
  }[];
}

export const ForemanPage: React.FC = () => {
  const { projectId: urlProjectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();

  const isAdmin = useSelector(selectIsAdmin);
  const isForeman = useSelector(selectIsForeman);
  const isReadOnly = isAdmin && !isForeman;

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    urlProjectId || null,
  );
  const [idleResolvedText, setIdleResolvedText] = useState<string>("");

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
    useGetSchedulesQuery(selectedProjectId ?? skipToken);

  const { data: cameras = [], refetch: refetchCameras } = useGetCamerasQuery(
    selectedProjectId ?? skipToken,
  );

  const { data: equipmentTypes = [] } = useGetEquipmentTypesQuery();

  const { data: liveSummary = null, refetch: refetchSummary } =
    useGetLiveSummaryQuery(selectedProjectId ?? skipToken, {
      pollingInterval: 5000,
      skipPollingIfUnfocused: true,
    });

  const project: ProjectData | null = useMemo(() => {
    const fallback = availableProjects.find((p) => p.id === selectedProjectId);
    const source = rawProject || fallback;
    if (!source) return null;

    return {
      id: source.id,
      name: source.name || "Объект капитального строительства",
      address: source.address || "Адрес не указан",
      type_id: source.type_id || undefined,
      status: source.schedule_status || source.status || "DRAFT",
      schedule_status: source.schedule_status || source.status || "DRAFT",
      camera_url:
        Array.isArray(cameras) && cameras.length > 0
          ? cameras[0].stream_url
          : "",
    };
  }, [rawProject, availableProjects, selectedProjectId, cameras]);

  const reloadSchedules = useCallback(async () => {
    if (!selectedProjectId) return;
    await Promise.all([
      refetchProject(),
      refetchSchedules(),
      refetchCameras(),
      refetchSummary(),
    ]);
  }, [
    selectedProjectId,
    refetchProject,
    refetchSchedules,
    refetchCameras,
    refetchSummary,
  ]);

  const handleSelectProject = (projId: string) => {
    setSelectedProjectId(projId);
    navigate(`/foreman/${projId}`);
  };

  const handleBackToSelection = () => {
    if (isAdmin) {
      navigate("/admin/registry");
      return;
    }
    setSelectedProjectId(null);
    navigate("/foreman");
  };

  if (isLoadingProjects) {
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
    return (
      <div className="foreman-page">
        <Header />
        <div className="project-selector-wrapper">
          <div className="project-selector-card">
            <div className="project-selector-header">
              <h2>Выберите объект строительства</h2>
              <p>
                Доступных объектов: {availableProjects.length}. Нажмите на
                нужную стройплощадку для перехода к редактированию графика:
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
      <div className="foreman-page">
        <Header />
        <div className="foreman-content">
          <div className="empty-state-container">
            <h2 className="empty-state-title">Ошибка загрузки ОКС</h2>
            <p className="empty-state-description">
              {isProjectsError
                ? "Ошибка подключения к реестру"
                : "Объект не найден или нет доступа"}
            </p>
            <button
              type="button"
              className="foreman-primary-button"
              onClick={handleBackToSelection}
            >
              Вернуться назад
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

      {isReadOnly && (
        <div className="foreman-readonly-banner-wrap">
          <div className="foreman-readonly-banner">
            <LockIcon className="readonly-banner-icon" />
            <div className="readonly-banner-text">
              <strong>
                Режим наблюдателя (Департамент градостроительной политики)
              </strong>
              <span>
                Вы просматриваете объект в режиме чтения. Формирование этапов,
                изменение сроков, привязка техники и отметки о ликвидации
                простоя заблокированы.
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="foreman-toolbar-switch">
        <div className="foreman-project-selector-group">
          <span className="kpi-caption kpi-caption-inline">Стройплощадка:</span>
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
          <ArrowLeftIcon className="btn-icon-svg" />
          <span>
            {isAdmin
              ? "Вернуться в реестр строек"
              : `Все объекты (${availableProjects.length})`}
          </span>
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
            <span className="kpi-caption">Полномочия на объекте</span>
            <div className="kpi-title-strong">
              {isReadOnly
                ? "Только чтение"
                : project.status === "ACTIVE" ||
                    project.schedule_status === "ACTIVE"
                  ? "График зафиксирован"
                  : "Формирование графика"}
            </div>
            <span className="kpi-sub-text">
              {isReadOnly
                ? "Правка графиков закреплена за прорабом объекта"
                : project.status === "ACTIVE" ||
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

            {!isReadOnly && (
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
            )}
          </div>
        )}

        {idleResolvedText && (
          <div className="gantt-msg-banner msg-success gantt-msg-no-margin">
            {idleResolvedText}
          </div>
        )}
      </div>

      <ForemanObjectManager
        project={project}
        schedules={schedules}
        equipmentTypes={equipmentTypes}
        reloadSchedules={reloadSchedules}
        isReadOnly={isReadOnly}
      />
    </div>
  );
};

export default ForemanPage;
