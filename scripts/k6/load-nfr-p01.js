// L3-PERF-01 — NFR-P01 (TDS 7.4): read-heavy load at the expected peak.
// 300 virtual users, 60 s ramp, 5 min steady; p95 under 3 s and under 1 % failed requests.
//
//   k6 run -e BASE_URL=http://localhost:8081 -e K6_EMPLOYEE_CODES=... -e K6_PASSWORD=... scripts/k6/load-nfr-p01.js
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { API, authHeaders } from './lib/auth.js';

export const options = {
  stages: [
    { duration: '60s', target: 300 },
    { duration: '5m', target: 300 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    'http_req_duration{expected_response:true}': ['p(95)<3000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  return {};
}

export default function () {
  const headers = authHeaders();

  group('staff reads own data', () => {
    const me = http.get(`${API}/me`, { headers, tags: { name: 'GET /me' } });
    check(me, { 'me 200': (r) => r.status === 200 });

    const records = http.get(`${API}/training/records?page=0&size=20`, {
      headers,
      tags: { name: 'GET /training/records' },
    });
    check(records, {
      'records 200': (r) => r.status === 200,
      'records paged': (r) => r.json('data.content') !== undefined,
    });

    const status = http.get(`${API}/training/status/me`, {
      headers,
      tags: { name: 'GET /training/status/me' },
    });
    check(status, { 'status 200': (r) => r.status === 200 });

    const assigned = http.get(`${API}/assigned-forms?page=0&size=20`, {
      headers,
      tags: { name: 'GET /assigned-forms' },
    });
    check(assigned, { 'assigned 200': (r) => r.status === 200 });

    const notifications = http.get(`${API}/me/notifications/unread-count`, {
      headers,
      tags: { name: 'GET /me/notifications/unread-count' },
    });
    check(notifications, { 'unread 200': (r) => r.status === 200 });
  });

  sleep(1);
}
