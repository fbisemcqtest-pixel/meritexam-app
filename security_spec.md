# MeritExam Security Specification (Phase 0)

## 1. Data Invariants
1. **Role & Verification Integrity**: A newly registered user via Student or Teacher portals MUST start with `status == 'pending'` and `role in ['student', 'teacher']`. No user may self-assign `role == 'admin'` or `status == 'approved'` (unless already verified as an Admin via `/admins/{uid}` or the bootstrapped Admin email with `email_verified == true`).
2. **PII Isolation**: User documents contain `email`, `fullName`, and `identifier` (roll/employee ID). Reads (`get`) are restricted to `isOwner(userId) || isAdmin()`. `list` is strictly restricted to `isAdmin()`.
3. **Admin-Selected Examination Mode Integrity**: Only `isAdmin()` may create or modify `/systemSettings/global`. When `resultMode == 'admin_review'`, student-submitted `/attempts/{attemptId}` documents MUST be created with `resultReleased == false` and `status == 'submitted'`.
4. **Test Creation Integrity**: Only `isAdmin()` or an `approved` Teacher may create `/tests/{testId}`. Only `isAdmin()` or the creating Teacher may edit/delete a test.
5. **Immutable Submission Records**: Once a student submits an `/attempts/{attemptId}` document, the student cannot modify `answers`, `score`, `resultReleased`, or `status`. Only `isAdmin()` (or the test's approved Teacher when authorized) may release results (`resultReleased: true`, `status: 'reviewed'`).
6. **Temporal & Volumetric Integrity**: All `createdAt`, `submittedAt`, and `updatedAt` timestamps MUST equal `request.time`. All string fields have bounded `.size()` limits and all document IDs match `^[a-zA-Z0-9_\-]+$`.

## 2. Dirty Dozen Adversarial Payloads (Expected: PERMISSION_DENIED)
1. **Self-Approved Student Registration**: Creating `/users/u1` with `role: 'student', status: 'approved'`.
2. **Self-Promoted Admin Registration**: Creating `/users/u1` with `role: 'admin', status: 'approved'` from a non-admin account.
3. **Student Updating Own Approval Status**: Updating `/users/u1` with `status: 'approved'` via `affectedKeys` bypass.
4. **Shadow Ghost Field Injection**: Creating `/users/u1` with extra unexpected key `isSuperUser: true`.
5. **Email Spoofing Without Verification**: Accessing admin routes with matching email but `email_verified == false`.
6. **PII Blanket Scraping**: Non-admin user attempting `list` or `get` on `/users/otherUser`.
7. **Unapproved Teacher Creating Test**: Teacher with `status: 'pending'` attempting to create `/tests/t1`.
8. **Student Tampering With Test**: Approved student attempting to update `/tests/t1` `isActive` or `questions`.
9. **Student Changing Global Mode**: Student or Teacher attempting to update `/systemSettings/global` to `resultMode: 'instant'`.
10. **Student Forcing Instant Result in Delayed Mode**: Creating `/attempts/a1` with `resultReleased: true` when `systemSettings/global.resultMode == 'admin_review'`.
11. **Student Self-Grading Update**: Student attempting to update `score: 100` or `resultReleased: true` on `/attempts/a1`.
12. **Resource Exhaustion / ID Poisoning**: Creating `/tests/<1500-char-invalid-id>` or `title` exceeding 160 characters.
