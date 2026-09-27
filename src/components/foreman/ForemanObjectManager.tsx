import React, { useState, useMemo, useEffect } from "react";
import {
  ProjectData,
  EquipmentType,
  ScheduleItem,
} from "../../pages/foreman/ForemanPage";
import { getAuthHeaders } from "../../api/api";
import { monitoringApi } from "../../api/monitoringApi";
import { CameraManagerModal } from "./CameraManagerModal";
import "../../styles/ForemanGantt.css";

const API_URL = process.env.REACT_APP_API_URL || "";

const EQUIPMENT_NAMES_MAP: Record<string, string> = {
  EXCAVATOR: "Экскаватор",
  MOBILE_CRANE: "Автокран",
  DUMP_TRUCK: "Самосвал",
  BULLDOZER: "Бульдозер",
  CONCRETE_MIXER: "Автобетоносмеситель",
  ROAD_ROLLER: "Каток",
  FLATBED_TRUCK: "Бортовой грузовик",
};

interface ForemanObjectManagerProps {
  project: ProjectData;
  schedules: ScheduleItem[];
  equipmentTypes: EquipmentType[];
  reloadSchedules: () => Promise<void>;
  hideTopBar?: boolean;
}

interface EquipmentRequirementItem {
  equipment_type_id: string;
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
  riskAlert: string;
  equipment: EquipmentRequirementItem[];
  allowedEquipmentIds: string[];
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
}) => {
  const [stages, setStages] = useState<GanttMajorStage[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const cleanTitle = (val: string): string =>
    (val || "").replace(/^\d+(\.\d+)*\.\s*/, "").trim();

  const resolveEquipmentName = (
    idOrCode: string,
    types: EquipmentType[],
  ): string => {
    if (!idOrCode) return "Техника";

    const matched = types.find(
      (t) =>
        t.id === idOrCode ||
        (t.code && t.code.toUpperCase() === idOrCode.toUpperCase()),
    );
    if (matched && matched.name) return matched.name;

    const upper = idOrCode.toUpperCase();
    if (EQUIPMENT_NAMES_MAP[upper]) {
      return EQUIPMENT_NAMES_MAP[upper];
    }

    return idOrCode;
  };

  useEffect(() => {
    const initData = async () => {
      let rawStages: any[] = [];

      if (schedules && schedules.length > 0) {
        rawStages = schedules;
      } else if (project.type_id || project.id) {
        try {
          const query = project.type_id
            ? `?project_type_id=${project.type_id}`
            : "";
          const res = await fetch(
            `${API_URL}/api/v1/dictionaries/stage-templates${query}`,
            { headers: getAuthHeaders() },
          );
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) rawStages = data;
          }
        } catch (err) {
          console.error("Ошибка загрузки шаблонов с бэкенда:", err);
        }
      }

      if (rawStages.length === 0) {
        setStages([]);
        return;
      }

      const stageMap = new Map<string, any[]>();
      rawStages.forEach((item) => {
        const majorName = cleanTitle(item.stage_name || "Этап работ");
        const list = stageMap.get(majorName) || [];
        list.push(item);
        stageMap.set(majorName, list);
      });

      let stageCounter = 1;
      const parsedStages: GanttMajorStage[] = [];

      stageMap.forEach((subItems, majorName) => {
        const currentStageNum = stageCounter++;
        let subCounter = 1;

        const subs: GanttSubStage[] = subItems.map((sub) => {
          const subNumStr = `${currentStageNum}.${subCounter++}`;
          const subName = cleanTitle(
            sub.substage_name || sub.stage_name || "Подэтап",
          );

          let days = 7;
          if (sub.base_start_date && sub.base_end_date) {
            const diff = Math.round(
              (new Date(sub.base_end_date).getTime() -
                new Date(sub.base_start_date).getTime()) /
                (1000 * 60 * 60 * 24),
            );
            days = diff > 0 ? diff : 1;
          } else if (sub.default_duration_days) {
            days = sub.default_duration_days;
          }

          const eqList: EquipmentRequirementItem[] = [];
          const sourceEq =
            sub.equipment_requirements || sub.default_equipment || [];

          if (Array.isArray(sourceEq)) {
            sourceEq.forEach((eq: any) => {
              const eqId = eq.equipment_type_id || eq.id || eq.code;
              eqList.push({
                equipment_type_id: eqId,
                name: resolveEquipmentName(eqId, equipmentTypes),
                count: eq.required_count || eq.count || 1,
                isRequired: true,
              });
            });
          }

          const allowedIds: string[] = [];
          if (Array.isArray(sub.allowed_equipment)) {
            sub.allowed_equipment.forEach((codeOrId: string) => {
              const found = equipmentTypes.find(
                (e) =>
                  e.id === codeOrId ||
                  (e.code && e.code.toUpperCase() === codeOrId.toUpperCase()),
              );
              if (found) allowedIds.push(found.id);
            });
          }

          return {
            id: sub.id || `sub-${currentStageNum}-${subCounter}`,
            subNumber: subNumStr,
            name: subName,
            durationDays: days,
            status: sub.status || "PLANNED",
            isCriticalPath: Boolean(sub.is_critical || sub.isCriticalPath),
            riskAlert: sub.risk_alert || sub.riskAlert || "",
            equipment: eqList,
            allowedEquipmentIds: allowedIds,
          };
        });

        parsedStages.push({
          id: `major-${currentStageNum}`,
          stageNumber: currentStageNum,
          name: majorName,
          subStages: subs,
        });
      });

      setStages(parsedStages);
    };

    initData();
  }, [schedules, project.id, project.type_id, equipmentTypes]);

  // Расчет каскада лесенки внутри каждого этапа (0% -> 100%)
  const timelineLayout = useMemo(() => {
    const subOffsets = new Map<
      string,
      { startPercent: number; widthPercent: number }
    >();

    stages.forEach((maj) => {
      const stageTotalDays = maj.subStages.reduce(
        (sum, s) => sum + s.durationDays,
        0,
      );
      const validTotal = stageTotalDays > 0 ? stageTotalDays : 1;

      let dayOffset = 0;
      maj.subStages.forEach((sub) => {
        const startPercent = (dayOffset / validTotal) * 100;
        const rawWidth = (sub.durationDays / validTotal) * 100;
        const widthPercent = Math.max(rawWidth, 4);

        subOffsets.set(sub.id, {
          startPercent: Math.min(Math.max(0, startPercent), 96),
          widthPercent,
        });

        dayOffset += sub.durationDays;
      });
    });

    return { subOffsets };
  }, [stages]);

  const toggleCollapse = (stageId: string) => {
    setCollapsed((prev) => ({ ...prev, [stageId]: !prev[stageId] }));
  };

  const handleDurationChange = (
    stageId: string,
    subId: string,
    days: number,
  ) => {
    const validDays = Math.max(1, days || 1);
    setStages((prev) =>
      prev.map((maj) => {
        if (maj.id !== stageId) return maj;
        return {
          ...maj,
          subStages: maj.subStages.map((sub) =>
            sub.id === subId ? { ...sub, durationDays: validDays } : sub,
          ),
        };
      }),
    );
  };

  const handleEquipmentCountChange = (
    stageId: string,
    subId: string,
    eqTypeId: string,
    delta: number,
  ) => {
    setStages((prev) =>
      prev.map((maj) => {
        if (maj.id !== stageId) return maj;
        return {
          ...maj,
          subStages: maj.subStages.map((sub) => {
            if (sub.id !== subId) return sub;

            const existingIdx = sub.equipment.findIndex(
              (e) => e.equipment_type_id === eqTypeId,
            );
            if (existingIdx === -1) return sub;

            const current = sub.equipment[existingIdx];
            const nextCount = current.count + delta;
            const updatedList = [...sub.equipment];

            if (current.isRequired && nextCount < 1) return sub;

            if (nextCount <= 0) {
              updatedList.splice(existingIdx, 1);
            } else {
              updatedList[existingIdx] = { ...current, count: nextCount };
            }

            return { ...sub, equipment: updatedList };
          }),
        };
      }),
    );
  };

  const handleAddEquipment = (
    stageId: string,
    subId: string,
    eqTypeId: string,
  ) => {
    if (!eqTypeId) return;
    const name = resolveEquipmentName(eqTypeId, equipmentTypes);

    setStages((prev) =>
      prev.map((maj) => {
        if (maj.id !== stageId) return maj;
        return {
          ...maj,
          subStages: maj.subStages.map((sub) => {
            if (sub.id !== subId) return sub;
            if (sub.equipment.some((e) => e.equipment_type_id === eqTypeId))
              return sub;

            const newItem: EquipmentRequirementItem = {
              equipment_type_id: eqTypeId,
              name,
              count: 1,
              isRequired: false,
            };

            return { ...sub, equipment: [...sub.equipment, newItem] };
          }),
        };
      }),
    );
  };

  // Автогенерация графика из шаблона ТЗ
  const handleApplyTemplate = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const res = await monitoringApi.applyTemplate(project.id);
      await reloadSchedules();
      setStatusMessage({
        type: "success",
        text: `График успешно сгенерирован по нормам ТЗ (создано этапов: ${res.created_stages_count})`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Ошибка применения шаблона ТЗ",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Пакетное сохранение правок Ганта (bulk-sync)
  const handleSaveBulkSync = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      let cursorDate = new Date();
      const flatList: any[] = [];
      let seq = 1;

      stages.forEach((maj) => {
        maj.subStages.forEach((sub) => {
          const start = new Date(cursorDate);
          const end = new Date(
            start.getTime() + sub.durationDays * 24 * 60 * 60 * 1000,
          );
          cursorDate = end;

          flatList.push({
            stage_name: `${maj.stageNumber}. ${maj.name}`,
            substage_name: `${sub.subNumber}. ${sub.name}`,
            sequence_order: seq++,
            base_start_date: start.toISOString(),
            base_end_date: end.toISOString(),
            equipment_requirements: sub.equipment.map((e) => ({
              equipment_type_id: e.equipment_type_id,
              required_count: e.count,
            })),
          });
        });
      });

      const res = await fetch(
        `${API_URL}/api/v1/projects/${project.id}/schedules/bulk-sync`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({ stages: flatList }),
        },
      );

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(
          errJson?.detail ||
            errJson?.error?.message ||
            "Ошибка сохранения графика",
        );
      }

      await reloadSchedules();
      setStatusMessage({
        type: "success",
        text: "График и распределение техники успешно сохранены на сервере",
      });
    } catch (e: any) {
      setStatusMessage({
        type: "error",
        text: e.message || "Ошибка сохранения",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Утверждение графика (DRAFT -> ACTIVE)
  const handleConfirmSchedule = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const res = await fetch(
        `${API_URL}/api/v1/projects/${project.id}/schedules/confirm`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        },
      );

      if (!res.ok) throw new Error("Не удалось утвердить график");
      await reloadSchedules();
      setStatusMessage({
        type: "success",
        text: "График официально утвержден (ACTIVE)",
      });
    } catch (e: any) {
      setStatusMessage({ type: "error", text: e.message });
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
              📹 Камеры объекта
            </button>

            <button
              type="button"
              className="btn-gantt-secondary"
              onClick={handleApplyTemplate}
              disabled={isProcessing}
            >
              ⚡ Шаблон из ТЗ
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
              Утвердить график
            </button>
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
            ниже, чтобы автоматически развернуть утвержденные этапы, сроки и
            технику из нормативной базы ТЗ.
          </p>
          <button
            type="button"
            className="btn-gantt-primary"
            onClick={handleApplyTemplate}
            disabled={isProcessing}
          >
            {isProcessing
              ? "Генерация..."
              : "⚡ Сгенерировать график из шаблона ТЗ"}
          </button>
        </div>
      ) : (
        <div className="gantt-grid">
          <div className="gantt-head">
            <div>Этап / Подэтап СМР</div>
            <div>Статус</div>
            <div>Срок (дней)</div>
            <div>Потребность в технике</div>
            <div>Диаграмма Ганта</div>
          </div>

          <div className="gantt-body">
            {stages.map((maj) => {
              const isCollapsed = Boolean(collapsed[maj.id]);

              return (
                <React.Fragment key={maj.id}>
                  {/* Родительский этап: строго прямоугольный сводный бар */}
                  <div
                    className="gantt-parent-row"
                    onClick={() => toggleCollapse(maj.id)}
                  >
                    <div className="gantt-parent-name">
                      <span className="gantt-toggle">
                        {isCollapsed ? "▶" : "▼"}
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

                  {/* Подэтапы: прямоугольные бары без скруглений */}
                  {!isCollapsed &&
                    maj.subStages.map((sub) => {
                      const allowedPool =
                        sub.allowedEquipmentIds.length > 0
                          ? equipmentTypes.filter((et) =>
                              sub.allowedEquipmentIds.includes(et.id),
                            )
                          : equipmentTypes;

                      const availableToAdd = allowedPool.filter(
                        (et) =>
                          !sub.equipment.some(
                            (e) => e.equipment_type_id === et.id,
                          ),
                      );

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
                            {sub.riskAlert && (
                              <span
                                className="substage-risk-alert"
                                title={sub.riskAlert}
                              >
                                ⚠️ {sub.riskAlert}
                              </span>
                            )}
                          </div>

                          <div>
                            <span className="gantt-status-badge">
                              {sub.status}
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
                                onChange={(e) =>
                                  handleDurationChange(
                                    maj.id,
                                    sub.id,
                                    parseInt(e.target.value, 10),
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
                                  key={eq.equipment_type_id}
                                  className={`eq-chip ${
                                    eq.isRequired
                                      ? "eq-chip-required"
                                      : "eq-chip-allowed"
                                  }`}
                                  title={
                                    eq.isRequired
                                      ? "Обязательная техника по ТЗ"
                                      : "Допустимая техника"
                                  }
                                >
                                  <span className="eq-chip-label">
                                    {eq.name}
                                  </span>
                                  <button
                                    type="button"
                                    className="eq-btn"
                                    onClick={() =>
                                      handleEquipmentCountChange(
                                        maj.id,
                                        sub.id,
                                        eq.equipment_type_id,
                                        -1,
                                      )
                                    }
                                  >
                                    -
                                  </button>
                                  <span className="eq-count">{eq.count}</span>
                                  <button
                                    type="button"
                                    className="eq-btn"
                                    onClick={() =>
                                      handleEquipmentCountChange(
                                        maj.id,
                                        sub.id,
                                        eq.equipment_type_id,
                                        1,
                                      )
                                    }
                                  >
                                    +
                                  </button>
                                </div>
                              ))}

                              {availableToAdd.length > 0 && (
                                <select
                                  className="eq-add-sel"
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleAddEquipment(
                                        maj.id,
                                        sub.id,
                                        e.target.value,
                                      );
                                    }
                                  }}
                                >
                                  <option value="">+ Допустимая техника</option>
                                  {availableToAdd.map((et) => (
                                    <option key={et.id} value={et.id}>
                                      {et.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="timeline-cell">
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

      {/* Модальное окно управления видеокамерами */}
      {isCameraModalOpen && (
        <CameraManagerModal
          projectId={project.id}
          onClose={() => setIsCameraModalOpen(false)}
        />
      )}
    </div>
  );
};
