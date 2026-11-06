# Problem Statement: Kisht Fee Portal (Company A, Jaipur)

## Client Profile
- **Client**: Company A, Jaipur
- **Business**: Engineering and Medical Entrance Coaching (IIT-JEE & NEET)
- **Scale**: 4 centres, 2,600 students, 140 staff
- **Revenue**: ₹30–34 crore / year
- **Fee Model**: Average fee ₹1.2 lakh / year, paid in 3 or 4 instalments

## Current State & Bottlenecks
- Centres record receipts in desktop fee software and manually post totals to Tally.
- Due dates sit in separate Excel sheets per centre.
- Accounts staff phone parents to remind them; parents call centres to inquire about balances.
- Test scores are distributed as PDFs in WhatsApp groups.
- Refunds are calculated manually by hand.

## The Problem & Financial Impact
- **Annual Billing**: 2,600 × ₹1,20,000 = ₹31.2 crore billed annually.
- **Uncollected Dues**: 2% is never collected due to late and uneven follow-ups = ₹62.4 lakh loss.
- **Delayed Revenue**: 12% of instalment value arrives over 60 days late.
- **Labour Overhead**: 8 accounts staff spend half their time chasing dues (4 FTEs × ₹4.2 lakh) = ₹16.8 lakh.
- **Total Annual Drain**: ₹79.2 lakh / year.

## Target Outcomes & Success Metrics
- **Budget & Timeline**: ₹6 lakh, 6 weeks.
- Dues >60 days late reduced from 12% to 6% in two terms.
- Inbound parent calls regarding dues reduced by 70%.
- Month-end reconciliation time slashed from 4 days to 1 day.

## Users & Stakeholders
1. **Parents** (primarily mobile phone users; needs Hindi support and 5-second clarity).
2. **Students**.
3. **Centre Accounts Staff & Counsellors**.
4. **Founder-Director**.

## Core Build Requirements (Must-Have Scope)
- **Fee Ledger per Student**: Fee plan, instalments, discounts, payments, balance, and days overdue.
- **Parent Portal (Mobile-First, OTP Login)**: Due amount, due date, pay button, payment receipts with GST, attendance records, and test scores.
- **Automated Bilingual Reminders (Hindi & English)**: Sent before, on, and after due date; immediately stops when paid; verifies DPDP consent before sending.
- **Payment Link per Instalment**: Gateway test mode with HMAC-SHA256 verified webhook marking instalments as paid.
- **Pro-Rata Refund Calculator**: Ministry of Education 2024 Coaching Guidelines compliance (refund within 10 days).
- **Accounts Dashboard**: Cross-centre and batch dues view, ageing buckets (0-30, 31-60, 60+), and Tally export format.
- **Bulk Upload**: Batch CSV/Excel upload for attendance and test scores.
- **AI Dropout-Risk Flag**: Flags students at risk based on missed instalments, falling attendance, and test score drops. Creates counsellor call tasks only (never automated parent fee actions; counsellor can mark false flags).
- **Unmatched Payments Queue**: Webhook discrepancies or unknown references are quarantined for accounts review.

## Out of Scope
- Video lectures or learning management platform (LMS)
- Timetables scheduling
- Admissions CRM pipeline
