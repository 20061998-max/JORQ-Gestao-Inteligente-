# Security Specification & Payload-First TDD — JORQ Gestão Inteligente

## 1. Data Invariants
1. **Multi-Tenant Isolation**: A tenant company document (`companies/{companyId}`) and all tenant-scoped collections (`revenues`, `expenses`, `transactions`, `products`, `services`, `clients`, `reports`, `subscriptions`, `payments`) are strictly bound to `companyId` and `userId == request.auth.uid` (or active `company_members/{companyId}_{uid}`). A client can never read, list, update, or delete records belonging to another company.
2. **Privilege Escalation Prevention**: Users registering in `users/{userId}` can only create their profile with `role == 'client'` and `status == 'active'`. Only verified administrators (`isAdmin()`) can promote roles, create/modify `plans`, `coupons`, `system_settings`, or suspend/reactivate companies.
3. **Email Verification Enforcement**: Standard tenant write operations require `request.auth.token.email_verified == true`.
4. **Temporal & Relational Integrity**: `createdAt` and `updatedAt` must match `request.time`. Parent `companyId` must exist via `exists()` on tenant record creation. `ownerId`/`userId` is immutable on update.
5. **Subscription Payment Integrity**: Client creation of `subscriptions` is restricted to `status == 'pending'`. Access activation occurs only after server-side verification against Mercado Pago API.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Self-Admin Escalation**: `POST /users/{uid}` with `{ role: 'admin' }` -> Must return `PERMISSION_DENIED`.
2. **Shadow Field Injection**: `POST /revenues/{id}` with `{ ..., isVerifiedAdmin: true }` -> Must return `PERMISSION_DENIED` (`hasOnly()` gate).
3. **Unverified Admin Spoof**: `GET /audit_logs/{id}` with `email: 'josuelroque05052020@gmail.com'` and `email_verified: false` -> Must return `PERMISSION_DENIED`.
4. **Cross-Tenant Read**: User B attempts `GET /revenues/{revBelongingToCompanyA}` -> Must return `PERMISSION_DENIED`.
5. **Cross-Tenant List Scraping**: User B attempts `LIST /expenses` without filtering by own `userId` -> Must return `PERMISSION_DENIED`.
6. **Direct Active Subscription Bypass**: Client attempts `POST /subscriptions/{id}` with `{ status: 'authorized' }` -> Must return `PERMISSION_DENIED`.
7. **ID Poisoning**: `POST /companies/{2000_char_invalid_id}` -> Must return `PERMISSION_DENIED` (`isValidId()`).
8. **Client Plan Price Tampering**: Client attempts `UPDATE /plans/{planId}` with `{ monthlyPrice: 0.01 }` -> Must return `PERMISSION_DENIED`.
9. **Audit Log Deletion/Tampering**: Client or admin attempts `DELETE /audit_logs/{id}` or `UPDATE /audit_logs/{id}` -> Must return `PERMISSION_DENIED` (immutable audit trail).
10. **PII Blanket Read**: User B attempts `GET /users/{userA}` -> Must return `PERMISSION_DENIED`.
11. **Timestamp Forgery**: Client sends `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> Must return `PERMISSION_DENIED`.
12. **Orphan Financial Record**: Client attempts `POST /revenues/{id}` with non-existent `companyId: 'fake_comp_999'` -> Must return `PERMISSION_DENIED` (`exists()` check).
