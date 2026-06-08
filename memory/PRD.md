# SK Made — Failed Payment Tracker (PRD)

## Original problem statement
Build an app to track failure payment made on online website like bill payment etc but debited from account, need function to add failure screenshot.

## User choices (Feb 2026)
- Authentication: **None** (single-user, local use)
- Fields tracked: amount, date, merchant/website, payment method (UPI/Card/NetBanking/Wallet/Other), transaction ID, bank, status (Pending/Refunded/Lost), notes
- Screenshot storage: **Emergent object storage**
- Extras: summary stats dashboard, filter/search, CSV export
- Design style: **Minimal** (Swiss / High-Contrast archetype)

## Architecture
- **Frontend**: React + Tailwind + Shadcn UI. Single page Dashboard at `/`.
- **Backend**: FastAPI (`/api` prefix), MongoDB via Motor, `requests` to Emergent object storage.
- **Storage**: Emergent object storage under `failed-payment-tracker/screenshots/{uuid}.{ext}`. File metadata stored in `files` collection with soft-delete flag.

## Implemented (Feb 2026)
- Backend: `POST/GET/GET-by-id/PATCH/DELETE /api/payments`, `GET /api/payments/stats`, `POST /api/screenshots`, `GET /api/screenshots/{path}`.
- Frontend: stat cards (Amount Stuck, Total Records, Recovered, Lost), search bar, status filter, full payments table, Add/Edit dialog with screenshot upload, Detail dialog with screenshot viewer + status change + delete, CSV export.
- Backend regression suite: 21/21 tests passing (`/app/backend/tests/test_payments.py`).

## Backlog
- P1: Sort/column toggles on the table; pagination beyond 1000 records.
- P1: Date range filter (preset + custom range).
- P2: Multi-screenshot per payment, bank statement PDF attachment.
- P2: Email/PDF "complaint pack" to send to bank/merchant.
- P2: Mobile-first quick-add (camera capture for screenshot).
- P2: Recovery rate KPI, average resolution time chart.
