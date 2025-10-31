export type PlaybookStep = {
  id: string;
  title: string;
  description: string;
  order: number;
};

export type Playbook = {
  id: string;
  name: string;
  description: string;
  steps: PlaybookStep[];
  createdAt: string;
};

export type IncidentStepStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export type IncidentStep = {
  id: string;
  status: IncidentStepStatus;
  assignee?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  playbookStep: PlaybookStep;
};

export type IncidentStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export type Incident = {
  id: string;
  title: string;
  status: IncidentStatus;
  startedAt: string;
  completedAt?: string | null;
  playbook: Playbook;
  steps: IncidentStep[];
};

export type IncidentEvent =
  | { type: 'CONNECTED'; payload: { incidentId: string } }
  | { type: 'HEARTBEAT'; timestamp: number }
  | { type: 'INCIDENT_CREATED'; payload: Incident }
  | { type: 'STEP_UPDATED'; payload: IncidentStep }
  | { type: 'INCIDENT_COMPLETED'; payload: Incident };
