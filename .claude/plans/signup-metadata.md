# COMPLETE - 2026-03-08

# Signup Metadata — Store Acquisition Context on User Accounts

## Context

The current invite key system validates keys at signup but **never records which key was used**. There's no way to answer "how did this user find us?" or "which invite key brought in the most users?".

This plan adds a `signup_metadata JSONB` column to the `users` table that captures acquisition context at account creation time — invite key, UTM parameters, and referral source — without needing further schema changes for future signals.

## Changes

### 1. Migration: `shared/db/migrations/014_signup_metadata.sql` (new file)

```sql
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS signup_metadata JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_users_signup_metadata ON users USING GIN (signup_metadata);
```

- `NOT NULL DEFAULT '{}'` — existing users get empty object, no backfill needed
- GIN index enables efficient queries like `WHERE signup_metadata->>'invite_key' = 'xyz'`

### 2. Types: `shared/db/src/types.ts`

Add `signup_metadata: Record<string, unknown>` to `User` interface (before `created_at`, line 25).

Add a typed interface for write-side usage:

```typescript
export interface SignupMetadata {
    invite_key?: string;
    referral_source?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_term?: string;
    utm_content?: string;
    [key: string]: unknown;
}
```

### 3. Signup Handler: `api/src/handlers/auth/signup.ts`

**Accept UTM fields in request** — update `SignupRequest` interface (line 22-29) to add optional UTM fields:

```typescript
interface SignupRequest {
    username: string;
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    invite_key: string;
    // Optional acquisition tracking
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_term?: string;
    utm_content?: string;
    referral_source?: string;
}
```

**Build metadata object** — after validation, before INSERT (around line 112):

```typescript
const signupMetadata: SignupMetadata = { invite_key };
if (utm_source) signupMetadata.utm_source = utm_source;
if (utm_medium) signupMetadata.utm_medium = utm_medium;
// ... etc for each UTM field and referral_source
```

**Update INSERT query** (line 113-118) to include `signup_metadata`:

```sql
INSERT INTO users (username, first_name, last_name, email, email_verified, signup_metadata)
VALUES ($1, $2, $3, $4, false, $5)
RETURNING *
```

Pass `JSON.stringify(signupMetadata)` as the 5th parameter.

### 4. User API Response: `api/src/handlers/users.ts`

- Add `signup_metadata?: Record<string, unknown>` to `UserApiResponse` interface (line 21-33)
- Update `userToApiResponse` (line 35) to accept `includeAdminFields = false` parameter
- Include `signup_metadata` only when `includeAdminFields` is true
- Update call sites: pass `true` in admin-only handlers (`handleListUsers`, `handleCreateUser`), pass `isAdmin(currentUser)` in `handleGetUser` and `handleUpdateUser`

### 5. Frontend Signup: `ssg/src/pages/signup.tsx`

Update the inline `signupScript` (line 101-163) to capture UTM params from the URL and include them in the POST body:

```javascript
// At top of the IIFE, read UTM params from URL
var params = new URLSearchParams(window.location.search);
var utmFields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'referral_source'];
var utmData = {};
utmFields.forEach(function(field) {
    var val = params.get(field);
    if (val) utmData[field] = val;
});
```

Then spread `utmData` into the `JSON.stringify` body alongside the existing form fields.

## Files to Modify

| File | Change |
|------|--------|
| `shared/db/migrations/014_signup_metadata.sql` | **New file** — ALTER TABLE + GIN index |
| `shared/db/src/types.ts` | Add `signup_metadata` to `User`, add `SignupMetadata` interface |
| `api/src/handlers/auth/signup.ts` | Accept UTM fields, store in signup_metadata during INSERT |
| `api/src/handlers/users.ts` | Expose signup_metadata in admin API responses |
| `ssg/src/pages/signup.tsx` | Read UTM params from URL, send with signup request |

## Verification

1. `docker compose build && docker compose up` — migration runs automatically
2. Visit `/signup?utm_source=twitter&utm_campaign=launch` and create an account
3. Check DB: `SELECT signup_metadata FROM users WHERE username = 'testuser'` → should show `{"invite_key": "...", "utm_source": "twitter", "utm_campaign": "launch"}`
4. Admin GET `/api/users` → response includes `signup_metadata`
5. Non-admin GET `/api/auth/me` → response does NOT include `signup_metadata`
