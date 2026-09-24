import React, { useEffect, useState } from "react";

import { useAuthFetch } from "../../hooks/useAuthFetch";
import {
  createProject,
  getProjectTypes,
  ProjectType,
} from "../../api/apiAdmin";

const CreateOks = () => {
  const authFetch = useAuthFetch();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [typeId, setTypeId] = useState("");

  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadProjectTypes = async () => {
      setIsLoadingTypes(true);
      setErrorMessage("");

      try {
        const result = await getProjectTypes(authFetch);

        setProjectTypes(result.filter((type) => type.is_active));
      } catch (error) {
        if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Не удалось загрузить типы объектов");
        }
      } finally {
        setIsLoadingTypes(false);
      }
    };

    loadProjectTypes();
  }, [authFetch]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSuccessMessage("");
    setErrorMessage("");
    setIsLoading(true);

    try {
      await createProject(authFetch, {
        name,
        address,
        type_id: typeId,
      });

      setSuccessMessage("ОКС успешно создан");

      setName("");
      setAddress("");
      setTypeId("");
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Не удалось создать ОКС");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="admin-container">
      <div className="admin-card-header">
        <h1>Создание объекта</h1>

        <p>Создайте объект капитального строительства.</p>
      </div>

      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="oks-name">Наименование объекта</label>

          <input
            id="oks-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Введите наименование объекта"
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="oks-address">Адрес объекта</label>

          <input
            id="oks-address"
            type="text"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Введите адрес объекта"
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="oks-type">Тип объекта</label>

          <select
            id="oks-type"
            value={typeId}
            onChange={(event) => setTypeId(event.target.value)}
            disabled={isLoadingTypes}
            required
          >
            <option value="">
              {isLoadingTypes ? "Загрузка типов..." : "Выберите тип объекта"}
            </option>

            {projectTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="admin-primary-button"
          disabled={isLoading || isLoadingTypes}
        >
          {isLoading ? "Создание..." : "Создать ОКС"}
        </button>

        {successMessage && (
          <div className="admin-success-message">{successMessage}</div>
        )}

        {errorMessage && (
          <div className="admin-error-message">{errorMessage}</div>
        )}
      </form>
    </section>
  );
};

export default CreateOks;
