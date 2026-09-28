export type ScheduleStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED";

export interface StageEquipmentRequirement {
  equipment_type: string; 
  equipment_type_id?: string;    // UUID
  required_count: number;
  is_required?: boolean;
}

export interface ScheduleStageItem {
  id: string;
  project_id: string;
  stage_name: string;
  substage_name: string;
  sequence_order: number;
  base_start_date: string;
  base_end_date: string;
  phantom_start_date?: string | null;
  phantom_end_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  status: ScheduleStatus | string;
  equipment_requirements: StageEquipmentRequirement[];
}

export interface StageSyncPayload {
  id?: string;
  stage_name: string;
  substage_name: string;
  sequence_order: number;
  base_start_date: string;
  base_end_date: string;
  equipment_requirements: StageEquipmentRequirement[];
}

export interface ApplyTemplateResponse {
  created_stages_count: number;
  status: string;
  message: string;
}

export interface CurrentRequirementsResponse {
  schedule_id: string;
  project_id: string;
  stage_name: string;
  substage_name: string;
  sequence_order: number;
  status: string;
  base_start_date: string;
  base_end_date: string;
  required_equipment: any[];
}
