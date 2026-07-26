// L3-PERF-02 — NFR-S01 (TDS 7.4): stress run to find the breaking point.
// 500 virtual users, 120 s ramp, 10 min steady; the system must degrade gracefully — still under
// 1 % failed requests, and no 5xx at all (queueing/slowdown is acceptable, errors are not).
//
//   k6 run -e BASE_URL=http://localhost:8081 -e K6_EMPLOYEE_CODES=... -e K6_PASSWORD=... scripts/k6/stress-nfr-s01.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { API, authHeaders } from './lib/auth.js';

const serverErrors = new Counter('server_errors_5xx');

export const options = {
  stages: [
    { duration: '120s', target: 500 },
    { duration: '10m', target: 500 },
    { duration: '60s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    server_errors_5xx: ['count==0'],
    // Degradation budget: slower is tolerated, timing out is not.
    'http_req_duration{expected_response:true}': ['p(99)<10000'],
  },
};

export default function () {
  const headers = authHeaders();

  const responses = http.batch([
    ['GET', `${API}/training/records?page=0&size=20`, null, { headers, tags: { name: 'GET /training/records' } }],
    ['GET', `${API}/assigned-forms?page=0&size=20`, null, { headers, tags: { name: 'GET /assigned-forms' } }],
    ['GET', `${API}/me/exam-assignments`, null, { headers, tags: { name: 'GET /me/exam-assignments' } }],
  ]);

  responses.forEach((response) => {
    if (response.status >= 500) {
      serverErrors.add(1);
    }
    check(response, { 'no server error': (r) => r.status < 500 });
  });

  sleep(1);
}
