import http from 'k6/http';
import { fail } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8081';
export const API = `${BASE_URL}/api/v1`;

/**
 * Logs in once per virtual user and returns the Authorization header.
 *
 * Credentials come from the environment so no secret is committed:
 *   K6_EMPLOYEE_CODES  comma-separated employee codes (the VU picks one by index)
 *   K6_PASSWORD        the shared password of those seeded accounts
 */
export function authHeaders() {
  const codes = (__ENV.K6_EMPLOYEE_CODES || '').split(',').filter((code) => code.length > 0);
  const password = __ENV.K6_PASSWORD;
  if (codes.length === 0 || !password) {
    fail('set K6_EMPLOYEE_CODES and K6_PASSWORD before running the load tests');
  }
  const employeeCode = codes[(__VU - 1) % codes.length];

  const response = http.post(
    `${API}/auth/login`,
    JSON.stringify({ employeeCode, password }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'POST /auth/login' } },
  );
  if (response.status !== 200) {
    fail(`login failed for ${employeeCode}: ${response.status} ${response.body}`);
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${response.json('data.accessToken')}`,
  };
}
