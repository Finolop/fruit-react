import React, { useState, useEffect, useCallback } from "react";
import { monitoringApi, CameraItem } from "../../api/monitoringApi";
import "../../styles/EngineerPage.css";
import "../../styles/ForemanGantt.css";

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
      setSuccessText("Камера успешно подключена к стройплощадке");
      await loadCameras();
    } catch (err: any) {
      setErrorText(err.message || "Не удалось добавить камеру");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (camera: CameraItem) => {
    setErrorText("");
    try {
      await monitoringApi.toggleCameraActive(camera.id, !camera.is_active);
      await loadCameras();
    } catch (err: any) {
      setErrorText(err.message || "Ошибка переключения статуса камеры");
    }
  };

  const handleDeleteCamera = async (cameraId: string) => {
    if (!window.confirm("Вы действительно хотите удалить эту камеру со стройплощадки?")) {
      return;
    }
    setErrorText("");
    try {
      await monitoringApi.deleteCamera(cameraId);
      await loadCameras();
    } catch (err: any) {
      setErrorText(err.message || "Ошибка удаления камеры");
    }
  };

  return (
    <div className="engineer-modal-overlay">
      <div className="engineer-modal-card">
        <div className="engineer-modal-header">
          <h2>Видеонаблюдение стройплощадки</h2>
          <p>Подключение RTSP-камер для нейросетевого мониторинга техники</p>
        </div>

        {errorText && <div className="gantt-msg-banner msg-error">{errorText}</div>}
        {successText && <div className="gantt-msg-banner msg-success">{successText}</div>}

        {/* Форма добавления новой камеры */}
        <form onSubmit={handleAddCamera}>
          <div className="engineer-form-field">
            <label>URL видеопотока (RTSP / HLS / HTTP)</label>
            <input
              type="text"
              placeholder="rtsp://admin:pass@192.168.1.100:554/live/ch0"
              value={newStreamUrl}
              onChange={(e) => setNewStreamUrl(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-submit-action"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Подключение..." : "+ Подключить видеокамеру"}
          </button>
        </form>

        <hr className="role-section-divider" style={{ margin: "20px 0" }} />

        {/* Список подключенных камер */}
        <div className="engineer-form-field">
          <label>Подключенные камеры объекта ({cameras.length})</label>
          {isLoading ? (
            <p className="metric-subtext">Загрузка камер...</p>
          ) : cameras.length === 0 ? (
            <p className="metric-subtext">На объекте пока не установлено ни одной камеры</p>
          ) : (
            <div className="report-links-list">
              {cameras.map((cam, idx) => (
                <div key={cam.id} className="violation-row">
                  <div className="user-info">
                    <span className="user-name">
                      Камера #{idx + 1} {cam.is_active ? "🟢 В сети" : "⚪ Отключена"}
                    </span>
                    <span className="user-id">{cam.stream_url}</span>
                  </div>

                  <div className="table-actions-cell">
                    <button
                      type="button"
                      className="role-edit-button"
                      onClick={() => handleToggleActive(cam)}
                    >
                      {cam.is_active ? "Отключить" : "Включить"}
                    </button>
                    <button
                      type="button"
                      className="btn-unassign-chip"
                      title="Удалить камеру"
                      onClick={() => handleDeleteCamera(cam.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="engineer-modal-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};