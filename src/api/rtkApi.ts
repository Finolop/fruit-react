import {
  createApi,
  fetchBaseQuery,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import {
  getAccessToken,
  setAccessToken,
  clearTokensAndRedirect,
  LiveSummaryResponse,
} from "./api";
import {
  ProjectListItem,
  ProjectType,
  CreateProjectRequest,
  Project,
  ProjectAssignment,
  User,
} from "./apiAdmin";
import {
  AlertResponse,
  AlertResolveRequest,
  CascadeShiftRequest,
  CascadeShiftResponse,
  SpecialStatusResponse,
  OrangeStatusReportCreate,
  OrangeStatusReportResponse,
  FrameItemResponse,
} from "./apiEngineer";
import { CameraItem } from "./monitoringApi";
import {
  ProjectData,
  ScheduleItem,
  EquipmentType,
} from "../pages/foreman/ForemanPage";

const API_URL = process.env.REACT_APP_API_URL || "";

export const extractApiError = (err: any, fallback: string): string => {
  if (!err) return fallback;
  const data = err.data || err;
  if (typeof data?.error?.message === "string") {
    return data.error.message;
  }
  if (typeof data?.detail === "string") {
    return data.detail;
  }
  if (Array.isArray(data?.detail)) {
    return data.detail.map((e: any) => e.msg || e.message).join(", ");
  }
  if (typeof err.message === "string" && err.message !== "Rejected") {
    return err.message;
  }
  return fallback;
};

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  credentials: "include",
  prepareHeaders: (headers) => {
    const token = getAccessToken();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  },
});

let refreshPromise: Promise<string | null> | null = null;

const refreshTokenRequest = async (): Promise<string | null> => {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.access_token) {
      setAccessToken(data.access_token);
      return data.access_token;
    }
    return null;
  } catch {
    return null;
  }
};

export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  const urlStr = typeof args === "string" ? args : args.url;
  const isAuthEndpoint =
    urlStr.includes("/auth/refresh") ||
    urlStr.includes("/auth/login") ||
    urlStr.includes("/auth/register");

  if (result.error && result.error.status === 401 && !isAuthEndpoint) {
    if (!refreshPromise) {
      refreshPromise = refreshTokenRequest().finally(() => {
        refreshPromise = null;
      });
    }

    const newToken = await refreshPromise;

    if (newToken) {
      result = await rawBaseQuery(args, api, extraOptions);
    } else {
      await clearTokensAndRedirect();
    }
  }

  return result;
};

export const rtkApi = createApi({
  reducerPath: "rtkApi",
  baseQuery: baseQueryWithReauth,
  refetchOnMountOrArgChange: true,
  refetchOnFocus: true,
  tagTypes: [
    "Projects",
    "Project",
    "Schedules",
    "LiveSummary",
    "Alerts",
    "SpecialStatus",
    "Cameras",
    "Frames",
    "Dictionaries",
    "Assignments",
    "Users",
  ],
  endpoints: (builder) => ({
    // 1. ПРОЕКТЫ И СПРАВОЧНИКИ
    getProjects: builder.query<
      ProjectListItem[],
      {
        status?: string;
        alert_level?: string;
        special_status?: string;
        type_id?: string;
        limit?: number;
        offset?: number;
      } | void
    >({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params) {
          if (params.status) searchParams.set("status", params.status);
          if (params.alert_level)
            searchParams.set("alert_level", params.alert_level);
          if (params.special_status)
            searchParams.set("special_status", params.special_status);
          if (params.type_id) searchParams.set("type_id", params.type_id);
          if (params.limit !== undefined)
            searchParams.set("limit", String(params.limit));
          if (params.offset !== undefined)
            searchParams.set("offset", String(params.offset));
        }
        const qs = searchParams.toString();
        return `/api/v1/projects${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["Projects"],
    }),

    getProjectById: builder.query<ProjectData, string>({
      query: (projectId) => `/api/v1/projects/${projectId}`,
      providesTags: (_res, _err, id) => [{ type: "Project", id }],
    }),

    createProject: builder.mutation<Project, CreateProjectRequest>({
      query: (body) => ({
        url: "/api/v1/projects",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Projects"],
    }),

    getProjectTypes: builder.query<ProjectType[], void>({
      query: () => "/api/v1/dictionaries/project-types",
      providesTags: ["Dictionaries"],
    }),

    getEquipmentTypes: builder.query<EquipmentType[], void>({
      query: () => "/api/v1/dictionaries/equipment-types",
      providesTags: ["Dictionaries"],
    }),

    // 2. ПОЛЬЗОВАТЕЛИ, КОМАНДА И РОЛИ (АДМИН)
    getUsers: builder.query<User[], void>({
      query: () => "/api/v1/auth/users",
      providesTags: ["Users"],
    }),

    updateUserRoleByEmail: builder.mutation<
      User,
      { email: string; roles: string[] }
    >({
      query: (body) => ({
        url: "/api/v1/auth/users/roles",
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Users", "Projects"],
    }),

    getProjectAssignments: builder.query<ProjectAssignment[], string>({
      query: (projectId) => `/api/v1/projects/${projectId}/assignments`,
      providesTags: (_res, _err, id) => [{ type: "Assignments", id }],
    }),

    assignUserToProject: builder.mutation<
      ProjectAssignment,
      { projectId: string; userId: string; roleInProject: string }
    >({
      query: ({ projectId, userId, roleInProject }) => ({
        url: `/api/v1/projects/${projectId}/assignments`,
        method: "POST",
        body: { user_id: userId, role_in_project: roleInProject },
      }),
      invalidatesTags: (_res, _err, { projectId }) => [
        { type: "Assignments", id: projectId },
        "Projects",
      ],
    }),

    removeUserFromProject: builder.mutation<
      void,
      { projectId: string; assignmentId: string }
    >({
      query: ({ projectId, assignmentId }) => ({
        url: `/api/v1/projects/${projectId}/assignments/${assignmentId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_res, _err, { projectId }) => [
        { type: "Assignments", id: projectId },
        "Projects",
      ],
    }),

    // 3. ГРАФИК СМР (ПРОРАБ И ИНЖЕНЕР)
    getSchedules: builder.query<ScheduleItem[], string>({
      query: (projectId) => `/api/v1/projects/${projectId}/schedules`,
      providesTags: (_res, _err, id) => [{ type: "Schedules", id }],
    }),

    applyTemplate: builder.mutation<
      { created_stages_count: number; status: string; message: string },
      { projectId: string; startDate?: string }
    >({
      query: ({ projectId, startDate }) => ({
        url: `/api/v1/projects/${projectId}/schedules/apply-template`,
        method: "POST",
        body: { start_date: startDate || new Date().toISOString() },
      }),
      invalidatesTags: (_res, _err, { projectId }) => [
        { type: "Schedules", id: projectId },
        { type: "Project", id: projectId },
        { type: "LiveSummary", id: projectId },
      ],
    }),

    bulkSyncSchedules: builder.mutation<
      { message: string },
      { projectId: string; stages: any[] }
    >({
      query: ({ projectId, stages }) => ({
        url: `/api/v1/projects/${projectId}/schedules/bulk-sync`,
        method: "PUT",
        body: { stages },
      }),
      invalidatesTags: (_res, _err, { projectId }) => [
        { type: "Schedules", id: projectId },
        { type: "LiveSummary", id: projectId },
      ],
    }),

    confirmSchedule: builder.mutation<{ message: string }, string>({
      query: (projectId) => ({
        url: `/api/v1/projects/${projectId}/schedules/confirm`,
        method: "POST",
      }),
      invalidatesTags: (_res, _err, projectId) => [
        { type: "Project", id: projectId },
        { type: "Schedules", id: projectId },
        { type: "LiveSummary", id: projectId },
        "Projects",
      ],
    }),

    startStage: builder.mutation<
      ScheduleItem,
      { projectId: string; scheduleId: string }
    >({
      query: ({ projectId, scheduleId }) => ({
        url: `/api/v1/projects/${projectId}/schedules/${scheduleId}/start`,
        method: "POST",
      }),
      invalidatesTags: (_res, _err, { projectId }) => [
        { type: "Schedules", id: projectId },
        { type: "LiveSummary", id: projectId },
        "Projects",
      ],
    }),

    completeStageEarly: builder.mutation<
      ScheduleItem,
      {
        projectId: string;
        scheduleId: string;
        actual_end_date?: string;
        comment?: string;
      }
    >({
      query: ({ projectId, scheduleId, actual_end_date, comment }) => ({
        url: `/api/v1/projects/${projectId}/schedules/${scheduleId}/complete-early`,
        method: "POST",
        body: {
          actual_end_date: actual_end_date || new Date().toISOString(),
          foreman_comment:
            comment || "Завершено досрочно по акту АОСР технадзора",
        },
      }),
      invalidatesTags: (_res, _err, { projectId }) => [
        { type: "Schedules", id: projectId },
        { type: "LiveSummary", id: projectId },
        "Projects",
      ],
    }),

    // 4. МОНИТОРИНГ, АЛЕРТЫ И СПЕЦСТАТУСЫ (ИНЖЕНЕР)
    getLiveSummary: builder.query<LiveSummaryResponse, string>({
      query: (projectId) => `/api/v1/projects/${projectId}/live-summary`,
      providesTags: (_res, _err, id) => [{ type: "LiveSummary", id }],
    }),

    getActiveAlert: builder.query<AlertResponse | null, string>({
      queryFn: async (projectId, _queryApi, _extraOptions, baseQuery) => {
        const res = await baseQuery(
          `/api/v1/alerts/active?project_id=${projectId}`,
        );
        if (res.error) {
          if (res.error.status === 404) {
            return { data: null };
          }
          return { error: res.error };
        }
        return { data: (res.data as AlertResponse) || null };
      },
      providesTags: (_res, _err, id) => [{ type: "Alerts", id }],
    }),

    getAlertsList: builder.query<
      AlertResponse[],
      { projectId: string; limit?: number; offset?: number }
    >({
      query: ({ projectId, limit = 50, offset = 0 }) =>
        `/api/v1/alerts?project_id=${projectId}&limit=${limit}&offset=${offset}`,
      providesTags: (_res, _err, { projectId }) => [
        { type: "Alerts", id: projectId },
      ],
    }),

    resolveAlert: builder.mutation<
      AlertResponse,
      { alertId: string; projectId: string; payload: AlertResolveRequest }
    >({
      query: ({ alertId, payload }) => ({
        url: `/api/v1/alerts/${alertId}/resolve`,
        method: "POST",
        body: payload,
      }),
      invalidatesTags: (_res, _err, { projectId }) => [
        { type: "Alerts", id: projectId },
        { type: "LiveSummary", id: projectId },
        { type: "SpecialStatus", id: projectId },
        "Projects",
      ],
    }),

    cascadeShift: builder.mutation<
      CascadeShiftResponse,
      { projectId: string; payload: CascadeShiftRequest }
    >({
      query: ({ projectId, payload }) => ({
        url: `/api/v1/projects/${projectId}/schedules/cascade-shift`,
        method: "POST",
        body: payload,
      }),
      invalidatesTags: (_res, _err, { projectId }) => [
        { type: "Schedules", id: projectId },
        { type: "LiveSummary", id: projectId },
        { type: "SpecialStatus", id: projectId },
        "Projects",
      ],
    }),

    getCurrentSpecialStatus: builder.query<
      SpecialStatusResponse | null,
      string
    >({
      queryFn: async (projectId, _queryApi, _extraOptions, baseQuery) => {
        const res = await baseQuery(
          `/api/v1/special-statuses/projects/${projectId}/current`,
        );
        if (res.error) {
          if (res.error.status === 404) {
            return { data: null };
          }
          return { error: res.error };
        }
        return { data: (res.data as SpecialStatusResponse) || null };
      },
      providesTags: (_res, _err, id) => [{ type: "SpecialStatus", id }],
    }),

    submitOrangeReport: builder.mutation<
      OrangeStatusReportResponse,
      {
        windowId: string;
        projectId: string;
        payload: OrangeStatusReportCreate;
      }
    >({
      query: ({ windowId, payload }) => ({
        url: `/api/v1/special-statuses/windows/${windowId}/orange-report`,
        method: "POST",
        body: payload,
      }),
      invalidatesTags: (_res, _err, { projectId }) => [
        { type: "SpecialStatus", id: projectId },
        { type: "LiveSummary", id: projectId },
        "Projects",
      ],
    }),

    closeSpecialStatusWindow: builder.mutation<
      SpecialStatusResponse,
      { windowId: string; projectId: string; comment: string }
    >({
      query: ({ windowId, comment }) => ({
        url: `/api/v1/special-statuses/windows/${windowId}/close`,
        method: "POST",
        body: { close_comment: comment },
      }),
      invalidatesTags: (_res, _err, { projectId }) => [
        { type: "SpecialStatus", id: projectId },
        { type: "LiveSummary", id: projectId },
        "Projects",
      ],
    }),

    // 5. ВИДЕОКАМЕРЫ И КАДРЫ
    getCameras: builder.query<CameraItem[], string>({
      query: (projectId) => `/api/v1/projects/${projectId}/cameras`,
      providesTags: (_res, _err, id) => [{ type: "Cameras", id }],
    }),

    addCamera: builder.mutation<
      CameraItem,
      { projectId: string; streamUrl: string }
    >({
      query: ({ projectId, streamUrl }) => ({
        url: `/api/v1/projects/${projectId}/cameras`,
        method: "POST",
        body: { stream_url: streamUrl },
      }),
      invalidatesTags: (_res, _err, { projectId }) => [
        { type: "Cameras", id: projectId },
        { type: "Project", id: projectId },
      ],
    }),

    toggleCameraActive: builder.mutation<
      CameraItem,
      { cameraId: string; projectId: string; isActive: boolean }
    >({
      query: ({ cameraId, isActive }) => ({
        url: `/api/v1/cameras/${cameraId}`,
        method: "PATCH",
        body: { is_active: isActive },
      }),
      invalidatesTags: (_res, _err, { projectId }) => [
        { type: "Cameras", id: projectId },
      ],
    }),

    deleteCamera: builder.mutation<
      { message: string },
      { cameraId: string; projectId: string }
    >({
      query: ({ cameraId }) => ({
        url: `/api/v1/cameras/${cameraId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_res, _err, { projectId }) => [
        { type: "Cameras", id: projectId },
        { type: "Project", id: projectId },
      ],
    }),

    getProjectFrames: builder.query<
      FrameItemResponse[],
      { projectId: string; limit?: number; offset?: number }
    >({
      query: ({ projectId, limit = 50, offset = 0 }) =>
        `/api/v1/projects/${projectId}/frames?limit=${limit}&offset=${offset}`,
      providesTags: (_res, _err, { projectId }) => [
        { type: "Frames", id: projectId },
      ],
    }),

    uploadCameraFrame: builder.mutation<
      FrameItemResponse,
      { cameraId: string; projectId: string; file: File }
    >({
      query: ({ cameraId, file }) => {
        const formData = new FormData();
        formData.append("file", file);
        return {
          url: `/api/v1/cameras/${cameraId}/frames/upload`,
          method: "POST",
          body: formData,
        };
      },
      invalidatesTags: (_res, _err, { projectId }) => [
        { type: "Frames", id: projectId },
        { type: "LiveSummary", id: projectId },
        { type: "Alerts", id: projectId },
      ],
    }),

    markFrameAsEvidence: builder.mutation<
      { message: string },
      { frameId: string; projectId: string; isSaved: boolean }
    >({
      query: ({ frameId, isSaved }) => ({
        url: `/api/v1/frames/${frameId}/evidence`,
        method: "PATCH",
        body: { is_saved_for_report: isSaved },
      }),
      invalidatesTags: (_res, _err, { projectId }) => [
        { type: "Frames", id: projectId },
      ],
    }),
  }),
});

export const {
  useGetProjectsQuery,
  useGetProjectByIdQuery,
  useCreateProjectMutation,
  useGetProjectTypesQuery,
  useGetEquipmentTypesQuery,
  useGetUsersQuery,
  useUpdateUserRoleByEmailMutation,
  useGetProjectAssignmentsQuery,
  useAssignUserToProjectMutation,
  useRemoveUserFromProjectMutation,
  useGetSchedulesQuery,
  useApplyTemplateMutation,
  useBulkSyncSchedulesMutation,
  useConfirmScheduleMutation,
  useStartStageMutation,
  useCompleteStageEarlyMutation,
  useGetLiveSummaryQuery,
  useGetActiveAlertQuery,
  useGetAlertsListQuery,
  useResolveAlertMutation,
  useCascadeShiftMutation,
  useGetCurrentSpecialStatusQuery,
  useSubmitOrangeReportMutation,
  useCloseSpecialStatusWindowMutation,
  useGetCamerasQuery,
  useAddCameraMutation,
  useToggleCameraActiveMutation,
  useDeleteCameraMutation,
  useGetProjectFramesQuery,
  useUploadCameraFrameMutation,
  useMarkFrameAsEvidenceMutation,
} = rtkApi;
