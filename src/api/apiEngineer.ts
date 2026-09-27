import { getAuthHeaders } from "./api";

const API_URL = process.env.REACT_APP_API_URL || "";

// ==========================================
// DTO & Интерфейсы по OpenAPI бэкенда
// ==========================================

export interface LiveSummaryStage {
  name: string;
  days_current: number;
  days_total_stage: number;
  days_remaining: number;
  progress_status: string;
}

export interface LiveSummaryEquipment {
  required_total: number;
  detected_total: number;
  active_count: number;
  idle_count: number;
}

export interface LiveSummaryResponse {
  project_name: string;
  physical_progress_percent: number;
  time_elapsed_percent: number;
  alert_level: string;
  special_status: string;
  special_status_deadline: string | null;
  current_stage: LiveSummaryStage;
  equipment_realtime: LiveSummaryEquipment;
}

export interface AlertResponse {
  id: string;
  project_id: string;
  schedule_id: string | null;
  severity: "YELLOW" | "RED" | string;
  trigger_type: string;
  status: string;
  trigger_frame_id: string | null;
  details: Record<string, any>;
  triggered_at: string;
  escalate_at: string | null;
  yellow_escalated_to_red_at: string | null;
  resolved_at: string | null;
}

export interface AlertResolveRequest {
  action_taken: string;
  engineer_comment: string;
  evidence_frame_ids: string[];
  target_deadline?: string;
}

export interface CascadeShiftRequest {
  from_schedule_id: string;
  shift_days: number;
  target_timeline: "PHANTOM" | "BASE";
  reason_comment: string;
  document_reference: string;
  close_special_status?: boolean;
}

export interface CascadeShiftResponse {
  shifted_stages_count: number;
  old_estimated_completion: string;
  new_estimated_completion: string;
  audit_trail_id: string;
}

export interface SpecialStatusResponse {
  id: string;
  project_id: string;
  alert_id: string | null;
  type: string;
  created_by_user_id: string;
  start_time: string;
  target_deadline: string;
  actual_end_time: string | null;
  reason_comment: string;
  close_comment: string | null;
}

export interface SpecialStatusCloseRequest {
  close_comment: string;
}

export interface OrangeStatusReportCreate {
  is_plan_caught_up: boolean;
  time_lost_hours: number;
  responsible_party: string;
  summary_meta?: Record<string, any>;
}

export interface OrangeStatusReportResponse {
  id: string;
  special_status_window_id: string;
  is_plan_caught_up: boolean;
  time_lost_hours: string;
  responsible_party: string;
  summary_meta: Record<string, any>;
  created_at: string;
}

export interface FrameItemResponse {
  id: string;
  camera_id: string;
  project_id: string;
  captured_at: string;
  image_path: string;
  image_url: string;
  is_saved_for_report: boolean;
  detection_result: Record<string, any>;
  processed_at: string;
}

export interface ProjectSettingsResponse {
  yellow_to_red_timeout_hours: number;
  idle_threshold_minutes: number;
  frame_retention_days: number;
}

export interface ProjectSettingsUpdate {
  yellow_to_red_timeout_hours: number;
  idle_threshold_minutes: number;
  frame_retention_days: number;
}

// ==========================================
// Вспомогательный парсер ответов
// ==========================================

const handleApiResponse = async <T>(
  res: Response,
  defaultErrorMsg: string,
): Promise<T> => {
  if (!res.ok) {
    let detail = "";
    try {
      const errJson = await res.json();
      detail = errJson?.detail?.[0]?.msg || errJson?.detail || errJson?.message;
    } catch {
      // Игнорируем ошибку парсинга JSON
    }
    throw new Error(detail || `${defaultErrorMsg} (Код: ${res.status})`);
  }
  return res.json();
};

// ==========================================
// Методы API инженера ПТО
// ==========================================

export const engineerApi = {
  // 1. Шапка дашборда: светофор, прогресс, онлайн-техника
  getLiveSummary: async (projectId: string): Promise<LiveSummaryResponse> => {
    const res = await fetch(
      `${API_URL}/api/v1/projects/${projectId}/live-summary`,
      {
        headers: getAuthHeaders(),
      },
    );
    return handleApiResponse<LiveSummaryResponse>(
      res,
      "Не удалось загрузить live-summary объекта",
    );
  },

  // 2. Текущий открытый алерт по объекту
  getActiveAlert: async (projectId: string): Promise<AlertResponse | null> => {
    const res = await fetch(
      `${API_URL}/api/v1/alerts/active?project_id=${projectId}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (res.status === 404) return null;
    return handleApiResponse<AlertResponse>(
      res,
      "Ошибка получения активного алерта",
    );
  },

  // 3. Закрытие / реакция инженера на красный алерт (3 сценария)
  resolveAlert: async (
    alertId: string,
    payload: AlertResolveRequest,
  ): Promise<AlertResponse> => {
    const res = await fetch(`${API_URL}/api/v1/alerts/${alertId}/resolve`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleApiResponse<AlertResponse>(
      res,
      "Не удалось зарегистрировать решение по алерту",
    );
  },

  // 4. Каскадный сдвиг сроков цепочки этапов
  cascadeShift: async (
    projectId: string,
    payload: CascadeShiftRequest,
  ): Promise<CascadeShiftResponse> => {
    const res = await fetch(
      `${API_URL}/api/v1/projects/${projectId}/schedules/cascade-shift`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      },
    );
    return handleApiResponse<CascadeShiftResponse>(
      res,
      "Ошибка выполнения каскадного сдвига",
    );
  },

  // 5. Текущий активный спецстатус объекта
  getCurrentSpecialStatus: async (
    projectId: string,
  ): Promise<SpecialStatusResponse | null> => {
    const res = await fetch(
      `${API_URL}/api/v1/special-statuses/projects/${projectId}/current`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (res.status === 404) return null;
    return handleApiResponse<SpecialStatusResponse>(
      res,
      "Ошибка получения текущего спецстатуса",
    );
  },

  // 6. Закрытие окна спецстатуса инженером
  closeSpecialStatusWindow: async (
    windowId: string,
    comment: string,
  ): Promise<SpecialStatusResponse> => {
    const res = await fetch(
      `${API_URL}/api/v1/special-statuses/windows/${windowId}/close`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          close_comment: comment,
        } as SpecialStatusCloseRequest),
      },
    );
    return handleApiResponse<SpecialStatusResponse>(
      res,
      "Не удалось закрыть окно спецстатуса",
    );
  },

  // 7. Отправка штрафного отчета разбора инцидента
  submitOrangeReport: async (
    windowId: string,
    payload: OrangeStatusReportCreate,
  ): Promise<OrangeStatusReportResponse> => {
    const res = await fetch(
      `${API_URL}/api/v1/special-statuses/windows/${windowId}/orange-report`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      },
    );
    return handleApiResponse<OrangeStatusReportResponse>(
      res,
      "Ошибка отправки штрафного отчета",
    );
  },

  // 8. Список снимков с камеры для выбора улик
  getProjectFrames: async (
    projectId: string,
    limit = 20,
  ): Promise<FrameItemResponse[]> => {
    const res = await fetch(
      `${API_URL}/api/v1/projects/${projectId}/frames?limit=${limit}`,
      {
        headers: getAuthHeaders(),
      },
    );
    return handleApiResponse<FrameItemResponse[]>(
      res,
      "Не удалось загрузить снимки с камер",
    );
  },

  // 9. Закрепление кадра как официальной улики нарушения
  markFrameAsEvidence: async (
    frameId: string,
    isSaved = true,
  ): Promise<{ message: string }> => {
    const res = await fetch(`${API_URL}/api/v1/frames/${frameId}/evidence`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ is_saved_for_report: isSaved }),
    });
    return handleApiResponse<{ message: string }>(
      res,
      "Не удалось зафиксировать улику",
    );
  },

  // 10. Получение индивидуальных настроек и порогов ОКС
  getProjectSettings: async (
    projectId: string,
  ): Promise<ProjectSettingsResponse> => {
    const res = await fetch(
      `${API_URL}/api/v1/projects/${projectId}/settings`,
      {
        headers: getAuthHeaders(),
      },
    );
    return handleApiResponse<ProjectSettingsResponse>(
      res,
      "Ошибка получения настроек ОКС",
    );
  },

  // 11. Сохранение настроек и порогов ОКС
  updateProjectSettings: async (
    projectId: string,
    payload: ProjectSettingsUpdate,
  ): Promise<ProjectSettingsResponse> => {
    const res = await fetch(
      `${API_URL}/api/v1/projects/${projectId}/settings`,
      {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      },
    );
    return handleApiResponse<ProjectSettingsResponse>(
      res,
      "Не удалось обновить настройки ОКС",
    );
  },
};
