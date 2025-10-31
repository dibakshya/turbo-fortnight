import { Router } from 'express';

import { incidentsRouter } from './incidents';
import { playbooksRouter } from './playbooks';

export const router = Router();

router.use('/playbooks', playbooksRouter);
router.use('/incidents', incidentsRouter);
