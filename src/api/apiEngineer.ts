import { fetchWithAuth, LiveSummaryResponse } from "./api";

export type { LiveSummaryResponse };

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

export interface AuditTrailItem {
  id: string;
  project_id: string;
  user_id: string;
  user_email: string;
  action_type: string;
  old_values: Record<string, any>;
  new_values: Record<string, any>;
  created_at: string;
}

const handleApiResponse = async <T>(
  res: Response,
  defaultErrorMsg: string,
): Promise<T> => {
  if (!res.ok) {
    let detail = "";
    try {
      const errJson = await res.json();
      if (typeof errJson?.detail === "string") {
        detail = errJson.detail;
      } else if (Array.isArray(errJson?.detail)) {
        detail = errJson.detail.map((e: any) => e.msg || e.message).join(", ");
      } else if (errJson?.message) {
        detail = errJson.message;
      }
    } catch {}
    throw new Error(detail || `${defaultErrorMsg} (Код: ${res.status})`);
  }
  return res.json();
};

export const engineerApi = {
  getLiveSummary: async (projectId: string): Promise<LiveSummaryResponse> => {
    const res = await fetchWithAuth(
      `/api/v1/projects/${projectId}/live-summary`,
    );
    return handleApiResponse<LiveSummaryResponse>(
      res,
      "Не удалось загрузить live-summary объекта",
    );
  },

  getActiveAlert: async (projectId: string): Promise<AlertResponse | null> => {
    const res = await fetchWithAuth(
      `/api/v1/alerts/active?project_id=${projectId}`,
    );
    if (res.status === 404) return null;
    return handleApiResponse<AlertResponse>(
      res,
      "Ошибка получения активного алерта",
    );
  },

  getAlerts: async (
    projectId: string,
    limit = 50,
    offset = 0,
  ): Promise<AlertResponse[]> => {
    const res = await fetchWithAuth(
      `/api/v1/alerts?project_id=${projectId}&limit=${limit}&offset=${offset}`,
    );
    return handleApiResponse<AlertResponse[]>(
      res,
      "Ошибка получения журнала алертов",
    );
  },

  resolveAlert: async (
    alertId: string,
    payload: AlertResolveRequest,
  ): Promise<AlertResponse> => {
    const res = await fetchWithAuth(`/api/v1/alerts/${alertId}/resolve`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return handleApiResponse<AlertResponse>(
      res,
      "Не удалось зарегистрировать решение по алерту",
    );
  },

  cascadeShift: async (
    projectId: string,
    payload: CascadeShiftRequest,
  ): Promise<CascadeShiftResponse> => {
    const res = await fetchWithAuth(
      `/api/v1/projects/${projectId}/schedules/cascade-shift`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return handleApiResponse<CascadeShiftResponse>(
      res,
      "Ошибка выполнения каскадного сдвига",
    );
  },

  getCurrentSpecialStatus: async (
    projectId: string,
  ): Promise<SpecialStatusResponse | null> => {
    const res = await fetchWithAuth(
      `/api/v1/special-statuses/projects/${projectId}/current`,
    );
    if (res.status === 404) return null;
    return handleApiResponse<SpecialStatusResponse>(
      res,
      "Ошибка получения текущего спецстатуса",
    );
  },

  closeSpecialStatusWindow: async (
    windowId: string,
    comment: string,
  ): Promise<SpecialStatusResponse> => {
    const res = await fetchWithAuth(
      `/api/v1/special-statuses/windows/${windowId}/close`,
      {
        method: "POST",
        body: JSON.stringify({ close_comment: comment }),
      },
    );
    return handleApiResponse<SpecialStatusResponse>(
      res,
      "Не удалось закрыть окно спецстатуса",
    );
  },

  submitOrangeReport: async (
    windowId: string,
    payload: OrangeStatusReportCreate,
  ): Promise<OrangeStatusReportResponse> => {
    const res = await fetchWithAuth(
      `/api/v1/special-statuses/windows/${windowId}/orange-report`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return handleApiResponse<OrangeStatusReportResponse>(
      res,
      "Ошибка отправки штрафного отчета",
    );
  },

  getOrangeReports: async (
    projectId: string,
  ): Promise<OrangeStatusReportResponse[]> => {
    const res = await fetchWithAuth(
      `/api/v1/special-statuses/projects/${projectId}/orange-reports`,
    );
    return handleApiResponse<OrangeStatusReportResponse[]>(
      res,
      "Ошибка загрузки реестра штрафных отчетов",
    );
  },

  getProjectFrames: async (
    projectId: string,
    limit = 50,
    offset = 0,
  ): Promise<FrameItemResponse[]> => {
    const res = await fetchWithAuth(
      `/api/v1/projects/${projectId}/frames?limit=${limit}&offset=${offset}`,
    );
    return handleApiResponse<FrameItemResponse[]>(
      res,
      "Не удалось загрузить снимки с камер",
    );
  },

  markFrameAsEvidence: async (
    frameId: string,
    isSaved = true,
  ): Promise<{ message: string }> => {
    const res = await fetchWithAuth(`/api/v1/frames/${frameId}/evidence`, {
      method: "PATCH",
      body: JSON.stringify({ is_saved_for_report: isSaved }),
    });
    return handleApiResponse<{ message: string }>(
      res,
      "Не удалось зафиксировать улику",
    );
  },

  getProjectSettings: async (
    projectId: string,
  ): Promise<ProjectSettingsResponse> => {
    const res = await fetchWithAuth(`/api/v1/projects/${projectId}/settings`);
    return handleApiResponse<ProjectSettingsResponse>(
      res,
      "Ошибка получения настроек ОКС",
    );
  },

  updateProjectSettings: async (
    projectId: string,
    payload: ProjectSettingsResponse,
  ): Promise<ProjectSettingsResponse> => {
    const res = await fetchWithAuth(`/api/v1/projects/${projectId}/settings`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return handleApiResponse<ProjectSettingsResponse>(
      res,
      "Не удалось обновить настройки ОКС",
    );
  },

  getAuditTrail: async (
    projectId: string,
    limit = 50,
    offset = 0,
    actionType?: string,
  ): Promise<AuditTrailItem[]> => {
    const query = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (actionType) query.set("action_type", actionType);

    const res = await fetchWithAuth(
      `/api/v1/projects/${projectId}/audit-trail?${query.toString()}`,
    );
    return handleApiResponse<AuditTrailItem[]>(
      res,
      "Ошибка загрузки журнала аудита",
    );
  },
};
