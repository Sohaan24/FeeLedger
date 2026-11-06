# AGENTS.md: Kisht fee portal (MERN)

## Project
Fee tracking system and parent portal for a coaching institute (a take-home exercise for a simulated client).
Stack: MongoDB, Express, React, Node.
Read `docs/BRIEF.md` (the problem statement) before changing any behaviour. Do not use information that is not in it.

## Hard rules (never break these)
1. Only the verified payment webhook may mark an instalment paid. Never mark paid from a frontend redirect or a client request.
2. On every webhook: verify the HMAC-SHA256 signature over the raw request body, compare the amount with the instalment, and dedupe on the gateway payment ID (unique index). An unknown reference or an amount mismatch goes to the unmatched queue. Never mark anything paid in that case.
3. Store money as integers (rupees or paise). Never use floats for money.
4. No secrets in the repository. Keep `.env` gitignored and commit `.env.example` with variable names only. Seed data is fake. No real personal data.
5. Never invent business rules. If the brief is silent (refund percentages, GST rate, reminder timing), choose a default, record it in `docs/ASSUMPTIONS.md` labelled as an assumption, and tell me.
6. The AI risk flag only creates a counsellor call task. It never takes a fee action and never messages a parent. Counsellors can mark a flag as false.
7. `PAYMENT_PROVIDER` defaults to `mock`. The app must run end to end with no external keys.
8. Reminders must re-check the balance before sending and stop once an instalment is paid. Skip parents without recorded consent.

## Code
- Business logic (balance, days overdue, ageing buckets, refund, risk score) lives in pure functions under `Backend/src/domain/` with unit tests. Controllers stay thin.
- Validate every input. Enforce roles in middleware: a parent sees only their own children's data; only accounts staff see the ledger and dashboard.
- Use one consistent API error shape. Never leak stack traces to the client.
- Keep files small and readable. Prefer clear names over comments.

## UI
- Minimal design: white space, one accent colour, one typeface.
- The parent dues screen shows the amount, the due date and a Pay button, nothing more.
- Every screen needs loading, empty and error states. Build mobile-first.
- User-facing text comes from a Hindi/English strings file, not hard-coded.

## Workflow
- Work on one slice at a time. Do not touch unrelated files.
- Ask before adding a dependency.
- Before saying a task is done: run the tests and the linter, then summarise what changed and what is unverified. Never claim something works unless it was run.
- Make small commits with clear messages. Do not rewrite git history.
- Never paste or log secrets, tokens or webhook payloads containing personal data.
