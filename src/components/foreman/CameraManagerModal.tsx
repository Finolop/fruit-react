import React, { useState, useEffect } from "react";
import { CameraItem } from "../../api/monitoringApi";
import {
  useGetCamerasQuery,
  useGetCameraSnapshotsQuery,
  useAddCameraMutation,
  useToggleCameraActiveMutation,
  useDeleteCameraMutation,
} from "../../api/rtkApi";
import { ReactComponent as CameraIcon } from "../../assets/images/Camera.svg";
import { ReactComponent as TrashIcon } from "../../assets/images/Trash_Full.svg";
import { ReactComponent as CloseIcon } from "../../assets/images/Close_MD.svg";
import { ReactComponent as LockIcon } from "../../assets/images/Lock.svg";
import { ReactComponent as DownloadFileIcon } from "../../assets/images/File_Download.svg";
import { ReactComponent as ExpandCornersIcon } from "../../assets/images/Expand.svg";

import "../../styles/CameraModal.css";

interface Props {
  projectId: string;
  onClose: () => void;
  isReadOnly?: boolean;
}

interface FullscreenImageData {
  title: string;
  url: string;
  src: string;
  detectedClasses: string[];
}

export const CameraManagerModal: React.FC<Props> = ({
  projectId,
  onClose,
  isReadOnly = false,
}) => {
  const [newStreamUrl, setNewStreamUrl] = useState("");
  // По умолчанию выключено
  const [showBBoxes, setShowBBoxes] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [activeFullscreenImage, setActiveFullscreenImage] =
    useState<FullscreenImageData | null>(null);

  const { data: cameras = [], isLoading } = useGetCamerasQuery(projectId);
  const { data: snapshots = [] } = useGetCameraSnapshotsQuery(projectId, {
    pollingInterval: 3000,
    skipPollingIfUnfocused: true,
  });

  const [addCamera, { isLoading: isAdding }] = useAddCameraMutation();
  const [toggleCameraActive] = useToggleCameraActiveMutation();
  const [deleteCamera] = useDeleteCameraMutation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveFullscreenImage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleDownload = () => {
    if (!activeFullscreenImage) return;
    const link = document.createElement("a");
    link.href = activeFullscreenImage.src;
    link.download = `${activeFullscreenImage.title.replace(/\s+/g, "_")}_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    if (!newStreamUrl.trim()) {
      setErrorText("Укажите ссылку на видеопоток");
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
      setSuccessText("Камера успешно подключена");
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
      <div className="camera-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="camera-modal-header">
          <div className="camera-modal-header-info">
            <CameraIcon className="camera-modal-header-icon" />
            <div>
              <h3>Видеомониторинг стройплощадки</h3>
              <p>Управление камерами и онлайн-кадры детекции техники</p>
            </div>
          </div>

          <div className="camera-header-right-actions">
            <label
              className="camera-switch-control"
              title="Переключить показ рамок нейросети"
            >
              <span className="camera-switch-label">Детекция техники</span>
              <span className="camera-switch-track">
                <input
                  type="checkbox"
                  checked={showBBoxes}
                  onChange={(e) => setShowBBoxes(e.target.checked)}
                />
                <span className="camera-switch-slider" />
              </span>
            </label>

            <button
              type="button"
              className="camera-modal-close-btn"
              onClick={onClose}
              title="Закрыть окно"
            >
              <CloseIcon className="ui-icon-sm" />
            </button>
          </div>
        </div>

        <div className="camera-modal-body">
          {isReadOnly && (
            <div className="camera-modal-readonly-note">
              <LockIcon className="btn-icon-svg" />
              <span>
                <strong>Режим наблюдателя (Департамент):</strong> управление
                видеокамерами доступно инженеру технадзора и прорабу объекта.
              </span>
            </div>
          )}

          {errorText && (
            <div className="camera-modal-alert error">{errorText}</div>
          )}
          {successText && (
            <div className="camera-modal-alert success">{successText}</div>
          )}

          {!isReadOnly && (
            <form onSubmit={handleAddCamera} className="camera-add-card">
              <label
                htmlFor="camera-stream-input"
                className="camera-add-card-label"
              >
                Подключить камеру
              </label>
              <div className="camera-input-row">
                <input
                  id="camera-stream-input"
                  type="text"
                  placeholder="https://..."
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
                    : "Вставьте ссылку выше для подключения потока."}
                </small>
              </div>
            ) : (
              <div className="camera-list-grid">
                {cameras.map((cam, idx) => {
                  const snap = snapshots.find((s) => s.camera_id === cam.id);
                  const imageSource = showBBoxes
                    ? snap?.annotated_image_base64 || snap?.raw_image_base64
                    : snap?.raw_image_base64 || snap?.annotated_image_base64;

                  const detectedClasses = snap?.detected_classes_ru || [];

                  return (
                    <div
                      key={cam.id}
                      className={`camera-item-card ${
                        cam.is_active ? "online" : "offline"
                      }`}
                    >
                      <div className="camera-item-top">
                        <div className="camera-status-group">
                          <span className="camera-number-tag">
                            Камера #{idx + 1}
                          </span>
                          <span
                            className={`camera-badge-pill ${
                              cam.is_active ? "on" : "off"
                            }`}
                          >
                            {cam.is_active ? "В сети (ON)" : "Отключена"}
                          </span>
                          {snap && snap.detection_count > 0 && (
                            <span className="camera-detected-count-badge">
                              Техники: {snap.detection_count} шт.
                            </span>
                          )}
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

                      {/* Область кадра с иконкой разворота */}
                      <div
                        className="camera-snapshot-preview-box"
                        onClick={() =>
                          imageSource &&
                          setActiveFullscreenImage({
                            title: `Камера #${idx + 1}`,
                            url: cam.stream_url,
                            src: imageSource,
                            detectedClasses,
                          })
                        }
                      >
                        {imageSource ? (
                          <>
                            <img
                              src={imageSource}
                              alt={`Кадр с камеры #${idx + 1}`}
                              className="camera-snapshot-preview-img"
                            />
                            <span className="camera-expand-indicator">
                              <ExpandCornersIcon className="camera-expand-icon" />
                              <span>Развернуть</span>
                            </span>
                          </>
                        ) : (
                          <div className="camera-no-signal-placeholder">
                            Нет сигнала / ожидание первого снимка
                          </div>
                        )}
                      </div>

                      {detectedClasses.length > 0 && (
                        <div className="camera-detected-list-row">
                          <span className="detected-label">В кадре:</span>
                          {detectedClasses.map((cls, cIdx) => (
                            <span key={cIdx} className="detected-class-chip">
                              {cls}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="camera-item-bottom">
                        <span className="camera-date-text">
                          {snap?.captured_at
                            ? `Снимок: ${new Date(
                                snap.captured_at,
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}`
                            : `Подключена: ${new Date(
                                cam.created_at,
                              ).toLocaleDateString("ru-RU")}`}
                        </span>
                        {!isReadOnly && (
                          <button
                            type="button"
                            className={`camera-toggle-btn ${
                              cam.is_active ? "btn-stop" : "btn-start"
                            }`}
                            onClick={() => handleToggleActive(cam)}
                          >
                            {cam.is_active ? "Приостановить" : "Активировать"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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

      {/* Полноэкранный Lightbox */}
      {activeFullscreenImage && (
        <div
          className="camera-fullscreen-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setActiveFullscreenImage(null);
          }}
        >
          <div className="camera-fullscreen-top-bar">
            <div className="camera-fullscreen-caption">
              <h4>{activeFullscreenImage.title}</h4>
              <span>{activeFullscreenImage.url}</span>
            </div>

            <div className="camera-fullscreen-actions">
              <button
                type="button"
                className="camera-fullscreen-download-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
                title="Скачать снимок на компьютер"
              >
                <DownloadFileIcon className="camera-fullscreen-download-icon" />
                <span>Скачать снимок</span>
              </button>

              <button
                type="button"
                className="camera-fullscreen-close-btn"
                onClick={() => setActiveFullscreenImage(null)}
                title="Закрыть во весь экран (Esc)"
              >
                <CloseIcon className="ui-icon-sm" />
              </button>
            </div>
          </div>

          <div
            className="camera-fullscreen-content"
            onClick={(e) => {
              e.stopPropagation();
              setActiveFullscreenImage(null);
            }}
          >
            <img
              src={activeFullscreenImage.src}
              alt="Полноэкранный снимок"
              className="camera-fullscreen-img"
            />

            {activeFullscreenImage.detectedClasses.length > 0 && (
              <div
                className="camera-fullscreen-footer"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="fullscreen-detected-label">
                  Обнаруженная техника:
                </span>
                {activeFullscreenImage.detectedClasses.map((cls, idx) => (
                  <span key={idx} className="fullscreen-class-chip">
                    {cls}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
