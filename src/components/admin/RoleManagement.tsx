import React, { useState } from "react";

const RoleManagement = () => {
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("");

    const handleSubmit = (
        event: React.FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        console.log({
            email,
            role,
        });
    };

    return (
        <div className="admin-container">
            <div className="admin-card-header">
                <h2>Выдача ролей</h2>

                <p>
                    Назначьте роль пользователю по email
                </p>
            </div>

            <form
                onSubmit={handleSubmit}
                className="admin-form"
            >
                <div className="form-field">
                    <label htmlFor="user-email">
                        Email пользователя
                    </label>

                    <input
                        id="user-email"
                        type="email"
                        value={email}
                        onChange={(event) =>
                            setEmail(event.target.value)
                        }
                        placeholder="Введите email пользователя"
                    />
                </div>

                <div className="form-field">
                    <label htmlFor="user-role">
                        Роль
                    </label>

                    <select
                        id="user-role"
                        value={role}
                        onChange={(event) =>
                            setRole(event.target.value)
                        }
                    >
                        <option value="">
                            Выберите роль
                        </option>

                        <option value="engineer">
                            Инженер технадзора
                        </option>

                        <option value="foreman">
                            Ответственный прораб
                        </option>

                        <option value="department">
                            Департамент
                        </option>
                    </select>
                </div>

                <button
                    type="submit"
                    className="admin-primary-button"
                >
                    Выдать роль
                </button>
            </form>

            <div className="roles-table">
                <h3>Выданные роли</h3>

                <div className="roles-table-header">
                    <span>Email</span>
                    <span>Роль</span>
                </div>

                <div className="roles-table-row">
                    <span>Пока нет данных</span>
                    <span>—</span>
                </div>
            </div>
        </div>
    );
};

export default RoleManagement;