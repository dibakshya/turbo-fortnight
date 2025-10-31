import { Router } from 'express';

import { prisma } from '../prisma';

export const playbooksRouter = Router();

playbooksRouter.get('/', async (_req, res) => {
  const playbooks = await prisma.playbook.findMany({
    include: {
      steps: {
        orderBy: { order: 'asc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json(playbooks);
});
