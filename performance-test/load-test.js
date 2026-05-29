import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/latest/dist/bundle.js';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const successfulLogins = new Counter('successful_logins');
const failedRequests = new Counter('failed_requests');
const errorRate = new Rate('error_rate');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TEST_USER_COUNT = 60;

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------
const rampingVUsOptions = {
  scenarios: {
    ramping_vus: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 50 },
        { duration: '2m', target: 50 },
        { duration: '30s', target: 100 },
        { duration: '1m', target: 100 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_duration: ['avg<2000', 'p(95)<3000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.95'],
  },
};

const constantThroughputOptions = {
  scenarios: {
    constant_rps: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_duration: ['avg<2000', 'p(95)<3000'],
    http_req_failed: ['rate<0.01'],
    http_reqs: ['rate>=20'],
    checks: ['rate>0.95'],
  },
};

const SCENARIO = __ENV.SCENARIO || 'ramping';
export const options =
  SCENARIO === 'throughput' ? constantThroughputOptions : rampingVUsOptions;

// ---------------------------------------------------------------------------
// Setup — pre-register test users before the load test begins
//   This avoids hitting the auth rate limiter (20 req / 15 min) during the test.
//   Each user gets a unique email and a known password.
// ---------------------------------------------------------------------------
export function setup() {
  const users = [];

  for (let i = 0; i < TEST_USER_COUNT; i++) {
    const email = `loadtest_user${i}_${Date.now()}@bookrunner.test`;
    const password = `TestPass${i}!`;
    const name = `LoadTest User ${i}`;

    const res = http.post(
      `${BASE_URL}/api/users`,
      JSON.stringify({ name, email, password }),
      { headers: { 'Content-Type': 'application/json' } },
    );

    if (res.status === 201) {
      users.push({ email, password });
    } else if (res.status === 409) {
      users.push({ email, password });
    }
  }

  return { users };
}

// ---------------------------------------------------------------------------
// Main function — runs per VU iteration
//   Uses pre-registered users from setup. No registration during test.
// ---------------------------------------------------------------------------
export default function (data) {
  if (!data.users || data.users.length === 0) {
    errorRate.add(1);
    failedRequests.add(1);
    return;
  }

  // Pick a credential using VU ID (deterministic spread across users)
  const vuIndex = __VU % data.users.length;
  const cred = data.users[vuIndex];

  let token = null;

  // --- Login ---
  group('Login user', () => {
    const res = http.post(
      `${BASE_URL}/api/users`,
      JSON.stringify({ email: cred.email, password: cred.password }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'POST /api/users (login)' },
      },
    );
    check(res, {
      'login status 200': (r) => r.status === 200,
      'login has token': (r) => {
        try {
          return !!JSON.parse(r.body).token;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(res.status !== 200);
    if (res.status !== 200) {
      failedRequests.add(1);
    } else {
      successfulLogins.add(1);
      try {
        token = JSON.parse(res.body).token;
      } catch {}
    }
  });

  sleep(0.3);

  // --- Browse catalog (read-heavy, no auth) ---
  group('Browse catalog', () => {
    const res = http.get(`${BASE_URL}/api/books`, {
      tags: { name: 'GET /api/books' },
    });
    check(res, {
      'catalog status 200': (r) => r.status === 200,
      'catalog has books': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body) && body.length > 0;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(res.status !== 200);
    if (res.status !== 200) failedRequests.add(1);
  });

  sleep(0.5);

  // --- Authenticated cart operations ---
  if (token) {
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    group('Add to cart', () => {
      const res = http.post(
        `${BASE_URL}/api/cart`,
        JSON.stringify({ book_title: 'One Piece', volume: 'Vol 1', quantity: 1 }),
        {
          headers: authHeaders,
          tags: { name: 'POST /api/cart' },
        },
      );
      check(res, {
        'add-to-cart status 201 or 200': (r) =>
          r.status === 201 || r.status === 200,
      });
      errorRate.add(res.status !== 201 && res.status !== 200);
    });

    sleep(0.3);

    group('View cart', () => {
      const res = http.get(`${BASE_URL}/api/cart`, {
        headers: authHeaders,
        tags: { name: 'GET /api/cart' },
      });
      check(res, {
        'view-cart status 200': (r) => r.status === 200,
      });
      errorRate.add(res.status !== 200);
      if (res.status !== 200) failedRequests.add(1);
    });
  }

  sleep(1);
}

// ---------------------------------------------------------------------------
// Summary — writes HTML + JSON reports
// ---------------------------------------------------------------------------
export function handleSummary(data) {
  return {
    'results/summary.html': htmlReport(data, {
      title: `BookRunner Load Test — ${SCENARIO}`,
    }),
    'results/summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
