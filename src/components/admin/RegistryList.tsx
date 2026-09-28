import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthFetch } from "../../hooks/useAuthFetch";
import { getProjects, ProjectListItem } from "../../api/apiAdmin";
import closeIcon from "../../assets/images/Close_MD.svg";

export type SidebarViewFilter =
  | "all"
  | "green"
  | "orange"
  | "purple"
  | "analytics";

export interface DepartmentOverview {
  total_projects: number;
  green_count: number;
  orange_count: number;
  purple_count: number;
  avg_progress_percent: number;
  avg_time_elapsed_percent: number;
  total_critical_alerts: number;
  total_idle_hours?: number;
}

const ITEMS_PER_PAGE = 6;
const API_URL = process.env.REACT_APP_API_URL || "";

const RegistryList: React.FC = () => {
  const navigate = useNavigate();
  const authFetch = useAuthFetch();

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<SidebarViewFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [serverOverview, setServerOverview] = useState<{
    total_idle_hours?: number;
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [projectsData, overviewRes] = await Promise.all([
        getProjects(authFetch, { limit: 100 }),
        authFetch(`${API_URL}/api/v1/analytics/department-overview`).catch(
          () => null,
        ),
      ]);

      setProjects(projectsData || []);

      if (overviewRes && overviewRes.ok) {
        const json = await overviewRes.json().catch(() => null);
        if (json) setServerOverview(json);
      }
    } catch (err: any) {
      setError(err.message || "Ошибка загрузки реестра строек");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Сводная макро-аналитика
  const stats: DepartmentOverview = useMemo(() => {
    const total = projects.length;
    if (total === 0) {
      return {
        total_projects: 0,
        green_count: 0,
        orange_count: 0,
        purple_count: 0,
        avg_progress_percent: 0,
        avg_time_elapsed_percent: 0,
        total_critical_alerts: 0,
        total_idle_hours: serverOverview?.total_idle_hours || 0,
      };
    }

    const green = projects.filter(
      (p) =>
        p.current_alert_level === "GREEN" &&
        (!p.current_special_status || p.current_special_status === "NONE"),
    ).length;

    const orange = projects.filter(
      (p) =>
        p.current_special_status === "ORANGE" ||
        p.current_alert_level === "YELLOW",
    ).length;

    const purple = projects.filter(
      (p) =>
        p.current_special_status === "PURPLE" ||
        p.current_alert_level === "RED",
    ).length;

    const sumProgress = projects.reduce(
      (acc, p) => acc + (p.physical_progress_percent || 0),
      0,
    );

    const sumElapsed = projects.reduce(
      (acc, p) => acc + (p.time_elapsed_percent || 0),
      0,
    );

    const sumCriticalAlerts = projects.reduce(
      (acc, p) => acc + (p.critical_alerts_count || 0),
      0,
    );

    return {
      total_projects: total,
      green_count: green,
      orange_count: orange,
      purple_count: purple,
      avg_progress_percent: Number((sumProgress / total).toFixed(1)),
      avg_time_elapsed_percent: Number((sumElapsed / total).toFixed(1)),
      total_critical_alerts: sumCriticalAlerts,
      total_idle_hours: serverOverview?.total_idle_hours || 0,
    };
  }, [projects, serverOverview]);

  // Распределение ОКС по 4 диапазонам готовности
  const progressBrackets = useMemo(() => {
    const b1 = projects.filter((p) => (p.physical_progress_percent || 0) < 25);
    const b2 = projects.filter(
      (p) =>
        (p.physical_progress_percent || 0) >= 25 &&
        (p.physical_progress_percent || 0) < 50,
    );
    const b3 = projects.filter(
      (p) =>
        (p.physical_progress_percent || 0) >= 50 &&
        (p.physical_progress_percent || 0) < 75,
    );
    const b4 = projects.filter((p) => (p.physical_progress_percent || 0) >= 75);

    return [
      {
        title: "Котлован и нулевой цикл (0–25%)",
        count: b1.length,
        percent: stats.total_projects
          ? (b1.length / stats.total_projects) * 100
          : 0,
        colorClass: "bracket-blue",
      },
      {
        title: "Несущие монолитные конструкции (25–50%)",
        count: b2.length,
        percent: stats.total_projects
          ? (b2.length / stats.total_projects) * 100
          : 0,
        colorClass: "bracket-indigo",
      },
      {
        title: "Инженерные сети и контур (50–75%)",
        count: b3.length,
        percent: stats.total_projects
          ? (b3.length / stats.total_projects) * 100
          : 0,
        colorClass: "bracket-orange",
      },
      {
        title: "Отделка, фасады и ПНР (75–100%)",
        count: b4.length,
        percent: stats.total_projects
          ? (b4.length / stats.total_projects) * 100
          : 0,
        colorClass: "bracket-green",
      },
    ];
  }, [projects, stats.total_projects]);

  // Объекты с наибольшим отставанием
  const priorityLaggingProjects = useMemo(() => {
    return [...projects]
      .filter(
        (p) =>
          p.current_special_status === "ORANGE" ||
          p.current_alert_level === "RED" ||
          (p.time_elapsed_percent || 0) >
            (p.physical_progress_percent || 0) + 5,
      )
      .sort((a, b) => {
        const lagA =
          (a.time_elapsed_percent || 0) - (a.physical_progress_percent || 0);
        const lagB =
          (b.time_elapsed_percent || 0) - (b.physical_progress_percent || 0);
        return lagB - lagA;
      })
      .slice(0, 5);
  }, [projects]);

  const handleCardClick = (filter: SidebarViewFilter) => {
    setActiveFilter(filter);
    setCurrentPage(1);
  };

  const filteredProjects = useMemo(() => {
    let list = projects;

    if (activeFilter === "green") {
      list = list.filter(
        (p) =>
          p.current_alert_level === "GREEN" &&
          (!p.current_special_status || p.current_special_status === "NONE"),
      );
    } else if (activeFilter === "orange") {
      list = list.filter(
        (p) =>
          p.current_special_status === "ORANGE" ||
          p.current_alert_level === "YELLOW",
      );
    } else if (activeFilter === "purple") {
      list = list.filter(
        (p) =>
          p.current_special_status === "PURPLE" ||
          p.current_alert_level === "RED",
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.address && p.address.toLowerCase().includes(q)) ||
          (p.current_stage_name &&
            p.current_stage_name.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [projects, activeFilter, searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProjects.length / ITEMS_PER_PAGE),
  );

  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProjects.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProjects, currentPage]);

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const getStatusIndicatorClass = (
    alertLevel: string,
    specialStatus: string,
  ): string => {
    if (specialStatus === "PURPLE") return "status-purple";
    if (specialStatus === "ORANGE") return "status-orange";
    if (alertLevel === "GREEN") return "status-green";
    return "status-orange";
  };

  const getDeviationBadge = (alertLevel: string, specialStatus: string) => {
    if (specialStatus === "PURPLE") {
      return (
        <span className="deviation-badge deviation-purple">Форс-Мажор</span>
      );
    }
    if (
      specialStatus === "ORANGE" ||
      alertLevel === "RED" ||
      alertLevel === "YELLOW"
    ) {
      return (
        <span className="deviation-badge deviation-danger">
          Штрафной Коридор
        </span>
      );
    }
    return (
      <span className="deviation-badge deviation-success">Отклонений Нет</span>
    );
  };

  const handleOpen = (id: string) => {
    navigate(`/foreman/${id}`);
  };

  return (
    <div className="registry-layout">
      <section className="registry-main-card">
        <div className="registry-card-header">
          <div>
            <h2 className="registry-title">
              {activeFilter === "green" &&
                "Объекты в штатном режиме (Зеленый коридор)"}
              {activeFilter === "orange" &&
                "Объекты в штрафном коридоре (Оранжевый статус)"}
              {activeFilter === "purple" &&
                "Объекты в режиме форс-мажора (Фиолетовый статус)"}
              {activeFilter === "analytics" &&
                "Сводная аналитика темпов строительства по Москве"}
              {activeFilter === "all" &&
                "Сводный мониторинг объектов капитального строительства Москвы"}
            </h2>

            {activeFilter !== "all" && (
              <button
                type="button"
                className="reset-filter-link"
                onClick={() => {
                  setActiveFilter("all");
                  setSearchQuery("");
                  setCurrentPage(1);
                }}
              >
                <img src={closeIcon} alt="" className="ui-icon-xs" />
                <span>Сбросить фильтр (показать все ОКС)</span>
              </button>
            )}
          </div>

          <div className="active-filter-badge">
            ОКС в выборке: <strong>{filteredProjects.length}</strong>
          </div>
        </div>

        {error && <div className="admin-error-message">{error}</div>}

        {activeFilter === "analytics" ? (
          /* =======================================================
             ПОЛНОЦЕННЫЙ ЭКРАН СРЕДНЕЙ ГОТОВНОСТИ И АНАЛИТИКИ
             ======================================================= */
          <div className="analytics-dashboard-view">
            {/* 4 главных макро-показателя */}
            <div className="analytics-kpi-row">
              <div className="analytics-metric-card">
                <span className="analytics-metric-label">
                  Средняя готовность ОКС
                </span>
                <div className="analytics-metric-value text-blue">
                  {stats.avg_progress_percent}%
                </div>
                <span className="analytics-metric-sub">
                  Фактический физический объём СМР
                </span>
              </div>

              <div className="analytics-metric-card">
                <span className="analytics-metric-label">
                  Директивное время
                </span>
                <div className="analytics-metric-value text-slate">
                  {stats.avg_time_elapsed_percent}%
                </div>
                <span className="analytics-metric-sub">
                  Средний расход планового времени
                </span>
              </div>

              <div className="analytics-metric-card">
                <span className="analytics-metric-label">
                  Штатный ход работ
                </span>
                <div className="analytics-metric-value text-green">
                  {stats.green_count} ОКС
                </div>
                <span className="analytics-metric-sub">
                  {stats.total_projects
                    ? `${((stats.green_count / stats.total_projects) * 100).toFixed(0)}% строек без сбоев`
                    : "0%"}
                </span>
              </div>

              <div className="analytics-metric-card">
                <span className="analytics-metric-label">
                  В зоне риска и штрафов
                </span>
                <div className="analytics-metric-value text-orange">
                  {stats.orange_count + stats.purple_count} ОКС
                </div>
                <span className="analytics-metric-sub">
                  {stats.total_critical_alerts} критических алертов
                </span>
              </div>
            </div>

            {/* Два аналитических блока: стадии и приоритетные отставания */}
            <div className="analytics-row">
              {/* Распределение по стадиям */}
              <div className="analytics-box">
                <h4 className="analytics-box-title">
                  Распределение ОКС по стадии готовности
                </h4>
                <div className="brackets-list">
                  {progressBrackets.map((bracket, idx) => (
                    <div key={idx} className="bracket-item">
                      <div className="bracket-header">
                        <span className="bracket-title">{bracket.title}</span>
                        <strong className="bracket-count">
                          {bracket.count} ОКС
                        </strong>
                      </div>
                      <div className="bar-track">
                        <div
                          className={`bar-fill ${bracket.colorClass}`}
                          style={{ width: `${bracket.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Распределение по статусам контроля */}
              <div className="analytics-box">
                <h4 className="analytics-box-title">
                  Оперативный статус надзора ОКС
                </h4>
                <div className="status-bars-group">
                  <div className="bar-item">
                    <div className="bar-label">
                      <span>Штатный ход (Зелёный)</span>
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

                <div className="analytics-meta-banner">
                  <span>Общий зафиксированный простой техники:</span>
                  <strong>{stats.total_idle_hours || 0} маш.-час.</strong>
                </div>
              </div>
            </div>

            {/* Таблица строек, требующих внимания */}
            <div className="analytics-priority-card">
              <h4 className="analytics-box-title">
                Стройки, требующие первоочередного внимания Департамента
              </h4>
              {priorityLaggingProjects.length === 0 ? (
                <p className="analytics-empty-note">
                  Критических отставаний по объектам столицы не зафиксировано.
                </p>
              ) : (
                <div className="registry-table-wrapper">
                  <table className="monitoring-table">
                    <thead>
                      <tr>
                        <th>Статус</th>
                        <th>Объект капитального строительства</th>
                        <th>Текущий этап</th>
                        <th>Готовность / План</th>
                        <th>Действие</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priorityLaggingProjects.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <span
                              className={`status-indicator ${getStatusIndicatorClass(
                                p.current_alert_level,
                                p.current_special_status,
                              )}`}
                            />
                          </td>
                          <td>
                            <div className="table-object-name">{p.name}</div>
                            {p.address && (
                              <div className="table-object-address">
                                {p.address}
                              </div>
                            )}
                          </td>
                          <td className="table-stage">
                            {p.current_stage_name || "—"}
                          </td>
                          <td>
                            <div className="lag-progress-wrap">
                              <span className="lag-val">
                                {p.physical_progress_percent?.toFixed(1) || 0}%
                              </span>
                              <span className="lag-plan">
                                (план: {p.time_elapsed_percent?.toFixed(1) || 0}
                                %)
                              </span>
                            </div>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn-action-open"
                              onClick={() => handleOpen(p.id)}
                            >
                              Открыть
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="analytics-return-bar">
              <button
                type="button"
                className="btn-gantt-secondary"
                onClick={() => setActiveFilter("all")}
              >
                ← Вернуться к таблице реестра
              </button>
            </div>
          </div>
        ) : (
          /* =======================================================
             ТАБЛИЦА РЕЕСТРА С ПОИСКОМ
             ======================================================= */
          <div className="registry-table-wrapper">
            {/* Строка поиска */}
            <div className="registry-search-container">
              <div className="registry-search-box">
                <input
                  type="text"
                  placeholder="Поиск по названию ОКС, адресу или этапу СМР..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="registry-search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="registry-search-clear-btn"
                    onClick={() => {
                      setSearchQuery("");
                      setCurrentPage(1);
                    }}
                    title="Очистить поиск"
                  >
                    <img
                      src={closeIcon}
                      alt="Очистить"
                      className="ui-icon-xs"
                    />
                  </button>
                )}
              </div>
            </div>

            <table className="monitoring-table">
              <thead>
                <tr>
                  <th className="th-center">
                    Статус
                    <br />
                    ОКС
                  </th>
                  <th>Объект / Адрес</th>
                  <th>Текущий Этап</th>
                  <th>Готовность</th>
                  <th>
                    Характер
                    <br />
                    Отклонений
                  </th>
                  <th className="th-center">Действие</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="registry-empty">
                      Загрузка реестра строек...
                    </td>
                  </tr>
                ) : paginatedProjects.length > 0 ? (
                  paginatedProjects.map((project) => (
                    <tr key={project.id}>
                      <td className="td-center">
                        <span
                          className={`status-indicator ${getStatusIndicatorClass(
                            project.current_alert_level,
                            project.current_special_status,
                          )}`}
                        />
                      </td>
                      <td>
                        <div className="table-object-name">{project.name}</div>
                        {project.address && (
                          <div className="table-object-address">
                            {project.address}
                          </div>
                        )}
                      </td>
                      <td className="table-stage">
                        {project.current_stage_name || "—"}
                      </td>
                      <td className="table-progress">
                        {project.physical_progress_percent !== undefined
                          ? `${project.physical_progress_percent.toFixed(1)}%`
                          : "0.0%"}
                      </td>
                      <td>
                        {getDeviationBadge(
                          project.current_alert_level,
                          project.current_special_status,
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
                    <td colSpan={6} className="registry-empty">
                      {searchQuery
                        ? `По запросу «${searchQuery}» ничего не найдено`
                        : "Объекты не найдены"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Пагинация */}
            {totalPages > 1 && (
              <div className="roles-pagination">
                <button
                  type="button"
                  className="pagination-button pagination-arrow"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                >
                  Назад
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      type="button"
                      className={`pagination-button ${currentPage === page ? "pagination-active" : ""}`}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </button>
                  ),
                )}

                <button
                  type="button"
                  className="pagination-button pagination-arrow"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || loading}
                >
                  Вперед
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Правая панель с кликабельными карточками */}
      <aside className="registry-sidebar">
        <div
          className={`stat-card stat-clickable ${activeFilter === "all" ? "active-all" : ""}`}
          onClick={() => handleCardClick("all")}
        >
          <span className="stat-label">Всего ОКС в Москве</span>
          <span className="stat-value stat-bold">
            {stats.total_projects} Объектов
          </span>
          <span className="stat-hint">Показать полный список</span>
        </div>

        <div
          className={`stat-card stat-clickable ${activeFilter === "green" ? "active-green" : ""}`}
          onClick={() => handleCardClick("green")}
        >
          <span className="stat-label">Штатный ход (Зелёный)</span>
          <span className="stat-value text-green">{stats.green_count} ОКС</span>
          <span className="stat-hint">Фильтровать штатные</span>
        </div>

        <div
          className={`stat-card stat-clickable ${activeFilter === "orange" ? "active-orange" : ""}`}
          onClick={() => handleCardClick("orange")}
        >
          <span className="stat-label">Штрафной коридор (Оранжевый)</span>
          <span className="stat-value text-orange">
            {stats.orange_count} ОКС
          </span>
          <span className="stat-hint">Фильтровать отстающие</span>
        </div>

        <div
          className={`stat-card stat-clickable ${activeFilter === "purple" ? "active-purple" : ""}`}
          onClick={() => handleCardClick("purple")}
        >
          <span className="stat-label">Форс-мажор (Фиолетовый)</span>
          <span className="stat-value text-purple">
            {stats.purple_count} ОКС
          </span>
          <span className="stat-hint">Фильтровать форс-мажоры</span>
        </div>

        <div
          className={`stat-card stat-clickable ${activeFilter === "analytics" ? "active-analytics" : ""}`}
          onClick={() => handleCardClick("analytics")}
        >
          <span className="stat-label">Средняя готовность по городу</span>
          <span className="stat-value text-blue">
            {stats.avg_progress_percent}%
          </span>
          <span className="stat-hint">Макро-срез и аналитика</span>
        </div>
      </aside>
    </div>
  );
};

export default RegistryList;
