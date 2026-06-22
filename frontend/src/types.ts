// Domain types shared across the app.

export interface Team {
  id: string;
  name: string;
}

export interface Department {
  id: string;
  name: string;
  teams: Team[];
}

export interface Employee {
  id: string;
  fullName: string;
  departmentId: string;
  team: string; // team name within the department
  skills: string[];
  active: boolean;
}

// Result returned by the backend /classify endpoint.
export interface ClassifyResult {
  category: string;
  department: string;
  confidence: number;
  reason: string;
  document_name?: string | null;
}

// Runtime config from the backend /config endpoint.
export interface AppConfig {
  demo_env: boolean;
  departments: string[];
}
