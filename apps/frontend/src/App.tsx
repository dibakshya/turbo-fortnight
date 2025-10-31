import { useEffect, useMemo, useState } from 'react';
import './App.css';

import {
  createIncident,
  fetchIncident,
  fetchIncidents,
  fetchPlaybooks,
  subscribeToIncident,
  updateIncidentStep
} from './api';
import { formatDateTime, incidentStatusLabel, stepStatusLabel } from './config';
import type { Incident, IncidentStepStatus, Playbook } from './types';

const stepActions: IncidentStepStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];

type IncidentOption = {
  label: string;
  value: string;
};

function App() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [currentIncidentId, setCurrentIncidentId] = useState<string | null>(null);
  const [currentIncident, setCurrentIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingStepId, setUpdatingStepId] = useState<string | null>(null);
  const [assigneeDrafts, setAssigneeDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [playbookData, incidentData] = await Promise.all([fetchPlaybooks(), fetchIncidents()]);
        setPlaybooks(playbookData);
        setIncidents(incidentData);

        if (incidentData.length > 0) {
          setCurrentIncidentId(incidentData[0].id);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load initial data';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    if (!currentIncidentId) {
      setCurrentIncident(null);
      return;
    }

    let isActive = true;

    const loadIncident = async () => {
      try {
        const incident = await fetchIncident(currentIncidentId);
        if (isActive) {
          setCurrentIncident(incident);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load incident';
        if (isActive) setError(message);
      }
    };

    loadIncident();
    const eventSource = subscribeToIncident(currentIncidentId, (event) => {
      if (!isActive) return;
      if (event.type === 'STEP_UPDATED') {
        setCurrentIncident((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            steps: prev.steps.map((step) =>
              step.id === event.payload.id ? { ...step, ...event.payload } : step
            )
          };
        });
        setIncidents((prev) =>
          prev.map((incident) =>
            incident.id === currentIncidentId
              ? {
                  ...incident,
                  steps: incident.steps.map((step) =>
                    step.id === event.payload.id ? { ...step, ...event.payload } : step
                  )
                }
              : incident
          )
        );
        setAssigneeDrafts((prev) => ({
          ...prev,
          [event.payload.id]: event.payload.assignee ?? ''
        }));
      }

      if (event.type === 'INCIDENT_COMPLETED' || event.type === 'INCIDENT_CREATED') {
        setCurrentIncident(event.payload);
        setIncidents((prev) =>
          prev.map((incident) => (incident.id === event.payload.id ? event.payload : incident))
        );
      }
    });

    return () => {
      isActive = false;
      eventSource.close();
    };
  }, [currentIncidentId]);

  useEffect(() => {
    if (!currentIncident) return;
    const drafts: Record<string, string> = {};
    currentIncident.steps.forEach((step) => {
      drafts[step.id] = step.assignee ?? '';
    });
    setAssigneeDrafts(drafts);
  }, [currentIncident?.id]);

  const incidentOptions: IncidentOption[] = useMemo(
    () =>
      incidents.map((incident) => ({
        value: incident.id,
        label: `${incident.title} • ${formatDateTime(incident.startedAt)}`
      })),
    [incidents]
  );

  const handleStartIncident = async (playbook: Playbook) => {
    setIsCreating(true);
    setError(null);
    try {
      const incident = await createIncident({ playbookId: playbook.id });
      setIncidents((prev) => [incident, ...prev]);
      setCurrentIncidentId(incident.id);
      setCurrentIncident(incident);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start incident';
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleReloadIncident = async () => {
    if (!currentIncidentId) return;
    try {
      const latest = await fetchIncident(currentIncidentId);
      setCurrentIncident(latest);
      setIncidents((prev) => prev.map((incident) => (incident.id === latest.id ? latest : incident)));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to refresh incident';
      setError(message);
    }
  };

  const handleUpdateStep = async (stepId: string, status: IncidentStepStatus) => {
    if (!currentIncidentId) return;
    setUpdatingStepId(stepId);
    setError(null);
    try {
      const assignee = assigneeDrafts[stepId]?.trim();
      const updated = await updateIncidentStep(currentIncidentId, stepId, {
        status,
        assignee: assignee === '' ? undefined : assignee
      });

      setCurrentIncident((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          steps: prev.steps.map((step) => (step.id === updated.id ? { ...step, ...updated } : step))
        };
      });

      setIncidents((prev) =>
        prev.map((incident) =>
          incident.id === currentIncidentId
            ? {
                ...incident,
                steps: incident.steps.map((step) =>
                  step.id === updated.id ? { ...step, ...updated } : step
                )
              }
            : incident
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update step';
      setError(message);
    } finally {
      setUpdatingStepId(null);
    }
  };

  const handleAssigneeChange = (stepId: string, value: string) => {
    setAssigneeDrafts((prev) => ({
      ...prev,
      [stepId]: value
    }));
  };

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>Flipkart Incident Response Copilot</h1>
          <p className="app__subtitle">Coordinate runbooks, track tasks, and capture learnings fast.</p>
        </div>
        <button className="refresh-button" onClick={handleReloadIncident} disabled={!currentIncidentId}>
          Refresh Incident
        </button>
      </header>

      {error && (
        <div className="alert" role="alert">
          <span>{error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading workspace…</div>
      ) : (
        <main className="layout">
          <section className="panel">
            <h2>Playbooks</h2>
            <p className="panel__hint">Launch an incident using a curated runbook.</p>
            <div className="playbook-list">
              {playbooks.map((playbook) => (
                <article key={playbook.id} className="playbook-card">
                  <div className="playbook-card__body">
                    <h3>{playbook.name}</h3>
                    <p>{playbook.description}</p>
                    <span className="playbook-card__meta">{playbook.steps.length} steps</span>
                  </div>
                  <button
                    className="primary-button"
                    onClick={() => handleStartIncident(playbook)}
                    disabled={isCreating}
                  >
                    Launch Incident
                  </button>
                </article>
              ))}
              {playbooks.length === 0 && <p>No playbooks defined yet.</p>}
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <div>
                <h2>Active Incidents</h2>
                <p className="panel__hint">Select an incident to track progress in real time.</p>
              </div>
              <select
                value={currentIncidentId ?? ''}
                onChange={(event) => setCurrentIncidentId(event.target.value || null)}
              >
                <option value="">Select incident…</option>
                {incidentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {currentIncident ? (
              <div className="incident-card">
                <header className="incident-card__header">
                  <div>
                    <h3>{currentIncident.title}</h3>
                    <p>{currentIncident.playbook.name}</p>
                  </div>
                  <span className={`status-badge status-${currentIncident.status.toLowerCase()}`}>
                    {incidentStatusLabel[currentIncident.status] ?? currentIncident.status}
                  </span>
                </header>

                <dl className="incident-meta">
                  <div>
                    <dt>Started</dt>
                    <dd>{formatDateTime(currentIncident.startedAt)}</dd>
                  </div>
                  <div>
                    <dt>Completed</dt>
                    <dd>{formatDateTime(currentIncident.completedAt)}</dd>
                  </div>
                </dl>

                <div className="steps">
                  {currentIncident.steps.map((step) => (
                    <article key={step.id} className="step-card">
                      <div className="step-card__header">
                        <div>
                          <h4>
                            <span className="step-order">#{step.playbookStep.order}</span>
                            {step.playbookStep.title}
                          </h4>
                          <p className="step-description">{step.playbookStep.description}</p>
                        </div>
                        <span className={`status-tag status-${step.status.toLowerCase()}`}>
                          {stepStatusLabel[step.status] ?? step.status}
                        </span>
                      </div>

                      <div className="step-assign">
                        <label>
                          Assignee
                          <input
                            type="text"
                            value={assigneeDrafts[step.id] ?? ''}
                            onChange={(event) => handleAssigneeChange(step.id, event.target.value)}
                            placeholder="Optional assignee"
                          />
                        </label>
                        <div className="step-actions">
                          {stepActions.map((status) => (
                            <button
                              key={status}
                              className={
                                step.status === status ? 'chip chip--active' : 'chip chip--ghost'
                              }
                              onClick={() => handleUpdateStep(step.id, status)}
                              disabled={updatingStepId === step.id}
                            >
                              {stepStatusLabel[status]}
                            </button>
                          ))}
                        </div>
                      </div>

                      <dl className="step-meta">
                        <div>
                          <dt>Started</dt>
                          <dd>{formatDateTime(step.startedAt)}</dd>
                        </div>
                        <div>
                          <dt>Completed</dt>
                          <dd>{formatDateTime(step.completedAt)}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <p className="panel__placeholder">Select or launch an incident to get started.</p>
            )}
          </section>
        </main>
      )}
    </div>
  );
}

export default App;
