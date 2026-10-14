# Improvements within the IAS 1 guide

Reference: d47d64dd4f7297354a42ab2306d26ebe.docx, read as assignment criteria. The eight minimum requirements and the 100-point rubric retain the existing cryptography module and prioritize functionality (30) and explainable AI monitoring (30).

Recommended next improvements:

1. Evaluate the existing kNN model with genuine allowed and controlled suspicious sessions, report false alarms and missed detections, and include the baseline size and measured explanation in the evaluation. Do not present synthetic tests as real accuracy.
2. Export all records matching report filters through server-side pagination, instead of just the currently loaded window. Preserve role/owner restrictions and CSV protections.
3. Add an administrator notification for newly generated alerts and a clear last-updated indicator, while retaining the investigation notes and related activity links already implemented.
4. Use a shared atomic request rate limiter for the serverless deployment. The failed-login lock is already database-backed; the separate burst counters are currently per instance.
5. Prepare four controlled demonstrations with database evidence: normal cryptography activity, five failed attempts and a lock, an actual detected anomaly after collecting a baseline, and denied administrator access by a regular user. The document asks for four scenarios but names only three.

## Overview loading changes

Previously, the dashboard requested statistics on mount and again when /state updated its events. Each protected request also waited sequentially for the session, profile, policy, IP block and baseline reads.

Now the SecurityContext owns a single parallel state/statistics refresh. It coalesces overlapping refreshes for the same account, publishes activity data as soon as it arrives without waiting for statistics, preserves previous records during background refresh, and refreshes again after a mutation when needed. Pending cards show a loading marker rather than a false zero. Results from a previous account are ignored.

The API runs independent session/profile reads together, then independent policy/IP/baseline reads together. It still verifies identity, revocable sessions, activation, locks, role access, risk decisions and activity recording before serving protected data. No table access rules, five-attempt controls, or audit writes were removed.

Verification includes request-count assertions, a controlled delayed-statistics browser check, concurrent-read gates in API tests, existing authentication/prevention tests, and both role layouts. These checks do not establish a measured production dashboard speed percentage; real-account loading still depends on Supabase and Vercel network latency and cold starts.
