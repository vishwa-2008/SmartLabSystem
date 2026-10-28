/**
 * KARE Smart Lab Express API Automated Verification Suite
 */

import http from 'node:http';

const API_BASE = 'http://localhost:5000';
const VALID_DEVICE_TOKEN = '1007d4fe45634146fd958879620e997ad95b72e62a1032bb8cf73d7687f25abc';

function makeRequest(path, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runApiVerification() {
  console.log('--- Starting KARE Smart Lab Express API Verification Suite ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // Test 1: GET /health
    const health = await makeRequest('/health');
    assert(health.status === 200, 'GET /health responds with HTTP 200');
    assert(health.body.ok === true, 'GET /health returns ok: true');
    assert(health.body.service === 'smart-lab-system-api', 'GET /health returns service identifier');

    // Test 2: POST /api/scan-event unauthorized
    const unauthScan = await makeRequest('/api/scan-event', { method: 'POST' }, { templateId: 1 });
    assert(unauthScan.status === 401, 'POST /api/scan-event without device token returns HTTP 401 Unauthorized');

    // Test 3: POST /api/scan-event with invalid token
    const badTokenScan = await makeRequest(
      '/api/scan-event',
      { method: 'POST', headers: { 'X-Device-Token': 'wrong_token', 'Content-Type': 'application/json' } },
      { templateId: 1 }
    );
    assert(badTokenScan.status === 401, 'POST /api/scan-event with invalid token returns HTTP 401');

    // Test 4: POST /api/scan-event with invalid template ID
    const invalidTemplateScan = await makeRequest(
      '/api/scan-event',
      { method: 'POST', headers: { 'X-Device-Token': VALID_DEVICE_TOKEN, 'Content-Type': 'application/json' } },
      { templateId: -5 }
    );
    assert(invalidTemplateScan.status === 400, 'POST /api/scan-event with invalid template ID returns HTTP 400');

    // Test 5: POST /api/scan-event authorized
    const authScan = await makeRequest(
      '/api/scan-event',
      { method: 'POST', headers: { 'X-Device-Token': VALID_DEVICE_TOKEN, 'Content-Type': 'application/json' } },
      { templateId: 1, isTest: true }
    );
    assert(authScan.status === 201, 'POST /api/scan-event with valid token returns HTTP 201 Created');
    assert(authScan.body.success === true, 'POST /api/scan-event confirms success: true');
    assert(authScan.body.event?.template_id === 1, 'POST /api/scan-event returns event with template_id: 1');

    // Test 6: POST /api/device/heartbeat
    const heartbeat = await makeRequest(
      '/api/device/heartbeat',
      { method: 'POST', headers: { 'X-Device-Token': VALID_DEVICE_TOKEN, 'Content-Type': 'application/json' } },
      {
        deviceId: 'esp32-lab-01',
        uptimeSeconds: 120,
        freeHeap: 190000,
        firmwareVersion: '1.2.0'
      }
    );
    assert(heartbeat.status === 200, 'POST /api/device/heartbeat returns HTTP 200 OK');
    assert(heartbeat.body.ok === true, 'Heartbeat acknowledged by server');

    // Test 7: GET /api/device/status
    const status = await makeRequest('/api/device/status');
    assert(status.status === 200, 'GET /api/device/status returns HTTP 200 OK');
    assert(status.body.device?.online === true, 'GET /api/device/status confirms device is ONLINE following heartbeat');

    // Test 8: Enrollment Flow Handshake
    const startEnroll = await makeRequest(
      '/api/enrollment/start',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Device-Token': VALID_DEVICE_TOKEN } },
      { studentId: 'a0000001-0000-0000-0000-000000000001', targetTemplateId: 7 }
    );
    assert(startEnroll.status === 201, 'POST /api/enrollment/start initiates enrollment session');
    const sessionId = startEnroll.body.sessionId;

    const deviceCheckTask = await makeRequest(
      '/api/device/enrollment-task',
      { headers: { 'X-Device-Token': VALID_DEVICE_TOKEN } }
    );
    assert(deviceCheckTask.status === 200, 'GET /api/device/enrollment-task responds to ESP32');
    assert(deviceCheckTask.body.hasTask === true, 'ESP32 confirms pending enrollment task available');
    assert(deviceCheckTask.body.targetTemplateId === 7, 'Target template ID matches requested slot 7');

    const deviceReportDone = await makeRequest(
      '/api/device/enrollment-complete',
      { method: 'POST', headers: { 'X-Device-Token': VALID_DEVICE_TOKEN, 'Content-Type': 'application/json' } },
      { sessionId, templateId: 7, status: 'enrolled' }
    );
    assert(deviceReportDone.status === 200, 'POST /api/device/enrollment-complete acknowledges completion');

    console.log(`\nVerification Suite Complete: ${passed} Passed, ${failed} Failed`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('API Verification error:', err.message);
    process.exit(1);
  }
}

runApiVerification();
