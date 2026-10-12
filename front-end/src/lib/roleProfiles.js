'use strict';

/**
 * Actor profiles and demo credentials, lifted from shared/rbac.js.
 *
 * `FA.accessRole` is the legacy label "ADMIN" and is deliberately distinct from
 * the Admin actor's "ORG_ADMIN", so the two can never collide in an
 * authorize(['ADMIN', ...]) check. Do not "harmonise" these strings.
 */
export const actorProfiles = {
  Admin: {
    actor: 'Admin',
    accessRole: 'ORG_ADMIN',
    label: 'Admin',
    modules: [
      'ADMIN',
      'ANALYTICS',
      'ADMISSIONS',
      'INVENTORY',
      'DOCTOR',
      'PATIENT',
      'BILLING',
      'APPOINTMENTS',
      'INSURANCE',
      'LEADERSHIP',
    ],
  },
  Patient: { actor: 'Patient', accessRole: 'PATIENT', label: 'Patient', modules: ['PATIENT'] },
  PRE: { actor: 'PRE', accessRole: 'OPERATIONS', label: 'PRE Operator', modules: ['PRE'] },
  HOM: {
    actor: 'HOM',
    accessRole: 'SUPER_USER',
    label: 'Super User',
    modules: ['HOM', 'FA', 'PRE', 'PATIENT'],
  },
  FA: { actor: 'FA', accessRole: 'ADMIN', label: 'Admin', modules: ['FA'] },
};

/**
 * Demo credentials for the login page's helper panel, keyed by organization_id.
 * Staff follow the unified-login convention name.<role>@<hospital domain>
 * (citygen.com = org 1, apollo.com = org 2); patients use personal emails.
 */
export const mockAccountsByOrg = {
  1: {
    Admin: [{ email: 'owner.admin@citygen.com', password: 'Owner@123', displayName: 'Hospital Owner' }],
    HOM: [{ email: 'admin.hom@citygen.com', password: 'Hom@123', displayName: 'Admin User' }],
    PRE: [
      { email: 'rekha.pre@citygen.com', password: 'Pre@123', displayName: 'Rekha Nair' },
      {
        email: 'billing.assist.pre@citygen.com',
        password: 'Assist@123',
        displayName: 'Billing Assist (custom-role demo)',
      },
    ],
    FA: [{ email: 'farah.fa@citygen.com', password: 'Fa@123', displayName: 'Farah Ansari' }],
    Patient: [
      { email: 'arjun.k@hosp.com', password: 'Hamiz@123', displayName: 'Arjun Kapoor' },
      { email: 'priyanka.n@hosp.com', password: 'Salma@123', displayName: 'Priyanka Nair' },
      { email: 'rohan.m@hosp.com', password: 'John@123', displayName: 'Rohan Mehta' },
    ],
  },
  2: {
    Admin: [{ email: 'owner.admin@apollo.com', password: 'Apollo@123', displayName: 'Apollo Owner' }],
    HOM: [{ email: 'admin.hom@apollo.com', password: 'Apollo@123', displayName: 'Apollo Admin' }],
    PRE: [{ email: 'priya.pre@apollo.com', password: 'Apollo@123', displayName: 'Priya Krishnan' }],
    FA: [{ email: 'rajesh.fa@apollo.com', password: 'Apollo@123', displayName: 'Rajesh Iyer' }],
    Patient: [
      { email: 'meera@apollo.hosp.com', password: 'Apollo@123', displayName: 'Meera Subramaniam' },
    ],
  },
};

/** Platform Super User demo login (the platform console's own realm). */
export const PLATFORM_DEMO_ACCOUNT = {
  email: 'super.platform@federico.com',
  password: 'Federico@Platform123',
  displayName: 'Platform Super User',
};

export function getProfile(actor) {
  return actorProfiles[actor] || null;
}

/** Actor -> portal access check (RBAC), distinct from org module entitlement. */
export function hasModuleAccess(moduleName, actor) {
  const profile = getProfile(actor);
  return Boolean(profile && profile.modules.includes(moduleName));
}

