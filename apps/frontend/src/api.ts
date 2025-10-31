import { API_BASE_URL } from './config';
import type {
  Incident,
  IncidentEvent,
  IncidentStep,
  IncidentStepStatus,
  Playbook
} from './types';

const jsonHeaders = {
  'Content-Type': 'application/json'
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...jsonHeaders,
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request to ${path} failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const fetchPlaybooks = () => request<Playbook[]>('/playbooks');

export const fetchIncidents = () => request<Incident[]>('/incidents');

export const fetchIncident = (incidentId: string) => request<Incident>(`/incidents/${incidentId}`);

export const createIncident = (payload: { playbookId: string; title?: string }) =>
  request<Incident>('/incidents', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

export const updateIncidentStep = (
  incidentId: string,
  stepId: string,
  payload: { status: IncidentStepStatus; assignee?: string }
) =>
  request<IncidentStep>(`/incidents/${incidentId}/steps/${stepId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });

export const subscribeToIncident = (incidentId: string, handler: (event: IncidentEvent) => void) => {
  const eventSource = new EventSource(`${API_BASE_URL}/incidents/${incidentId}/stream`);

  eventSource.onmessage = (event) => {
    try {
      const data: IncidentEvent = JSON.parse(event.data);
      handler(data);
    } catch (error) {
      console.error('Failed to parse SSE event', error);
    }
  };

  eventSource.onerror = () => {
    console.warn('SSE connection error, closing stream');
    eventSource.close();
  };

  return eventSource;
};
