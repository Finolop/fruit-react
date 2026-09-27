import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  ProjectData,
  EquipmentType,
  ScheduleItem,
} from "../../pages/foreman/ForemanPage";
import { fetchWithAuth } from "../../api/api";
import { monitoringApi } from "../../api/monitoringApi";
import { CameraManagerModal } from "./CameraManagerModal";
import { EarlyCompleteModal } from "../engineer/EarlyCompleteModal";
import "../../styles/ForemanGantt.css";

const API_URL = process.env.REACT_APP_API_URL || "";

const FALLBACK_EQUIPMENT_NAMES: Record<string, string> = {
  bulldozer: "Бульдозер",
  dump_truck: "Самосвал",
  excavator: "Экскаватор",
  mobile_crane: "Автокран",
  truck: "Бортовой грузовик",
  concrete_mixer: "Автобетоносмеситель",
  road_roller: "Каток",
  drilling_rig: "Буровая установка",
  pump_truck: "Автобетононасос",
};

interface ForemanObjectManagerProps {
  project: ProjectData;
  schedules: ScheduleItem[];
  equipmentTypes: EquipmentType[];
  reloadSchedules: () => Promise<void>;
  hideTopBar?: boolean;
  isEngineer?: boolean;
}

interface EquipmentRequirementItem {
  typeCode: string;
  name: string;
  count: number;
  isRequired: boolean;
}

interface GanttSubStage {
  id: string;
  subNumber: string;
  name: string;
  durationDays: number;
  status: string;
  isCriticalPath: boolean;
  equipment: EquipmentRequirementItem[];
}

interface GanttMajorStage {
  id: string;
  stageNumber: number;
  name: string;
  subStages: GanttSubStage[];
}

export const ForemanObjectManager: React.FC<ForemanObjectManagerProps> = ({
  project,
  schedules,
  equipmentTypes,
  reloadSchedules,
  hideTopBar = false,
  isEngineer = false,
}) => {
  const [stages, setStages] = useState<GanttMajorStage[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isLocallyConfirmed, setIsLocallyConfirmed] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [earlyCompleteTarget, setEarlyCompleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const isLocked =
    isLocallyConfirmed ||
    project.status === "ACTIVE" ||
    project.schedule_status === "ACTIVE" ||
    hideTopBar;

  const cleanTitle = (val: string): string =>
    (val || "").replace(/^\d+(\.\d+)*[-.\s]+/, "").trim();

  const resolveEquipmentInfo = useCallback(
    (rawKey: string): { typeCode: string; name: string } => {
      if (!rawKey) return { typeCode: "unknown", name: "Техника" };

      const keyLower = rawKey.toLowerCase();

      const matched = equipmentTypes.find(
        (et) =>
          et.id === rawKey ||
          (et.code && et.code.toLowerCase() === keyLower)
      );

      if (matched) {
        const code = (matched.code || matched.id).toLowerCase();
        const name = matched.name || FALLBACK_EQUIPMENT_NAMES[code] || code;
        return { typeCode: code, name };
      }

      if (FALLBACK_EQUIPMENT_NAMES[keyLower]) {
        return { typeCode: keyLower, name: FALLBACK_EQUIPMENT_NAMES[keyLower] };
      }

      return { typeCode: keyLower, name: rawKey };
    },
    [equipmentTypes]
  );

  useEffect(() => {
    const rawList = schedules || [];
    if (rawList.length === 0) {
      setStages([]);
      return;
    }

    const stageMap = new Map<string, ScheduleItem[]>();
    rawList.forEach((item) => {
      const major = cleanTitle(item.stage_name || "Этап работ");
      const list = stageMap.get(major) || [];
      list.push(item);
      stageMap.set(major, list);
    });

    let stageIdx = 1;
    const parsed: GanttMajorStage[] = [];

    stageMap.forEach((subItems, majorName) => {
      const curStageNum = stageIdx++;
      let subIdx = 1;

      const subStages: GanttSubStage[] = subItems.map((sub: any) => {
        let days = 7;
        if (sub.base_start_date && sub.base_end_date) {
          const diff = Math.round(
            (new Date(sub.base_end_date).getTime() -
              new Date(sub.base_start_date).getTime()) /
              (1000 * 60 * 60 * 24)
          );
          days = diff > 0 ? diff : 1;
        }

        const eqList: EquipmentRequirementItem[] = [];
        const sourceEq = sub.equipment_requirements || [];

        sourceEq.forEach((eq: any) => {
          const rawKey =
            eq.equipment_type ||
            eq.equipment_type_id ||
            eq.code ||
            eq.id ||
            "";
          const resolved = resolveEquipmentInfo(rawKey);

          eqList.push({
            typeCode: resolved.typeCode,
            name: resolved.name,
            count: Number(eq.required_count ?? eq.count) || 1,
            isRequired: true,
          });
        });

        return {
          id: sub.id,
          subNumber: `${curStageNum}.${subIdx++}`,
          name: cleanTitle(sub.substage_name || sub.stage_name || "Подэтап"),
          durationDays: days,
          status: sub.status || "PLANNED",
          isCriticalPath: Boolean(sub.is_critical || sub.is_critical_path),
          equipment: eqList,
        };
      });

      parsed.push({
        id: `major-${curStageNum}`,
        stageNumber: curStageNum,
        name: majorName,
        subStages,
      });
    });

    setStages(parsed);
  }, [schedules, resolveEquipmentInfo]);

  const timelineLayout = useMemo(() => {
    const subOffsets = new Map<
      string,
      { startPercent: number; widthPercent: number }
    >();

    stages.forEach((maj) => {
      const stageTotalDays = maj.subStages.reduce(
        (sum, s) => sum + s.durationDays,
        0
      );
      const validTotal = stageTotalDays > 0 ? stageTotalDays : 1;

      let dayOffset = 0;
      maj.subStages.forEach((sub) => {
        const startPercent = (dayOffset / validTotal) * 100;
        const rawWidth = (sub.durationDays / validTotal) * 100;
        subOffsets.set(sub.id, {
          startPercent: Math.min(Math.max(0, startPercent), 96),
          widthPercent: Math.max(rawWidth, 4),
        });
        dayOffset += sub.durationDays;
      });
    });

    return { subOffsets };
  }, [stages]);

  const toggleCollapse = (stageId: string) => {
    setCollapsed((prev) => ({ ...prev, [stageId]: !prev[stageId] }));
  };

  const handleDurationChange = (stageId: string, subId: string, days: number) => {
    if (isLocked) return;
    const val = Math.max(1, days || 1);
    setStages((prev) =>
      prev.map((maj) =>
        maj.id === stageId
          ? {
              ...maj,
              subStages: maj.subStages.map((s) =>
                s.id === subId ? { ...s, durationDays: val } : s
              ),
            }
          : maj
      )
    );
  };

  const handleEquipmentCountChange = (
    stageId: string,
    subId: string,
    typeCode: string,
    delta: number
  ) => {
    if (isLocked) return;
    setStages((prev) =>
      prev.map((maj) => {
        if (maj.id !== stageId) return maj;
        return {
          ...maj,
          subStages: maj.subStages.map((sub) => {
            if (sub.id !== subId) return sub;
            const idx = sub.equipment.findIndex(
              (e) => e.typeCode === typeCode.toLowerCase()
            );
            if (idx === -1) return sub;

            const cur = sub.equipment[idx];
            const nextCount = cur.count + delta;
            const updated = [...sub.equipment];

            if (cur.isRequired && nextCount < 1) return sub;

            if (nextCount <= 0) {
              updated.splice(idx, 1);
            } else {
              updated[idx] = { ...cur, count: nextCount };
            }
            return { ...sub, equipment: updated };
          }),
        };
      })
    );
  };

  const handleAddEquipment = (stageId: string, subId: string, rawKey: string) => {
    if (isLocked || !rawKey) return;
    const resolved = resolveEquipmentInfo(rawKey);

    setStages((prev) =>
      prev.map((maj) => {
        if (maj.id !== stageId) return maj;
        return {
          ...maj,
          subStages: maj.subStages.map((sub) => {
            if (sub.id !== subId) return sub;
            if (sub.equipment.some((e) => e.typeCode === resolved.typeCode)) {
              return sub;
            }
            return {
              ...sub,
              equipment: [
                ...sub.equipment,
                {
                  typeCode: resolved.typeCode,
                  name: resolved.name,
                  count: 1,
                  isRequired: false,
                },
              ],
            };
          }),
        };
      })
    );
  };

  const handleApplyTemplate = async () => {
    if (isLocked) return;
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const res = await monitoringApi.applyTemplate(project.id);
      await reloadSchedules();
      setStatusMessage({
        type: "success",
        text: `График сгенерирован по нормам ТЗ (создано этапов: ${res.created_stages_count})`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Ошибка генерации шаблона",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveBulkSync = async () => {
    setIsProcessing(true);
    setStatusMessage(null);

    try {
      let cursorDate = new Date();
      const flatList: any[] = [];
      let seq = 1;

      stages.forEach((maj) => {
        maj.subStages.forEach((sub) => {
          const startDate = new Date(cursorDate);
          const endDate = new Date(
            startDate.getTime() + sub.durationDays * 24 * 60 * 60 * 1000
          );
          cursorDate = endDate;

          const eqReqs = sub.equipment.map((e) => ({
            equipment_type: e.typeCode.toLowerCase(),
            required_count: Number(e.count) || 1,
          }));

          const itemPayload: any = {
            stage_name: maj.name,
            substage_name: sub.name,
            sequence_order: seq++,
            base_start_date: startDate.toISOString(),
            base_end_date: endDate.toISOString(),
            status: sub.status || "PLANNED",
            equipment_requirements: eqReqs,
          };

          if (sub.id && !sub.id.startsWith("sub-")) {
            itemPayload.id = sub.id;
          }

          flatList.push(itemPayload);
        });
      });

      const res = await fetchWithAuth(
        `${API_URL}/api/v1/projects/${project.id}/schedules/bulk-sync`,
        {
          method: "PUT",
          body: JSON.stringify({ stages: flatList }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const errMsg =
          errData?.message ||
          errData?.detail?.[0]?.message ||
          errData?.detail ||
          `Код ответа сервера: ${res.status}`;
        throw new Error(errMsg);
      }

      await reloadSchedules();

      setStatusMessage({
        type: "success",
        text: "График и техника успешно сохранены на сервере",
      });
    } catch (e: any) {
      console.error("Ошибка bulk-sync:", e);
      setStatusMessage({
        type: "error",
        text: `Не удалось сохранить график: ${e.message}`,
      });
      throw e;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmSchedule = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      await handleSaveBulkSync();

      const res = await fetchWithAuth(
        `${API_URL}/api/v1/projects/${project.id}/schedules/confirm`,
        {
          method: "POST",
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const errMsg =
          errData?.message ||
          errData?.detail?.[0]?.msg ||
          errData?.detail ||
          `Код ошибки: ${res.status}`;
        throw new Error(errMsg);
      }

      setIsLocallyConfirmed(true);
      await reloadSchedules();

      setStatusMessage({
        type: "success",
        text: "График официально утвержден (ACTIVE). Режим редактирования закрыт.",
      });
    } catch (e: any) {
      setStatusMessage({
        type: "error",
        text: `Ошибка утверждения: ${e.message}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="gantt-root">
      {!hideTopBar && (
        <div className="gantt-top-bar">
          <div className="gantt-title-wrap">
            <h1>{project.name}</h1>
            <p>{project.address || "Адрес площадки"}</p>
          </div>

          <div className="gantt-top-actions">
            <button
              type="button"
              className="btn-gantt-secondary"
              onClick={() => setIsCameraModalOpen(true)}
            >
              Камеры объекта
            </button>

            {isLocked ? (
              <span className="project-selector-badge">
                График утвержден (Только просмотр)
              </span>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-gantt-secondary"
                  onClick={handleApplyTemplate}
                  disabled={isProcessing}
                >
                  Шаблон из ТЗ
                </button>

                <button
                  type="button"
                  className="btn-gantt-secondary"
                  onClick={handleSaveBulkSync}
                  disabled={isProcessing}
                >
                  {isProcessing ? "Сохранение..." : "Сохранить правки Ганта"}
                </button>

                <button
                  type="button"
                  className="btn-gantt-success"
                  onClick={handleConfirmSchedule}
                  disabled={isProcessing}
                >
                  {isProcessing ? "Утверждение..." : "Утвердить график"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {statusMessage && (
        <div
          className={`gantt-msg-banner ${
            statusMessage.type === "success" ? "msg-success" : "msg-error"
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {stages.length === 0 ? (
        <div className="gantt-empty-card">
          <h3>График строительства пока не сформирован</h3>
          <p>
            Для этого объекта еще не создана диаграмма Ганта. Нажмите кнопку
            ниже, чтобы автоматически развернуть этапы и технику из шаблона ТЗ.
          </p>
          {!isLocked && (
            <button
              type="button"
              className="btn-gantt-primary"
              onClick={handleApplyTemplate}
              disabled={isProcessing}
            >
              {isProcessing ? "Генерация..." : "Сгенерировать график из шаблона ТЗ"}
            </button>
          )}
        </div>
      ) : (
        <div className="gantt-grid">
          <div className="gantt-head">
            <div>Этап / Подэтап СМР</div>
            <div>Статус</div>
            <div>Срок (дней)</div>
            <div>Потребность в технике</div>
            <div>Диаграмма Ганта / Арбитраж</div>
          </div>

          <div className="gantt-body">
            {stages.map((maj) => {
              const isCollapsed = Boolean(collapsed[maj.id]);

              return (
                <React.Fragment key={maj.id}>
                  <div
                    className="gantt-parent-row"
                    onClick={() => toggleCollapse(maj.id)}
                  >
                    <div className="gantt-parent-name">
                      <span className="gantt-toggle">
                        {isCollapsed ? "►" : "▼"}
                      </span>
                      <span>
                        {maj.stageNumber}. {maj.name}
                      </span>
                    </div>
                    <div>—</div>
                    <div>—</div>
                    <div>—</div>
                    <div>
                      <div className="timeline-cell">
                        <div className="gantt-timeline-track" />
                        <svg
                          className="gantt-svg-track"
                          viewBox="0 0 100 24"
                          preserveAspectRatio="none"
                        >
                          <rect
                            className="gantt-rect-parent"
                            x="0"
                            y="5"
                            width="100"
                            height="14"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {!isCollapsed &&
                    maj.subStages.map((sub) => {
                      const layout = timelineLayout.subOffsets.get(sub.id);
                      const rectClass = sub.isCriticalPath
                        ? "gantt-rect-critical"
                        : "gantt-rect-child";

                      return (
                        <div
                          key={sub.id}
                          className={`gantt-child-row ${
                            sub.isCriticalPath ? "gantt-child-row-critical" : ""
                          }`}
                        >
                          <div className="gantt-child-title">
                            <span className="substage-name-text">
                              {sub.subNumber}. {sub.name}
                            </span>
                          </div>

                          <div>
                            <span
                              className={`gantt-status-badge ${
                                sub.status === "COMPLETED" ? "status-completed" : ""
                              }`}
                            >
                              {sub.status === "COMPLETED"
                                ? "Выполнен"
                                : sub.status === "IN_PROGRESS"
                                ? "В работе"
                                : "Запланирован"}
                            </span>
                          </div>

                          <div>
                            <div className="duration-ctrl">
                              <input
                                type="number"
                                min="1"
                                max="365"
                                className="duration-num-input"
                                value={sub.durationDays}
                                disabled={isLocked}
                                onChange={(e) =>
                                  handleDurationChange(
                                    maj.id,
                                    sub.id,
                                    parseInt(e.target.value, 10)
                                  )
                                }
                              />
                              <span className="unit-txt">дн.</span>
                            </div>
                          </div>

                          <div>
                            <div className="eq-chip-box">
                              {sub.equipment.map((eq) => (
                                <div
                                  key={eq.typeCode}
                                  className={`eq-chip ${
                                    eq.isRequired
                                      ? "eq-chip-required"
                                      : "eq-chip-allowed"
                                  }`}
                                  title="Техника на этапе"
                                >
                                  <span className="eq-chip-label">{eq.name}</span>
                                  {!isLocked && (
                                    <button
                                      type="button"
                                      className="eq-btn"
                                      onClick={() =>
                                        handleEquipmentCountChange(
                                          maj.id,
                                          sub.id,
                                          eq.typeCode,
                                          -1
                                        )
                                      }
                                    >
                                      -
                                    </button>
                                  )}
                                  <span className="eq-count">{eq.count}</span>
                                  {!isLocked && (
                                    <button
                                      type="button"
                                      className="eq-btn"
                                      onClick={() =>
                                        handleEquipmentCountChange(
                                          maj.id,
                                          sub.id,
                                          eq.typeCode,
                                          1
                                        )
                                      }
                                    >
                                      +
                                    </button>
                                  )}
                                </div>
                              ))}

                              {!isLocked && (
                                <select
                                  className="eq-add-sel"
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleAddEquipment(
                                        maj.id,
                                        sub.id,
                                        e.target.value
                                      );
                                    }
                                  }}
                                >
                                  <option value="">+ Допустимая техника</option>
                                  {equipmentTypes.map((et) => {
                                    const resolved = resolveEquipmentInfo(
                                      et.code || et.id
                                    );
                                    return (
                                      <option key={et.id} value={resolved.typeCode}>
                                        {resolved.name}
                                      </option>
                                    );
                                  })}
                                </select>
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="engineer-gantt-action-cell">
                              <div className="timeline-cell timeline-cell-flex">
                                <div className="gantt-timeline-track" />
                                <svg
                                  className="gantt-svg-track"
                                  viewBox="0 0 100 24"
                                  preserveAspectRatio="none"
                                >
                                  <rect
                                    className={rectClass}
                                    x={layout?.startPercent || 0}
                                    y="5"
                                    width={layout?.widthPercent || 6}
                                    height="14"
                                  />
                                </svg>
                              </div>

                              {isEngineer && (
                                <div className="engineer-action-wrapper">
                                  {sub.status !== "COMPLETED" ? (
                                    <button
                                      type="button"
                                      className="btn-gantt-success btn-action-small"
                                      onClick={() =>
                                        setEarlyCompleteTarget({
                                          id: sub.id,
                                          name: `${sub.subNumber}. ${sub.name}`,
                                        })
                                      }
                                    >
                                      Завершить досрочно
                                    </button>
                                  ) : (
                                    <span className="text-secondary-label">
                                      Подтверждено
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {isCameraModalOpen && (
        <CameraManagerModal
          projectId={project.id}
          onClose={() => setIsCameraModalOpen(false)}
        />
      )}

      {earlyCompleteTarget && (
        <EarlyCompleteModal
          projectId={project.id}
          stageId={earlyCompleteTarget.id}
          stageName={earlyCompleteTarget.name}
          onClose={() => setEarlyCompleteTarget(null)}
          onSuccess={reloadSchedules}
        />
      )}
    </div>
  );
};