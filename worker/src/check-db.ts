import { prisma } from './services/db';

async function main() {
  const workers = await prisma.worker.findMany({
    include: {
      heartbeats: {
        orderBy: { timestamp: 'desc' },
        take: 2,
      },
    },
  });
  console.log('\n================ Connected Workers ================');
  console.log(JSON.stringify(workers, null, 2));

  const queues = await prisma.queue.findMany();
  console.log('\n================ Queues ================');
  console.log(JSON.stringify(queues, null, 2));

  const jobs = await prisma.job.findMany({
    include: {
      executions: {
        include: {
          logs: {
            orderBy: { timestamp: 'asc' },
          },
        },
      },
      deadLetterJob: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  console.log('\n================ Jobs & Executions ================');
  console.log(JSON.stringify(jobs, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
