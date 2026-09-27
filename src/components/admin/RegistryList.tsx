// src/components/admin/RegistryList.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthFetch } from "../../hooks/useAuthFetch";
import { getProjects, ProjectListItem } from "../../api/apiAdmin";

export type SidebarViewFilter = "all" | "green" | "orange" | "purple" | "analytics";

export interface DepartmentOverview {
  total_projects: number;
  green_count: number;
  orange_count: number;
  purple_count: number;
  avg_progress_percent: number;
}

const ITEMS_PER_PAGE = 6;

const RegistryList: React.FC = () => {
  const navigate = useNavigate();
  const authFetch = useAuthFetch();

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<SidebarViewFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getProjects(authFetch, { limit: 100 });
      setProjects(data);
    } catch (err: any) {
      setError(err.message || "Ошибка загрузки проектов");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Расчет сводной аналитики по полученным данным из бэкенда
  const stats: DepartmentOverview = useMemo(() => {
    const total = projects.length;
    if (total === 0) {
      return {
        total_projects: 0,
        green_count: 0,
        orange_count: 0,
        purple_count: 0,
        avg_progress_percent: 0,
      };
    }

    const green = projects.filter(
      (p) => p.current_alert_level === "GREEN" && (!p.current_special_status || p.current_special_status === "NONE")
    ).length;

    const orange = projects.filter(
      (p) => p.current_special_status === "ORANGE" || p.current_alert_level === "YELLOW"
    ).length;

    const purple = projects.filter(
      (p) => p.current_special_status === "PURPLE" || p.current_alert_level === "RED"
    ).length;

    const sumProgress = projects.reduce(
      (acc, p) => acc + (p.physical_progress_percent || 0),
      0
    );

    return {
      total_projects: total,
      green_count: green,
      orange_count: orange,
      purple_count: purple,
      avg_progress_percent: Number((sumProgress / total).toFixed(1)),
    };
  }, [projects]);

  const handleCardClick = (filter: SidebarViewFilter) => {
    setActiveFilter(filter);
    setCurrentPage(1);
  };

  const filteredProjects = useMemo(() => {
    if (activeFilter === "all" || activeFilter === "analytics") {
      return projects;
    }
    if (activeFilter === "green") {
      return projects.filter(
        (p) => p.current_alert_level === "GREEN" && (!p.current_special_status || p.current_special_status === "NONE")
      );
    }
    if (activeFilter === "orange") {
      return projects.filter(
        (p) => p.current_special_status === "ORANGE" || p.current_alert_level === "YELLOW"
      );
    }
    if (activeFilter === "purple") {
      return projects.filter(
        (p) => p.current_special_status === "PURPLE" || p.current_alert_level === "RED"
      );
    }
    return projects;
  }, [projects, activeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / ITEMS_PER_PAGE));

  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProjects.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProjects, currentPage]);

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const getStatusIndicatorClass = (alertLevel: string, specialStatus: string): string => {
    if (specialStatus === "PURPLE") return "status-purple";
    if (specialStatus === "ORANGE") return "status-orange";
    if (alertLevel === "GREEN") return "status-green";
    return "status-orange";
  };

  const getDeviationBadge = (alertLevel: string, specialStatus: string) => {
    if (specialStatus === "PURPLE") {
      return <span className="deviation-badge deviation-purple">Форс-Мажор</span>;
    }
    if (specialStatus === "ORANGE" || alertLevel === "RED" || alertLevel === "YELLOW") {
      return <span className="deviation-badge deviation-danger">Штрафной Коридор</span>;
    }
    return <span className="deviation-badge deviation-success">Отклонений Нет</span>;
  };

  // Переход на страницу прораба конкретного объекта
  const handleOpen = (id: string) => {
    navigate(`/foreman/${id}`);
  };

  return (
    <div className="registry-layout">
      <section className="registry-main-card">
        <div className="registry-card-header">
          <div>
            <h2 className="registry-title">
              {activeFilter === "green" && "Объекты в штатном режиме (Зеленый коридор)"}
              {activeFilter === "orange" && "Объекты в штрафном коридоре (Оранжевый статус)"}
              {activeFilter === "purple" && "Объекты в режиме форс-мажора (Фиолетовый статус)"}
              {activeFilter === "analytics" && "Аналитический срез темпов строительства по Москве"}
              {activeFilter === "all" && "Сводный Мониторинг Объектов Капитального Строительства Москвы"}
            </h2>
            {activeFilter !== "all" && (
              <button
                type="button"
                className="reset-filter-link"
                onClick={() => setActiveFilter("all")}
              >
                ✕ Сбросить фильтр (показать все ОКС)
              </button>
            )}
          </div>

          <div className="active-filter-badge">
            Найдено: <strong>{filteredProjects.length}</strong>
          </div>
        </div>

        {error && <div className="admin-error-message">{error}</div>}

        {activeFilter === "analytics" ? (
          <div className="analytics-dashboard-view">
            <div className="analytics-row">
              <div className="analytics-box">
                <h4 className="analytics-box-title">Распределение по статусам ОКС</h4>
                <div className="status-bars-group">
                  <div className="bar-item">
                    <div className="bar-label">
                      <span>Штатно (Зеленый)</span>
                      <strong>{stats.green_count} ОКС</strong>
                    </div>
                    <div className="bar-track">
                      <div
                        className="bar-fill bg-green"
                        style={{
                          width: `${stats.total_projects ? (stats.green_count / stats.total_projects) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="bar-item">
                    <div className="bar-label">
                      <span>Штрафной коридор (Оранжевый)</span>
                      <strong>{stats.orange_count} ОКС</strong>
                    </div>
                    <div className="bar-track">
                      <div
                        className="bar-fill bg-orange"
                        style={{
                          width: `${stats.total_projects ? (stats.orange_count / stats.total_projects) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="bar-item">
                    <div className="bar-label">
                      <span>Форс-мажор / Инцидент (Фиолетовый)</span>
                      <strong>{stats.purple_count} ОКС</strong>
                    </div>
                    <div className="bar-track">
                      <div
                        className="bar-fill bg-purple"
                        style={{
                          width: `${stats.total_projects ? (stats.purple_count / stats.total_projects) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="analytics-box">
                <h4 className="analytics-box-title">Средняя готовность объектов</h4>
                <div className="district-circles-grid">
                  <div className="district-item">
                    <div className="district-metric metric-blue">{stats.avg_progress_percent}%</div>
                    <span className="district-name">По городу</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="registry-table-wrapper">
            <table className="monitoring-table">
              <thead>
                <tr>
                  <th className="th-center">Статус<br />ОКС</th>
                  <th>Объект / Адрес</th>
                  <th>Текущий Этап</th>
                  <th>Готовность</th>
                  <th>Характер<br />Отклонений</th>
                  <th className="th-center">Действие</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="registry-empty">Загрузка данных...</td>
                  </tr>
                ) : paginatedProjects.length > 0 ? (
                  paginatedProjects.map((project) => (
                    <tr key={project.id}>
                      <td className="td-center">
                        <span
                          className={`status-indicator ${getStatusIndicatorClass(
                            project.current_alert_level,
                            project.current_special_status
                          )}`}
                        />
                      </td>
                      <td>
                        <div className="table-object-name">{project.name}</div>
                        {project.address && (
                          <div className="table-object-address">{project.address}</div>
                        )}
                      </td>
                      <td className="table-stage">{project.current_stage_name || "—"}</td>
                      <td className="table-progress">
                        {project.physical_progress_percent !== undefined
                          ? `${project.physical_progress_percent.toFixed(1)}%`
                          : "0.0%"}
                      </td>
                      <td>
                        {getDeviationBadge(
                          project.current_alert_level,
                          project.current_special_status
                        )}
                      </td>
                      <td className="td-center">
                        <button
                          type="button"
                          className="btn-action-open"
                          onClick={() => handleOpen(project.id)}
                        >
                          Открыть
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="registry-empty">Объекты не найдены</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="roles-pagination">
              <button
                type="button"
                className="pagination-button pagination-arrow"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || loading}
              >
                Назад
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  className={`pagination-button ${currentPage === page ? "pagination-active" : ""}`}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                className="pagination-button pagination-arrow"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || loading}
              >
                Вперед
              </button>
            </div>
          </div>
        )}
      </section>

      <aside className="registry-sidebar">
        <div
          className={`stat-card stat-clickable ${activeFilter === "all" ? "active-all" : ""}`}
          onClick={() => handleCardClick("all")}
        >
          <span className="stat-label">Всего ОКС В Москве</span>
          <span className="stat-value stat-bold">{stats.total_projects} Объектов</span>
          <span className="stat-hint">Показать полный список</span>
        </div>

        <div
          className={`stat-card stat-clickable ${activeFilter === "green" ? "active-green" : ""}`}
          onClick={() => handleCardClick("green")}
        >
          <span className="stat-label">Штатный Ход (Зеленый)</span>
          <span className="stat-value text-green">{stats.green_count} ОКС</span>
          <span className="stat-hint">Фильтровать штатные</span>
        </div>

        <div
          className={`stat-card stat-clickable ${activeFilter === "orange" ? "active-orange" : ""}`}
          onClick={() => handleCardClick("orange")}
        >
          <span className="stat-label">Штрафной Коридор (Оранжевый)</span>
          <span className="stat-value text-orange">{stats.orange_count} ОКС</span>
          <span className="stat-hint">Фильтровать проблемные</span>
        </div>

        <div
          className={`stat-card stat-clickable ${activeFilter === "purple" ? "active-purple" : ""}`}
          onClick={() => handleCardClick("purple")}
        >
          <span className="stat-label">Форс-Мажор (Фиолетовый)</span>
          <span className="stat-value text-purple">{stats.purple_count} ОКС</span>
          <span className="stat-hint">Фильтровать форс-мажоры</span>
        </div>

        <div
          className={`stat-card stat-clickable ${activeFilter === "analytics" ? "active-analytics" : ""}`}
          onClick={() => handleCardClick("analytics")}
        >
          <span className="stat-label">Средняя Готовность По Городу</span>
          <span className="stat-value text-blue">{stats.avg_progress_percent}%</span>
          <span className="stat-hint">📊 Графика и аналитика</span>
        </div>
      </aside>
    </div>
  );
};

export default RegistryList;