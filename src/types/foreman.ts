// src/types/foreman.ts

export type ProjectStatus = "DRAFT" | "ACTIVE";
export type HealthStatus = "GREEN" | "YELLOW" | "RED";

export interface EquipmentRequirement {
  id?: string;
  type: string;
  count: number;
}

export interface OksStage {
  id: string;
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  equipment: EquipmentRequirement[];
}

export interface OksProject {
  id: string;
  name: string;
  address: string;
  status: ProjectStatus;
  progress: number;
  health_status: HealthStatus;
  reason: string;
}