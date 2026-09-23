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

export const createProject = async (
    authFetch: (
        input: string,
        init?: RequestInit
    ) => Promise<Response>,
    data: CreateProjectRequest
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
                message =
                    typeof error.detail === "string"
                        ? error.detail
                        : message;
            }
        } catch {
            // Оставляем стандартное сообщение
        }

        throw new Error(message);
    }

    return response.json();
};