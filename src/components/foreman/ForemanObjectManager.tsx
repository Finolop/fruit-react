import React, { useState, useMemo, useEffect } from "react";
import {
  ProjectData,
  EquipmentType,
  ScheduleItem,
} from "../../pages/foreman/ForemanPage";
import { foremanApi } from "../../api/apiForeman";
import { CameraManagerModal } from "./CameraManagerModal";
import { EarlyCompleteModal } from "../engineer/EarlyCompleteModal";

import cameraIcon from "../../assets/images/Camera.svg";
import lockIcon from "../../assets/images/Lock.svg";
import clipboardIcon from "../../assets/images/File_Add.svg";
import saveIcon from "../../assets/images/Save.svg";
import checkIcon from "../../assets/images/Circle_Check.svg";
import chevronDownIcon from "../../assets/images/Caret_Down_MD.svg";
import chevronRightIcon from "../../assets/images/Caret_Up_MD.svg";

import "../../styles/ForemanGantt.css";

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
  isReadOnly?: boolean;
}

interface EquipmentRequirementItem {
  typeId: string;
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
  startDate: Date;
  endDate: Date;
  isShifted: boolean;
  isEarlyCompleted: boolean;
  status: string;
  isCriticalPath: boolean;
  equipment: EquipmentRequirementItem[];
}

interface GanttMajorStage {
  id: string;
  stageNumber: number;
  name: string;
  startDate: Date;
  endDate: Date;
  totalDurationDays: number;
  subStages: GanttSubStage[];
}

const safeParseDate = (dateStr?: string, fallback: Date = new Date()): Date => {
  if (!dateStr) return fallback;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? fallback : d;
};

const formatDateRu = (date: Date): string => {
  if (!date || isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
};

const getStorageKey = (projectId: string) => `argus_eq_req_${projectId}`;

const loadLocalRequirementMap = (projectId: string): Record<string, boolean> => {
  try {
    const raw = localStorage.getItem(getStorageKey(projectId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveLocalRequirementMap = (
  projectId: string,
  map: Record<string, boolean>
) => {
  try {
    localStorage.setItem(getStorageKey(projectId), JSON.stringify(map));
  } catch {}
};

const cleanTitle = (val: string): string =>
  (val || "").replace(/^\d+(\.\d+)*[-.\s]+/, "").trim();

export const ForemanObjectManager: React.FC<ForemanObjectManagerProps> = ({
  project,
  schedules,
  equipmentTypes,
  reloadSchedules,
  hideTopBar = false,
  isEngineer = false,
  isReadOnly = false,
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
    nextStageId?: string;
    nextStageName?: string;
  } | null>(null);

  const isLocked =
    isReadOnly ||
    isLocallyConfirmed ||
    project.status === "ACTIVE" ||
    project.schedule_status === "ACTIVE" ||
    hideTopBar;

  // 1. Загрузка и разбор структуры графиков
  useEffect(() => {
    const rawList = schedules || [];
    if (rawList.length === 0) {
      setStages([]);
      return;
    }

    const reqMap = loadLocalRequirementMap(project.id);
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
        const subStageName = cleanTitle(sub.substage_name || sub.stage_name || "Подэтап");
        const effectiveStartStr =
          sub.actual_start_date ||
          sub.phantom_start_date ||
          sub.base_start_date;

        let effectiveEndStr = sub.base_end_date;
        const isEarly = Boolean(
          sub.status === "COMPLETED" && sub.actual_end_date,
        );
        const isShift = Boolean(sub.phantom_start_date || sub.phantom_end_date);

        if (isEarly && sub.actual_end_date) {
          effectiveEndStr = sub.actual_end_date;
        } else if (sub.phantom_end_date) {
          effectiveEndStr = sub.phantom_end_date;
        }

        const sDate = safeParseDate(effectiveStartStr);
        const eDate = safeParseDate(
          effectiveEndStr,
          new Date(sDate.getTime() + 7 * 86400000),
        );

        let days = Math.round(
          (eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        days = days > 0 ? days : 1;

        const eqList: EquipmentRequirementItem[] = [];
        const sourceEq = sub.equipment_requirements || [];

        sourceEq.forEach((eq: any) => {
          const rawId = (eq.equipment_type_id || eq.id || "").toLowerCase();
          const rawCode = (eq.equipment_type || eq.code || "").toLowerCase();

          const matched = equipmentTypes.find(
            (et) =>
              (rawId && et.id.toLowerCase() === rawId) ||
              (rawCode && et.code && et.code.toLowerCase() === rawCode),
          );

          const finalId = matched?.id || eq.equipment_type_id || rawId;
          const finalCode = (matched?.code || rawCode || "unknown").toLowerCase();
          const finalName =
            matched?.name ||
            FALLBACK_EQUIPMENT_NAMES[finalCode] ||
            "Строительная техника";

          let backendRequired: boolean | null = null;
          if (eq.is_required !== undefined && eq.is_required !== null) {
            backendRequired =
              eq.is_required === true ||
              eq.is_required === 1 ||
              eq.is_required === "true";
          } else if (eq.required !== undefined && eq.required !== null) {
            backendRequired =
              eq.required === true ||
              eq.required === 1 ||
              eq.required === "true";
          }

          const cacheKey = `${subStageName}_${finalCode}`;
          const finalIsRequired =
            backendRequired !== null
              ? backendRequired
              : reqMap[cacheKey] !== undefined
              ? reqMap[cacheKey]
              : true;

          eqList.push({
            typeId: finalId,
            typeCode: finalCode,
            name: finalName,
            count: Number(eq.required_count ?? eq.count) || 1,
            isRequired: finalIsRequired,
          });
        });

        return {
          id: sub.id,
          subNumber: `${curStageNum}.${subIdx++}`,
          name: subStageName,
          durationDays: days,
          startDate: sDate,
          endDate: eDate,
          isShifted: isShift,
          isEarlyCompleted: isEarly,
          status: sub.status || "PLANNED",
          isCriticalPath: Boolean(sub.is_critical ?? sub.is_critical_path),
          equipment: eqList,
        };
      });

      const allStartTimes = subStages.map((s) => s.startDate.getTime());
      const allEndTimes = subStages.map((s) => s.endDate.getTime());
      const minStart =
        allStartTimes.length > 0
          ? new Date(Math.min(...allStartTimes))
          : new Date();
      const maxEnd =
        allEndTimes.length > 0
          ? new Date(Math.max(...allEndTimes))
          : new Date();
      const totalDays = subStages.reduce((acc, s) => acc + s.durationDays, 0);

      parsed.push({
        id: `major-${curStageNum}`,
        stageNumber: curStageNum,
        name: majorName,
        startDate: minStart,
        endDate: maxEnd,
        totalDurationDays: totalDays,
        subStages,
      });
    });

    setStages(parsed);
  }, [schedules, equipmentTypes, project.id]);

  const flatSubStages = useMemo(() => {
    return stages.flatMap((maj) => maj.subStages);
  }, [stages]);

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

  const handleDurationChange = (
    stageId: string,
    subId: string,
    days: number,
  ) => {
    if (isLocked) return;
    const val = Math.max(1, days || 1);

    setStages((prev) =>
      prev.map((maj) => {
        if (maj.id !== stageId) return maj;

        const updatedSubStages = maj.subStages.map((s) => {
          if (s.id !== subId) return s;
          const newEnd = new Date(
            s.startDate.getTime() + val * 24 * 60 * 60 * 1000,
          );
          return {
            ...s,
            durationDays: val,
            endDate: newEnd,
          };
        });

        const allEndTimes = updatedSubStages.map((s) => s.endDate.getTime());
        const newMaxEnd = new Date(Math.max(...allEndTimes));
        const newTotalDays = updatedSubStages.reduce(
          (acc, s) => acc + s.durationDays,
          0,
        );

        return {
          ...maj,
          subStages: updatedSubStages,
          endDate: newMaxEnd,
          totalDurationDays: newTotalDays,
        };
      }),
    );
  };

  // Переключение критического пути подэтапа (вынесено в корень компонента)
  const handleToggleCriticalPath = (
    stageId: string,
    subId: string,
    isCritical: boolean,
  ) => {
    if (isLocked) return;
    setStages((prev) =>
      prev.map((maj) => {
        if (maj.id !== stageId) return maj;
        return {
          ...maj,
          subStages: maj.subStages.map((sub) => {
            if (sub.id !== subId) return sub;
            return {
              ...sub,
              isCriticalPath: isCritical,
            };
          }),
        };
      }),
    );
  };

  const handleEquipmentCountChange = (
    stageId: string,
    subId: string,
    typeId: string,
    delta: number,
  ) => {
    if (isLocked) return;
    setStages((prev) =>
      prev.map((maj) => {
        if (maj.id !== stageId) return maj;
        return {
          ...maj,
          subStages: maj.subStages.map((sub) => {
            if (sub.id !== subId) return sub;
            const idx = sub.equipment.findIndex((e) => e.typeId === typeId);
            if (idx === -1) return sub;

            const cur = sub.equipment[idx];
            const nextCount = cur.count + delta;
            const updated = [...sub.equipment];

            if (nextCount <= 0) {
              updated.splice(idx, 1);
            } else {
              updated[idx] = { ...cur, count: nextCount };
            }
            return { ...sub, equipment: updated };
          }),
        };
      }),
    );
  };

  const handleToggleRequirementType = (
    stageId: string,
    subId: string,
    typeId: string,
  ) => {
    if (isLocked) return;
    setStages((prev) =>
      prev.map((maj) => {
        if (maj.id !== stageId) return maj;
        return {
          ...maj,
          subStages: maj.subStages.map((sub) => {
            if (sub.id !== subId) return sub;
            const updated = sub.equipment.map((eq) => {
              if (eq.typeId === typeId) {
                const nextIsRequired = !eq.isRequired;
                const reqMap = loadLocalRequirementMap(project.id);
                reqMap[`${sub.name}_${eq.typeCode}`] = nextIsRequired;
                saveLocalRequirementMap(project.id, reqMap);
                return { ...eq, isRequired: nextIsRequired };
              }
              return eq;
            });
            return { ...sub, equipment: updated };
          }),
        };
      }),
    );
  };

  const handleRemoveEquipment = (
    stageId: string,
    subId: string,
    typeId: string,
  ) => {
    if (isLocked) return;
    setStages((prev) =>
      prev.map((maj) => {
        if (maj.id !== stageId) return maj;
        return {
          ...maj,
          subStages: maj.subStages.map((sub) => {
            if (sub.id !== subId) return sub;
            return {
              ...sub,
              equipment: sub.equipment.filter((eq) => eq.typeId !== typeId),
            };
          }),
        };
      }),
    );
  };

  const handleAddEquipment = (
    stageId: string,
    subId: string,
    eqTypeId: string,
    isRequired: boolean,
  ) => {
    if (isLocked || !eqTypeId) return;

    const matched = equipmentTypes.find(
      (et) => et.id.toLowerCase() === eqTypeId.toLowerCase(),
    );

    const typeCode = (matched?.code || "unknown").toLowerCase();
    const name = matched?.name || FALLBACK_EQUIPMENT_NAMES[typeCode] || "Строительная техника";

    setStages((prev) =>
      prev.map((maj) => {
        if (maj.id !== stageId) return maj;
        return {
          ...maj,
          subStages: maj.subStages.map((sub) => {
            if (sub.id !== subId) return sub;
            if (sub.equipment.some((e) => e.typeId === eqTypeId)) {
              return sub;
            }

            const reqMap = loadLocalRequirementMap(project.id);
            reqMap[`${sub.name}_${typeCode}`] = isRequired;
            saveLocalRequirementMap(project.id, reqMap);

            return {
              ...sub,
              equipment: [
                ...sub.equipment,
                {
                  typeId: eqTypeId,
                  typeCode,
                  name,
                  count: 1,
                  isRequired,
                },
              ],
            };
          }),
        };
      }),
    );
  };

  const handleApplyTemplate = async () => {
    if (isLocked) return;
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const res = await foremanApi.applyTemplate(project.id);
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
    if (isLocked) return;
    setIsProcessing(true);
    setStatusMessage(null);

    try {
      const flatList: any[] = [];
      const reqMap = loadLocalRequirementMap(project.id);
      let seq = 1;

      stages.forEach((maj) => {
        maj.subStages.forEach((sub) => {
          const eqReqs = sub.equipment.map((e) => {
            const matched = equipmentTypes.find(
              (et) =>
                et.id.toLowerCase() === e.typeId.toLowerCase() ||
                (et.code && et.code.toLowerCase() === e.typeCode.toLowerCase())
            );
            const code = (matched?.code || e.typeCode || "excavator").toLowerCase();

            reqMap[`${sub.name}_${code}`] = e.isRequired;

            return {
              equipment_type: code,
              equipment_type_id: e.typeId,
              required_count: Number(e.count) || 1,
              is_required: e.isRequired,
            };
          });

          const itemPayload: any = {
            stage_name: maj.name,
            substage_name: sub.name,
            sequence_order: seq++,
            base_start_date: sub.startDate.toISOString(),
            base_end_date: sub.endDate.toISOString(),
            is_critical: sub.isCriticalPath,
            is_critical_path: sub.isCriticalPath,
            equipment_requirements: eqReqs,
          };

          if (sub.id && !sub.id.startsWith("sub-") && !sub.id.startsWith("major-")) {
            itemPayload.id = sub.id;
          }

          flatList.push(itemPayload);
        });
      });

      saveLocalRequirementMap(project.id, reqMap);

      await foremanApi.bulkSync(project.id, flatList);
      await reloadSchedules();

      setStatusMessage({
        type: "success",
        text: "График и параметры техники успешно сохранены в системе",
      });
    } catch (e: any) {
      setStatusMessage({
        type: "error",
        text: `Не удалось сохранить график: ${e.message}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmSchedule = async () => {
    if (isLocked) return;
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      await handleSaveBulkSync();
      await foremanApi.confirmSchedule(project.id);

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

  const canCompleteEarly = Boolean(isEngineer) && !isReadOnly;

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
              className="btn-gantt-camera-action"
              onClick={() => setIsCameraModalOpen(true)}
              title="Управление видеопотоками площадки"
            >
              <img src={cameraIcon} alt="" className="btn-icon-svg" />
              <span>Видеокамеры</span>
            </button>

            {isLocked ? (
              <div className="schedule-locked-badge">
                <img src={lockIcon} alt="" className="badge-icon-svg" />
                <div className="locked-text-wrap">
                  <span className="locked-badge-title">
                    {isReadOnly
                      ? "Режим чтения (Департамент)"
                      : "Директивный график утверждён"}
                  </span>
                  <span className="locked-badge-sub">
                    {isReadOnly
                      ? "Правка графиков доступна только прорабу"
                      : "Режим непрерывного мониторинга СМР"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="schedule-draft-action-group">
                <button
                  type="button"
                  className="btn-gantt-action-tool"
                  onClick={handleApplyTemplate}
                  disabled={isProcessing}
                  title="Заполнить типовыми этапами из ТЗ"
                >
                  <img src={clipboardIcon} alt="" className="btn-icon-svg" />
                  <span>Шаблон ТЗ</span>
                </button>

                <button
                  type="button"
                  className="btn-gantt-action-tool"
                  onClick={handleSaveBulkSync}
                  disabled={isProcessing}
                  title="Сохранить текущие сроки и технику"
                >
                  <img src={saveIcon} alt="" className="btn-icon-svg" />
                  <span>
                    {isProcessing ? "Сохранение..." : "Сохранить правки"}
                  </span>
                </button>

                <button
                  type="button"
                  className="btn-gantt-confirm-primary"
                  onClick={handleConfirmSchedule}
                  disabled={isProcessing}
                  title="Утвердить график и запустить фиксацию"
                >
                  <img
                    src={checkIcon}
                    alt=""
                    className="btn-icon-svg btn-icon-white"
                  />
                  <span>
                    {isProcessing ? "Утверждение..." : "Утвердить график"}
                  </span>
                </button>
              </div>
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
            {isReadOnly
              ? "Для этого объекта график СМР ещё не был сформирован прорабом."
              : "Для этого объекта еще не создана диаграмма Ганта. Нажмите кнопку ниже, чтобы автоматически развернуть этапы и технику из шаблона ТЗ."}
          </p>
          {!isLocked && (
            <button
              type="button"
              className="btn-gantt-confirm-primary"
              onClick={handleApplyTemplate}
              disabled={isProcessing}
            >
              <img
                src={clipboardIcon}
                alt=""
                className="btn-icon-svg btn-icon-white"
              />
              <span>
                {isProcessing
                  ? "Генерация..."
                  : "Сгенерировать график из шаблона ТЗ"}
              </span>
            </button>
          )}
        </div>
      ) : (
        <div className="gantt-grid">
          <div className="gantt-head">
            <div>Этап / Подэтап СМР</div>
            <div>Статус / Действия</div>
            <div>Даты и срок</div>
            <div>Потребность в технике</div>
            <div>Диаграмма Ганта</div>
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
                      <img
                        src={isCollapsed ? chevronRightIcon : chevronDownIcon}
                        alt=""
                        className="icon-chevron"
                      />
                      <span>
                        {maj.stageNumber}. {maj.name}
                      </span>
                    </div>

                    <div>—</div>

                    <div className="parent-dates-cell">
                      <span className="parent-dates-range">
                        {formatDateRu(maj.startDate)} —{" "}
                        {formatDateRu(maj.endDate)}
                      </span>
                      <span className="parent-days-pill">
                        {maj.totalDurationDays} дн.
                      </span>
                    </div>

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

                      const currentSubIdx = flatSubStages.findIndex(
                        (s) => s.id === sub.id,
                      );
                      const nextSubStage =
                        currentSubIdx !== -1 &&
                        currentSubIdx + 1 < flatSubStages.length
                          ? flatSubStages[currentSubIdx + 1]
                          : undefined;

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

                            {/* Селектор критического пути со стрелочкой для прораба */}
                            {!isLocked ? (
                              <div className="critical-select-wrap">
                                <select
                                  className={`critical-path-select ${
                                    sub.isCriticalPath ? "is-critical" : "not-critical"
                                  }`}
                                  value={sub.isCriticalPath ? "true" : "false"}
                                  onChange={(e) =>
                                    handleToggleCriticalPath(
                                      maj.id,
                                      sub.id,
                                      e.target.value === "true",
                                    )
                                  }
                                  title="Изменить статус критического пути"
                                >
                                  <option value="true">Крит. путь</option>
                                  <option value="false">Обычный</option>
                                </select>
                              </div>
                            ) : (
                              sub.isCriticalPath && (
                                <span
                                  className="critical-path-pill"
                                  title="Критический путь: задержка этапа сдвигает дату сдачи объекта"
                                >
                                  Крит. путь
                                </span>
                              )
                            )}
                          </div>

                          <div className="status-col-cell">
                            <span
                              className={`gantt-status-badge ${
                                sub.status === "COMPLETED"
                                  ? "status-completed"
                                  : sub.status === "IN_PROGRESS"
                                    ? "status-in-progress"
                                    : ""
                              }`}
                            >
                              {sub.status === "COMPLETED"
                                ? "Выполнен"
                                : sub.status === "IN_PROGRESS"
                                  ? "В работе"
                                  : "Запланирован"}
                            </span>

                            {canCompleteEarly && sub.status !== "COMPLETED" && (
                              <button
                                type="button"
                                className="btn-early-complete-chip"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEarlyCompleteTarget({
                                    id: sub.id,
                                    name: `${sub.subNumber}. ${sub.name}`,
                                    nextStageId: nextSubStage?.id,
                                    nextStageName: nextSubStage
                                      ? `${nextSubStage.subNumber}. ${nextSubStage.name}`
                                      : undefined,
                                  });
                                }}
                                title="Досрочная приемка этапа по акту АОСР"
                              >
                                <img
                                  src={checkIcon}
                                  alt=""
                                  className="ui-icon-xs"
                                />
                                <span>Завершить досрочно</span>
                              </button>
                            )}
                          </div>

                          <div className="child-dates-cell">
                            <div className="dates-range-row">
                              <span className="dates-text">
                                {formatDateRu(sub.startDate)} —{" "}
                                {formatDateRu(sub.endDate)}
                              </span>
                              {sub.isEarlyCompleted && (
                                <span
                                  className="date-badge-early"
                                  title="Срок сокращен по акту АОСР"
                                >
                                  АОСР
                                </span>
                              )}
                              {sub.isShifted && !sub.isEarlyCompleted && (
                                <span
                                  className="date-badge-shifted"
                                  title="Срок скорректирован каскадным сдвигом"
                                >
                                  Сдвиг
                                </span>
                              )}
                            </div>

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
                                  key={eq.typeId}
                                  className={`eq-chip ${
                                    eq.isRequired
                                      ? "eq-chip-required"
                                      : "eq-chip-allowed"
                                  }`}
                                >
                                  {!isLocked ? (
                                    <button
                                      type="button"
                                      className={`eq-req-pill-btn ${
                                        eq.isRequired ? "is-req" : "is-allow"
                                      }`}
                                      onClick={() =>
                                        handleToggleRequirementType(
                                          maj.id,
                                          sub.id,
                                          eq.typeId,
                                        )
                                      }
                                      title="Кликните для переключения: Обязательная ⇄ Допустимая"
                                    >
                                      {eq.isRequired ? "Обяз." : "Допуст."}
                                    </button>
                                  ) : (
                                    <span
                                      className={`eq-req-pill-btn ${
                                        eq.isRequired ? "is-req" : "is-allow"
                                      }`}
                                    >
                                      {eq.isRequired ? "Обяз." : "Допуст."}
                                    </span>
                                  )}

                                  <span className="eq-chip-label">
                                    {eq.name}
                                  </span>

                                  {!isLocked && (
                                    <button
                                      type="button"
                                      className="eq-btn"
                                      onClick={() =>
                                        handleEquipmentCountChange(
                                          maj.id,
                                          sub.id,
                                          eq.typeId,
                                          -1,
                                        )
                                      }
                                      title="Уменьшить"
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
                                          eq.typeId,
                                          1,
                                        )
                                      }
                                      title="Увеличить"
                                    >
                                      +
                                    </button>
                                  )}

                                  {!isLocked && (
                                    <button
                                      type="button"
                                      className="eq-remove-btn"
                                      onClick={() =>
                                        handleRemoveEquipment(
                                          maj.id,
                                          sub.id,
                                          eq.typeId,
                                        )
                                      }
                                      title="Удалить технику"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              ))}

                              {!isLocked && (
                                <div className="eq-add-dropdown-wrap">
                                  <select
                                    className="eq-add-sel"
                                    value=""
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        const [type, eqId] = e.target.value.split("::");
                                        handleAddEquipment(
                                          maj.id,
                                          sub.id,
                                          eqId,
                                          type === "REQ",
                                        );
                                      }
                                    }}
                                  >
                                    <option value="">+ Добавить технику</option>
                                    <optgroup label="Обязательная техника (должна работать на объекте)">
                                      {equipmentTypes
                                        .filter(
                                          (et) =>
                                            !sub.equipment.some(
                                              (e) => e.typeId.toLowerCase() === et.id.toLowerCase(),
                                            ),
                                        )
                                        .map((et) => (
                                          <option
                                            key={`req-${et.id}`}
                                            value={`REQ::${et.id}`}
                                          >
                                            ★ {et.name || et.code} (Обязательная)
                                          </option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="Допустимая техника (вспомогательная)">
                                      {equipmentTypes
                                        .filter(
                                          (et) =>
                                            !sub.equipment.some(
                                              (e) => e.typeId.toLowerCase() === et.id.toLowerCase(),
                                            ),
                                        )
                                        .map((et) => (
                                          <option
                                            key={`allow-${et.id}`}
                                            value={`ALLOW::${et.id}`}
                                          >
                                            ○ {et.name || et.code} (Допустимая)
                                          </option>
                                        ))}
                                    </optgroup>
                                  </select>
                                </div>
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

      {isCameraModalOpen && (
        <CameraManagerModal
          projectId={project.id}
          onClose={() => setIsCameraModalOpen(false)}
          isReadOnly={isReadOnly}
        />
      )}

      {earlyCompleteTarget && (
        <EarlyCompleteModal
          projectId={project.id}
          stageId={earlyCompleteTarget.id}
          stageName={earlyCompleteTarget.name}
          nextStageId={earlyCompleteTarget.nextStageId}
          nextStageName={earlyCompleteTarget.nextStageName}
          onClose={() => setEarlyCompleteTarget(null)}
          onSuccess={reloadSchedules}
        />
      )}
    </div>
  );
};