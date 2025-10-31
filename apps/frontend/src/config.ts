export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

export const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleString();
};

export const incidentStatusLabel: Record<string, string> = {
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
};

export const stepStatusLabel: Record<string, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed'
};
