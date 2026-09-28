import React, { useState, useEffect, useCallback } from "react";
import { monitoringApi, CameraItem } from "../../api/monitoringApi";
import cameraIcon from "../../assets/images/Camera.svg";
import trashIcon from "../../assets/images/Trash_Full.svg";
import closeIcon from "../../assets/images/Close_MD.svg";
import "../../styles/CameraModal.css";

interface Props {
  projectId: string;
  onClose: () => void;
}

export const CameraManagerModal: React.FC<Props> = ({ projectId, onClose }) => {
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [newStreamUrl, setNewStreamUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  const loadCameras = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await monitoringApi.getCameras(projectId);
      setCameras(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setErrorText(err.message || "Ошибка загрузки списка видеокамер");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadCameras();
  }, [loadCameras]);

  const handleAddCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStreamUrl.trim()) {
      setErrorText("Укажите RTSP-ссылку или URL видеопотока");
      return;
    }

    setIsSubmitting(true);
    setErrorText("");
    setSuccessText("");

    try {
      await monitoringApi.addCamera(projectId, newStreamUrl.trim());
      setNewStreamUrl("");
      setSuccessText("Камера успешно подключена и передана в контур мониторинга");
      await loadCameras();
    } catch (err: any) {
      setErrorText(err.message || "Не удалось добавить камеру");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (camera: CameraItem) => {
    setErrorText("");
    setSuccessText("");
    try {
      await monitoringApi.toggleCameraActive(camera.id, !camera.is_active);
      await loadCameras();
    } catch (err: any) {
      setErrorText(err.message || "Ошибка изменения активности камеры");
    }
  };

  const handleDeleteCamera = async (cameraId: string) => {
    if (!window.confirm("Удалить эту камеру со стройплощадки? Детекция по ней будет прекращена.")) {
      return;
    }
    setErrorText("");
    setSuccessText("");
    try {
      await monitoringApi.deleteCamera(cameraId);
      setSuccessText("Камера удалена из системы");
      await loadCameras();
    } catch (err: any) {
      setErrorText(err.message || "Ошибка удаления камеры");
    }
  };

  return (
    <div className="camera-modal-overlay" onClick={onClose}>
      <div className="camera-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="camera-modal-header">
          <div className="camera-modal-header-info">
            <img src={cameraIcon} alt="" className="camera-modal-header-icon" />
            <div>
              <h3>Видеонаблюдение стройплощадки</h3>
              <p>Подключение RTSP / HTTP видеопотоков для нейросетевого мониторинга техники</p>
            </div>
          </div>
          <button
            type="button"
            className="camera-modal-close-btn"
            onClick={onClose}
            title="Закрыть окно"
          >
            <img src={closeIcon} alt="Закрыть" className="ui-icon-sm" />
          </button>
        </div>

        <div className="camera-modal-body">
          {errorText && <div className="camera-modal-alert error">{errorText}</div>}
          {successText && <div className="camera-modal-alert success">{successText}</div>}

          {/* Форма подключения новой камеры */}
          <form onSubmit={handleAddCamera} className="camera-add-card">
            <label htmlFor="camera-stream-input" className="camera-add-card-label">
              Подключить новую видеокамеру
            </label>

            <div className="camera-input-row">
              <input
                id="camera-stream-input"
                type="text"
                placeholder="rtsp://admin:pass@192.168.1.100:554/live/ch0 или http://..."
                value={newStreamUrl}
                onChange={(e) => setNewStreamUrl(e.target.value)}
                disabled={isSubmitting}
                className="camera-url-input"
                required
              />
              <button
                type="submit"
                className="camera-add-submit-btn"
                disabled={isSubmitting || !newStreamUrl.trim()}
              >
                {isSubmitting ? "Подключение..." : "+ Подключить"}
              </button>
            </div>

            <div className="camera-hints-row">
              <span>Быстрый протокол:</span>
              <span className="camera-hint-chip" onClick={() => setNewStreamUrl("rtsp://")}>
                rtsp://
              </span>
              <span className="camera-hint-chip" onClick={() => setNewStreamUrl("http://")}>
                http://
              </span>
              <span className="camera-hint-chip" onClick={() => setNewStreamUrl("https://")}>
                https://
              </span>
            </div>
          </form>

          {/* Список подключенных камер */}
          <div className="camera-list-section">
            <div className="camera-list-header">
              <span className="camera-list-title">Камеры на объекте ({cameras.length})</span>
              <span className="camera-online-badge">
                В сети: {cameras.filter((c) => c.is_active).length} из {cameras.length}
              </span>
            </div>

            {isLoading ? (
              <div className="camera-empty-box">Синхронизация камер объекта...</div>
            ) : cameras.length === 0 ? (
              <div className="camera-empty-box">
                <img src={cameraIcon} alt="" className="camera-empty-icon-svg" />
                <p>На этой стройплощадке пока нет подключенных камер.</p>
                <small>Вставьте RTSP-ссылку выше, чтобы запустить фиксацию техники.</small>
              </div>
            ) : (
              cameras.map((cam, idx) => (
                <div
                  key={cam.id}
                  className={`camera-item-card ${cam.is_active ? "online" : "offline"}`}
                >
                  <div className="camera-item-top">
                    <div className="camera-status-group">
                      <span className="camera-number-tag">Камера #{idx + 1}</span>
                      <span className={`camera-badge-pill ${cam.is_active ? "on" : "off"}`}>
                        {cam.is_active ? "В сети (ON)" : "Отключена"}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="camera-delete-btn"
                      title="Удалить камеру со стройки"
                      onClick={() => handleDeleteCamera(cam.id)}
                    >
                      <img src={trashIcon} alt="Удалить" className="ui-icon-trash" />
                    </button>
                  </div>

                  <div className="camera-url-box" title={cam.stream_url}>
                    <code>{cam.stream_url}</code>
                  </div>

                  <div className="camera-item-bottom">
                    <span className="camera-date-text">
                      Подключена: {new Date(cam.created_at).toLocaleDateString("ru-RU")}
                    </span>

                    <button
                      type="button"
                      className={`camera-toggle-btn ${cam.is_active ? "btn-stop" : "btn-start"}`}
                      onClick={() => handleToggleActive(cam)}
                    >
                      {cam.is_active ? "Приостановить" : "Активировать"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="camera-modal-footer">
          <button type="button" className="camera-modal-close-action" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};