// L3-PERF-03 — NFR-P02 (TDS 7.4): write path — checklist scoring under load.
// 100 virtual users, 30 s ramp, 5 min steady; the scoring call (POST /form-submissions/{id}/submission)
// must stay under 1 s at p95.
//
// Prerequisite: each account in K6_EMPLOYEE_CODES needs at least one ACTIVE form assignment whose
// version has exactly one required SINGLE_CHOICE question (see docs/l3-system-api-tests/README.md).
//
//   k6 run -e BASE_URL=http://localhost:8081 -e K6_EMPLOYEE_CODES=... -e K6_PASSWORD=... scripts/k6/load-nfr-p02-scoring.js
import http from 'k6/http';
import { check, fail, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { API, authHeaders } from './lib/auth.js';

const scoringDuration = new Trend('scoring_duration', true);

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    scoring_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const headers = authHeaders();

  const assigned = http.get(`${API}/assigned-forms?page=0&size=1`, {
    headers,
    tags: { name: 'GET /assigned-forms' },
  });
  if (assigned.status !== 200 || !assigned.json('data.content.0')) {
    fail('the VU account has no active form assignment — seed one before running this scenario');
  }
  const assignmentItemId = assigned.json('data.content.0.assignmentItemId');
  const employeeCode = http.get(`${API}/me`, { headers, tags: { name: 'GET /me' } })
    .json('data.employeeCode');

  group('score one checklist', () => {
    const detail = http.get(`${API}/assigned-forms/${assignmentItemId}`, {
      headers,
      tags: { name: 'GET /assigned-forms/{id}' },
    });
    check(detail, { 'detail 200': (r) => r.status === 200 });
    const question = detail.json('data.version.sections.0.items.0.question');

    const draft = http.post(
      `${API}/form-submissions`,
      JSON.stringify({
        assignmentItemId,
        subject: { type: 'USER', employeeCode },
      }),
      { headers, tags: { name: 'POST /form-submissions' } },
    );
    if (draft.status !== 201) {
      return; // an open draft already exists for this VU; skip this iteration
    }
    const submissionId = draft.json('data.id');

    const answered = http.put(
      `${API}/form-submissions/${submissionId}`,
      JSON.stringify({
        lockVersion: draft.json('data.lockVersion'),
        answers: [{ questionKey: question.questionKey, optionKey: question.options[0].optionKey }],
      }),
      { headers, tags: { name: 'PUT /form-submissions/{id}' } },
    );
    check(answered, { 'answers 200': (r) => r.status === 200 });

    const submitted = http.post(
      `${API}/form-submissions/${submissionId}/submission`,
      JSON.stringify({ lockVersion: answered.json('data.lockVersion') }),
      { headers, tags: { name: 'POST /form-submissions/{id}/submission' } },
    );
    scoringDuration.add(submitted.timings.duration);
    check(submitted, {
      'submit 200': (r) => r.status === 200,
      'scored': (r) => r.json('data.scoringStatus') === 'CALCULATED',
    });
  });

  sleep(1);
}
