import React, { useState } from "react";
import { CameraItem } from "../../api/monitoringApi";
import {
  useGetCamerasQuery,
  useAddCameraMutation,
  useToggleCameraActiveMutation,
  useDeleteCameraMutation,
} from "../../api/rtkApi";
import { FramesGallery } from "../monitoring/FramesGallery";
import { ReactComponent as CameraIcon } from "../../assets/images/Camera.svg";
import { ReactComponent as TrashIcon } from "../../assets/images/Trash_Full.svg";
import { ReactComponent as CloseIcon } from "../../assets/images/Close_MD.svg";
import { ReactComponent as LockIcon } from "../../assets/images/Lock.svg";
import "../../styles/CameraModal.css";

interface Props {
  projectId: string;
  onClose: () => void;
  isReadOnly?: boolean;
}

export const CameraManagerModal: React.FC<Props> = ({
  projectId,
  onClose,
  isReadOnly = false,
}) => {
  const [activeTab, setActiveTab] = useState<"CAMERAS" | "GALLERY">("CAMERAS");
  const [newStreamUrl, setNewStreamUrl] = useState("");
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  const { data: cameras = [], isLoading } = useGetCamerasQuery(projectId);
  const [addCamera, { isLoading: isAdding }] = useAddCameraMutation();
  const [toggleCameraActive] = useToggleCameraActiveMutation();
  const [deleteCamera] = useDeleteCameraMutation();

  const handleAddCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    if (!newStreamUrl.trim()) {
      setErrorText("Укажите RTSP-ссылку или URL видеопотока");
      return;
    }

    setErrorText("");
    setSuccessText("");

    try {
      await addCamera({
        projectId,
        streamUrl: newStreamUrl.trim(),
      }).unwrap();

      setNewStreamUrl("");
      setSuccessText(
        "Камера успешно подключена и передана в контур видеоаналитики",
      );
    } catch (err: any) {
      setErrorText(
        err?.data?.detail || err?.message || "Не удалось добавить камеру",
      );
    }
  };

  const handleToggleActive = async (camera: CameraItem) => {
    if (isReadOnly) return;
    setErrorText("");
    setSuccessText("");
    try {
      await toggleCameraActive({
        cameraId: camera.id,
        projectId,
        isActive: !camera.is_active,
      }).unwrap();
    } catch (err: any) {
      setErrorText(
        err?.data?.detail ||
          err?.message ||
          "Ошибка изменения активности камеры",
      );
    }
  };

  const handleDeleteCamera = async (cameraId: string) => {
    if (isReadOnly) return;
    if (
      !window.confirm(
        "Удалить эту камеру со стройплощадки? Детекция техники будет остановлена.",
      )
    )
      return;
    setErrorText("");
    setSuccessText("");
    try {
      await deleteCamera({ cameraId, projectId }).unwrap();
      setSuccessText("Камера удалена из системы");
    } catch (err: any) {
      setErrorText(
        err?.data?.detail || err?.message || "Ошибка удаления камеры",
      );
    }
  };

  return (
    <div className="camera-modal-overlay" onClick={onClose}>
      <div
        className="camera-modal-card"
        style={{ maxWidth: activeTab === "GALLERY" ? "980px" : "680px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="camera-modal-header">
          <div className="camera-modal-header-info">
            <CameraIcon className="camera-modal-header-icon" />
            <div>
              <h3>Видеомониторинг стройплощадки</h3>
              <p>Управление камерами и галерея детекции техники нейросетью</p>
            </div>
          </div>
          <button
            type="button"
            className="camera-modal-close-btn"
            onClick={onClose}
            title="Закрыть окно"
          >
            <CloseIcon className="ui-icon-sm" />
          </button>
        </div>

        {/* Навигация по вкладкам */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            padding: "12px 24px 0",
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("CAMERAS")}
            style={{
              padding: "10px 18px",
              fontSize: "13px",
              fontWeight: 600,
              border: "none",
              borderBottom:
                activeTab === "CAMERAS"
                  ? "2px solid #e53935"
                  : "2px solid transparent",
              color: activeTab === "CAMERAS" ? "#e53935" : "#64748b",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            📹 Видеокамеры ({cameras.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("GALLERY")}
            style={{
              padding: "10px 18px",
              fontSize: "13px",
              fontWeight: 600,
              border: "none",
              borderBottom:
                activeTab === "GALLERY"
                  ? "2px solid #e53935"
                  : "2px solid transparent",
              color: activeTab === "GALLERY" ? "#e53935" : "#64748b",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            🖼 Снимки детекции нейросети
          </button>
        </div>

        <div className="camera-modal-body">
          {isReadOnly && (
            <div className="camera-modal-readonly-note">
              <LockIcon className="btn-icon-svg" />
              <span>
                <strong>Режим наблюдателя (Департамент):</strong> управление
                видеокамерами и отметка улик доступны инженеру технадзора и
                прорабу объекта.
              </span>
            </div>
          )}

          {errorText && (
            <div className="camera-modal-alert error">{errorText}</div>
          )}
          {successText && (
            <div className="camera-modal-alert success">{successText}</div>
          )}

          {activeTab === "GALLERY" ? (
            <FramesGallery projectId={projectId} />
          ) : (
            <>
              {!isReadOnly && (
                <form onSubmit={handleAddCamera} className="camera-add-card">
                  <label
                    htmlFor="camera-stream-input"
                    className="camera-add-card-label"
                  >
                    Подключить новую видеокамеру к нейросети
                  </label>
                  <div className="camera-input-row">
                    <input
                      id="camera-stream-input"
                      type="text"
                      placeholder="rtsp://... или http://mock_camera:8081/frame.jpg"
                      value={newStreamUrl}
                      onChange={(e) => setNewStreamUrl(e.target.value)}
                      disabled={isAdding}
                      className="camera-url-input"
                      required
                    />
                    <button
                      type="submit"
                      className="camera-add-submit-btn"
                      disabled={isAdding || !newStreamUrl.trim()}
                    >
                      {isAdding ? "Подключение..." : "+ Подключить"}
                    </button>
                  </div>
                  <div className="camera-hints-row">
                    <span>Быстрый протокол:</span>
                    <span
                      className="camera-hint-chip"
                      onClick={() =>
                        setNewStreamUrl("http://mock_camera:8081/frame.jpg")
                      }
                    >
                      Эмулятор (MockServer)
                    </span>
                    <span
                      className="camera-hint-chip"
                      onClick={() => setNewStreamUrl("rtsp://")}
                    >
                      rtsp://
                    </span>
                    <span
                      className="camera-hint-chip"
                      onClick={() => setNewStreamUrl("http://")}
                    >
                      http://
                    </span>
                  </div>
                </form>
              )}

              <div className="camera-list-section">
                <div className="camera-list-header">
                  <span className="camera-list-title">
                    Камеры на объекте ({cameras.length})
                  </span>
                  <span className="camera-online-badge">
                    В сети: {cameras.filter((c) => c.is_active).length} из{" "}
                    {cameras.length}
                  </span>
                </div>

                {isLoading ? (
                  <div className="camera-empty-box">
                    Синхронизация камер объекта...
                  </div>
                ) : cameras.length === 0 ? (
                  <div className="camera-empty-box">
                    <CameraIcon className="camera-empty-icon-svg" />
                    <p>На этой стройплощадке пока нет подключенных камер.</p>
                    <small>
                      {isReadOnly
                        ? "Видеокамеры пока не подключены."
                        : "Вставьте RTSP/HTTP ссылку выше для запуска детекции техники."}
                    </small>
                  </div>
                ) : (
                  cameras.map((cam, idx) => (
                    <div
                      key={cam.id}
                      className={`camera-item-card ${cam.is_active ? "online" : "offline"}`}
                    >
                      <div className="camera-item-top">
                        <div className="camera-status-group">
                          <span className="camera-number-tag">
                            Камера #{idx + 1}
                          </span>
                          <span
                            className={`camera-badge-pill ${cam.is_active ? "on" : "off"}`}
                          >
                            {cam.is_active ? "В сети (ON)" : "Отключена"}
                          </span>
                        </div>
                        {!isReadOnly && (
                          <button
                            type="button"
                            className="camera-delete-btn"
                            title="Удалить камеру"
                            onClick={() => handleDeleteCamera(cam.id)}
                          >
                            <TrashIcon className="ui-icon-trash" />
                          </button>
                        )}
                      </div>
                      <div className="camera-url-box" title={cam.stream_url}>
                        <code>{cam.stream_url}</code>
                      </div>
                      <div className="camera-item-bottom">
                        <span className="camera-date-text">
                          Подключена:{" "}
                          {new Date(cam.created_at).toLocaleDateString("ru-RU")}
                        </span>
                        {!isReadOnly && (
                          <button
                            type="button"
                            className={`camera-toggle-btn ${cam.is_active ? "btn-stop" : "btn-start"}`}
                            onClick={() => handleToggleActive(cam)}
                          >
                            {cam.is_active ? "Приостановить" : "Активировать"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div className="camera-modal-footer">
          <button
            type="button"
            className="camera-modal-close-action"
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
  