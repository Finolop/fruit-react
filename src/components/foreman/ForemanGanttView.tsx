import React, { useState, useMemo } from "react";
import { fetchWithAuth } from "../../api/api";
import "../../styles/ForemanGantt.css";

export interface ScheduleItem {
  id: string;
  project_id: string;
  stage_name: string;
  substage_name: string;
  sequence_order: number;
  base_start_date: string;
  base_end_date: string;
  status: string;
  equipment_requirements: {
    equipment_type_id: string;
    required_count: number;
  }[];
}

interface EquipmentType {
  id: string;
  code: string;
  name: string;
}

interface Props {
  projectId: string;
  projectName: string;
  projectAddress: string;
  initialSchedules: ScheduleItem[];
  equipmentTypes: EquipmentType[];
  onReload: () => Promise<void>;
}

export const ForemanGanttView: React.FC<Props> = ({
  projectId,
  projectName,
  projectAddress,
  initialSchedules,
  equipmentTypes,
  onReload,
}) => {
  const [items, setItems] = useState<ScheduleItem[]>(initialSchedules);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const groupedStages = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    items.forEach((item) => {
      const list = map.get(item.stage_name) || [];
      list.push(item);
      map.set(item.stage_name, list);
    });
    return Array.from(map.entries());
  }, [items]);

  const toggleGroup = (stageName: string) => {
    setCollapsed((prev) => ({ ...prev, [stageName]: !prev[stageName] }));
  };

  const getDays = (startStr: string, endStr: string) => {
    const s = new Date(startStr).getTime();
    const e = new Date(endStr).getTime();
    const diff = Math.round((e - s) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  };

  const timelineLayout = useMemo(() => {
    const subOffsets = new Map<
      string,
      { startPercent: number; widthPercent: number }
    >();

    groupedStages.forEach(([, subStages]) => {
      const stageTotalDays = subStages.reduce(
        (sum, s) => sum + getDays(s.base_start_date, s.base_end_date),
        0,
      );
      const validTotal = stageTotalDays > 0 ? stageTotalDays : 1;

      let dayOffset = 0;
      subStages.forEach((sub) => {
        const days = getDays(sub.base_start_date, sub.base_end_date);
        const startPercent = (dayOffset / validTotal) * 100;
        const rawWidth = (days / validTotal) * 100;
        const widthPercent = Math.max(rawWidth, 6);

        subOffsets.set(sub.id, {
          startPercent: Math.min(Math.max(0, startPercent), 94),
          widthPercent,
        });

        dayOffset += days;
      });
    });

    return { subOffsets };
  }, [groupedStages]);

  const handleDurationChange = (id: string, newDays: number) => {
    const days = Math.max(1, newDays || 1);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const startDate = new Date(item.base_start_date);
        const newEnd = new Date(
          startDate.getTime() + days * 24 * 60 * 60 * 1000,
        );
        return {
          ...item,
          base_end_date: newEnd.toISOString(),
        };
      }),
    );
  };

  const handleEquipmentChange = (
    itemId: string,
    eqTypeId: string,
    delta: number,
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const currentReqs = [...item.equipment_requirements];
        const existingIdx = currentReqs.findIndex(
          (r) => r.equipment_type_id === eqTypeId,
        );

        if (existingIdx >= 0) {
          const nextCount = currentReqs[existingIdx].required_count + delta;
          if (nextCount <= 0) {
            currentReqs.splice(existingIdx, 1);
          } else {
            currentReqs[existingIdx].required_count = nextCount;
          }
        } else if (delta > 0) {
          currentReqs.push({ equipment_type_id: eqTypeId, required_count: 1 });
        }

        return { ...item, equipment_requirements: currentReqs };
      }),
    );
  };

  const handleApplyTemplate = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await fetchWithAuth(
        `/api/v1/projects/${projectId}/schedules/apply-template`,
        {
          method: "POST",
          body: JSON.stringify({ start_date: new Date().toISOString() }),
        },
      );
      if (!res.ok)
        throw new Error("Не удалось сгенерировать график из шаблона ТЗ");
      await onReload();
      setFeedback({
        type: "success",
        text: "График успешно сгенерирован по нормам ТЗ",
      });
    } catch (e: any) {
      setFeedback({ type: "error", text: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBulkSync = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const payload = {
        stages: items.map((it) => ({
          id: it.id,
          stage_name: it.stage_name,
          substage_name: it.substage_name,
          sequence_order: it.sequence_order,
          base_start_date: it.base_start_date,
          base_end_date: it.base_end_date,
          equipment_requirements: it.equipment_requirements,
        })),
      };

      const res = await fetchWithAuth(
        `/api/v1/projects/${projectId}/schedules/bulk-sync`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) throw new Error("Ошибка пакетного сохранения графика");
      setFeedback({
        type: "success",
        text: "График и распределение техники успешно сохранены",
      });
    } catch (e: any) {
      setFeedback({ type: "error", text: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmSchedule = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await fetchWithAuth(
        `/api/v1/projects/${projectId}/schedules/confirm`,
        {
          method: "POST",
        },
      );
      if (!res.ok) throw new Error("Не удалось утвердить график");
      await onReload();
      setFeedback({
        type: "success",
        text: "График официально утвержден (ACTIVE)",
      });
    } catch (e: any) {
      setFeedback({ type: "error", text: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="gantt-root">
      <div className="gantt-top-bar">
        <div className="gantt-title-wrap">
          <h1>{projectName}</h1>
          <p>{projectAddress}</p>
        </div>

        <div className="gantt-top-actions">
          {items.length > 0 && (
            <>
              <button
                type="button"
                className="btn-gantt-secondary"
                onClick={handleSaveBulkSync}
                disabled={isSaving}
              >
                {isSaving ? "Сохранение..." : "Сохранить правки Ганта"}
              </button>
              <button
                type="button"
                className="btn-gantt-success"
                onClick={handleConfirmSchedule}
                disabled={isSaving}
              >
                Утвердить график
              </button>
            </>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`gantt-msg-banner ${feedback.type === "success" ? "msg-success" : "msg-error"}`}
        >
          {feedback.text}
        </div>
      )}

      {items.length === 0 ? (
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
            disabled={isSaving}
          >
            {isSaving
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
            {groupedStages.map(([stageName, subStages]) => {
              const isCollapsed = Boolean(collapsed[stageName]);

              return (
                <React.Fragment key={stageName}>
                  <div
                    className="gantt-parent-row"
                    onClick={() => toggleGroup(stageName)}
                  >
                    <div className="gantt-parent-name">
                      <span className="gantt-toggle">
                        {isCollapsed ? "▶" : "▼"}
                      </span>
                      <span>{stageName}</span>
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
                    subStages.map((sub) => {
                      const days = getDays(
                        sub.base_start_date,
                        sub.base_end_date,
                      );
                      const layout = timelineLayout.subOffsets.get(sub.id);

                      return (
                        <div key={sub.id} className="gantt-child-row">
                          <div className="gantt-child-title">
                            <span className="substage-name-text">
                              {sub.substage_name || sub.stage_name}
                            </span>
                          </div>

                          <div>
                            <span
                              className={`gantt-status-badge ${
                                sub.status === "IN_PROGRESS"
                                  ? "gantt-status-active"
                                  : ""
                              }`}
                            >
                              {sub.status}
                            </span>
                          </div>

                          <div>
                            <div className="duration-ctrl">
                              <input
                                type="number"
                                min="1"
                                className="duration-num-input"
                                value={days}
                                onChange={(e) =>
                                  handleDurationChange(
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
                              {sub.equipment_requirements.map((req) => {
                                const eqName =
                                  equipmentTypes.find(
                                    (e) => e.id === req.equipment_type_id,
                                  )?.name || "Техника";
                                return (
                                  <div
                                    key={req.equipment_type_id}
                                    className="eq-chip"
                                  >
                                    <span className="eq-chip-label">
                                      {eqName}
                                    </span>
                                    <button
                                      type="button"
                                      className="eq-btn"
                                      onClick={() =>
                                        handleEquipmentChange(
                                          sub.id,
                                          req.equipment_type_id,
                                          -1,
                                        )
                                      }
                                    >
                                      -
                                    </button>
                                    <span className="eq-count">
                                      {req.required_count}
                                    </span>
                                    <button
                                      type="button"
                                      className="eq-btn"
                                      onClick={() =>
                                        handleEquipmentChange(
                                          sub.id,
                                          req.equipment_type_id,
                                          1,
                                        )
                                      }
                                    >
                                      +
                                    </button>
                                  </div>
                                );
                              })}

                              <select
                                className="eq-add-sel"
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleEquipmentChange(
                                      sub.id,
                                      e.target.value,
                                      1,
                                    );
                                  }
                                }}
                              >
                                <option value="">+ Техника</option>
                                {equipmentTypes
                                  .filter(
                                    (et) =>
                                      !sub.equipment_requirements.some(
                                        (r) => r.equipment_type_id === et.id,
                                      ),
                                  )
                                  .map((et) => (
                                    <option key={et.id} value={et.id}>
                                      {et.name}
                                    </option>
                                  ))}
                              </select>
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
                                  className="gantt-rect-child"
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
    </div>
  );
};
