import { OksProject, OksStage } from "../types/foreman";

// Базовый URL
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

// Заглушки для API (потом подключим реальные fetch/axios запросы)
export const foremanApi = {
  getProject: async (projectId: string): Promise<OksProject> => {
    throw new Error("Not implemented");
  },
  
  getStages: async (projectId: string): Promise<OksStage[]> => {
    throw new Error("Not implemented");
  },

  lockProject: async (projectId: string): Promise<void> => {
    throw new Error("Not implemented");
  },

  saveStages: async (projectId: string, stages: OksStage[]): Promise<void> => {
    throw new Error("Not implemented");
  }
};