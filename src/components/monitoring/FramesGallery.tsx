import React, { useState } from "react";
import {
  useGetProjectFramesQuery,
  useUploadCameraFrameMutation,
  useMarkFrameAsEvidenceMutation,
  useGetCamerasQuery,
  extractApiError,
} from "../../api/rtkApi";
import { FrameItemResponse } from "../../api/apiEngineer";
import { ReactComponent as CameraIcon } from "../../assets/images/Camera.svg";
import { ReactComponent as CheckIcon } from "../../assets/images/Circle_Check.svg";
import { ReactComponent as CloseIcon } from "../../assets/images/Close_MD.svg";
import "../../styles/FramesGallery.css";

const TECH_TRANSLATION: Record<string, string> = {
  excavator: "Экскаватор",
  dump_truck: "Самосвал",
  bulldozer: "Бульдозер",
  road_roller: "Дорожный каток",
  front_loader: "Фронтальный погрузчик",
  concrete_mixer: "Автобетоносмеситель",
  truck: "Грузовик",
  mobile_crane: "Автокран",
  tower_crane: "Башенный кран",
  loader_crane: "Кран-манипулятор",
  concrete_pump: "Бетононасос",
  skid_steer_loader: "Мини-погрузчик",
  backhoe_loader: "Экскаватор-погрузчик",
  drilling_rig: "Буровая установка",
  pump_truck: "Автобетононасос",
};

interface FramesGalleryProps {
  projectId: string;
}

export const FramesGallery: React.FC<FramesGalleryProps> = ({ projectId }) => {
  const [selectedFrame, setSelectedFrame] = useState<FrameItemResponse | null>(
    null,
  );
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  }>({ width: 1280, height: 720 });

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const { data: frames = [], isLoading } = useGetProjectFramesQuery(
    { projectId, limit: 30 },
    { pollingInterval: 4000 },
  );
  const { data: cameras = [] } = useGetCamerasQuery(projectId);

  const [uploadFrame, { isLoading: isUploading }] =
    useUploadCameraFrameMutation();
  const [markEvidence] = useMarkFrameAsEvidenceMutation();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (cameras.length === 0) {
      setMessage({
        type: "error",
        text: "Сначала подключите хотя бы одну камеру к объекту",
      });
      return;
    }

    try {
      setMessage(null);
      await uploadFrame({
        cameraId: cameras[0].id,
        projectId,
        file,
      }).unwrap();
      setMessage({
        type: "success",
        text: "Снимок отправлен на распознавание",
      });
    } catch (err: any) {
      setMessage({
        type: "error",
        text: extractApiError(err, "Ошибка загрузки снимка"),
      });
    }
  };

  const handleToggleEvidence = async (frame: FrameItemResponse) => {
    const nextState = !frame.is_saved_for_report;
    try {
      await markEvidence({
        frameId: frame.id,
        projectId,
        isSaved: nextState,
      }).unwrap();

      if (selectedFrame?.id === frame.id) {
        setSelectedFrame({ ...selectedFrame, is_saved_for_report: nextState });
      }
      setMessage({
        type: "success",
        text: nextState ? "Кадр зафиксирован как улика" : "Статус улики снят",
      });
    } catch (err: any) {
      setMessage({
        type: "error",
        text: extractApiError(err, "Ошибка изменения статуса улики"),
      });
    }
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setImageDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    }
  };

  const parseDetections = (
    det: any,
  ): { label: string; bbox?: number[]; conf?: number }[] => {
    if (!det) return [];

    if (Array.isArray(det)) {
      return det.map((d: any) => ({
        label: TECH_TRANSLATION[d.class?.toLowerCase()] || d.class || "Техника",
        bbox: d.bbox,
        conf: d.confidence ? Math.round(d.confidence * 100) : undefined,
      }));
    }

    if (Array.isArray(det.classes)) {
      return det.classes.map((c: string, idx: number) => ({
        label: TECH_TRANSLATION[c?.toLowerCase()] || c,
        bbox: det.boxes?.[idx],
      }));
    }

    return Object.entries(det).map(([k, v]) => ({
      label: `${TECH_TRANSLATION[k.toLowerCase()] || k}: ${v} шт.`,
    }));
  };

  const formatSummaryString = (det: any): string => {
    const items = parseDetections(det);
    if (items.length === 0) return "Техника не обнаружена";
    return items
      .map((i) => (i.conf ? `${i.label} (${i.conf}%)` : i.label))
      .join(", ");
  };

  const selectedDetections = selectedFrame
    ? parseDetections(selectedFrame.detection_result)
    : [];

  return (
    <div className="frames-gallery-wrapper">
      <div className="frames-gallery-top">
        <span className="frames-gallery-count-title">
          Снимки видеофиксации ({frames.length})
        </span>

        <label className="upload-frame-btn-label">
          <CameraIcon className="btn-icon-svg btn-icon-white" />
          <span>
            {isUploading ? "Обработка..." : "Загрузить снимок вручную"}
          </span>
          <input
            type="file"
            accept="image/*"
            className="upload-frame-input-hidden"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
        </label>
      </div>

      {message && (
        <div
          className={`gantt-msg-banner ${
            message.type === "success" ? "msg-success" : "msg-error"
          }`}
        >
          {message.text}
        </div>
      )}

      {isLoading ? (
        <p className="metric-subtext">Синхронизация галереи кадров...</p>
      ) : frames.length === 0 ? (
        <div className="camera-empty-box">
          <p>Кадров с камер пока не поступало</p>
          <small>
            Кадры автоматически фиксируются воркером видеоаналитики каждые
            несколько секунд.
          </small>
        </div>
      ) : (
        <div className="frames-grid">
          {frames.map((frame) => (
            <div
              key={frame.id}
              className={`frame-card ${
                frame.is_saved_for_report ? "evidence-marked" : ""
              }`}
              onClick={() => setSelectedFrame(frame)}
            >
              <div className="frame-img-box">
                <img
                  src={frame.image_url || frame.image_path}
                  alt="Кадр стройплощадки"
                  className="frame-img-preview"
                />
                <span className="frame-card-badge">
                  {new Date(frame.captured_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                {frame.is_saved_for_report && (
                  <span className="frame-evidence-pill">Улика</span>
                )}
              </div>

              <div className="frame-card-info">
                <span className="frame-date-txt">
                  {new Date(frame.captured_at).toLocaleDateString("ru-RU")}
                </span>
                <span
                  className="frame-detected-txt"
                  title={formatSummaryString(frame.detection_result)}
                >
                  {formatSummaryString(frame.detection_result)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedFrame && (
        <div
          className="frame-modal-overlay"
          onClick={() => setSelectedFrame(null)}
        >
          <div
            className="frame-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="frame-modal-header">
              <h3>Кадр детекции #{selectedFrame.id.slice(0, 8)}</h3>
              <button
                type="button"
                className="btn-unassign-chip"
                onClick={() => setSelectedFrame(null)}
              >
                <CloseIcon className="ui-icon-xs" />
              </button>
            </div>

            <div className="frame-view-stage">
              <img
                src={selectedFrame.image_url || selectedFrame.image_path}
                alt="Полный снимок объекта"
                className="frame-view-img"
                onLoad={handleImageLoad}
              />

              <svg
                className="frame-bbox-svg-overlay"
                viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
                preserveAspectRatio="none"
              >
                {selectedDetections.map(
                  (d, i) =>
                    d.bbox &&
                    d.bbox.length === 4 && (
                      <g key={i}>
                        <rect
                          x={d.bbox[0]}
                          y={d.bbox[1]}
                          width={d.bbox[2] - d.bbox[0]}
                          height={d.bbox[3] - d.bbox[1]}
                          className="bbox-rect"
                        />
                        <text
                          x={d.bbox[0] + 6}
                          y={Math.max(d.bbox[1] - 8, 22)}
                          className="bbox-text"
                        >
                          {d.label} {d.conf ? `${d.conf}%` : ""}
                        </text>
                      </g>
                    ),
                )}
              </svg>
            </div>

            <div className="engineer-form-field">
              <label>Обнаруженная техника на кадре:</label>
              <p className="frame-modal-summary-text">
                {formatSummaryString(selectedFrame.detection_result)}
              </p>
            </div>

            <div className="frame-modal-actions">
              <button
                type="button"
                className={`btn-toggle-evidence ${
                  selectedFrame.is_saved_for_report
                    ? "is-evidence"
                    : "not-evidence"
                }`}
                onClick={() => handleToggleEvidence(selectedFrame)}
              >
                {selectedFrame.is_saved_for_report ? (
                  <span>Снять статус улики</span>
                ) : (
                  <>
                    <CheckIcon className="btn-icon-svg" />
                    <span>Зафиксировать как улику</span>
                  </>
                )}
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
