// Security Rules Adversarial Test Specification (Dirty Dozen)
// Run against Firebase Rules Unit Testing Emulator when available.

export interface DirtyDozenCase {
  id: number;
  name: string;
  collection: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  expected: 'PERMISSION_DENIED';
  description: string;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Self-Admin Escalation',
    collection: 'users',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Non-admin client creating user profile with role: "admin".'
  },
  {
    id: 2,
    name: 'Shadow Field Injection',
    collection: 'revenues',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Revenue payload with undeclared ghost field isVerifiedAdmin: true.'
  },
  {
    id: 3,
    name: 'Unverified Admin Spoof',
    collection: 'audit_logs',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    description: 'Token matching admin email with email_verified: false.'
  },
  {
    id: 4,
    name: 'Cross-Tenant Read',
    collection: 'revenues',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    description: 'Authenticated user B reading revenue owned by user A.'
  },
  {
    id: 5,
    name: 'Cross-Tenant List Scraping',
    collection: 'expenses',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    description: 'Listing expenses without matching userId == request.auth.uid.'
  },
  {
    id: 6,
    name: 'Direct Active Subscription Bypass',
    collection: 'subscriptions',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Client creating subscription directly with status: "authorized".'
  },
  {
    id: 7,
    name: 'ID Poisoning',
    collection: 'companies',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Document ID longer than 128 chars or containing invalid symbols.'
  },
  {
    id: 8,
    name: 'Client Plan Price Tampering',
    collection: 'plans',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'Non-admin modifying monthlyPrice of a SaaS plan.'
  },
  {
    id: 9,
    name: 'Audit Log Deletion',
    collection: 'audit_logs',
    operation: 'delete',
    expected: 'PERMISSION_DENIED',
    description: 'Attempting to delete immutable audit log record.'
  },
  {
    id: 10,
    name: 'PII Blanket Read',
    collection: 'users',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    description: 'Non-owner reading private user document.'
  },
  {
    id: 11,
    name: 'Timestamp Forgery',
    collection: 'revenues',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Sending backdated createdAt instead of request.time.'
  },
  {
    id: 12,
    name: 'Orphan Financial Record',
    collection: 'revenues',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Creating revenue referencing a non-existent companyId.'
  }
];
