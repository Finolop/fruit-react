import React, { useEffect, useState, useMemo } from "react";
import {
  useGetProjectTypesQuery,
  useCreateProjectMutation,
  extractApiError,
} from "../../api/rtkApi";

interface CreateOksProps {
  onSuccess?: () => void;
}

const MAX_NAME_LENGTH = 100;
const MAX_ADDRESS_LENGTH = 160;

const CreateOks: React.FC<CreateOksProps> = ({ onSuccess }) => {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [typeId, setTypeId] = useState("");

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const {
    data: rawTypes = [],
    isLoading: isLoadingTypes,
    isError: isTypesError,
  } = useGetProjectTypesQuery();

  const [createProject, { isLoading }] = useCreateProjectMutation();

  const projectTypes = useMemo(
    () => rawTypes.filter((type) => type.is_active),
    [rawTypes],
  );

  useEffect(() => {
    if (projectTypes.length > 0 && !typeId) {
      setTypeId(projectTypes[0].id);
    }
  }, [projectTypes, typeId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedAddress = address.trim();

    if (!trimmedName || !trimmedAddress || !typeId) {
      setErrorMessage("Пожалуйста, заполните все обязательные поля");
      return;
    }

    if (trimmedName.length > MAX_NAME_LENGTH) {
      setErrorMessage(
        `Название объекта не должно превышать ${MAX_NAME_LENGTH} символов`,
      );
      return;
    }

    if (trimmedAddress.length > MAX_ADDRESS_LENGTH) {
      setErrorMessage(
        `Адрес объекта не должен превышать ${MAX_ADDRESS_LENGTH} символов`,
      );
      return;
    }

    setSuccessMessage("");
    setErrorMessage("");

    try {
      await createProject({
        name: trimmedName,
        address: trimmedAddress,
        type_id: typeId,
      }).unwrap();

      setSuccessMessage("ОКС успешно создан");
      setName("");
      setAddress("");
      if (projectTypes.length > 0) {
        setTypeId(projectTypes[0].id);
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMessage(extractApiError(err, "Не удалось создать ОКС"));
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
          <div className="form-label-row">
            <label htmlFor="oks-name">Наименование объекта *</label>
            <span
              className={`char-counter ${
                name.length >= MAX_NAME_LENGTH ? "limit-reached" : ""
              }`}
            >
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
          <div className="form-label-row">
            <label htmlFor="oks-address">Адрес объекта *</label>
            <span
              className={`char-counter ${
                address.length >= MAX_ADDRESS_LENGTH ? "limit-reached" : ""
              }`}
            >
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
          <label htmlFor="oks-type">
            Тип объекта капитального строительства *
          </label>
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

        {(errorMessage || isTypesError) && (
          <div className="admin-error-message">
            {errorMessage || "Не удалось загрузить типы объектов"}
          </div>
        )}
      </form>
    </section>
  );
};

export default CreateOks;