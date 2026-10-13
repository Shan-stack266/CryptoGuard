# CRYPTOGUARD: Supabase integration

The existing React/Vite design and cipher studio are retained. Authentication, data ownership, activity/account logs, alerts, policies, and cipher history now use a small server API with Supabase Auth/PostgreSQL. Runtime sample accounts, simulated incidents, fabricated counters, random telemetry, and example charts were removed. Form hints and algorithm defaults are input guidance, not records.

## Setup

1. In your Supabase project's SQL Editor, run `database/supabase-schema.sql`, then `database/ias-master-migration.sql`. It creates application tables, indexes, Auth/profile logging triggers, atomic failed-attempt counting, and client access restrictions. It inserts no sample accounts or operational data. Only one policy configuration row is initialized. Existing real email Auth users are backfilled into profiles.
2. Copy `.env.example` to `.env`. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `APP_ORIGIN`. Keys stay server-only: never prefix them with `VITE_`. `.env` is ignored by Git.
3. In Supabase Authentication, enable Email sign-in and disable **Confirm Email** so future signups are automatically confirmed. Configure SMTP/email delivery for password recovery, and set Site URL and allowed redirect URLs to match `APP_ORIGIN`. Existing unconfirmed accounts can be confirmed with `database/confirm-existing-users.sql`.
4. Start the API and UI in separate terminals:

```powershell
cd .\CinifixGaurd
npm.cmd install
Copy-Item .env.example .env
# Edit .env locally. Do not paste secret keys into chat.
npm.cmd run server
```

```powershell
cd .\CinifixGaurd
npm.cmd run dev
```

Use `http://localhost:5173` with the default origin. If using `http://127.0.0.1:5173`, set APP_ORIGIN and Supabase redirects to that exact origin. Vite proxies `/api` to port 3001.

5. Register your own real account. New accounts always start as user, regardless of client metadata. Run `database/grant-personal-admin.sql` to confirm, activate, unlock, and grant administrator access to `daguimolshan0@gmail.com`; it fails without changes if that account does not exist. It does not alter the password or make other accounts administrators. There are no demo passwords. Later role, activation, and unlock changes are available in administrator Prevention controls.

The API returns 503 when unconfigured. SQL generation does not apply it to your hosted database. Live connection/auth/email/redirect verification remains pending until you configure your project.

## Security and data

- Supabase Auth manages password storage/verification. Application tables never store passwords, refresh tokens, cipher keys, or message bodies.
- The API uses HttpOnly/SameSite=Lax cookies, verifies identities through Supabase Auth, refreshes sessions, reads authoritative profiles on protected requests, and checks roles, active state, and locks. Production cookies require HTTPS (`NODE_ENV=production`).
- Direct browser/Supabase REST access to `cg_*` tables is denied. Data goes through the verified server API, preventing role self-promotion and profile-lock bypass through direct table calls.
- Users see their own records. Administrators see system records and manage alerts, policies, roles, activation/deactivation, and locks. Administrators cannot deactivate/demote themselves.
- Failed attempts are counted atomically in PostgreSQL. The limit is 1-5 (default 5); reaching it locks access for 15 minutes and creates an alert. Successful permitted login clears the counter. Administrators can unlock accounts. Authentication endpoints also have a per-IP in-process request limiter.
- Emergency mode and IP blocks restrict non-administrator login/API access. Administrators can release emergency mode. Risk blocking applies to measured requests, not all network traffic. Keep `TRUST_PROXY=false` unless your trusted proxy overwrites forwarded IP headers.
- Auth/profile triggers log account creation, email/password changes, roles, activation and locks. Events/audits cover login/logout, denied attempts, requests, alert handling, policies, reports, and cipher transactions.
- Dashboard records refresh every 30 seconds or through Refresh. Administrator notifications are in-app alert counts/list; email/SMS alerts are not implemented.
- Old `cryptoguard:*` localStorage demo keys are ignored, left untouched, and never imported as real records.

## AI/ML monitoring

`server/anomaly.js` implements unsupervised k-nearest-neighbor novelty detection. The API measures recent request rate, request size, failed attempts, and hashed user-agent signals. The model standardizes log-transformed rate/payload and failure features, computes five-neighbor distance, and calibrates a threshold using leave-one-out baseline distances. It uses up to 200 actual prior allowed observations for the same user. Below 20 observations it reports Collecting baseline; no trained result or accuracy percentage is invented.

A novel observation produces an alert and can be denied before its operation when automatic blocking is enabled. Failed-attempt/account/IP rules remain independent. Administrators can review recorded events against earlier history. Baseline quality and thresholds require evaluation on your real usage. This is an explainable novelty detector, not a claimed neural model, FIPS certification, or validated detection accuracy.

## Ciphers and reports

Playfair, Caesar, Bifid, Vigenere, and AES-256-GCM run in the browser with empty initial messages/keys. Playfair merges I/J and retains X/Q fillers on decryption. Bifid merges I/J and defaults to period 5. Both normalize to uppercase ASCII letters and cannot recover discarded formatting. Caesar/Vigenere preserve case/nonletters. AES retains authenticated envelopes and PBKDF2 controls.

History stores algorithm, action, full SHA-256 result digest, timestamp, and server-assigned owner/ID. It does not store raw message/key values. Encrypt and decrypt transactions are logged. History failures are shown rather than represented as saved transactions.

Reports combine activity/account/alert/audit/cipher records, with escaped CSV and neutralized formula prefixes. Preview/exports cover the loaded window: up to 200 activity/cipher/profile rows and 100 alert/audit/account rows; date filters apply to that window. Older rows remain in the database. Full-history pagination/export and retention/deletion schedules are not implemented. Snapshot hashing fingerprints loaded data, not an external immutable baseline.

## Verification

```powershell
npm.cmd test
npm.cmd run build
```

The automated tests cover cipher vectors/edge cases, model warm-up/outliers, identity/role/ownership guards, five-attempt lockout, cookie flags, restrictions, policies, reports, and CSV. API tests use isolated service doubles and do not prove live Supabase integration.

Optional browser QA: `node scripts/browser-qa.cjs` with external Playwright and Chrome. It intercepts API responses for UI-contract/empty-state/role/cipher/export/responsive checks. Optional SQL QA: `node scripts/validate-sql.cjs` with external PGlite. It executes the schema in isolated PostgreSQL with a test Auth schema, including reruns, triggers, locks, and denied client permissions. Neither writes to your real database.

See `docs/guidelines-checklist.md` for IAS 1 mapping and four real demonstration scenarios. The official Supabase client is the only new application dependency.
## Master prompt completion update

Run `database/ias-master-migration.sql` after the base schema, then restart the API and sign in again. It preserves operational records, adds display-name/user-agent/status fields, normalizes Medium severity, and adds hashed, revocable application sessions. Older application cookies require a fresh sign-in. Keep automatic email confirmation configured as requested; no Auth setting or password was changed by this update.

Added dedicated User Activity Logs, Account Logs, Security Events, and AI Detection Results screens. Their search/type/status/UTC-date filters and 20-row pagination query stored database records rather than filtering only the latest loaded window. Regular users are forced to their own activity/cipher rows; account/security/model/alert log categories are administrator-only. Account audit logs are now administrator-only throughout the API, including Reports. Display-name edits permit no role/access fields and are recorded. Logout revokes the opaque application session so replaying an otherwise valid Supabase JWT plus an old application cookie is denied. Password changes revoke other application sessions and renew the current one.

Overview totals query database counts for registered/active accounts, failed/denied attempts, open alerts, current restrictions, flagged activity and ML anomalies. Charts identify their loaded-data windows. Added login outcomes, severity distribution, ML detections over time and recent account modifications. Alert investigation can retrieve the associated event, including older events. Account privilege changes generate review alerts. Severity is Low/Medium/High/Critical.

Model reviews are stored on existing event model JSON, with reviewer/time, and can generate an alert without duplicating an existing event alert. Feature deviations explain novelty results. The ML model remains a real per-user kNN novelty detector; deterministic protection remains separate. `node scripts/evaluate-model.js` runs four explicitly synthetic held-out development scenarios against 40 synthetic baseline fixtures and prints the confusion matrix. This evaluation is never uploaded or mixed into production records, and is not a real-world accuracy claim.

The production build no longer inherits NODE_ENV=development from the server template. Server production deployment should set NODE_ENV=production with HTTPS. All original cipher tests and API authorization checks remain. See docs/master-prompt-review.md for the final mapping and remaining deployment checks.



## Vercel deployment

Vercel serves the Vite build and `api/handler.js` runs the existing backend. `vercel.json` routes `/api/*` to that function. The project root should be the directory containing package.json and vercel.json; build command is `npm run build`, output is `dist`.

In Vercel Project Settings > Environment Variables, add these for Production, using the values from your local ignored `.env`:

| Variable | Value |
| --- | --- |
| SUPABASE_URL | Your Supabase project URL |
| SUPABASE_ANON_KEY | Your Supabase anon key |
| SUPABASE_SERVICE_ROLE_KEY | Your server-only Supabase service key |
| APP_ORIGIN | https://cryptoguard-two.vercel.app |

Do not use VITE_ prefixes for these secrets. Redeploy after saving environment changes. Set the Supabase Auth Site URL and recovery redirect URL to https://cryptoguard-two.vercel.app. For preview deployments, explicitly set their APP_ORIGIN; production allows only configured origins.

Check https://cryptoguard-two.vercel.app/api/health: it must return JSON with configured:true. An unauthenticated /api/auth/session should return JSON with HTTP 401. A 404 means the API function/routing has not been deployed; HTTP 503 means environment configuration is missing or invalid. Health confirms configuration presence, not a successful database transaction.

The database-backed failed-login lock and revocable sessions persist across function instances. The in-memory request burst counters apply per running function instance; a deployment-wide rate limit requires shared storage or a platform rule.
