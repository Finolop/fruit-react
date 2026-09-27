import React, { useEffect, useState, useMemo, useRef } from "react";
import { useAuthFetch } from "../../hooks/useAuthFetch";
import {
  updateUserRoleByEmail,
  getProjects,
  assignUserToProject,
  getProjectAssignments,
  removeUserFromProject,
  ProjectListItem,
  ProjectAssignment,
  User,
} from "../../api/apiAdmin";

interface RoleManagementProps {
  refreshTrigger?: number;
}

const STORAGE_USERS_KEY = "admin_cached_known_users";

const RoleManagement: React.FC<RoleManagementProps> = ({ refreshTrigger = 0 }) => {
  const authFetch = useAuthFetch();

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Форма 1: смена роли по Email
  const [targetEmail, setTargetEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("foreman");
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  // Реестр пользователей (сохраняется в localStorage между перезагрузками страницы)
  const [knownUsers, setKnownUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_USERS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveUsers = (updater: (prev: User[]) => User[]) => {
    setKnownUsers((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Форма 2: привязка к ОКС
  const [userInputValue, setUserInputValue] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [assignProjectId, setAssignProjectId] = useState("");
  const [assignRoleInProject, setAssignRoleInProject] = useState("foreman");
  const [projectSearch, setProjectSearch] = useState("");
  const [currentAssignments, setCurrentAssignments] = useState<ProjectAssignment[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isFindingByEmail, setIsFindingByEmail] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    getProjects(authFetch, { limit: 100 })
      .then((data) => {
        setProjects(data);
        if (data.length > 0 && !assignProjectId) {
          setAssignProjectId(data[0].id);
        }
      })
      .catch(() => {});
  }, [refreshTrigger, authFetch, assignProjectId]);

  useEffect(() => {
    if (!assignProjectId) return;
    getProjectAssignments(authFetch, assignProjectId)
      .then((assignments) => setCurrentAssignments(assignments || []))
      .catch(() => setCurrentAssignments([]));
  }, [assignProjectId, authFetch]);

  const filteredProjects = useMemo(() => {
    if (!projectSearch.trim()) return projects;
    const q = projectSearch.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.address && p.address.toLowerCase().includes(q))
    );
  }, [projects, projectSearch]);

  const filteredUsers = useMemo(() => {
    if (!userInputValue.trim()) return knownUsers;
    const query = userInputValue.toLowerCase();
    return knownUsers.filter(
      (u) =>
        u.email.toLowerCase().includes(query) ||
        u.id.toLowerCase().includes(query) ||
        (u.first_name && u.first_name.toLowerCase().includes(query)) ||
        (u.last_name && u.last_name.toLowerCase().includes(query))
    );
  }, [knownUsers, userInputValue]);

  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmail.trim()) return;

    setIsUpdatingRole(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const updatedUser = await updateUserRoleByEmail(authFetch, targetEmail.trim(), [selectedRole]);
      setSuccessMessage(
        `Роль пользователя ${targetEmail} успешно сохранена (${selectedRole}). ID: ${updatedUser.id}`
      );

      saveUsers((prev) => {
        const filtered = prev.filter((u) => u.id !== updatedUser.id);
        return [updatedUser, ...filtered];
      });

      setTargetEmail("");
    } catch (err: any) {
      setErrorMessage(err.message || "Ошибка обновления роли");
    } finally {
      setIsUpdatingRole(false);
    }
  };

  // Поиск ID пользователя по Email, если страницу обновили
  const handleFindByEmail = async () => {
    const emailToFind = userInputValue.trim();
    if (!emailToFind || !emailToFind.includes("@")) {
      setErrorMessage("Введите корректный Email сотрудника для поиска");
      return;
    }

    setIsFindingByEmail(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const foundUser = await updateUserRoleByEmail(authFetch, emailToFind, [assignRoleInProject]);
      saveUsers((prev) => {
        const filtered = prev.filter((u) => u.id !== foundUser.id);
        return [foundUser, ...filtered];
      });

      setSelectedUserId(foundUser.id);
      setUserInputValue(`${foundUser.email} (${foundUser.id.slice(0, 8)}...)`);
      setSuccessMessage(`Сотрудник найден: ${foundUser.email} (ID: ${foundUser.id})`);
    } catch (err: any) {
      setErrorMessage(err.message || "Пользователь с таким Email не найден на сервере");
    } finally {
      setIsFindingByEmail(false);
    }
  };

  const handleSelectUser = (user: User) => {
    setSelectedUserId(user.id);
    setUserInputValue(`${user.email} (${user.id.slice(0, 8)}...)`);
    setIsDropdownOpen(false);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalUserId = selectedUserId || userInputValue.trim();

    if (!finalUserId || !assignProjectId) return;

    setIsAssigning(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const newAssignment = await assignUserToProject(
        authFetch,
        assignProjectId,
        finalUserId,
        assignRoleInProject
      );
      setSuccessMessage("Сотрудник успешно привязан к объекту");
      setCurrentAssignments((prev) => [...prev, newAssignment]);
      setUserInputValue("");
      setSelectedUserId("");
    } catch (err: any) {
      setErrorMessage(err.message || "Ошибка привязки к объекту");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!assignProjectId) return;
    try {
      setErrorMessage("");
      setSuccessMessage("");
      await removeUserFromProject(authFetch, assignProjectId, assignmentId);
      setSuccessMessage("Сотрудник успешно отозван с объекта");
      setCurrentAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    } catch (err: any) {
      setErrorMessage(err.message || "Ошибка отзыва сотрудника");
    }
  };

  return (
    <section className="admin-container">
      <div className="admin-card-header">
        <h2>Управление ролями и объектами</h2>
        <p>Выдача глобальных ролей и распределение команды по стройплощадкам.</p>
      </div>

      {successMessage && <div className="admin-success-message">{successMessage}</div>}
      {errorMessage && <div className="admin-error-message">{errorMessage}</div>}

      <div className="role-management-flow">
        {/* Форма 1: смена роли по Email */}
        <form onSubmit={handleRoleSubmit} className="admin-form">
          <div className="subform-header">
            <h3>1. Выдача системной роли по Email</h3>
            <p>Укажите Email сотрудника для изменения системных прав</p>
          </div>

          <div className="role-change-row">
            <div className="form-field form-field-email">
              <label>Email пользователя *</label>
              <input
                type="email"
                placeholder="foreman@stroi.mos.ru"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-field form-field-role">
              <label>Назначаемая роль *</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="foreman">Прораб</option>
                <option value="engineer">Инженер</option>
                <option value="admin">Департамент</option>
              </select>
            </div>

            <button
              type="submit"
              className="admin-primary-button btn-role-submit"
              disabled={isUpdatingRole || !targetEmail.trim()}
            >
              {isUpdatingRole ? "Сохранение..." : "Назначить роль"}
            </button>
          </div>
        </form>

        <hr className="role-section-divider" />

        {/* Форма 2: привязка к ОКС */}
        <form onSubmit={handleAssignSubmit} className="admin-form">
          <div className="subform-header">
            <h3>2. Назначение сотрудника на объект</h3>
            <p>Выберите сотрудника из списка, введите Email для поиска или вставьте UUID</p>
          </div>

          <div className="assign-grid-fields">
            <div className="form-field" ref={dropdownRef}>
              <label>Сотрудник (Email или UUID) *</label>
              <div className="autocomplete-field-wrapper">
                <input
                  type="text"
                  placeholder="Нажмите для выбора или введите Email..."
                  value={userInputValue}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => {
                    setUserInputValue(e.target.value);
                    setSelectedUserId("");
                    setIsDropdownOpen(true);
                  }}
                  required
                />

                {isDropdownOpen && (
                  <div className="autocomplete-dropdown">
                    {filteredUsers.length === 0 ? (
                      <div className="autocomplete-empty">
                        {knownUsers.length === 0
                          ? "Введите Email сотрудника и нажмите «Найти по Email»"
                          : "Сотрудники не найдены"}
                      </div>
                    ) : (
                      filteredUsers.map((u) => (
                        <div
                          key={u.id}
                          className="autocomplete-item"
                          onClick={() => handleSelectUser(u)}
                        >
                          <div className="autocomplete-item-header">
                            <span className="autocomplete-user-email">{u.email}</span>
                            {(u.first_name || u.last_name) && (
                              <span className="autocomplete-user-name">
                                {u.first_name} {u.last_name}
                              </span>
                            )}
                          </div>
                          <span className="autocomplete-user-id">ID: {u.id}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {userInputValue.includes("@") && !selectedUserId && (
                <button
                  type="button"
                  className="role-edit-button"
                  style={{ marginTop: "6px" }}
                  onClick={handleFindByEmail}
                  disabled={isFindingByEmail}
                >
                  {isFindingByEmail ? "Поиск..." : "🔍 Найти ID по введенному Email"}
                </button>
              )}
            </div>

            <div className="form-field">
              <label>Роль на данном объекте *</label>
              <select
                value={assignRoleInProject}
                onChange={(e) => setAssignRoleInProject(e.target.value)}
              >
                <option value="foreman">Прораб объекта</option>
                <option value="engineer">Инженер объекта</option>
              </select>
            </div>
          </div>

          <div className="form-field">
            <label>Фильтр ОКС</label>
            <input
              type="text"
              placeholder="Поиск объекта по наименованию или адресу..."
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Выберите объект капитального строительства *</label>
            <select
              value={assignProjectId}
              onChange={(e) => setAssignProjectId(e.target.value)}
              required
            >
              {filteredProjects.length === 0 ? (
                <option value="" disabled>Объекты не найдены</option>
              ) : (
                filteredProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.address || "Адрес не указан"})
                  </option>
                ))
              )}
            </select>
          </div>

          {assignProjectId && currentAssignments.length > 0 && (
            <div className="assignments-preview-box">
              <p className="assignments-preview-title">
                Назначены на этот объект ({currentAssignments.length}):
              </p>
              <div className="assignments-preview-list">
                {currentAssignments.map((a) => (
                  <span key={a.id} className="assignment-item-tag">
                    <strong>{a.role_in_project}:</strong>
                    <code>{a.user_id.slice(0, 8)}...</code>
                    <button
                      type="button"
                      className="btn-unassign-chip"
                      title="Отозвать сотрудника с объекта"
                      onClick={() => handleRemoveAssignment(a.id)}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            className="admin-primary-button"
            disabled={isAssigning || !userInputValue.trim() || !assignProjectId}
          >
            {isAssigning ? "Привязка..." : "Привязать сотрудника к объекту"}
          </button>
        </form>
      </div>
    </section>
  );
};

export default RoleManagement;