import { LogLevel } from '@prisma/client';

const BACKEND_URL = 'http://localhost:3000';

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('🚀 Starting Automated E2E Scheduler Test...\n');

  const email = `tester-${Date.now()}@example.com`;
  const password = 'password123';
  const name = 'QA Tester';

  // 1. Register User
  console.log(`[1/9] Registering new user: ${email}...`);
  const regRes = await fetch(`${BACKEND_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  if (!regRes.ok) {
    throw new Error(`Registration failed: ${await regRes.text()}`);
  }
  console.log('✅ User registered successfully.');

  // 2. Login User
  console.log('[2/9] Logging in to retrieve JWT token...');
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
  console.log('✅ Logged in successfully.');

  // 3. Fetch User Profile to get Project ID
  console.log('[3/9] Fetching profile to bootstrap project context...');
  const profileRes = await fetch(`${BACKEND_URL}/auth/profile`, {
    headers: authHeaders,
  });
  if (!profileRes.ok) {
    throw new Error(`Profile fetch failed: ${await profileRes.text()}`);
  }
  const profile = await profileRes.json();
  const projectId = profile.organizations[0].projects[0].id;
  console.log(`✅ Retrieved Default Project ID: ${projectId}`);

  // 4. Create Queue
  console.log('[4/9] Creating queue "Email Queue"...');
  const queueRes = await fetch(`${BACKEND_URL}/queues`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Email Queue',
      description: 'Handles transactional emails',
      concurrencyLimit: 5,
      priorityEnabled: true,
      projectId,
    }),
  });
  if (!queueRes.ok) {
    throw new Error(`Queue creation failed: ${await queueRes.text()}`);
  }
  const queue = await queueRes.json();
  console.log(`✅ Queue created successfully. ID: ${queue.id}`);

  // 5. Submit a Successful Job
  console.log('[5/9] Dispatching successful job: SEND_EMAIL...');
  const job1Res = await fetch(`${BACKEND_URL}/jobs`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'SEND_EMAIL',
      payload: {
        to: 'welcome@customer.com',
        shouldFail: false,
        data: { name: 'New Customer' },
      },
      priority: 5,
      queueId: queue.id,
    }),
  });
  if (!job1Res.ok) {
    throw new Error(`Job dispatch failed: ${await job1Res.text()}`);
  }
  const job1 = await job1Res.json();
  console.log(`✅ Job dispatched. ID: ${job1.id}, Status: ${job1.status}`);

  // 6. Wait and Verify Job Execution & Logs
  console.log('[6/9] Waiting for worker to execute successful job...');
  let completed = false;
  for (let i = 0; i < 10; i++) {
    await wait(1000);
    const checkRes = await fetch(`${BACKEND_URL}/jobs/${job1.id}`, { headers: authHeaders });
    const checkJob = await checkRes.json();
    console.log(`   Job Status Check: ${checkJob.status}`);
    if (checkJob.status === 'COMPLETED') {
      completed = true;
      break;
    }
  }

  if (!completed) {
    throw new Error('Timeout waiting for job completion. Check if the worker is running.');
  }
  console.log('✅ Job completed successfully by worker.');

  // Fetch Executions & Logs
  const execsRes = await fetch(`${BACKEND_URL}/jobs/${job1.id}/executions`, { headers: authHeaders });
  const execs = await execsRes.json();
  console.log(`✅ Executions found: ${execs.length}`);
  const execution = execs[0];
  console.log(`   Execution ID: ${execution.id}, Status: ${execution.status}, Duration: ${execution.duration}ms`);

  const logsRes = await fetch(`${BACKEND_URL}/jobs/executions/${execution.id}/logs`, { headers: authHeaders });
  const logs = await logsRes.json();
  console.log('✅ Log Output:');
  for (const log of logs) {
    console.log(`   [${log.level}] ${log.message}`);
  }

  // 7. Submit a Failing Job (Retry Test)
  console.log('\n[7/9] Dispatching failing job to verify retry policy...');
  const job2Res = await fetch(`${BACKEND_URL}/jobs`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'SEND_EMAIL',
      payload: {
        to: 'fail@customer.com',
        shouldFail: true,
        errorMessage: 'SMTP connection failed (port 587)',
      },
      priority: 10,
      queueId: queue.id,
    }),
  });
  if (!job2Res.ok) {
    throw new Error(`Job 2 dispatch failed: ${await job2Res.text()}`);
  }
  const job2 = await job2Res.json();
  console.log(`✅ Failing Job dispatched. ID: ${job2.id}, Status: ${job2.status}`);

  // 8. Observe Retry cycles and transition to DEAD / DLQ
  console.log('[8/9] Watching retry attempts and progression to DLQ (max 3 retries)...');
  let dead = false;
  for (let i = 0; i < 20; i++) {
    await wait(1500);
    const checkRes = await fetch(`${BACKEND_URL}/jobs/${job2.id}`, { headers: authHeaders });
    const checkJob = await checkRes.json();
    
    // Fetch executions to see attempts
    const checkExecsRes = await fetch(`${BACKEND_URL}/jobs/${job2.id}/executions`, { headers: authHeaders });
    const checkExecs = await checkExecsRes.json();
    const attempts = checkExecs.length;

    console.log(`   Check: Status=${checkJob.status}, Attempt Count=${attempts}`);

    if (checkJob.status === 'DEAD') {
      dead = true;
      break;
    }
  }

  if (!dead) {
    throw new Error('Timeout waiting for job to quarantine to DEAD status.');
  }
  console.log('✅ Job marked DEAD and quarantined.');

  // Verify DLQ Table contents
  console.log('[9/9] Querying Dead Letter Queue (DLQ) for quarantined jobs...');
  const dlqRes = await fetch(`${BACKEND_URL}/jobs/dlq?projectId=${projectId}`, { headers: authHeaders });
  const dlq = await dlqRes.json();
  console.log(`✅ DLQ Jobs count: ${dlq.length}`);
  const quarantined = dlq.find((j: any) => j.jobId === job2.id);
  if (quarantined) {
    console.log(`🎉 Success! Found quarantined job:`);
    console.log(`   Job ID: ${quarantined.jobId}`);
    console.log(`   Reason: ${quarantined.reason}`);
    console.log(`   Failed At: ${quarantined.failedAt}`);
    console.log(`   Retry Count: ${quarantined.retryCount}`);
  } else {
    throw new Error(`Job ${job2.id} not found in DLQ list.`);
  }

  // Dashboard Stats check
  console.log('\n📊 Querying Dashboard Metrics...');
  const metricsRes = await fetch(`${BACKEND_URL}/metrics/dashboard?projectId=${projectId}`, { headers: authHeaders });
  const metrics = await metricsRes.json();
  console.log('✅ Metrics summary:');
  console.log(`   Total Completed Jobs: ${metrics.jobStats.COMPLETED}`);
  console.log(`   Total Dead Jobs: ${metrics.jobStats.DEAD}`);
  console.log(`   Total Active Workers: ${metrics.workerStats.active}`);
  
  console.log('\n🎉 ALL SCHEDULER E2E TESTS COMPLETED SUCCESSFULLY! 🎉');
}

runTest().catch((err) => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
