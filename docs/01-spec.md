# teknisi-expense: complete spec

Everything decided, no explanation. For the reasoning behind any line, see the numbered document named in the last column.

---

## 1. What it is

Internal web app for PT KSA, Divisi Wood Finishing. HR enters technician travel expenses from paper forms, the branch head approves a closed month, the system exports a print-ready Excel matching the paper layout.

Scale: <10 users, 3 concurrent, 800 trips/month, ~10k rows/year, 1 developer.

---

## 2. Roles

| Role | Can |
|---|---|
| HR | Master data, enter/edit/delete trips (all branches), submit a month, export |
| Kepala Cabang | View, approve, reject, reopen, export. **Own branch only.** |
| Admin | Everything, plus users, branches, fuel rates |

Technicians are records, not users. No self registration. Landing page: HR/Admin → Beranda, Kepala Cabang → Menunggu Persetujuan.

---

## 3. The calculation

```
distance = odoEnd - odoStart
fuelCost = round(distance × pricePerLiter ÷ kmPerLiter)   // half up, whole rupiah
```

Current rate: Rp 10.000/litre, 30 km/litre → **Rp 333,33/km**. Motorcycle, Pertalite.

- Computed on the server at write time, stored, never derived on read.
- Rate = row with greatest `effectiveFrom` ≤ `tripDate`. None → 422 `RATE_NOT_FOUND`. No fallback.
- Toll, parkir, makan are manual amounts.

---

## 4. Data model

9 tables. Money is `Int` rupiah everywhere. Full field spec in `03-data-model.md`.

| Table | Key fields | Rules |
|---|---|---|
| `branches` | code, name | 6 rows |
| `cities` | name | unique, case insensitive |
| `destinations` | name, **`default_city_id` nullable** | default is a form suggestion only |
| `users` | email, role, branch_id | CHECK: branch_id required iff role=branch_head |
| `technicians` | **code (required, unique)**, name, branch_id | never deleted, only deactivated |
| `fuel_rates` | effective_from, price_per_liter, km_per_liter | **append only, no `effective_to`, no edit/delete route** |
| `expense_periods` | technician_id, **branch_id (snapshot)**, year, month, status | **UNIQUE(technician_id, year, month)** |
| `trips` | period_id, trip_date, city_id, destination_id, odo_start/end, **4 snapshot cols**, toll/parking/meal, odo_gap_flagged | CHECK odo_end > odo_start |
| `period_events` | period_id, event_type, actor, reason | **append only** |

**Snapshot columns on `trips`:** `distance_km`, `fuel_price_per_liter`, `fuel_km_per_liter`, `fuel_cost`. Stored, not derived. Point in time. Do not normalise away.

`distance_km` and `total_amount` are `GENERATED ALWAYS AS ... STORED`.

**Indexes, three:** `trips(period_id)`, `trips(trip_date)`, `expense_periods(branch_id, year, month)`. No more without a measurement. No `technician_id` on `trips`.

---

## 5. State machine

```
[draft] --submit--> [submitted] --approve--> [approved]
   ^                     |                        |
   |                   reject                  reopen
   |                  (+reason)                (+reason)
   |                     v                        |
   +---------------- [rejected] <-----------------+
```

| Transition | Who | From |
|---|---|---|
| create period | system, on first trip of the month | — |
| submit | HR, Admin | draft, rejected. ≥1 trip required. |
| approve | Kepala Cabang (own branch), Admin | submitted |
| reject | Kepala Cabang (own branch), Admin | submitted. Reason required. |
| reopen | Kepala Cabang (own branch), Admin | approved. Reason required. → draft |

**Lock rule:** trips writable only when period is `draft` or `rejected`. Otherwise **409 `PERIOD_LOCKED`**. Checked inside the transaction.

---

## 6. API

Hono at `src/app/api/[[...route]]/route.ts`. Swagger at `/api/docs`.

```
POST   /auth/login  { email, password }        POST /auth/logout      GET /me
GET    /cities                 POST /cities                    hr, admin
GET    /destinations           POST /destinations               hr, admin
GET    /technicians            POST /technicians  PATCH /:id    hr, admin
GET    /fuel-rates             GET /fuel-rates/effective?date=  POST (admin only)
GET    /periods                GET /periods/:id
POST   /periods/:id/submit                                      hr, admin
POST   /periods/:id/approve | /reject | /reopen  { reason }     branch_head, admin
GET    /trips?periodId=        POST /trips  PATCH /:id  DELETE /:id   hr, admin
GET    /trips/odometer-hint?technicianId=&date=                 hr, admin
GET    /exports/monthly?year=&month=&branchId=   → xlsx
```

**Response:** resource, or `{data, page, limit, total}`, or `{error:{code, message, fields}}`.

| Code | HTTP | | Code | HTTP |
|---|---|---|---|---|
| `UNAUTHENTICATED` | 401 | | `PERIOD_LOCKED` | 409 |
| `FORBIDDEN` | 403 | | `CONFLICT` | 409 |
| `NOT_FOUND` | 404 | | `RATE_NOT_FOUND` | 422 |
| `VALIDATION_ERROR` | 422 | | `RATE_LIMITED` | 429 |

**`POST /trips`** — client sends `technicianId, tripDate, cityId, destinationId, odoStart, odoEnd, tollAmount, parkingAmount, mealAmount, notes`. Server ignores `periodId`, `fuelCost`, `distanceKm`, any rate. One transaction: load technician → derive year/month → find-or-create period (snapshot branch_id) → lock check → rate lookup → compute → set `odo_gap_flagged` → insert.

---

## 7. Hard rules

1. Money computed on the server, stored. Never trusted from the request body.
2. Money is `Int` rupiah. Never float, never Decimal.
3. Trip stores the rate effective on its own date. Rate changes never alter existing rows.
4. Scope goes in the **WHERE clause**, never an `if` after the fetch. Out of scope → **404, not 403**.
5. Trips writable only in `draft` or `rejected`. Else 409.
6. UI text Bahasa Indonesia. Code English.
7. Light theme only. No dark surfaces, sidebar included.
8. Login failure message identical for wrong password / unknown email / deactivated account, **including response time**.
9. Session in httpOnly cookie, sliding 8h. Never localStorage, never bearer.
10. Failed save never clears the form.
11. Never `$queryRawUnsafe`. Never an edit/delete route for `fuel_rates` or `period_events`.

---

## 8. Entry speed: 5 mechanics, none optional

Target: **median under 15 seconds per trip, keyboard only.**

1. Teknisi and Tanggal stay populated after save
2. Km Awal pre-filled from last Km Akhir
3. Kota pre-filled from destination default, still editable
4. Keterangan offers recent notes
5. `Ctrl+Enter` saves and refocuses Km Akhir

---

## 9. Excel export

One file: sheet 1 `REKAP` (per technician + YTD column + branch subtotals), then one sheet per technician.

Technician sheet columns: `TANGGAL, TUJUAN, KOTA, KM AWAL, KM AKHIR, JARAK, BBM, TOLL DAN PARKIR, MAKAN, KETERANGAN` → Sub Total → Grand Total → Pemeriksa / Staf HRD GA block.

`TOLL DAN PARKIR` = toll + parking summed at render. Stored separately.

**Print setup per sheet, all required:** explicit `printArea`, `printTitlesRow` (header repeats), fit 1 page wide / unlimited tall, A4 landscape, 0.5in margins, footer with page X of Y + timestamp.

File name: `Biaya-Operasional-Teknisi-{YYYY}-{MM}-{BRANCH}.xlsx`

Verify: 22 trips → exactly 1 page. 60 trips → header repeats on every page.

---

## 10. Stack

| Layer | Choice |
|---|---|
| FE | Next.js App Router, TypeScript strict, Tailwind, shadcn/ui, React Hook Form, TanStack Query (optional) |
| BE | Hono + `@hono/zod-openapi` + `@hono/swagger-ui`, Zod, iron-session, bcryptjs, date-fns, ExcelJS (pinned exact) |
| DB | PostgreSQL, Prisma 7, Neon (Singapore `aws-ap-southeast-1`) |
| Host | Render Starter (prod) / Vercel Hobby (dev only, commercial use not permitted), region Singapore |
| Test | Vitest, plus one Playwright or Cypress happy path |
| Domain | `biaya-teknisi.ksa.co.id`, free |

**Folders:** `src/app` (React) · `src/app/api/[[...route]]/route.ts` (only file there) · `src/server/{routes,services,db,auth}` (no React) · `src/components` (no Prisma) · `src/lib` (isomorphic).

**Cost:** dev Rp 0. Production ~12 USD/mo ≈ Rp 212.000 (Render 7 + Neon ~5). All software free.

**Never add:** Redis, queue, Docker, worker, websockets, GraphQL, state library, auth service, monorepo tooling.

---

## 11. Build phases

| Phase | Days | Conf | Gate |
|---|---|---|---|
| 0 Foundation | 1.5 | High | Deployed preview, Swagger renders, pooled connection proven |
| **1 Vertical slice** | 4 | Med | **1 sheet prints to exactly 1 page, totals tie, checks 1–3 pass** |
| 2 Auth & scope | 2 | Med | Checks 4, 5, 6, 9 pass |
| 3 Master data | 2 | High | Technician with trips undeletable; rate uneditable |
| 4 Trip entry | 3 | Med | Check 11: median written down |
| 5 Period & approval | 2.5 | Med | Checks 7, 8 pass |
| 6 Export complete | 2 | Med | **Earliest shippable point** |
| 7 Dashboard | 1.5 | High | Totals match across pages |
| 8 Verify & repair | 2 | Low | All 12 checks |
| 9 Ship | 1.5 | Med | Check 12, handover doc |

**21.5 focused days.** At 1–2 days/week alongside the day job: **3 to 5 months calendar.**

---

## 12. The twelve checks

Run before go live. Full version in `06b-critical-checks.md`.

| # | Check | Pass |
|---|---|---|
| 1 | Add a new fuel rate, re-read an old trip | `fuel_cost` unchanged |
| 2 | 1 km trip on the 32 km/l rate | `fuel_cost = 313` |
| 3 | POST a trip with `fuelCost: 999999` | server value stored |
| 4 | Kepala Cabang JKT GETs an SMG period by id | 404, no SMG data |
| 5 | Kepala Cabang JKT exports with SMG `branchId` | 404, no file |
| 6 | Repeat 3, 4, 5 with curl | identical results |
| 7 | Save a trip inside an approved month | 409, total unchanged |
| 8 | Duplicate technician-year-month **via raw SQL** | DB rejects |
| 9 | Time unknown email vs wrong password | within 200 ms |
| 10 | Force failure mid-transaction | no orphan period |
| 11 | 20 trips, keyboard only | median <15s, **written down** |
| 12 | Restore a 3 day old backup | succeeds, complete |

Re-run 1, 11, 12 after three months. Have HR run 11.

---

## 13. Out of scope, version one

Technician self service · mobile / offline / PWA · receipt photos · GPS · payroll integration · payment tracking · non-motorcycle vehicles · other fuel types · per-branch rates · PDF export · notifications · multi-level approval · charts and dashboards · historical backfill · language switching · distance anomaly check · bulk edit/delete · browser print view.

---

## 14. Still open

**The rate is not agreed.** Rp 333,33/km produces figures far below what the paper form pays. Configurable row, so no code depends on it. Get it in writing before Phase 1.

---

## Document map

| Need | File |
|---|---|
| Start building | `11-phase-0-runbook.md` |
| Field specs, security detail | `03-data-model.md` |
| Exact Indonesian copy | `04-user-flow.md` |
| Screens | `05-mockup.html` |
| Generate high fidelity UI | `05b-stitch-prompts.md` |
| Criteria for one feature | `06-acceptance-criteria.md` (lookup only) |
| Why a decision was made | `07-technical-decisions.md` |
| Neon setup / trouble | `07b-neon-guide.md` |
| Scope contract | `02-prd.md` |
