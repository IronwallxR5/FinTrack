# FinTrack — Personal Finance Tracker

A full-stack personal finance management application built with a **Node.js / Express** backend and a **React + Vite** frontend. Track income and expenses across multiple currencies, set category budgets, upload receipts, receive budget-breach notifications by email, and get AI-driven financial insights powered by Groq.

---

## Table of Contents

1. [Live Features](#live-features)
2. [Tech Stack & Why I Chose It](#tech-stack--why-i-chose-it)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [API Reference](#api-reference)
6. [Environment Variables](#environment-variables)
7. [Local Setup](#local-setup)
8. [Challenges & How I Overcame Them](#challenges--how-i-overcame-them)
9. [Key Design Decisions](#key-design-decisions)
10. [Screenshots](#screenshots)

---

## Live Features

| Area | What it does |
|---|---|
| **Authentication** | JWT-based email/password auth + Google OAuth 2.0 (Passport.js). Tokens stored in `localStorage`; protected routes redirect unauthenticated users. |
| **Transactions** | Full CRUD for income/expense records. Filter by type and currency. Negative amounts represent refunds/adjustments. |
| **Receipt Uploads** | Attach a JPEG, PNG, WEBP, GIF, or PDF receipt (≤ 5 MB) to any transaction. Files stored on disk; UUID filenames prevent collisions. |
| **Categories** | User-defined income/expense categories. Cascaded on delete so no orphaned transactions. |
| **Multi-Currency** | 10 supported currencies (USD, INR, EUR, GBP, JPY, CHF, HKD, SGD, AED, KWD). Live exchange rates fetched browser-side from `api.exchangerate-api.com`; hardcoded fallback rates prevent UI breakage when the external API is down. |
| **Budgets** | Monthly spending limits per category, per currency. Real-time "% used" tracking. Visual warning at 80 %, alert at 100 %. |
| **Budget Notifications** | Automatic email via SendGrid when a transaction pushes a budget to ≥ 80 % or ≥ 100 %. In-app notification centre with unread badge. |
| **Dashboard** | Summary cards (total income, expenses, net balance), category breakdown pie chart, and recent transactions — all currency-aware. |
| **AI Financial Advisor** | Multi-turn chat powered by Groq (`llama-3.3-70b-versatile`). The system prompt is injected with the user's real financial data (summary, budget status, recent transactions) so advice is always personalised. |
| **AI Auto-Categorise** | ✨ Sparkles button next to any transaction description. Calls Groq to match the description against the user's own category list and auto-fills the dropdown. |
| **Profile** | Update display name and preferred currency. |

---

## Tech Stack & Why I Chose It

### Backend

| Technology | Version | Reason |
|---|---|---|
| **Node.js** | 20 | Non-blocking I/O is ideal for an API that makes concurrent DB queries and external HTTP calls (exchange rates, Groq, SendGrid). Familiar ecosystem with npm. |
| **Express 5** | ^5.2 | Express 5 ships with built-in async error propagation — `next(err)` is called automatically if an `async` route throws, removing the need for `try/catch` wrappers on every handler. This was a deliberate upgrade from v4. |
| **PostgreSQL (Neon)** | — | Relational data fits naturally here: users → categories → transactions → budgets all have clear foreign-key relationships. Neon provides a serverless Postgres instance with a free tier, branch-per-PR support, and connection pooling out of the box, which removed all infrastructure overhead. |
| **`pg` (node-postgres)** | ^8.19 | Raw SQL over an ORM gives full control over query optimisation (e.g., the budget currency filter is a single aggregating JOIN). No magic, no N+1 surprises. |
| **JWT (jsonwebtoken)** | ^9.0 | Stateless authentication. Each request is self-verified; no server-side session store needed. Pairs cleanly with a React SPA. |
| **Passport + Google OAuth** | ^0.7 / ^2.0 | Passport's strategy pattern made adding Google login a clean adapter rather than a custom OAuth flow. The session is intentionally short-lived (5 min) — just long enough to exchange the OAuth code for a JWT. |
| **Multer** | ^2.1 | De-facto standard for handling `multipart/form-data` in Express. Custom storage engine (UUID filenames, MIME-type whitelist, 5 MB limit) was straightforward to configure. |
| **@sendgrid/mail** | ^8.1 | Reliable transactional email with a generous free tier. The `notificationService` is called fire-and-forget after budget-impacting transactions so email delivery never blocks an API response. |
| **groq-sdk** | ^0.37 | Groq's inference API delivers `llama-3.3-70b-versatile` responses in ~1–2 seconds — fast enough for a chat UI. The SDK is a thin official wrapper; no undocumented endpoints. |
| **dotenv** | ^17 | Zero-dependency env loading. `dotenv@17` introduced the startup tip banner which doubles as a quick sanity-check that `.env` is being read. |

### Frontend

| Technology | Version | Reason |
|---|---|---|
| **React 19** | ^19.2 | Latest stable. The new compiler optimisations (automatic memoisation) reduce boilerplate. Context API alone is sufficient for this app's state surface — no Redux needed. |
| **Vite 7** | ^7.3 | HMR is near-instant even with Tailwind v4. `import.meta.env` maps cleanly to `VITE_*` variables. The build output is a single optimised bundle. |
| **Tailwind CSS v4** | ^4.2 | v4 drops the `tailwind.config.js` file; configuration lives in CSS via `@theme`. This reduced config boilerplate significantly. Utility-first removes the context-switching between JS and CSS files. |
| **React Router v7** | ^7.13 | File-based routing is opt-in; the `<Routes>` / `<Route>` API is mature and exactly the right complexity for ~10 pages. Nested routes let the authenticated layout wrap all protected pages cleanly. |
| **Recharts** | ^3.7 | Composable React chart primitives. The `PieChart` on the dashboard needed custom labels and tooltips — Recharts makes both surgical. |
| **Axios** | ^1.13 | Interceptors. A single request interceptor attaches the `Authorization: Bearer <token>` header to every call; a response interceptor catches 401s and triggers logout. This was not possible with the native `fetch` API without custom wrapping. |
| **lucide-react** | ^0.575 | Consistent, tree-shakeable icon set. Every icon used is individually imported — no bloat. |

---

## Project Structure

```
FJ-BE-R2-Padam-Rathi-NST-Pune/
├── backend/
│   ├── config/
│   │   ├── db.js              # pg Pool singleton
│   │   ├── groq.js            # Groq client singleton (null if key absent)
│   │   ├── migrate.js         # Auto-runs pending SQL migrations on startup
│   │   ├── passport.js        # Google OAuth 2.0 strategy
│   │   └── upload.js          # Multer disk storage + MIME whitelist
│   ├── controllers/
│   │   ├── aiController.js    # /api/ai/chat  +  /api/ai/categorize
│   │   ├── authController.js
│   │   ├── budgetController.js
│   │   ├── categoryController.js
│   │   ├── dashboardController.js
│   │   ├── notificationController.js
│   │   └── transactionController.js
│   ├── middlewares/
│   │   ├── authMiddleware.js  # JWT verification → req.user
│   │   └── errorHandler.js    # Global Express error handler
│   ├── migrations/            # Sequential SQL files, applied once
│   │   ├── 001_create_users_table.sql
│   │   ├── 002_create_categories_table.sql
│   │   ├── 003_create_transactions_table.sql
│   │   ├── 004_create_budgets_table.sql
│   │   ├── 005_add_user_profile_fields.sql
│   │   ├── 006_add_google_id.sql
│   │   ├── 007_add_currency_support.sql
│   │   ├── 008_add_budget_currency.sql
│   │   ├── 009_create_notifications_table.sql
│   │   └── 010_add_receipt_url.sql
│   ├── routes/
│   │   ├── aiRoutes.js
│   │   ├── authRoutes.js
│   │   ├── budgetRoutes.js
│   │   ├── categoryRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── notificationRoutes.js
│   │   └── transactionRoutes.js
│   ├── services/
│   │   └── notificationService.js  # Budget-breach detection + email
│   ├── uploads/               # Persisted receipt files (git-ignored)
│   ├── server.js
│   ├── .env                   # Local secrets (git-ignored)
│   └── .env.example
│
└── frontend/
    ├── public/
    └── src/
        ├── components/
        │   ├── Layout.jsx     # Sidebar nav + mobile topbar
        │   └── ui/            # Button, Card, Input, Badge, Select, …
        ├── context/
        │   └── AuthContext.jsx
        ├── lib/
        │   ├── api.js         # Axios instance + interceptors
        │   └── currencies.js  # CURRENCIES list + convert() + formatAmount()
        ├── pages/
        │   ├── AIAdvisor.jsx
        │   ├── Budgets.jsx
        │   ├── Categories.jsx
        │   ├── Dashboard.jsx
        │   ├── Login.jsx
        │   ├── Notifications.jsx
        │   ├── OAuthCallback.jsx
        │   ├── Profile.jsx
        │   ├── Register.jsx
        │   └── Transactions.jsx
        ├── App.jsx
        ├── .env               # VITE_API_URL (git-ignored)
        └── .env.example
```

---

## Database Schema

The schema is managed through 10 sequential migration files applied automatically at server startup.

```
users
  id (UUID PK), name, email, password_hash, google_id,
  preferred_currency, created_at

categories
  id (UUID PK), user_id (FK → users), name, type (income|expense), created_at

transactions
  id (UUID PK), user_id (FK → users), category_id (FK → categories),
  amount (NUMERIC), description, date, currency, receipt_url, created_at

budgets
  id (UUID PK), user_id (FK → users), category_id (FK → categories),
  monthly_limit (NUMERIC), currency, created_at

notifications
  id (UUID PK), user_id (FK → users), title, message,
  type (budget_warning|budget_exceeded|…), is_read (BOOLEAN), created_at
```

---

## API Reference

All protected routes require `Authorization: Bearer <token>`.

### Auth — `/api/auth`
| Method | Path | Description |
|---|---|---|
| POST | `/register` | Register with email + password |
| POST | `/login` | Login → returns JWT |
| GET | `/google` | Start Google OAuth flow |
| GET | `/google/callback` | OAuth redirect → returns JWT |
| GET | `/me` | Get current user profile |
| PUT | `/me` | Update name / preferred_currency |

### Transactions — `/api/transactions`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List transactions (filter by `type`, `currency`) |
| POST | `/` | Create transaction |
| PUT | `/:id` | Update transaction |
| DELETE | `/:id` | Delete transaction |
| POST | `/:id/receipt` | Upload receipt (multipart) |
| DELETE | `/:id/receipt` | Remove receipt |

### Categories — `/api/categories`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List user's categories |
| POST | `/` | Create category |
| PUT | `/:id` | Update category |
| DELETE | `/:id` | Delete category |

### Budgets — `/api/budgets`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List budgets with current month's spend |
| POST | `/` | Create budget |
| PUT | `/:id` | Update budget |
| DELETE | `/:id` | Delete budget |

### Dashboard — `/api/dashboard`
| Method | Path | Description |
|---|---|---|
| GET | `/` | Summary: totals, category breakdown, recent transactions |

### Notifications — `/api/notifications`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List notifications |
| GET | `/unread-count` | Returns `{ unread: N }` |
| PUT | `/:id/read` | Mark notification as read |
| PUT | `/mark-all-read` | Mark all as read |
| DELETE | `/:id` | Delete notification |

### AI — `/api/ai`
| Method | Path | Body | Description |
|---|---|---|---|
| POST | `/chat` | `{ message, history[] }` | Multi-turn financial advisor chat |
| POST | `/categorize` | `{ description }` | Suggest best-matching category |

---

## Environment Variables

### Backend (`backend/.env`)

```env
# PostgreSQL (Neon or any Postgres)
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# JWT
JWT_SECRET=a_long_random_string
JWT_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Google OAuth  (console.cloud.google.com)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# SendGrid transactional email
SENDGRID_API_KEY=SG.xxx
EMAIL_FROM=notifications@yourdomain.com

# CORS — comma-separated allowed frontend origins
ALLOWED_ORIGINS=http://localhost:5173

# Groq AI  (console.groq.com — free tier)
GROQ_API_KEY=gsk_xxx
GROQ_MODEL=llama-3.3-70b-versatile
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:3000/api
```

---

## Local Setup

### Prerequisites
- Node.js ≥ 20.19 (or 22.12+)
- A PostgreSQL database (Neon free tier recommended)
- A Groq API key (free at [console.groq.com](https://console.groq.com))

### 1 — Clone and install

```bash
git clone https://github.com/IronwallxR5/FJ-BE-R2-Padam-Rathi-NST-Pune.git
cd FJ-BE-R2-Padam-Rathi-NST-Pune

# Backend
cd backend
cp .env.example .env        # then fill in your values
npm install

# Frontend
cd ../frontend
cp .env.example .env        # VITE_API_URL=http://localhost:3000/api
npm install
```

### 2 — Start the backend

```bash
cd backend
npm run dev
# Server starts on :3000
# Migrations run automatically on first boot
```

### 3 — Start the frontend

```bash
cd frontend
npm run dev
# Vite dev server starts on :5173
```

### 4 — Open the app

Navigate to [http://localhost:5173](http://localhost:5173).

---

## Challenges & How I Overcame Them

### 1. Exchange Rates — Stale Cache + Race Condition

**Problem:** The dashboard fetched exchange rates from the backend, which cached them at startup. Any network error during the backend boot meant every currency conversion showed as `0` or `NaN`. Separately, `fetchData()` and `fetchRates()` were chained sequentially, so a slow rate API delayed the entire dashboard render.

**Solution:**
- Moved rate fetching to the **browser side** (`api.exchangerate-api.com/v4/latest/USD` directly from `currencies.js`).
- Pre-seeded `FALLBACK_RATES` for all 10 currencies so the UI always renders valid numbers even when the external API is unreachable.
- Split `fetchData` and `fetchRates` into **two independent async calls** launched in parallel — dashboard data appears immediately while rates update in the background.

---

### 2. Budget Spent Amount — Wrong Currency Mixing

**Problem:** A budget set in EUR was counting INR transactions toward its `spent_this_month` total, producing wildly incorrect figures.

**Solution:** Added a `WHERE t.currency = b.currency` filter to the budget aggregation query. Each budget now only sums transactions that share its currency. The frontend `convert()` utility converts the result to the user's preferred display currency for the summary view.

---

### 3. Google OAuth — Session Lifetime Mismatch

**Problem:** After the Google OAuth callback issued a JWT and redirected to the frontend, the Express session (used only for the OAuth handshake) lingered. On slow connections the session would expire mid-callback, causing a "failed to deserialise user" Passport error.

**Solution:** Set `cookie.maxAge` to 5 minutes (just long enough for the code exchange) and called `req.session.destroy()` immediately after the JWT was issued and the redirect sent. The JWT alone is the auth mechanism after that point.

---

### 4. Multer v2 Breaking API Change

**Problem:** `multer@2` removed the `fileFilter` callback signature `(req, file, cb)` in favour of returning a boolean/promise, breaking my MIME-type validation.

**Solution:** Read the v2 changelog and rewrote `fileFilter` as an `async` function returning `true`/`false`. Also switched from `cb(null, filename)` in `filename` to returning the string directly. Took ~30 minutes of debugging `TypeError: cb is not a function` stack traces to pinpoint.

---

### 5. Groq JSON Output — Inconsistent Formatting

**Problem:** The `categorize` endpoint asked Groq to return pure JSON, but the model occasionally wrapped the output in a markdown code block (` ```json ... ``` `), causing `JSON.parse()` to throw and returning a 500 to the frontend.

**Solution:** Added a regex extraction step — `raw.match(/\{[\s\S]*\}/)` — before parsing, which strips any surrounding markdown. Also dropped the temperature to `0.1` for deterministic JSON output. If parsing still fails, the endpoint gracefully returns `{ category_id: null, confidence: "low" }` instead of a 500.

---

### 6. CORS — Open Wildcard vs. Locked Origin

**Problem:** The initial `app.use(cors())` allowed any origin. This is fine locally but is a security liability when deployed, especially since cookies (`credentials: true`) are sent with Google OAuth.

**Solution:** Replaced the wildcard with an origin allowlist read from `ALLOWED_ORIGINS` (comma-separated env var). A custom origin callback allows requests with no `Origin` header (curl, Postman, mobile apps) while rejecting unknown browser origins. The frontend `.env` / `.env.example` documents `VITE_API_URL` so the deployed URL can be swapped without touching code.

---

### 7. AI Module Not Found on Boot

**Problem:** After wiring up `aiRoutes.js`, the server crashed with `Cannot find module '../middleware/auth'`. The folder is `middlewares` (plural) and the export is a default export, not a named `{ authenticateToken }`.

**Solution:** Fixed the import path to `../middlewares/authMiddleware` and changed the destructured import to a default import. Added a quick `find` + `grep module.exports` before writing any new route file to confirm naming conventions in future.

---

## Key Design Decisions

**Migration-first schema management.** Rather than using an ORM with auto-sync, all schema changes are explicit numbered SQL files. A `migrate.js` runner that tracks applied migrations in a `_migrations` table ensures the schema evolves predictably across environments. This made debugging currency columns and receipt URLs straightforward.

**Fire-and-forget notification checks.** Budget breach detection is deliberately async and non-blocking. A failed SendGrid call never surfaces as a transaction error to the user — it is logged server-side only. This keeps the transaction creation p95 latency unaffected by email delivery.

**AI graceful degradation.** The Groq client is initialised as `null` when `GROQ_API_KEY` is absent. Every AI endpoint checks for `null` first and returns a `503` with a human-readable message rather than crashing. This means the rest of the app works fully without an AI key configured.

**Browser-side currency conversion.** Keeping conversion logic in `currencies.js` (frontend) means the backend never needs to know about display currencies. Every API response carries the raw stored currency; the frontend converts on render. This separation makes adding new currencies a frontend-only change.

---

## Author

**Padam Rathi**
