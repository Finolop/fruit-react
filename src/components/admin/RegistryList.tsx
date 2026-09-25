// import React, { useEffect, useState, useMemo } from "react";
// import { useNavigate } from "react-router-dom";

// export type AlertLevel = "GREEN" | "YELLOW" | "RED";
// export type SpecialStatus = "NONE" | "PURPLE" | "ORANGE";

// export interface ProjectListItem {
//   id: string;
//   name: string;
//   address: string;
//   type_name?: string;
//   current_stage_name?: string;
//   progress_percent?: number;
//   progress_days?: string;
//   current_alert_level: AlertLevel;
//   current_special_status: SpecialStatus;
//   deviation_text?: string;
// }

// export interface DepartmentOverview {
//   total_projects: number;
//   green_count: number;
//   orange_count: number;
//   purple_count: number;
//   avg_progress_percent: number;
// }

// const ITEMS_PER_PAGE = 6;

// const RegistryList: React.FC = () => {
//   const navigate = useNavigate();

//   const [projects, setProjects] = useState<ProjectListItem[]>([]);
//   const [currentPage, setCurrentPage] = useState(1);
//   const [stats, setStats] = useState<DepartmentOverview>({
//     total_projects: 0,
//     green_count: 0,
//     orange_count: 0,
//     purple_count: 0,
//     avg_progress_percent: 0,
//   });
//   const [loading, setLoading] = useState<boolean>(true);

//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         setLoading(true);
//         const [projectsRes, overviewRes] = await Promise.all([
//           fetch("/api/v1/projects"),
//           fetch("/api/v1/analytics/department-overview"),
//         ]);

//         if (projectsRes.ok) {
//           const projectsData = await projectsRes.json();
//           setProjects(projectsData);
//         }

//         if (overviewRes.ok) {
//           const overviewData = await overviewRes.json();
//           setStats(overviewData);
//         }
//       } catch (error) {
//         console.error("Ошибка загрузки данных мониторинга:", error);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchData();
//   }, []);

//   const totalPages = Math.max(1, Math.ceil(projects.length / ITEMS_PER_PAGE));

//   const paginatedProjects = useMemo(() => {
//     const start = (currentPage - 1) * ITEMS_PER_PAGE;
//     return projects.slice(start, start + ITEMS_PER_PAGE);
//   }, [projects, currentPage]);

//   const handlePageChange = (page: number) => {
//     if (page < 1 || page > totalPages) return;
//     setCurrentPage(page);
//   };

//   const getStatusIndicatorClass = (
//     alertLevel: AlertLevel,
//     specialStatus: SpecialStatus,
//   ): string => {
//     if (specialStatus === "PURPLE") return "status-purple";
//     if (specialStatus === "ORANGE") return "status-orange";
//     if (alertLevel === "GREEN") return "status-green";
//     if (alertLevel === "YELLOW") return "status-orange";
//     return "status-orange";
//   };

//   const getDeviationBadge = (
//     alertLevel: AlertLevel,
//     specialStatus: SpecialStatus,
//     text?: string,
//   ) => {
//     if (specialStatus === "PURPLE") {
//       return (
//         <span className="deviation-badge deviation-purple">
//           {text || "Внешний Фактор"}
//         </span>
//       );
//     }
//     if (
//       specialStatus === "ORANGE" ||
//       alertLevel === "RED" ||
//       alertLevel === "YELLOW"
//     ) {
//       return (
//         <span className="deviation-badge deviation-danger">
//           {text || "Отклонение от графика"}
//         </span>
//       );
//     }
//     return (
//       <span className="deviation-badge deviation-success">
//         {text || "Отклонений Нет"}
//       </span>
//     );
//   };

//   const handleOpen = (id: string) => {
//     navigate(`/admin/oks/${id}`);
//   };

//   const renderPaginationButtons = () => {
//     const pages: (number | string)[] = [];

//     if (totalPages <= 7) {
//       for (let i = 1; i <= totalPages; i++) pages.push(i);
//     } else {
//       if (currentPage <= 4) {
//         pages.push(1, 2, 3, 4, 5, "...", totalPages);
//       } else if (currentPage >= totalPages - 3) {
//         pages.push(
//           1,
//           "...",
//           totalPages - 4,
//           totalPages - 3,
//           totalPages - 2,
//           totalPages - 1,
//           totalPages,
//         );
//       } else {
//         pages.push(
//           1,
//           "...",
//           currentPage - 1,
//           currentPage,
//           currentPage + 1,
//           "...",
//           totalPages,
//         );
//       }
//     }

//     return pages.map((page, index) => {
//       if (page === "...") {
//         return (
//           <span key={`dots-${index}`} className="pagination-dots">
//             ...
//           </span>
//         );
//       }
//       return (
//         <button
//           key={`page-${page}`}
//           type="button"
//           className={`pagination-button ${
//             currentPage === page ? "pagination-active" : ""
//           }`}
//           onClick={() => handlePageChange(page as number)}
//           disabled={loading}
//         >
//           {page}
//         </button>
//       );
//     });
//   };

//   return (
//     <div className="registry-layout">
//       <section className="registry-main-card">
//         <h2 className="registry-title">
//           Сводный Мониторинг Объектов Капитального Строительства Москвы
//         </h2>

//         <div className="registry-table-wrapper">
//           <table className="monitoring-table">
//             <thead>
//               <tr>
//                 <th className="th-center">
//                   Статус
//                   <br />
//                   ОКС
//                 </th>
//                 <th>Объект / Адрес</th>
//                 <th>
//                   Тип
//                   <br />
//                   Строительства
//                 </th>
//                 <th>Текущий Этап</th>
//                 <th>Готовность</th>
//                 <th>
//                   Характер
//                   <br />
//                   Отклонений
//                 </th>
//                 <th className="th-center">Действие</th>
//               </tr>
//             </thead>
//             <tbody>
//               {loading ? (
//                 <tr>
//                   <td colSpan={7} className="registry-empty">
//                     Загрузка данных...
//                   </td>
//                 </tr>
//               ) : paginatedProjects.length > 0 ? (
//                 paginatedProjects.map((project) => (
//                   <tr key={project.id}>
//                     <td className="td-center">
//                       <span
//                         className={`status-indicator ${getStatusIndicatorClass(
//                           project.current_alert_level,
//                           project.current_special_status,
//                         )}`}
//                       />
//                     </td>
//                     <td>
//                       <div className="table-object-name">{project.name}</div>
//                       {project.address && (
//                         <div className="table-object-address">
//                           {project.address}
//                         </div>
//                       )}
//                     </td>
//                     <td className="table-type">{project.type_name || "—"}</td>
//                     <td className="table-stage">
//                       {project.current_stage_name || "—"}
//                     </td>
//                     <td className="table-progress">
//                       {project.progress_percent !== undefined
//                         ? `${project.progress_percent.toFixed(1)}%`
//                         : "0.0%"}
//                       {project.progress_days && ` (${project.progress_days})`}
//                     </td>
//                     <td>
//                       {getDeviationBadge(
//                         project.current_alert_level,
//                         project.current_special_status,
//                         project.deviation_text,
//                       )}
//                     </td>
//                     <td className="td-center">
//                       <button
//                         type="button"
//                         className="btn-action-open"
//                         onClick={() => handleOpen(project.id)}
//                       >
//                         Открыть
//                       </button>
//                     </td>
//                   </tr>
//                 ))
//               ) : (
//                 <tr>
//                   <td colSpan={7} className="registry-empty">
//                     Объекты не найдены
//                   </td>
//                 </tr>
//               )}
//             </tbody>
//           </table>

//           <div className="roles-pagination">
//             <button
//               type="button"
//               className="pagination-button pagination-arrow"
//               onClick={() => handlePageChange(currentPage - 1)}
//               disabled={currentPage === 1 || loading}
//             >
//               Назад
//             </button>

//             {renderPaginationButtons()}

//             <button
//               type="button"
//               className="pagination-button pagination-arrow"
//               onClick={() => handlePageChange(currentPage + 1)}
//               disabled={currentPage === totalPages || loading}
//             >
//               Вперед
//             </button>
//           </div>
//         </div>
//       </section>

//       <aside className="registry-sidebar">
//         <div className="stat-card">
//           <span className="stat-label">Всего ОКС В Москве</span>
//           <span className="stat-value stat-bold">
//             {stats.total_projects} Объектов
//           </span>
//         </div>

//         <div className="stat-card">
//           <span className="stat-label">Штатный Ход (Зеленый)</span>
//           <span className="stat-value text-green">{stats.green_count} ОКС</span>
//         </div>

//         <div className="stat-card">
//           <span className="stat-label">Штрафный Коридор (Оранжевый)</span>
//           <span className="stat-value text-orange">
//             {stats.orange_count} ОКС
//           </span>
//         </div>

//         <div className="stat-card">
//           <span className="stat-label">Форс-Мажор (Фиолетовый)</span>
//           <span className="stat-value text-purple">
//             {stats.purple_count} ОКС
//           </span>
//         </div>

//         <div className="stat-card">
//           <span className="stat-label">Средняя Готовность По Городу</span>
//           <span className="stat-value text-blue">
//             {stats.avg_progress_percent}%
//           </span>
//         </div>
//       </aside>
//     </div>
//   );
// };

// export default RegistryList;



import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

export type AlertLevel = "GREEN" | "YELLOW" | "RED";
export type SpecialStatus = "NONE" | "PURPLE" | "ORANGE";
export type SidebarViewFilter = "all" | "green" | "orange" | "purple" | "analytics";

export interface ProjectListItem {
  id: string;
  name: string;
  address: string;
  type_name?: string;
  current_stage_name?: string;
  progress_percent?: number;
  progress_days?: string;
  current_alert_level: AlertLevel;
  current_special_status: SpecialStatus;
  deviation_text?: string;
}

export interface DepartmentOverview {
  total_projects: number;
  green_count: number;
  orange_count: number;
  purple_count: number;
  avg_progress_percent: number;
}

const ITEMS_PER_PAGE = 6;

const mockProjectsFallback: ProjectListItem[] = [
  {
    id: "1",
    name: 'ЖК "Пресня-Сити" Корп. 2',
    address: "г. Москва, ул. Пресненский Вал, 21",
    type_name: "Жилье",
    current_stage_name: "Разработка Котлована",
    progress_percent: 15.0,
    progress_days: "18/120дн",
    current_alert_level: "YELLOW",
    current_special_status: "ORANGE",
    deviation_text: "Отсутствие Техники (Самосвалы)",
  },
  {
    id: "2",
    name: "Школа на 825 мест",
    address: "г. Москва, ул. Северная, д. 15",
    type_name: "Образование",
    current_stage_name: "Монолитный Каркас",
    progress_percent: 38.2,
    progress_days: "67/170дн",
    current_alert_level: "RED",
    current_special_status: "PURPLE",
    deviation_text: "Внешний Фактор (Авария сетей)",
  },
  {
    id: "3",
    name: "Лечебно-диагностический комплекс ГКБ № 1",
    address: "г. Москва, ул. Строителей, вл. 7",
    type_name: "Здравоохранение",
    current_stage_name: "Кровельные Работы",
    progress_percent: 82.5,
    progress_days: "99/120дн",
    current_alert_level: "GREEN",
    current_special_status: "NONE",
    deviation_text: "Отклонений Нет",
  },
  {
    id: "4",
    name: "Детский сад на 350 мест",
    address: "г. Москва, ул. Новослободская, д. 45",
    type_name: "Образование",
    current_stage_name: "Отделочные работы",
    progress_percent: 74.0,
    progress_days: "88/110дн",
    current_alert_level: "GREEN",
    current_special_status: "NONE",
    deviation_text: "Отклонений Нет",
  },
  {
    id: "5",
    name: "Многоуровневый паркинг",
    address: "г. Москва, Ленинградский пр-т, 12",
    type_name: "Административный",
    current_stage_name: "Монтаж перекрытий",
    progress_percent: 45.0,
    progress_days: "45/100дн",
    current_alert_level: "YELLOW",
    current_special_status: "ORANGE",
    deviation_text: "Простой башенного крана",
  },
];

const RegistryList: React.FC = () => {
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<SidebarViewFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [stats, setStats] = useState<DepartmentOverview>({
    total_projects: 48,
    green_count: 38,
    orange_count: 7,
    purple_count: 3,
    avg_progress_percent: 42.4,
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [projectsRes, overviewRes] = await Promise.all([
          fetch("/api/v1/projects"),
          fetch("/api/v1/analytics/department-overview"),
        ]);

        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          setProjects(projectsData.length ? projectsData : mockProjectsFallback);
        } else {
          setProjects(mockProjectsFallback);
        }

        if (overviewRes.ok) {
          const overviewData = await overviewRes.json();
          setStats(overviewData);
        }
      } catch {
        setProjects(mockProjectsFallback);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
        (p) => p.current_alert_level === "GREEN" && p.current_special_status === "NONE"
      );
    }
    if (activeFilter === "orange") {
      return projects.filter(
        (p) => p.current_special_status === "ORANGE" || p.current_alert_level === "YELLOW"
      );
    }
    if (activeFilter === "purple") {
      return projects.filter((p) => p.current_special_status === "PURPLE");
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

  const getStatusIndicatorClass = (
    alertLevel: AlertLevel,
    specialStatus: SpecialStatus
  ): string => {
    if (specialStatus === "PURPLE") return "status-purple";
    if (specialStatus === "ORANGE") return "status-orange";
    if (alertLevel === "GREEN") return "status-green";
    return "status-orange";
  };

  const getDeviationBadge = (
    alertLevel: AlertLevel,
    specialStatus: SpecialStatus,
    text?: string
  ) => {
    if (specialStatus === "PURPLE") {
      return <span className="deviation-badge deviation-purple">{text || "Форс-Мажор"}</span>;
    }
    if (specialStatus === "ORANGE" || alertLevel === "RED" || alertLevel === "YELLOW") {
      return <span className="deviation-badge deviation-danger">{text || "Штрафной Коридор"}</span>;
    }
    return <span className="deviation-badge deviation-success">{text || "Отклонений Нет"}</span>;
  };

  const handleOpen = (id: string) => {
    navigate(`/admin/oks/${id}`);
  };

  const getTitleByFilter = () => {
    switch (activeFilter) {
      case "green":
        return "Объекты в штатном режиме (Зеленый коридор)";
      case "orange":
        return "Объекты в штрафном коридоре / на контроле (Оранжевый статус)";
      case "purple":
        return "Объекты в режиме форс-мажора (Фиолетовый статус)";
      case "analytics":
        return "Аналитический срез темпов строительства по Москве";
      default:
        return "Сводный Мониторинг Объектов Капитального Строительства Москвы";
    }
  };

  return (
    <div className="registry-layout">
      {/* ЛЕВАЯ ЧАСТЬ: Таблица с фильтром либо Графика Аналитики */}
      <section className="registry-main-card">
        <div className="registry-card-header">
          <div>
            <h2 className="registry-title">{getTitleByFilter()}</h2>
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

        {activeFilter === "analytics" ? (
          /* РЕЖИМ ГРАФИКОВ */
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
                        style={{ width: `${(stats.green_count / stats.total_projects) * 100}%` }}
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
                        style={{ width: `${(stats.orange_count / stats.total_projects) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="bar-item">
                    <div className="bar-label">
                      <span>Форс-мажор (Фиолетовый)</span>
                      <strong>{stats.purple_count} ОКС</strong>
                    </div>
                    <div className="bar-track">
                      <div
                        className="bar-fill bg-purple"
                        style={{ width: `${(stats.purple_count / stats.total_projects) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="analytics-box">
                <h4 className="analytics-box-title">Средняя готовность по округам</h4>
                <div className="district-circles-grid">
                  <div className="district-item">
                    <div className="district-metric metric-blue">48.2%</div>
                    <span className="district-name">ЦАО</span>
                  </div>
                  <div className="district-item">
                    <div className="district-metric metric-green">54.0%</div>
                    <span className="district-name">ЗАО</span>
                  </div>
                  <div className="district-item">
                    <div className="district-metric metric-orange">34.6%</div>
                    <span className="district-name">САО</span>
                  </div>
                  <div className="district-item">
                    <div className="district-metric metric-blue">42.4%</div>
                    <span className="district-name">ЮВАО</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="analytics-table-preview">
              <h4 className="analytics-box-title">Сводка темпов монтажных работ</h4>
              <p className="analytics-desc">
                Среднесуточный объем монолитных работ составляет 142 куб.м/сутки при плановых 160 куб.м/сутки.
                Основное узкое место: простой самосвальной техники на разгрузочных плечах САО.
              </p>
            </div>
          </div>
        ) : (
          /* РЕЖИМ СТАНДАРТНОЙ ТАБЛИЦЫ */
          <div className="registry-table-wrapper">
            <table className="monitoring-table">
              <thead>
                <tr>
                  <th className="th-center">Статус<br />ОКС</th>
                  <th>Объект / Адрес</th>
                  <th>Тип<br />Строительства</th>
                  <th>Текущий Этап</th>
                  <th>Готовность</th>
                  <th>Характер<br />Отклонений</th>
                  <th className="th-center">Действие</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="registry-empty">Загрузка данных...</td>
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
                      <td className="table-type">{project.type_name || "—"}</td>
                      <td className="table-stage">{project.current_stage_name || "—"}</td>
                      <td className="table-progress">
                        {project.progress_percent !== undefined
                          ? `${project.progress_percent.toFixed(1)}%`
                          : "0.0%"}
                        {project.progress_days && ` (${project.progress_days})`}
                      </td>
                      <td>
                        {getDeviationBadge(
                          project.current_alert_level,
                          project.current_special_status,
                          project.deviation_text
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
                    <td colSpan={7} className="registry-empty">Объекты в выбранной категории не найдены</td>
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

      {/* ПРАВАЯ ЧАСТЬ: Кликабельные Карточки-Индикаторы */}
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
          <span className="stat-label">Штрафный Коридор (Оранжевый)</span>
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
          <span className="stat-hint">📊 Открыть аналитику и графики</span>
        </div>
      </aside>
    </div>
  );
};

export default RegistryList;