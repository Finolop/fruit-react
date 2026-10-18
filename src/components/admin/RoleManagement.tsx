import React, { useEffect, useState, useMemo, useRef } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { User } from "../../api/apiAdmin";
import {
  useGetProjectsQuery,
  useGetUsersQuery,
  useGetProjectAssignmentsQuery,
  useUpdateUserRoleByEmailMutation,
  useAssignUserToProjectMutation,
  useRemoveUserFromProjectMutation,
  extractApiError,
} from "../../api/rtkApi";
import { ReactComponent as CloseIcon } from "../../assets/images/Close_MD.svg";

interface RoleManagementProps {
  refreshTrigger?: number;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Департамент",
  engineer: "Инженер",
  foreman: "Прораб",
  user: "Без роли",
};

const formatUserRoles = (roles: string[]): string => {
  if (!roles || roles.length === 0) return "Без роли";
  return roles.map((r) => ROLE_LABELS[r.toLowerCase()] || r).join(", ");
};

const RoleManagement: React.FC<RoleManagementProps> = () => {
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [targetEmail, setTargetEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("foreman");
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  const [userInputValue, setUserInputValue] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [assignProjectId, setAssignProjectId] = useState("");
  const [assignRoleInProject, setAssignRoleInProject] = useState("foreman");
  const [projectSearch, setProjectSearch] = useState("");

  const { data: dbUsers = [] } = useGetUsersQuery();
  const { data: projects = [] } = useGetProjectsQuery({ limit: 100 });

  const { data: currentAssignments = [] } = useGetProjectAssignmentsQuery(
    assignProjectId ? assignProjectId : skipToken,
  );

  const [updateUserRoleByEmail, { isLoading: isUpdatingRole }] =
    useUpdateUserRoleByEmailMutation();
  const [assignUserToProject, { isLoading: isAssigning }] =
    useAssignUserToProjectMutation();
  const [removeUserFromProject] = useRemoveUserFromProjectMutation();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
      if (
        roleDropdownRef.current &&
        !roleDropdownRef.current.contains(event.target as Node)
      ) {
        setIsRoleDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (projects.length > 0 && !assignProjectId) {
      setAssignProjectId(projects[0].id);
    }
  }, [projects, assignProjectId]);

  const filteredProjects = useMemo(() => {
    if (!projectSearch.trim()) return projects;
    const q = projectSearch.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.address && p.address.toLowerCase().includes(q)),
    );
  }, [projects, projectSearch]);

  const form1FilteredUsers = useMemo(() => {
    const q = targetEmail.trim().toLowerCase();
    if (!q) return dbUsers;
    return dbUsers.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.first_name && u.first_name.toLowerCase().includes(q)) ||
        (u.last_name && u.last_name.toLowerCase().includes(q)),
    );
  }, [dbUsers, targetEmail]);

  const eligibleUsers = useMemo(() => {
    const rawQuery = userInputValue.split(" (")[0].trim().toLowerCase();

    return dbUsers.filter((u) => {
      const roles = (u.roles || []).map((r) => r.toLowerCase());
      const hasAnyStaffRole =
        roles.includes("foreman") ||
        roles.includes("engineer") ||
        roles.includes("admin");

      if (!hasAnyStaffRole) return false;
      if (!rawQuery) return true;

      return (
        u.email.toLowerCase().includes(rawQuery) ||
        u.id.toLowerCase().includes(rawQuery) ||
        (u.first_name && u.first_name.toLowerCase().includes(rawQuery)) ||
        (u.last_name && u.last_name.toLowerCase().includes(rawQuery))
      );
    });
  }, [dbUsers, userInputValue]);

  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = targetEmail.trim();
    if (!email) return;

    setErrorMessage("");
    setSuccessMessage("");
    try {
      const updatedUser = await updateUserRoleByEmail({
        email,
        roles: [selectedRole],
      }).unwrap();

      setSuccessMessage(
        `Роль пользователя ${updatedUser.email} успешно сохранена (${
          ROLE_LABELS[selectedRole] || selectedRole
        }).`,
      );
      setTargetEmail("");
      setIsRoleDropdownOpen(false);
    } catch (err: any) {
      setErrorMessage(extractApiError(err, "Ошибка обновления роли"));
    }
  };

  const handleSelectUser = (user: User) => {
    setSelectedUserId(user.id);
    setUserInputValue(`${user.email} (${user.first_name} ${user.last_name})`);

    const roles = (user.roles || []).map((r) => r.toLowerCase());
    if (roles.includes("engineer") && !roles.includes("foreman")) {
      setAssignRoleInProject("engineer");
    } else if (roles.includes("foreman") && !roles.includes("engineer")) {
      setAssignRoleInProject("foreman");
    }

    setIsDropdownOpen(false);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawIdentifier =
      selectedUserId || userInputValue.split(" (")[0].trim();

    if (!rawIdentifier || !assignProjectId) return;

    setErrorMessage("");
    setSuccessMessage("");

    try {
      await assignUserToProject({
        projectId: assignProjectId,
        userId: rawIdentifier,
        roleInProject: assignRoleInProject,
      }).unwrap();

      setSuccessMessage("Сотрудник успешно привязан к объекту");
      setUserInputValue("");
      setSelectedUserId("");
    } catch (err: any) {
      setErrorMessage(extractApiError(err, "Ошибка привязки к объекту"));
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!assignProjectId) return;
    try {
      setErrorMessage("");
      setSuccessMessage("");
      await removeUserFromProject({
        projectId: assignProjectId,
        assignmentId,
      }).unwrap();
      setSuccessMessage("Сотрудник успешно отозван с объекта");
    } catch (err: any) {
      setErrorMessage(extractApiError(err, "Ошибка отзыва сотрудника"));
    }
  };

  return (
    <section className="admin-container">
      <div className="admin-card-header">
        <h2>Управление ролями и объектами</h2>
        <p>
          Выдача глобальных ролей и распределение команды по стройплощадкам.
        </p>
      </div>

      {successMessage && (
        <div className="admin-success-message">{successMessage}</div>
      )}
      {errorMessage && (
        <div className="admin-error-message">{errorMessage}</div>
      )}

      <div className="role-management-flow">
        {/* Этап 1: смена роли по Email */}
        <form onSubmit={handleRoleSubmit} className="admin-form">
          <div className="subform-header">
            <h3>1. Выдача системной роли по Email</h3>
            <p>Укажите Email сотрудника для изменения системных прав в базе</p>
          </div>

          <div className="role-change-row">
            <div className="form-field form-field-email" ref={roleDropdownRef}>
              <label>Email пользователя *</label>
              <div className="autocomplete-field-wrapper">
                <input
                  type="email"
                  placeholder="Выберите или введите Email..."
                  value={targetEmail}
                  onFocus={() => setIsRoleDropdownOpen(true)}
                  onChange={(e) => {
                    setTargetEmail(e.target.value);
                    setIsRoleDropdownOpen(true);
                  }}
                  required
                />

                {isRoleDropdownOpen && form1FilteredUsers.length > 0 && (
                  <div className="autocomplete-dropdown">
                    {form1FilteredUsers.map((u) => (
                      <div
                        key={u.id}
                        className="autocomplete-item"
                        onClick={() => {
                          setTargetEmail(u.email);
                          setIsRoleDropdownOpen(false);
                        }}
                      >
                        <div className="autocomplete-item-header">
                          <span className="autocomplete-user-email">
                            {u.email}
                          </span>
                          <span className="autocomplete-user-name">
                            {u.first_name} {u.last_name}
                          </span>
                        </div>
                        <span className="autocomplete-user-id">
                          Текущая роль: {formatUserRoles(u.roles)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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

        {/* Этап 2: привязка к ОКС */}
        <form onSubmit={handleAssignSubmit} className="admin-form">
          <div className="subform-header">
            <h3>2. Назначение сотрудника на объект</h3>
            <p>
              Выберите прораба или инженера из списка (роль на объекте
              подставится автоматически)
            </p>
          </div>

          <div className="assign-grid-fields">
            <div className="form-field" ref={dropdownRef}>
              <label>Сотрудник (Email или UUID) *</label>
              <div className="autocomplete-field-wrapper">
                <input
                  type="text"
                  placeholder="Выберите прораба или инженера..."
                  value={userInputValue}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => {
                    setUserInputValue(e.target.value);
                    setSelectedUserId("");
                    setIsDropdownOpen(true);
                  }}
                  required
                />

                {isDropdownOpen && eligibleUsers.length > 0 && (
                  <div className="autocomplete-dropdown">
                    {eligibleUsers.map((u) => (
                      <div
                        key={u.id}
                        className="autocomplete-item"
                        onClick={() => handleSelectUser(u)}
                      >
                        <div className="autocomplete-item-header">
                          <span className="autocomplete-user-email">
                            {u.email}
                          </span>
                          {(u.first_name || u.last_name) && (
                            <span className="autocomplete-user-name">
                              {u.first_name} {u.last_name}
                            </span>
                          )}
                        </div>
                        <span className="autocomplete-user-id">
                          Квалификация: {formatUserRoles(u.roles)} • ID:{" "}
                          {u.id.slice(0, 8)}...
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="form-field">
              <label>Роль на данном объекте *</label>
              <select
                value={assignRoleInProject}
                onChange={(e) => {
                  setAssignRoleInProject(e.target.value);
                  setSelectedUserId("");
                  setUserInputValue("");
                }}
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
                <option value="" disabled>
                  Объекты не найдены
                </option>
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
                {currentAssignments.map((a) => {
                  const matchedUser = dbUsers.find((u) => u.id === a.user_id);
                  return (
                    <span key={a.id} className="assignment-item-tag">
                      <strong>
                        {ROLE_LABELS[a.role_in_project] || a.role_in_project}:
                      </strong>
                      <code>
                        {matchedUser
                          ? `${matchedUser.email} (${matchedUser.first_name} ${matchedUser.last_name})`
                          : `${a.user_id.slice(0, 8)}...`}
                      </code>
                      <button
                        type="button"
                        className="btn-unassign-chip"
                        title="Отозвать сотрудника с объекта"
                        onClick={() => handleRemoveAssignment(a.id)}
                      >
                        <CloseIcon className="ui-icon-xs" />
                      </button>
                    </span>
                  );
                })}
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