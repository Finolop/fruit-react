import React, { useCallback, useEffect, useState } from "react";

import { useAuthFetch } from "../../hooks/useAuthFetch";
import { getUsers, User } from "../../api/apiAdmin";

const ITEMS_PER_PAGE = 6;

const RoleManagement = () => {
  const authFetch = useAuthFetch();

  const [users, setUsers] = useState<User[]>([]);

  const [currentPage, setCurrentPage] = useState(1);

  const [isLoading, setIsLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const loadUsers = useCallback(
    async (page: number) => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const offset = (page - 1) * ITEMS_PER_PAGE;

        const result = await getUsers(authFetch, {
          limit: ITEMS_PER_PAGE,
          offset,
        });

        setUsers(result);
        setCurrentPage(page);
      } catch (error) {
        if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Не удалось загрузить пользователей");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [authFetch],
  );

  useEffect(() => {
    loadUsers(1);
  }, [loadUsers]);

  const handlePageChange = (page: number) => {
    if (page < 1) {
      return;
    }

    loadUsers(page);
  };

  const handleEdit = (user: User) => {
    console.log("Редактирование пользователя:", user);
  };

  return (
    <section className="admin-container">
      <div className="admin-card-header">
        <h2>Управление ролями</h2>

        <p>Управление ролями пользователей и привязанными ОКС.</p>
      </div>

      {errorMessage && (
        <div className="admin-error-message">{errorMessage}</div>
      )}

      <div className="roles-table-wrapper">
        <table className="roles-table">
          <thead>
            <tr>
              <th>ID пользователя</th>
              <th>ФИО / должность</th>
              <th>Текущая роль</th>
              <th>Привязанные ОКС</th>
              <th>Управление</th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="roles-table-loading">
                  Загрузка пользователей...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="roles-table-empty">
                  Пользователи не найдены
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const role = user.roles[0];

                return (
                  <tr key={user.id}>
                    <td>
                      <span className="user-id">{user.id}</span>
                    </td>

                    <td>
                      <div className="user-info">
                        <span className="user-name">
                          {user.first_name} {user.last_name}
                        </span>

                        <span className="user-position">{user.email}</span>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`role-badge ${
                          role === "engineer"
                            ? "role-engineer"
                            : role === "foreman"
                              ? "role-foreman"
                              : "role-department"
                        }`}
                      >
                        {role === "engineer"
                          ? "Инженер"
                          : role === "foreman"
                            ? "Прораб"
                            : role === "admin"
                              ? "Департамент"
                              : "Пользователь"}
                      </span>
                    </td>

                    <td>
                      <div className="oks-list">
                        <span className="oks-item">—</span>
                      </div>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="role-edit-button"
                        onClick={() => handleEdit(user)}
                      >
                        Редактировать
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="roles-pagination">
          <button
            type="button"
            className="pagination-button pagination-arrow"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
          >
            Назад
          </button>

          <button
            type="button"
            className={`pagination-button ${
              currentPage === 1 ? "pagination-active" : ""
            }`}
            onClick={() => handlePageChange(1)}
            disabled={isLoading}
          >
            1
          </button>

          <button
            type="button"
            className={`pagination-button ${
              currentPage === 2 ? "pagination-active" : ""
            }`}
            onClick={() => handlePageChange(2)}
            disabled={isLoading}
          >
            2
          </button>

          <button
            type="button"
            className={`pagination-button ${
              currentPage === 3 ? "pagination-active" : ""
            }`}
            onClick={() => handlePageChange(3)}
            disabled={isLoading}
          >
            3
          </button>

          <span className="pagination-dots">...</span>

          <button
            type="button"
            className={`pagination-button ${
              currentPage === 8 ? "pagination-active" : ""
            }`}
            onClick={() => handlePageChange(8)}
            disabled={isLoading}
          >
            8
          </button>

          <button
            type="button"
            className={`pagination-button ${
              currentPage === 9 ? "pagination-active" : ""
            }`}
            onClick={() => handlePageChange(9)}
            disabled={isLoading}
          >
            9
          </button>

          <button
            type="button"
            className={`pagination-button ${
              currentPage === 10 ? "pagination-active" : ""
            }`}
            onClick={() => handlePageChange(10)}
            disabled={isLoading}
          >
            10
          </button>

          <button
            type="button"
            className="pagination-button pagination-arrow"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={isLoading}
          >
            Вперед
          </button>
        </div>
      </div>
    </section>
  );
};

export default RoleManagement;
