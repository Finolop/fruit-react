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

export interface GetUsersParams {
  role?: string;
  search?: string;
  limit?: number;
  offset?: number;
}


export const createProject = async (
  authFetch: (input: string, init?: RequestInit) => Promise<Response>,
  data: CreateProjectRequest,
): Promise<Project> => {
  const response = await authFetch("/api/v1/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    let message = "Не удалось создать ОКС";

    try {
      const error = await response.json();

      if (error?.detail) {
        message = typeof error.detail === "string" ? error.detail : message;
      }
    } catch {
      // Оставляем стандартное сообщение
    }

    throw new Error(message);
  }

  return response.json();
};

export const getProjectTypes = async (
    authFetch: (
        input: string,
        init?: RequestInit
    ) => Promise<Response>
): Promise<ProjectType[]> => {
    const response = await authFetch(
        "/api/v1/dictionaries/project-types",
        {
            method: "GET",
        }
    );

    if (!response.ok) {
        throw new Error("Не удалось загрузить типы объектов");
    }

    return response.json();
};

export const getUsers = async (
  authFetch: (input: string, init?: RequestInit) => Promise<Response>,
  params: GetUsersParams = {},
): Promise<User[]> => {
  const searchParams = new URLSearchParams();

  if (params.role) {
    searchParams.set("role", params.role);
  }

  if (params.search) {
    searchParams.set("search", params.search);
  }

  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }

  if (params.offset !== undefined) {
    searchParams.set("offset", String(params.offset));
  }

  const query = searchParams.toString();

  const response = await authFetch(`/api/v1/users${query ? `?${query}` : ""}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error("Не удалось загрузить пользователей");
  }

  return response.json();
};
