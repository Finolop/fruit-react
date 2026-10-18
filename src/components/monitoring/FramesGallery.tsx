import React, { useState } from "react";
import { useGetProjectFramesQuery } from "../../api/rtkApi";
import { FrameItemResponse } from "../../api/apiEngineer";
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
  const [selectedFrame, setSelectedFrame] = useState<FrameItemResponse | null>(null);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  }>({ width: 1280, height: 720 });

  const { data: frames = [], isLoading } = useGetProjectFramesQuery(
    { projectId, limit: 30 },
    { pollingInterval: 4000 },
  );

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
      </div>

      {isLoading ? (
        <p className="metric-subtext">Синхронизация галереи кадров...</p>
      ) : frames.length === 0 ? (
        <div className="camera-empty-box">
          <p>Кадров с камер пока не поступало</p>
          <small>
            Кадры автоматически фиксируются каждые несколько секунд.
          </small>
        </div>
      ) : (
        <div className="frames-grid">
          {frames.map((frame) => (
            <div
              key={frame.id}
              className="frame-card"
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
              <div className="frame-header-title-box">
                <h3>Кадр детекции #{selectedFrame.id.slice(0, 8)}</h3>
                {/* Тогл включения/выключения рамок ИИ */}
                <label className="bbox-toggle-label">
                  <input
                    type="checkbox"
                    checked={showBoundingBoxes}
                    onChange={(e) => setShowBoundingBoxes(e.target.checked)}
                  />
                  <span>Разметка ИИ</span>
                </label>
              </div>

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

              {showBoundingBoxes && (
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
              )}
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