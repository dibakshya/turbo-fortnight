import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../prisma';
import { sseBroker } from '../sse';

const createIncidentSchema = z.object({
  playbookId: z.string().trim().min(1),
  title: z.string().trim().min(3).max(120).optional()
});

const updateStepSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']),
  assignee: z.string().trim().min(1).optional()
});

export const incidentsRouter = Router();

incidentsRouter.get('/', async (_req, res) => {
  const incidents = await prisma.incident.findMany({
    include: {
      playbook: true,
      steps: {
        include: { playbookStep: true },
        orderBy: { playbookStep: { order: 'asc' } }
      }
    },
    orderBy: { startedAt: 'desc' }
  });

  res.json(incidents);
});

incidentsRouter.post('/', async (req, res) => {
  const payload = createIncidentSchema.parse(req.body);

  const playbook = await prisma.playbook.findUnique({
    where: { id: payload.playbookId },
    include: { steps: { orderBy: { order: 'asc' } } }
  });

  if (!playbook) {
    return res.status(404).json({ message: 'Playbook not found' });
  }

  const incident = await prisma.$transaction(async (tx) => {
    const createdIncident = await tx.incident.create({
      data: {
        playbookId: playbook.id,
        title: payload.title ?? `${playbook.name} Incident - ${new Date().toISOString()}`
      }
    });

    await tx.incidentStep.createMany({
      data: playbook.steps.map((step) => ({
        incidentId: createdIncident.id,
        playbookStepId: step.id
      }))
    });

    return tx.incident.findUniqueOrThrow({
      where: { id: createdIncident.id },
      include: {
        playbook: true,
        steps: {
          include: { playbookStep: true },
          orderBy: { playbookStep: { order: 'asc' } }
        }
      }
    });
  });

  sseBroker.publish(incident.id, { type: 'INCIDENT_CREATED', payload: incident });

  res.status(201).json(incident);
});

incidentsRouter.get('/:id', async (req, res) => {
  const incident = await prisma.incident.findUnique({
    where: { id: req.params.id },
    include: {
      playbook: true,
      steps: {
        include: { playbookStep: true },
        orderBy: { playbookStep: { order: 'asc' } }
      }
    }
  });

  if (!incident) {
    return res.status(404).json({ message: 'Incident not found' });
  }

  res.json(incident);
});

incidentsRouter.patch('/:id/steps/:stepId', async (req, res) => {
  const payload = updateStepSchema.parse(req.body);

  const incident = await prisma.incident.findUnique({ where: { id: req.params.id } });
  if (!incident) {
    return res.status(404).json({ message: 'Incident not found' });
  }

  const existingStep = await prisma.incidentStep.findUnique({
    where: { id: req.params.stepId },
    include: { playbookStep: true }
  });

  if (!existingStep || existingStep.incidentId !== incident.id) {
    return res.status(404).json({ message: 'Step not found' });
  }

  const timestamps: { startedAt?: Date; completedAt?: Date | null } = {};

  if (payload.status === 'IN_PROGRESS' && !existingStep.startedAt) {
    timestamps.startedAt = new Date();
  }

  if (payload.status === 'COMPLETED') {
    timestamps.completedAt = new Date();
    if (!existingStep.startedAt) {
      timestamps.startedAt = new Date();
    }
  } else {
    timestamps.completedAt = null;
  }

  const updatedStep = await prisma.incidentStep.update({
    where: { id: existingStep.id },
    data: {
      status: payload.status,
      assignee: payload.assignee ?? existingStep.assignee,
      startedAt: timestamps.startedAt ?? existingStep.startedAt,
      completedAt: timestamps.completedAt ?? existingStep.completedAt
    },
    include: { playbookStep: true }
  });

  sseBroker.publish(incident.id, { type: 'STEP_UPDATED', payload: updatedStep });

  // Update incident status if all steps completed
  const remaining = await prisma.incidentStep.count({
    where: { incidentId: incident.id, status: { not: 'COMPLETED' } }
  });

  if (remaining === 0 && incident.status !== 'COMPLETED') {
    const completedIncident = await prisma.incident.update({
      where: { id: incident.id },
      data: { status: 'COMPLETED', completedAt: new Date() }
    });
    sseBroker.publish(incident.id, { type: 'INCIDENT_COMPLETED', payload: completedIncident });
  }

  res.json(updatedStep);
});

incidentsRouter.get('/:id/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const listenerId = randomUUID();
  const { id } = req.params;

  sseBroker.addListener(id, { id: listenerId, res });
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', payload: { incidentId: id } })}\n\n`);

  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'HEARTBEAT', timestamp: Date.now() })}\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseBroker.removeListener(id, listenerId);
  });
});
