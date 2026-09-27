// src/api/apiAdmin.ts

export interface CreateProjectRequest {
  name: string;
  address: string;
  type_id: string;
}

export interface Project {
  id: string;
  name: string;
  address: string;
  type_id: string;
  status: string;
  schedule_status: string;
  current_alert_level: string;
  current_special_status: string;
}

export interface ProjectListItem {
  id: string;
  name: string;
  address: string;
  type_id: string;
  status: string;
  schedule_status: string;
  current_alert_level: string;
  current_special_status: string;
  current_stage_name: string;
  physical_progress_percent: number;
  time_elapsed_percent: number;
  critical_alerts_count: number;
  created_at: string;
}

export interface ProjectType {
  id: string;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  roles: string[];
}

export interface ProjectAssignment {
  id: string;
  project_id: string;
  user_id: string;
  role_in_project: string;
  assigned_at: string;
}

export const createProject = async (
  authFetch: (input: string, init?: RequestInit) => Promise<Response>,
  data: CreateProjectRequest,
): Promise<Project> => {
  const response = await authFetch("/api/v1/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    let message = "Не удалось создать ОКС";
    try {
      const error = await response.json();
      if (error?.detail) {
        message =
          typeof error.detail === "string"
            ? error.detail
            : JSON.stringify(error.detail);
      }
    } catch {}
    throw new Error(message);
  }

  return response.json();
};

export const getProjectTypes = async (
  authFetch: (input: string, init?: RequestInit) => Promise<Response>,
): Promise<ProjectType[]> => {
  const response = await authFetch("/api/v1/dictionaries/project-types", {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error("Не удалось загрузить типы объектов");
  }

  return response.json();
};

export const getProjects = async (
  authFetch: (input: string, init?: RequestInit) => Promise<Response>,
  params: {
    status?: string;
    alert_level?: string;
    special_status?: string;
    type_id?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<ProjectListItem[]> => {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set("status", params.status);
  if (params.alert_level) searchParams.set("alert_level", params.alert_level);
  if (params.special_status)
    searchParams.set("special_status", params.special_status);
  if (params.type_id) searchParams.set("type_id", params.type_id);
  if (params.limit !== undefined)
    searchParams.set("limit", String(params.limit));
  if (params.offset !== undefined)
    searchParams.set("offset", String(params.offset));

  const query = searchParams.toString();
  const response = await authFetch(
    `/api/v1/projects${query ? `?${query}` : ""}`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error("Не удалось загрузить реестр ОКС");
  }

  return response.json();
};

// PATCH /api/v1/auth/users/roles - по Swagger роли меняются по email
export const updateUserRoleByEmail = async (
  authFetch: (input: string, init?: RequestInit) => Promise<Response>,
  email: string,
  roles: string[],
): Promise<User> => {
  const response = await authFetch("/api/v1/auth/users/roles", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, roles }),
  });

  if (!response.ok) {
    let message = "Не удалось обновить роль";
    try {
      const error = await response.json();
      if (error?.detail) {
        message =
          typeof error.detail === "string"
            ? error.detail
            : JSON.stringify(error.detail);
      }
    } catch {}
    throw new Error(message);
  }

  return response.json();
};

// POST /api/v1/projects/{project_id}/assignments
export const assignUserToProject = async (
  authFetch: (input: string, init?: RequestInit) => Promise<Response>,
  projectId: string,
  userId: string,
  roleInProject: string = "foreman",
): Promise<ProjectAssignment> => {
  const response = await authFetch(
    `/api/v1/projects/${projectId}/assignments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, role_in_project: roleInProject }),
    },
  );

  if (!response.ok) {
    let message = "Не удалось назначить сотрудника на объект";
    try {
      const error = await response.json();
      if (error?.detail) {
        message =
          typeof error.detail === "string"
            ? error.detail
            : JSON.stringify(error.detail);
      }
    } catch {}
    throw new Error(message);
  }

  return response.json();
};

// GET /api/v1/projects/{project_id}/assignments
export const getProjectAssignments = async (
  authFetch: (input: string, init?: RequestInit) => Promise<Response>,
  projectId: string,
): Promise<ProjectAssignment[]> => {
  const response = await authFetch(
    `/api/v1/projects/${projectId}/assignments`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error("Не удалось получить команду объекта");
  }

  return response.json();
};

// DELETE /api/v1/projects/{project_id}/assignments/{assignment_id}
export const removeUserFromProject = async (
  authFetch: (input: string, init?: RequestInit) => Promise<Response>,
  projectId: string,
  assignmentId: string
): Promise<void> => {
  const response = await authFetch(
    `/api/v1/projects/${projectId}/assignments/${assignmentId}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    let message = "Не удалось отвязать сотрудника от объекта";
    try {
      const error = await response.json();
      if (error?.detail) {
        message = typeof error.detail === "string" ? error.detail : JSON.stringify(error.detail);
      }
    } catch {}
    throw new Error(message);
  }
};