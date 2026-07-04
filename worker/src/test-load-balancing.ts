const BACKEND_URL = 'http://localhost:3000';

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('🚀 Starting Automated Multi-Worker Load Balancing Test...\n');

  const email = `tester-${Date.now()}@example.com`;
  const password = 'password123';
  const name = 'Load Balance Tester';

  // 1. Register User
  console.log(`[1/5] Registering tester user: ${email}...`);
  const regRes = await fetch(`${BACKEND_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  if (!regRes.ok) {
    throw new Error(`Registration failed: ${await regRes.text()}`);
  }

  // 2. Login User
  console.log('[2/5] Logging in to retrieve JWT token...');
  const loginRes = await fetch(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!loginRes.ok) {
    throw new Error(`Login failed: ${await loginRes.text()}`);
  }
  const { access_token } = await loginRes.json();
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${access_token}`,
  };

  // 3. Fetch User Profile to get Project ID
  const profileRes = await fetch(`${BACKEND_URL}/auth/profile`, { headers: authHeaders });
  const profile = await profileRes.json();
  const projectId = profile.organizations[0].projects[0].id;

  // 4. Create Queue with High Concurrency Limit
  console.log('[3/5] Creating high-capacity queue "Bulk Queue"...');
  const queueRes = await fetch(`${BACKEND_URL}/queues`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Bulk Queue',
      description: 'Handles high throughput workloads',
      concurrencyLimit: 20, // Let workers handle as much as they want
      priorityEnabled: false,
      projectId,
    }),
  });
  const queue = await queueRes.json();
  console.log(`✅ Queue created. ID: ${queue.id}`);

  // 5. Submit 50 Jobs in Parallel
  const totalJobsCount = 50;
  console.log(`[4/5] Submitting ${totalJobsCount} jobs in parallel...`);
  const jobPromises: Promise<any>[] = [];
  for (let i = 1; i <= totalJobsCount; i++) {
    jobPromises.push(
      fetch(`${BACKEND_URL}/jobs`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: 'SEND_EMAIL',
          payload: {
            to: `recipient-${i}@bulk.com`,
            shouldFail: false,
            data: { index: i },
          },
          priority: 0,
          queueId: queue.id,
        }),
      }).then(async (res) => {
        if (!res.ok) throw new Error(`Job submission failed: ${await res.text()}`);
        return res.json();
      })
    );
  }

  const dispatchedJobs = await Promise.all(jobPromises);
  console.log(`✅ Dispatched ${dispatchedJobs.length} jobs successfully.`);

  // 6. Wait for all jobs to complete
  console.log('[5/5] Waiting for workers to execute the jobs...');
  let allDone = false;
  let checksCount = 0;
  const maxChecks = 45; // 45 * 2 seconds = 90s max timeout

  while (!allDone && checksCount < maxChecks) {
    await wait(2000);
    checksCount++;

    // Fetch jobs of this queue
    const checkRes = await fetch(`${BACKEND_URL}/jobs?queueId=${queue.id}&limit=100`, { headers: authHeaders });
    const checkData = await checkRes.json();
    const items = checkData.items || [];
    
    const completedCount = items.filter((j: any) => j.status === 'COMPLETED').length;
    const runningCount = items.filter((j: any) => j.status === 'RUNNING').length;
    const pendingCount = items.filter((j: any) => j.status === 'PENDING').length;

    console.log(`   Progress Check #${checksCount}: Pending=${pendingCount}, Running=${runningCount}, Completed=${completedCount}`);

    if (completedCount === totalJobsCount) {
      allDone = true;
    }
  }

  if (!allDone) {
    throw new Error('Timeout waiting for bulk jobs to complete. Are multiple workers running?');
  }

  // 7. Verify Distribution & Duplication
  console.log('\n📊 Fetching job execution records for analysis...');
  const verifyRes = await fetch(`${BACKEND_URL}/jobs?queueId=${queue.id}&limit=100`, { headers: authHeaders });
  const verifyData = await verifyRes.json();
  const completedJobs = verifyData.items || [];

  const workerDistribution: Record<string, number> = {};
  const duplicateJobs: string[] = [];
  const executionPromises: Promise<any>[] = [];

  for (const job of completedJobs) {
    executionPromises.push(
      fetch(`${BACKEND_URL}/jobs/${job.id}/executions`, { headers: authHeaders })
        .then((res) => res.json())
        .then((execs: any[]) => {
          if (execs.length > 1) {
            duplicateJobs.push(job.id);
          }
          for (const exec of execs) {
            const workerName = exec.worker?.name || 'Unknown Worker';
            workerDistribution[workerName] = (workerDistribution[workerName] || 0) + 1;
          }
        })
    );
  }

  await Promise.all(executionPromises);

  console.log('\n================ Load Balancing Report ================');
  console.log('Worker Distribution:');
  for (const [workerName, jobCount] of Object.entries(workerDistribution)) {
    console.log(`   👉 ${workerName}: processed ${jobCount} jobs (~${((jobCount / totalJobsCount) * 100).toFixed(1)}%)`);
  }
  
  console.log(`\nDuplicate Runs Detected: ${duplicateJobs.length}`);
  if (duplicateJobs.length > 0) {
    console.log('❌ Error: Found jobs that were executed multiple times! ID list:', duplicateJobs);
  } else {
    console.log('✅ Success! Every job was processed exactly once with NO duplicates.');
  }
  console.log('========================================================\n');
}

runTest().catch((err) => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
