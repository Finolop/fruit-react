import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useGetProjectsQuery } from "../../api/rtkApi";
import { ReactComponent as CloseIcon } from "../../assets/images/Close_MD.svg";

export type SidebarViewFilter = "all" | "green" | "orange" | "purple";

export interface DepartmentOverview {
  total_projects: number;
  green_count: number;
  orange_count: number;
  purple_count: number;
}

const ITEMS_PER_PAGE = 6;

const RegistryList: React.FC = () => {
  const navigate = useNavigate();

  const [activeFilter, setActiveFilter] = useState<SidebarViewFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const {
    data: projects = [],
    isLoading,
    isError,
  } = useGetProjectsQuery(
    { limit: 100 },
    {
      pollingInterval: 10000,
      skipPollingIfUnfocused: true,
    },
  );

  const stats: DepartmentOverview = useMemo(() => {
    const total = projects.length;
    if (total === 0) {
      return {
        total_projects: 0,
        green_count: 0,
        orange_count: 0,
        purple_count: 0,
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

    return {
      total_projects: total,
      green_count: green,
      orange_count: orange,
      purple_count: purple,
    };
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
                <CloseIcon className="ui-icon-xs" />
                <span>Сбросить фильтр (показать все ОКС)</span>
              </button>
            )}
          </div>

          <div className="active-filter-badge">
            ОКС в выборке: <strong>{filteredProjects.length}</strong>
          </div>
        </div>

        {isError && (
          <div className="admin-error-message">
            Ошибка загрузки реестра строек
          </div>
        )}

        <div className="registry-table-wrapper">
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
                  <CloseIcon className="ui-icon-xs" />
                </button>
              )}
            </div>
          </div>

          <table className="monitoring-table">
            <thead>
              <tr>
                <th className="th-center">Статус ОКС</th>
                <th>Объект / Адрес</th>
                <th>Текущий Этап</th>
                <th>Готовность</th>
                <th>Характер Отклонений</th>
                <th className="th-center">Действие</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
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
                      <div className="table-object-name" title={project.name}>
                        {project.name}
                      </div>
                      {project.address && (
                        <div
                          className="table-object-address"
                          title={project.address}
                        >
                          {project.address}
                        </div>
                      )}
                    </td>
                    <td className="table-stage">
                      {project.current_stage_name
                        ? project.current_stage_name
                            .replace(/^\d+(\.\d+)*[-.\s]+/, "")
                            .trim()
                        : "—"}
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

          {totalPages > 1 && (
            <div className="roles-pagination">
              <button
                type="button"
                className="pagination-button pagination-arrow"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || isLoading}
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
                disabled={currentPage === totalPages || isLoading}
              >
                Вперед
              </button>
            </div>
          )}
        </div>
      </section>

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
      </aside>
    </div>
  );
};

export default RegistryList;
