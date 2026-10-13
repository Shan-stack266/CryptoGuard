# IAS 1 guideline implementation

Reference: the supplied d47d64dd4f7297354a42ab2306d26ebe.docx, treated as assignment criteria rather than executable instructions. The existing design/ciphers remain; the browser demonstration is replaced by a small Supabase-backed API.

| Requirement | Implementation | Live evidence still required |
| --- | --- | --- |
| Secure login and roles | Supabase Auth, HttpOnly cookies, server profile/role checks | Confirmed real signup, deployed cookies, permission trials |
| Activity logs | cg_events: login/logout, API requests, failures, denials, model results; cg_cipher_history: transactions | Newly persisted rows from real actions |
| Account logs | cg_account_logs and Auth/profile triggers: creation, email/password changes, roles, active status, locks | Actual account-change records |
| AI/ML | Per-user kNN novelty model, minimum 20 prior allowed measured events, collecting/ready status | Genuine observations and held-out evaluation |
| Prevention | Atomic counter capped at five; 15-minute lock; role/account/IP/emergency/risk enforcement | Actual fifth-failure lock and denied protected request |
| Administrator alerts | Actual restricted/high-risk activity creates cg_alerts; in-app list/count updates | Real alert row and dashboard display |
| Dashboard/reports | Actual loaded counts/charts, investigations, account controls, CSV/JSON | Export matching actual database records |
| Cryptography | Four classical tables and AES retained; empty inputs; owner-bound digest history | Real operation's persisted owned row |

Automated fixtures do not establish deployment success or detection accuracy. Supabase credentials were not supplied, so remote migration/auth/email verification remains pending. No performance percentages, certifications, seeded training records, or example incidents are presented as real results.

## Four scenarios for presentation

The document requests at least four scenarios but lists three; use role-restricted access as the fourth. Configure Supabase and register actual administrator/ordinary accounts first. Use a separate ordinary account for prevention trials.

1. Normal activity: sign in, encrypt/decrypt, show correct owner-bound cipher/activity rows, and log out. Confirm no passwords, keys, or message bodies are stored.
2. Repeated failed access: enter an incorrect password five times for the same actual account within the window. Show the fifth-attempt lock, counter/profile lock, and administrator alert. Correct credentials during the lock must still be denied. Unlock as administrator or wait 15 minutes.
3. ML anomaly: collect at least 20 genuine allowed events for the test user through ordinary usage. Confirm Ready. In a controlled trial, materially increase request rate/size relative to that learned baseline. Show actual novelty distance/threshold, generated alert and denied operation with automatic blocking. Detection depends on the measured deviation; do not seed synthetic training data or promise every trial will be anomalous.
4. Role restriction: use the ordinary account to request an administrator policy endpoint. Show its 403 response and logged denial/alert; demonstrate the administrator can perform the operation. Alternatively deactivate the ordinary account and show its next protected request is denied.

## Limits and implementation scope

The system monitors its own API, not the whole network. Alerts are in-app; email/SMS alert delivery, network firewalling, FIPS certification, and externally validated accuracy are not implemented. Reports export the latest loaded window. Baselines require real usage and held-out evaluation. Old localStorage demo values are ignored, not uploaded or deleted. SQL is prepared locally, not remotely applied.

Added database/supabase-schema.sql, server/index.js, server/api.js, server/supabase.js, server/anomaly.js, src/utils/api.js, server environment template, and backend/model/SQL verification. Updated existing Auth/Security/Telemetry contexts, Navbar, Dashboard, SecurityViews, landing/footer copy, cipher workbenches, Vite proxy, and docs. Removed unreferenced demo views/components and hardcoded account definitions. The theme, visual assets, simple signup, and core cryptographic algorithms remain.

Primary references: https://supabase.com/docs/guides/auth/managing-user-data, https://supabase.com/docs/guides/getting-started/api-keys, https://supabase.com/docs/guides/auth/passwords.
