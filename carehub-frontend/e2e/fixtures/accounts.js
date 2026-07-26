/**
 * Test accounts, supplied through the environment — never hardcoded.
 *
 * The backend seeds its admin from ADMIN_EMPLOYEE_CODE / ADMIN_PASSWORD in
 * carehub-backend/.env.properties (gitignored), and every other account is created by the team, so the
 * suite cannot know any credential up front. Export these before running:
 *
 *   E2E_ADMIN_CODE, E2E_ADMIN_PASSWORD
 *   E2E_MANAGER_CODE, E2E_MANAGER_PASSWORD
 *   E2E_STAFF_CODE, E2E_STAFF_PASSWORD
 *   E2E_EVALUATOR_CODE, E2E_EVALUATOR_PASSWORD   (optional: an account with evaluation permissions
 *                                                 but no ADMIN role)
 */

export const ROLES = {
  admin: 'admin',
  manager: 'manager',
  staff: 'staff',
  evaluator: 'evaluator',
}

const ENV_PREFIX = {
  [ROLES.admin]: 'E2E_ADMIN',
  [ROLES.manager]: 'E2E_MANAGER',
  [ROLES.staff]: 'E2E_STAFF',
  [ROLES.evaluator]: 'E2E_EVALUATOR',
}

/** Landing page each role must reach after login — mirrors getPostLoginRoute in the app. */
export const LANDING_PATH = {
  [ROLES.admin]: '/admin/dashboard',
  [ROLES.manager]: '/manager/dashboard',
  [ROLES.staff]: '/staff/dashboard',
  // An evaluation permission beats the MANAGER role in getDefaultAuthenticatedRoute.
  [ROLES.evaluator]: '/admin/evaluation/dashboard',
}

export function accountFor(role) {
  const prefix = ENV_PREFIX[role]
  if (!prefix) {
    throw new Error(`unknown role: ${role}`)
  }
  const employeeCode = process.env[`${prefix}_CODE`]
  const password = process.env[`${prefix}_PASSWORD`]
  if (!employeeCode || !password) {
    return null
  }
  return { role, employeeCode, password }
}

/**
 * Resolves an account or skips the test with an actionable message. Skipping beats failing: a missing
 * credential is a setup gap, not a defect in the product.
 */
export function requireAccount(test, role) {
  const account = accountFor(role)
  test.skip(!account, `set ${ENV_PREFIX[role]}_CODE and ${ENV_PREFIX[role]}_PASSWORD to run this test`)
  return account
}
