import React, { useEffect, useState } from "react";
import { useAuthFetch } from "../../hooks/useAuthFetch";
import {
  createProject,
  getProjectTypes,
  ProjectType,
} from "../../api/apiAdmin";

interface CreateOksProps {
  onSuccess?: () => void;
}

const MAX_NAME_LENGTH = 100;
const MAX_ADDRESS_LENGTH = 160;

const CreateOks: React.FC<CreateOksProps> = ({ onSuccess }) => {
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
        const activeTypes = result.filter((type) => type.is_active);
        setProjectTypes(activeTypes);

        if (activeTypes.length > 0) {
          setTypeId(activeTypes[0].id);
        }
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

    const trimmedName = name.trim();
    const trimmedAddress = address.trim();

    if (!trimmedName || !trimmedAddress || !typeId) {
      setErrorMessage("Пожалуйста, заполните все обязательные поля");
      return;
    }

    if (trimmedName.length > MAX_NAME_LENGTH) {
      setErrorMessage(`Название объекта не должно превышать ${MAX_NAME_LENGTH} символов`);
      return;
    }

    if (trimmedAddress.length > MAX_ADDRESS_LENGTH) {
      setErrorMessage(`Адрес объекта не должен превышать ${MAX_ADDRESS_LENGTH} символов`);
      return;
    }

    setSuccessMessage("");
    setErrorMessage("");
    setIsLoading(true);

    try {
      await createProject(authFetch, {
        name: trimmedName,
        address: trimmedAddress,
        type_id: typeId,
      });

      setSuccessMessage("ОКС успешно создан");

      setName("");
      setAddress("");
      if (projectTypes.length > 0) {
        setTypeId(projectTypes[0].id);
      }

      if (onSuccess) {
        onSuccess();
      }
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
        <p>Создайте объект капитального строительства (ОКС).</p>
      </div>

      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <label htmlFor="oks-name">Наименование объекта *</label>
            <span style={{ fontSize: "11px", color: name.length >= MAX_NAME_LENGTH ? "#dc2626" : "#64748b" }}>
              {name.length}/{MAX_NAME_LENGTH}
            </span>
          </div>
          <input
            id="oks-name"
            type="text"
            maxLength={MAX_NAME_LENGTH}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Введите наименование объекта (до 100 симв.)"
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-field">
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <label htmlFor="oks-address">Адрес объекта *</label>
            <span style={{ fontSize: "11px", color: address.length >= MAX_ADDRESS_LENGTH ? "#dc2626" : "#64748b" }}>
              {address.length}/{MAX_ADDRESS_LENGTH}
            </span>
          </div>
          <input
            id="oks-address"
            type="text"
            maxLength={MAX_ADDRESS_LENGTH}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Введите адрес объекта (до 160 симв.)"
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-field">
          <label htmlFor="oks-type">Тип объекта капитального строительства *</label>
          <select
            id="oks-type"
            value={typeId}
            onChange={(event) => setTypeId(event.target.value)}
            disabled={isLoadingTypes || isLoading}
            required
          >
            <option value="">
              {isLoadingTypes ? "Загрузка типов..." : "Выберите тип объекта"}
            </option>

            {projectTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name} ({type.code})
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