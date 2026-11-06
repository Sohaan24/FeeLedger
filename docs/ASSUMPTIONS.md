# Project Assumptions & Defaults

Pursuant to `AGENTS.md` Rule 5: *"Never invent business rules. If the brief is silent (refund percentages, GST rate, reminder timing), choose a default, record it in `docs/ASSUMPTIONS.md` labelled as an assumption, and tell me."*

Every assumption below is explicitly labelled with `[ASSUMPTION]`.

---

### [ASSUMPTION 1] Reference Date & Temporal Baseline
- **Assumption**: The temporal anchor for the system, ageing buckets, seed data, and tests is **`2026-11-02`** (`REFERENCE_DATE=2026-11-02`), passed as a parameter into all pure domain functions.
- **Why**: The brief's sample data specifies:
  - `STU-0587` (Due 2026-10-10): "Part paid, 23 days overdue" $\rightarrow$ October 10 + 23 days = November 2, 2026.
  - `STU-0219` (Due 2026-11-15): "Due in 13 days" $\rightarrow$ November 15 - 13 days = November 2, 2026.

---

### [ASSUMPTION 2] Money Representation & Precision
- **Assumption**: All monetary values are stored in MongoDB schemas and processed in domain logic as positive integers in **paise** (1 INR = 100 paise). UI displays convert paise to INR (`₹`).
- **Why**: Eliminates floating-point rounding bugs and matches Indian payment gateway standards (Razorpay, Cashfree, PayU).

---

### [ASSUMPTION 3] Payment Integrity, Partial Payments & Overpayment Handling
- **Assumption**:
  - **Full Balance Pay Now**: The parent portal "Pay Now" action pays the **full remaining balance** of the earliest unpaid or partially paid instalment.
  - **Partial Payments**: Allowed **only** when accounts staff issue a specific partial payment link/attempt with a custom amount.
  - **Atomic Instalment Guard**: Instalment updates use a single atomic `findOneAndUpdate` with a conditional guard (`{ _id: instalmentId, $expr: { $lte: [{ $add: ["$paidPaise", amountPaise] }, "$amountPaise"] } }`). `paidPaise` can never exceed `amountPaise`.
  - **Overpayments & Concurrent Excess**: If a payment attempt or webhook arrives whose amount would cause `paidPaise > amountPaise`, or targets an already-paid instalment, it is routed to `UnmatchedPayment` (with reason `OVERPAYMENT` or `ALREADY_PAID`) and never applied to the instalment.
  - **Payment Status**: `Payment` records are created only for valid applied payments (`status: 'APPLIED'`). Unmatched or rejected payments reside strictly in `UnmatchedPayment` so they never taint the ledger or Tally export.

---

### [ASSUMPTION 4] Assumed Refund Policy & GST Treatment
- **Assumption**:
  - Screen title: **"Pro-Rata Refund (Assumed Policy)"**.
  - **Enrolled Days vs. Attended Days**: Pro-rata calculation uses **elapsed days enrolled** (course start date to formal exit notice date) divided by **total course duration days**, rather than physical attendance.
  - **Why**: Coaching seats are allocated per batch capacity. Elapsed calendar days enrolled provide an objective, non-disputable, and auditable calculation.
  - **Parameters on FeePlan**:
    - `courseStartDate` & `courseEndDate`
    - `adminFeePaise`: Non-refundable registration/admin fee (capped at ₹5,000 / 500,000 paise).
    - `materialFeePaise`: Non-refundable study kit fee if physical material was handed over (capped at ₹3,000 / 300,000 paise).
  - **Formula**:
    $$\text{Total Course Days} = \text{courseEndDate} - \text{courseStartDate}$$
    $$\text{Enrolled Days} = \text{exitDate} - \text{courseStartDate}$$
    $$\text{Instructional Deduction} = \text{round}\left( \frac{\text{Enrolled Days}}{\text{Total Course Days}} \times \text{totalCourseFeePaise} \right)$$
    $$\text{Net Refundable} = \max\Big(0,\, \text{paidPaise} - \text{adminFeePaise} - \text{materialFeePaise} - \text{Instructional Deduction}\Big)$$
  - **GST Treatment on Refunds**: Stated course fees are GST-inclusive. When a pro-rata refund is calculated, the net refund is similarly GST-inclusive; the tax component is pro-rated and reversed proportionally in accounts records (Credit Note with 18% GST split: 9% CGST + 9% SGST).
  - **Settlement Timeline**: The refund voucher states payment due within 10 calendar days under the assumed refund policy.

---

### [ASSUMPTION 5] GST Rate & Inclusivity
- **Assumption**:
  - GST rate: **18%** (9% CGST + 9% SGST).
  - Fees are quoted **GST Inclusive**.
  - Receipts display: Base Fee ($\frac{\text{Total}}{1.18}$), CGST 9%, SGST 9%, Total Paid, Receipt No., and GSTIN (`08AAAAA0000A1Z5`).

---

### [ASSUMPTION 6] Centres and Batches
- **Assumption**: 4 centres in Jaipur:
  1. `Jaipur Central (MI Road)`
  2. `Mansarovar Centre`
  3. `Vaishali Nagar Centre`
  4. `Tonk Road Centre`
  Batches include `JEE 2027 Morning`, `JEE 2027 Evening`, `NEET 2027 Morning`, `NEET 2027 Evening`.

---

### [ASSUMPTION 7] Rule-Based Dropout-Risk Score Weights and Cutoffs
- **Assumption**:
  - Strictly labelled **"Rule-Based Dropout-Risk Score"** across all UI and documentation.
  - Deterministic score capped at **100** points.
  - **Weights**:
    - **Fee delinquency**:
      - >15 days overdue: +30 points
      - >30 days overdue: +50 points (takes the higher bucket)
    - **Attendance trend**:
      - 30-day attendance <75%: +25 points
      - 30-day attendance <60%: +35 points (takes the higher bucket)
    - **Academic trend**:
      - Recent test score drop >20% compared to student's 3-test average: +15 points
  - **Cutoffs**:
    - `LOW`: 0 to 39 points
    - `MEDIUM`: 40 to 59 points
    - `HIGH`: 60 to 100 points (triggers `CounsellorTask` with status `PENDING`)
  - **Counsellor Task Statuses** (aligned with UI):
    - `PENDING`
    - `CONTACTED`
    - `RESOLVED`
    - `FALSE_ALARM`
  - **Safety Rule**: Counsellor task is purely internal. The system never sends automated messages to parents regarding risk and never restricts portal access.

---

### [ASSUMPTION 8] DPDP Act 2023 Consent & Automated Reminders
- **Assumption**:
  - `ParentConsent` is recorded **only after successful OTP verification**.
  - If consent does not exist, the parent is presented with a mandatory consent screen and blocked from accessing dues/portal until consent is recorded.
  - **Reminder Offsets**:
    - `-3` days (3 days before due date)
    - `0` days (on the due date)
    - `+3` days (3 days after due date)
    - `+7` days (7 days after due date)
  - **Idempotency**: At most one reminder per instalment per offset, tracked via an idempotency key (`${instalmentId}_${offset}`) in `MessageLog`.
  - **Reminders checks**:
    1. Parent has `consentGiven === true`. If not, skipped with status `SKIPPED_NO_CONSENT`.
    2. Re-checks balance before dispatch: if `paidPaise >= amountPaise`, skipped with status `SKIPPED_ALREADY_PAID`.
  - **Endpoint**: `POST /api/reminders/run` (restricted to `accounts_executive` role) and optional daily scheduled runner.

---

### [ASSUMPTION 9] Staff Roles & Authentication
- **Assumption**:
  - Staff: `accounts_executive`, `counsellor`, `admin` authenticated with email and bcrypt password.
  - Parents: OTP login with rate limiting (`express-rate-limit`).
  - In `OTP_MODE=mock`: test OTP `123456`, hashed in `Otp` collection with 5-minute expiry and max 3 attempts limit.

---

### [ASSUMPTION 10] Database Isolation for Tests & Seed
- **Assumption**:
  - Production/Demo DB: `kisht_fee_portal`.
  - Test DB: `kisht_fee_portal_test`.
  - Test suites and seed scripts explicitly refuse to run if `MONGO_URI` points to `kisht_fee_portal` during test execution.
