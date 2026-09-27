import React, { useState, useEffect, useCallback, useRef } from "react";
import { getProjectFrames, uploadCameraFrame } from "../../api/api";
import { engineerApi, FrameItemResponse } from "../../api/apiEngineer";
import { monitoringApi, CameraItem } from "../../api/monitoringApi";
import "../../styles/FramesGallery.css";
import "../../styles/EngineerPage.css";

interface FramesGalleryProps {
  projectId: string;
}

export const FramesGallery: React.FC<FramesGalleryProps> = ({ projectId }) => {
  const [frames, setFrames] = useState<FrameItemResponse[]>([]);
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<FrameItemResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [framesData, camerasData] = await Promise.all([
        getProjectFrames(projectId, 30),
        monitoringApi.getCameras(projectId).catch(() => []),
      ]);
      setFrames(Array.isArray(framesData) ? framesData : []);
      setCameras(Array.isArray(camerasData) ? camerasData : []);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Ошибка загрузки галереи снимков" });
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Физическая загрузка кадра на сервер через input file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (cameras.length === 0) {
      setMessage({
        type: "error",
        text: "Для загрузки снимка необходимо предварительно добавить хотя бы одну камеру на стройку",
      });
      return;
    }

    const targetCameraId = cameras[0].id;
    setIsUploading(true);
    setMessage(null);

    try {
      await uploadCameraFrame(targetCameraId, file);
      setMessage({ type: "success", text: "Снимок площадки успешно загружен и отправлен на распознавание" });
      await loadData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Не удалось загрузить снимок" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Фиксация кадра как улики нарушения
  const handleToggleEvidence = async (frame: FrameItemResponse) => {
    const nextState = !frame.is_saved_for_report;
    try {
      await engineerApi.markFrameAsEvidence(frame.id, nextState);
      const updatedFrames = frames.map((f) =>
        f.id === frame.id ? { ...f, is_saved_for_report: nextState } : f
      );
      setFrames(updatedFrames);
      if (selectedFrame && selectedFrame.id === frame.id) {
        setSelectedFrame({ ...selectedFrame, is_saved_for_report: nextState });
      }
      setMessage({
        type: "success",
        text: nextState
          ? "Кадр зафиксирован как официальная улика нарушения"
          : "Статус улики снят",
      });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Ошибка изменения статуса улики" });
    }
  };

  const formatDetectedInfo = (det: Record<string, any>): string => {
    if (!det || Object.keys(det).length === 0) return "Нейросеть: техника не найдена";
    const entries = Object.entries(det);
    return entries.map(([key, val]) => `${key}: ${val}`).join(", ");
  };

  return (
    <div className="frames-gallery-container">
      <div className="frames-gallery-header">
        <h3 className="frames-gallery-title">
          Снимки видеомониторинга и детекция техники ({frames.length})
        </h3>

        <div className="frames-gallery-actions">
          <label className="upload-frame-btn-label">
            {isUploading ? "Загрузка..." : "📷 Загрузить кадр с камеры"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="upload-frame-input-hidden"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
          </label>
        </div>
      </div>

      {message && (
        <div className={`gantt-msg-banner ${message.type === "success" ? "msg-success" : "msg-error"}`}>
          {message.text}
        </div>
      )}

      {isLoading ? (
        <p className="metric-subtext">Синхронизация галереи кадров объекта...</p>
      ) : frames.length === 0 ? (
        <p className="metric-subtext">Снимков с камер видеофиксации пока нет</p>
      ) : (
        <div className="frames-grid">
          {frames.map((frame) => (
            <div
              key={frame.id}
              className={`frame-card ${frame.is_saved_for_report ? "evidence-marked" : ""}`}
              onClick={() => setSelectedFrame(frame)}
            >
              <div className="frame-img-box">
                <img
                  src={frame.image_url || frame.image_path}
                  alt="Кадр стройплощадки"
                  className="frame-img-preview"
                />
                <span className="frame-card-badge">
                  {new Date(frame.captured_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                {frame.is_saved_for_report && (
                  <span className="frame-evidence-pill">Улика</span>
                )}
              </div>

              <div className="frame-card-info">
                <span className="frame-date-txt">
                  {new Date(frame.captured_at).toLocaleDateString("ru-RU")}
                </span>
                <span className="frame-detected-txt">
                  {formatDetectedInfo(frame.detection_result)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модальное окно просмотра кадра и закрепления улики */}
      {selectedFrame && (
        <div className="frame-modal-overlay" onClick={() => setSelectedFrame(null)}>
          <div className="frame-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="frame-modal-header">
              <h3>Кадр видеофиксации #{selectedFrame.id.slice(0, 8)}</h3>
              <button
                type="button"
                className="btn-unassign-chip"
                onClick={() => setSelectedFrame(null)}
              >
                ✕
              </button>
            </div>

            <div className="frame-view-stage">
              <img
                src={selectedFrame.image_url || selectedFrame.image_path}
                alt="Полный снимок объекта"
                className="frame-view-img"
              />
            </div>

            <div className="engineer-form-field">
              <label>Результат детекции строительной техники (нейросеть):</label>
              <p className="meta-row-note">
                {formatDetectedInfo(selectedFrame.detection_result)}
              </p>
            </div>

            <div className="frame-modal-actions">
              <button
                type="button"
                className={`btn-toggle-evidence ${
                  selectedFrame.is_saved_for_report ? "is-evidence" : "not-evidence"
                }`}
                onClick={() => handleToggleEvidence(selectedFrame)}
              >
                {selectedFrame.is_saved_for_report
                  ? "✓ Снять статус юридической улики"
                  : "📌 Закрепить как улику нарушения"}
              </button>

              <button
                type="button"
                className="btn-cancel"
                onClick={() => setSelectedFrame(null)}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};