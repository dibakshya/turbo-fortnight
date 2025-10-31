import { prisma } from './prisma';
import { logger } from './logger';

const seed = async () => {
  await prisma.incidentStep.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.playbookStep.deleteMany();
  await prisma.playbook.deleteMany();

  const playbooks = [
    {
      name: 'Checkout Latency Spike',
      description: 'Runbook for handling elevated latency in checkout service.',
      steps: [
        {
          title: 'Acknowledge Pager',
          description: 'Acknowledge alert and notify incident channel.',
          order: 1
        },
        {
          title: 'Assess Metrics',
          description: 'Review Grafana dashboard for checkout latency and error spikes.',
          order: 2
        },
        {
          title: 'Scale Service',
          description: 'Trigger horizontal pod autoscaling or scale up VM pool.',
          order: 3
        },
        {
          title: 'Update Stakeholders',
          description: 'Post status update in leadership channel every 15 minutes.',
          order: 4
        }
      ]
    },
    {
      name: 'Payments Gateway Outage',
      description: 'Checklist for responding to third-party payments downtime.',
      steps: [
        {
          title: 'Switch Gateway',
          description: 'Fail over to backup payment gateway provider.',
          order: 1
        },
        {
          title: 'Notify Finance Ops',
          description: 'Alert finance operations about payment disruption.',
          order: 2
        },
        {
          title: 'Communicate to Sellers',
          description: 'Send communication to sellers about potential delays.',
          order: 3
        }
      ]
    }
  ];

  for (const playbook of playbooks) {
    await prisma.playbook.create({
      data: {
        name: playbook.name,
        description: playbook.description,
        steps: {
          create: playbook.steps
        }
      }
    });
  }

  logger.info('Database seeded with sample playbooks');
};

seed()
  .catch((error) => {
    logger.error(error, 'Failed to seed database');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
