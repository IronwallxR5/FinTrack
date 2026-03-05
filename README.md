# FinTrack — Personal Finance Tracker

A full-stack personal finance management application with multi-currency support, AI-powered insights, budget monitoring with email alerts, and receipt management.

**Live Demo:** [Frontend (Vercel)](https://fj-be-r2-padam-rathi-nst-pune.vercel.app) · [Backend API (Render)](https://fj-be-r2-padam-rathi-nst-pune.onrender.com)

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture Overview](#-architecture-overview)
- [Project Structure](#-project-structure)
- [Database Schema](#-database-schema)
- [API Reference](#-api-reference)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Deployment](#-deployment)
- [Key Design Decisions](#-key-design-decisions)
- [Challenges & Solutions](#-challenges--solutions)
- [Author](#-author)

---

## ✨ Features

### Core Finance Management
- **Transaction Tracking** — Full CRUD for income and expense records with date, description, category, and currency
- **Custom Categories** — User-defined income/expense categories with cascade deletion (no orphaned data)
- **Multi-Currency Support** — 10 currencies (USD, INR, EUR, GBP, JPY, CHF, HKD, SGD, AED, KWD) with live exchange rate conversion
- **Receipt Uploads** — Attach JPEG, PNG, WEBP, GIF, or PDF receipts (≤ 5 MB) to any transaction

### Budget Monitoring & Alerts
- **Monthly Budgets** — Set spending limits per expense category with real-time progress tracking
- **Cross-Currency Budget Aggregation** — Budget in INR tracks USD/EUR/GBP expenses too, auto-converted via live exchange rates
- **Smart Notifications** — Automatic alerts at 80% (warning) and 100% (exceeded) thresholds
- **Email Alerts** — SendGrid-powered email notifications when budget thresholds are crossed
- **In-App Notification Centre** — Bell icon with unread badge, mark-as-read, and bulk actions

### AI-Powered Intelligence
- **Financial Advisor Chat** — Multi-turn conversational AI (Groq `llama-3.3-70b-versatile`) that knows your real financial data — balances, budgets, spending patterns — and gives personalised advice
- **Auto-Categorisation** — ✨ Sparkle button on transactions uses AI to match descriptions to your category list automatically

### Authentication & Security
- **JWT Authentication** — Stateless token-based auth with secure `httpOnly` patterns
- **Google OAuth 2.0** — One-click Google sign-in via Passport.js
- **Protected Routes** — All finance endpoints require valid tokens; frontend redirects unauthenticated users

### Dashboard & Visualisation
- **Financial Summary** — Total income, expenses, and net savings cards with currency conversion
- **Monthly Trends Chart** — Bar chart (Recharts) showing income vs expenses over time
- **Budget Progress Bars** — Visual indicators with colour-coded status (green/amber/red)
- **Currency Switcher** — View all data in any supported currency instantly

---

## 🛠 Tech Stack

### Backend

| Technology | Purpose |
|---|---|
| **Node.js 20** + **Express 5** | REST API server — Express 5's native async error propagation eliminates manual `try/catch` boilerplate |
| **PostgreSQL** (Neon) | Relational database — foreign keys enforce data integrity across users → categories → transactions → budgets |
| **pg (node-postgres)** | Raw SQL queries — full control over JOINs and aggregations without ORM overhead |
| **JWT (jsonwebtoken)** | Stateless authentication — self-verifying tokens, no server-side session store needed |
| **Passport.js** | Google OAuth 2.0 strategy — clean adapter pattern for social login |
| **SendGrid** | Transactional email — budget breach notifications delivered reliably |
| **Groq SDK** | LLM inference — `llama-3.3-70b-versatile` responses in ~1–2 seconds |
| **Multer 2** | File uploads — disk storage with UUID filenames and MIME-type validation |
| **dotenv 17** | Environment variable management |

### Frontend

| Technology | Purpose |
|---|---|
| **React 19** + **Vite 7** | SPA with near-instant HMR — React 19's automatic memoisation reduces boilerplate |
| **Tailwind CSS v4** | Utility-first styling — v4's CSS-based config eliminates `tailwind.config.js` entirely |
| **React Router v7** | Client-side routing with nested layouts for authenticated pages |
| **Recharts 3** | Composable chart components for the dashboard bar chart |
| **Axios** | HTTP client — interceptors auto-attach auth headers and handle 401 logouts |
| **lucide-react** | Tree-shakeable icon library — only imported icons are bundled |

---

## 🏗 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Vercel)                        │
│                                                                 │
│  React 19 + Vite 7 + Tailwind CSS v4                            │
│                                                                 │
│  ┌──────────┐ ┌────────────┐ ┌──────────┐ ┌─────────────────┐   │
│  │  Auth    │ │ Dashboard  │ │Budgets & │ │  AI Advisor     │   │
│  │  Pages   │ │ + Charts   │ │Notifs    │ │  + AutoCat      │   │
│  └────┬─────┘ └─────┬──────┘ └────┬─────┘ └───────┬─────────┘   │
│       │             │             │               │             │
│       └──────┬──────┴──────┬──────┘               │             │
│              │ AuthContext │  Axios Interceptors  │             │
│              │ (JWT store) │  (auto Bearer token) │             │
└──────────────┼─────────────┼──────────────────────┼─────────────┘
               │             │                      │
               ▼             ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                       BACKEND (Render)                          │
│                                                                 │
│  Node.js 20 + Express 5                                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Middleware Layer                     │    │
│  │  CORS · JWT Auth · Error Handler · Multer (uploads)     │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │                                     │
│  ┌────────┬──────────┬────┴────┬──────────┬────────────────┐    │
│  │  Auth  │Categories│Transact-│ Budgets  │  Dashboard     │    │
│  │  Ctrl  │  Ctrl    │ions Ctrl│  Ctrl    │  Ctrl          │    │
│  └────┬───┘└────┬────┘└───┬────┘└────┬────┘└───────┬───────┘    │
│       │         │         │          │             │            │
│       │         │    ┌────▼────┐     │             │            │
│       │         │    │Notif    │     │    ┌────────▼────────┐   │
│       │         │    │Service  │ ◄───┘    │Exchange Rates   │   │
│       │         │    │(budget  │          │Service (cached) │   │
│       │         │    │ alerts) │◄─────────┤                 │   │
│       │         │    └────┬────┘          └─────────────────┘   │
│       │         │         │                                     │
│       │         │    ┌────▼────┐  ┌───────────────┐             │
│       │         │    │SendGrid │  │  Groq LLM     │             │
│       │         │    │ (email) │  │  (AI chat +   │             │
│       │         │    └─────────┘  │   categorise) │             │
│       │         │                 └───────────────┘             │
└───────┼─────────┼──────────────────────────────────────────────-┘
        │         │
        ▼         ▼
┌─────────────────────────────────────────┐
│         PostgreSQL (Neon)               │
│                                         │
│  users · categories · transactions      │
│  budgets · notifications · _migrations  │
└─────────────────────────────────────────┘
```

**Data Flow:**
1. User interacts with React frontend → Axios sends request with JWT in `Authorization` header
2. Express middleware verifies JWT → extracts `req.user.id`
3. Controller executes raw SQL against PostgreSQL via `pg` Pool
4. For expense transactions: `notificationService` asynchronously checks budget thresholds, converts cross-currency spending via `exchangeRates` service, and triggers SendGrid email + in-app notification if 80%/100% breached
5. AI endpoints inject the user's real financial context into the Groq system prompt for personalised responses

---

## 📁 Project Structure

```
FJ-BE-R2-Padam-Rathi-NST-Pune/
│
├── backend/
│   ├── config/
│   │   ├── currencies.js          # Supported currency codes
│   │   ├── db.js                  # pg Pool singleton (Neon connection)
│   │   ├── email.js               # SendGrid wrapper (graceful fallback if no key)
│   │   ├── groq.js                # Groq client singleton (null if key absent)
│   │   ├── migrate.js             # Auto-runs pending SQL migrations on startup
│   │   ├── passport.js            # Google OAuth 2.0 strategy
│   │   └── upload.js              # Multer disk storage + MIME whitelist
│   │
│   ├── controllers/
│   │   ├── aiController.js        # POST /ai/chat + POST /ai/categorize
│   │   ├── authController.js      # Register, login, Google OAuth, profile
│   │   ├── budgetController.js    # CRUD + cross-currency spend aggregation
│   │   ├── categoryController.js  # CRUD for income/expense categories
│   │   ├── dashboardController.js # Summary, monthly report, category breakdown, rates
│   │   ├── notificationController.js  # List, read, delete notifications
│   │   └── transactionController.js   # CRUD + receipt upload/delete
│   │
│   ├── middlewares/
│   │   ├── authMiddleware.js      # JWT verification → req.user
│   │   ├── errorHandler.js        # Global Express error handler
│   │   └── validate.js            # UUID + date format validators
│   │
│   ├── migrations/                # Sequential SQL files (auto-applied)
│   │   ├── 001_create_users_table.sql
│   │   ├── 002_create_categories_table.sql
│   │   ├── 003_create_transactions_table.sql
│   │   ├── 004_create_budgets_table.sql
│   │   ├── 005_add_user_profile_fields.sql
│   │   ├── 006_add_google_id.sql
│   │   ├── 007_add_currency_support.sql
│   │   ├── 008_add_budget_currency.sql
│   │   ├── 009_create_notifications_table.sql
│   │   ├── 010_add_receipt_url.sql
│   │   └── 011_add_transaction_type.sql
│   │
│   ├── routes/                    # Express Router files (1:1 with controllers)
│   │   ├── aiRoutes.js
│   │   ├── authRoutes.js
│   │   ├── budgetRoutes.js
│   │   ├── categoryRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── notificationRoutes.js
│   │   └── transactionRoutes.js
│   │
│   ├── services/
│   │   ├── exchangeRates.js       # Shared exchange rate cache (1-hour TTL)
│   │   └── notificationService.js # Budget breach detection + email dispatch
│   │
│   ├── uploads/                   # Receipt files on disk (git-ignored)
│   ├── server.js                  # App entry point
│   └── .env.example               # Template for required env vars
│
└── frontend/
    └── src/
        ├── components/
        │   ├── Layout.jsx             # Sidebar nav + mobile-responsive topbar
        │   └── ui/                    # Reusable primitives
        │       ├── badge.jsx
        │       ├── button.jsx
        │       ├── card.jsx
        │       ├── input.jsx
        │       ├── label.jsx
        │       └── select.jsx
        │
        ├── context/
        │   └── AuthContext.jsx        # Global auth state + login/logout/register
        │
        ├── lib/
        │   ├── api.js                 # Axios instance + interceptors
        │   └── currencies.js          # Currency list, convert(), formatAmount()
        │
        ├── pages/
        │   ├── AIAdvisor.jsx          # Multi-turn AI chat interface
        │   ├── Budgets.jsx            # Budget CRUD + overall monthly summary
        │   ├── Categories.jsx         # Category management
        │   ├── Dashboard.jsx          # Financial overview + charts
        │   ├── Login.jsx              # Email/password + Google OAuth
        │   ├── Notifications.jsx      # In-app notification centre
        │   ├── OAuthCallback.jsx      # Google OAuth token handler
        │   ├── Profile.jsx            # Update name + preferred currency
        │   ├── Register.jsx           # New account creation
        │   └── Transactions.jsx       # Transaction list + form + receipt management
        │
        ├── App.jsx                    # Routes + AuthProvider wrapper
        └── main.jsx                   # Entry point
```

---

## 🗄 Database Schema

Managed through 11 sequential migration files, auto-applied on server startup via a `_migrations` tracking table.

```
┌──────────────────────────────────────────────────┐
│                     users                        │
├──────────────────────────────────────────────────┤
│ id (UUID PK)                                     │
│ name VARCHAR(100)                                │
│ email VARCHAR(255) UNIQUE                        │
│ password_hash TEXT                               │
│ google_id VARCHAR(255) UNIQUE                    │
│ preferred_currency VARCHAR(3) DEFAULT 'INR'      │
│ created_at TIMESTAMPTZ                           │
└──────────────┬───────────────────────────────────┘
               │
       ┌───────┴───────┐
       ▼               ▼
┌──────────────┐ ┌──────────────────────────────────┐
│  categories  │ │          notifications           │
├──────────────┤ ├──────────────────────────────────┤
│ id (UUID PK) │ │ id (UUID PK)                     │
│ user_id (FK) │ │ user_id (FK → users)             │
│ name         │ │ budget_id (FK → budgets)         │
│ type (income │ │ type (budget_warning |           │
│  | expense)  │ │       budget_exceeded)           │
│ created_at   │ │ title, message                   │
└──────┬───────┘ │ is_read BOOLEAN DEFAULT false    │
       │         │ month, year                      │
       │         │ UNIQUE (budget_id, type,         │
       │         │         month, year)             │
       │         │ created_at                       │
       │         └──────────────────────────────────┘
       │
  ┌────┴─────────────────┐
  ▼                      ▼
┌─────────────────┐ ┌──────────────────┐
│  transactions   │ │     budgets      │
├─────────────────┤ ├──────────────────┤
│ id (UUID PK)    │ │ id (UUID PK)     │
│ user_id (FK)    │ │ user_id (FK)     │
│ category_id(FK) │ │ category_id (FK) │
│ amount NUMERIC  │ │ monthly_limit    │
│ type (income |  │ │   NUMERIC        │
│       expense)  │ │ currency         │
│ description     │ │ UNIQUE(user_id,  │
│ date DATE       │ │  category_id)    │
│ currency        │ │ created_at       │
│ receipt_url     │ └──────────────────┘
│ created_at      │
│ updated_at      │
└─────────────────┘
```

---

## 📡 API Reference

> All routes prefixed with `/api`. Protected routes require `Authorization: Bearer <token>`.

### Authentication — `/api/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/register` | ✗ | Create account (name, email, password) |
| `POST` | `/login` | ✗ | Login → returns `{ token }` |
| `GET` | `/google` | ✗ | Initiate Google OAuth flow |
| `GET` | `/google/callback` | ✗ | OAuth callback → redirects with JWT |
| `GET` | `/me` | ✓ | Get current user profile |
| `PUT` | `/me` | ✓ | Update name / preferred_currency |

### Transactions — `/api/transactions`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/` | ✓ | List transactions (filter: `type`, `currency`, `category_id`, `from`, `to`) |
| `POST` | `/` | ✓ | Create transaction |
| `GET` | `/:id` | ✓ | Get single transaction |
| `PUT` | `/:id` | ✓ | Update transaction |
| `DELETE` | `/:id` | ✓ | Delete transaction |
| `POST` | `/:id/receipt` | ✓ | Upload receipt (multipart/form-data) |
| `DELETE` | `/:id/receipt` | ✓ | Remove receipt |

### Categories — `/api/categories`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/` | ✓ | List categories (filter: `type`) |
| `POST` | `/` | ✓ | Create category |
| `PUT` | `/:id` | ✓ | Update category |
| `DELETE` | `/:id` | ✓ | Delete category (cascades transactions) |

### Budgets — `/api/budgets`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/` | ✓ | List budgets with current month's cross-currency spend |
| `POST` | `/` | ✓ | Create budget (expense categories only) |
| `GET` | `/:id` | ✓ | Get single budget with spend details |
| `PUT` | `/:id` | ✓ | Update monthly limit |
| `DELETE` | `/:id` | ✓ | Delete budget |

### Dashboard — `/api/dashboard`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/summary` | ✓ | Income/expense/savings grouped by currency |
| `GET` | `/monthly-report` | ✓ | Monthly totals for chart data |
| `GET` | `/category-breakdown` | ✓ | Spending per category |
| `GET` | `/rates` | ✓ | Live exchange rates (1-hour server cache) |

### Notifications — `/api/notifications`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/` | ✓ | List notifications (paginated) |
| `GET` | `/unread-count` | ✓ | Get unread count |
| `PATCH` | `/:id/read` | ✓ | Mark one as read |
| `PATCH` | `/read-all` | ✓ | Mark all as read |
| `DELETE` | `/:id` | ✓ | Delete notification |
| `DELETE` | `/` | ✓ | Clear all notifications |

### AI — `/api/ai`

| Method | Endpoint | Auth | Body | Description |
|--------|----------|------|------|-------------|
| `POST` | `/chat` | ✓ | `{ message, history[] }` | Multi-turn financial advisor |
| `POST` | `/categorize` | ✓ | `{ description }` | AI-suggested category match |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 20.19 (or ≥ 22.12)
- **PostgreSQL** — [Neon](https://neon.tech) free tier recommended
- **Groq API Key** — Free at [console.groq.com](https://console.groq.com)
- **SendGrid API Key** *(optional)* — Free at [sendgrid.com](https://sendgrid.com) for email notifications
- **Google OAuth Credentials** *(optional)* — [Google Cloud Console](https://console.cloud.google.com)

### 1. Clone & Install

```bash
git clone https://github.com/IronwallxR5/FJ-BE-R2-Padam-Rathi-NST-Pune.git
cd FJ-BE-R2-Padam-Rathi-NST-Pune

# Backend
cd backend
cp .env.example .env    # Fill in your values (see Environment Variables section)
npm install

# Frontend
cd ../frontend
cp .env.example .env    # Set VITE_API_URL=http://localhost:3000/api
npm install
```

### 2. Start Backend

```bash
cd backend
npm run dev
# ✅ Server starts on http://localhost:3000
# ✅ Migrations run automatically on first boot
```

### 3. Start Frontend

```bash
cd frontend
npm run dev
# ✅ Vite dev server starts on http://localhost:5173
```

### 4. Open the App

Navigate to **[http://localhost:5173](http://localhost:5173)** and register a new account.

---

## 🔐 Environment Variables

### Backend — `backend/.env`

```env
# ────────────── Database ──────────────
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# ────────────── Authentication ──────────────
JWT_SECRET=a_long_random_string_here
JWT_EXPIRES_IN=7d

# ────────────── Server ──────────────
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# ────────────── Google OAuth (optional) ──────────────
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# ────────────── SendGrid Email (optional) ──────────────
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
EMAIL_FROM=verified-sender@yourdomain.com

# ────────────── Groq AI ──────────────
GROQ_API_KEY=gsk_xxxxxxxxxxxxx
GROQ_MODEL=llama-3.3-70b-versatile
```

### Frontend — `frontend/.env`

```env
VITE_API_URL=http://localhost:3000/api
```

> **Note:** Both Google OAuth and SendGrid are optional. The app works fully without them — Google login button won't appear, and budget alerts log to the console instead of sending emails.

---

## 🌐 Deployment

| Service | Component | Configuration |
|---------|-----------|---------------|
| **Render** | Backend | Root Directory: `backend/`, Build: `npm install`, Start: `node server.js` |
| **Vercel** | Frontend | Root Directory: `frontend/`, Framework: Vite, Output: `dist/` |
| **Neon** | Database | Serverless PostgreSQL with connection pooling |

**Key deployment settings:**
- Backend: Set `NODE_ENV=production`, `FRONTEND_URL=https://your-vercel-url.vercel.app`
- Frontend: Set `VITE_API_URL=https://your-render-url.onrender.com/api`
- Add `vercel.json` with rewrites for SPA routing:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```

---

## 🎯 Key Design Decisions

### 1. Migration-First Schema Management
Rather than using an ORM with auto-sync, all schema changes are explicit numbered SQL files. A `migrate.js` runner tracks applied migrations in a `_migrations` table, ensuring the schema evolves predictably across all environments (local, staging, production).

### 2. Raw SQL Over ORM
Using `pg` directly gives full control over query optimisation. The budget aggregation query, for example, uses `json_agg` with a subquery to collect per-currency spending, then converts server-side — something that would be awkward to express in Sequelize or Prisma.

### 3. Server-Side Cross-Currency Budget Aggregation
Budget spending is converted to the budget's currency on the backend using a shared exchange rate cache (`exchangeRates.js`, 1-hour TTL). This ensures the API response is immediately usable and consistent — the frontend doesn't need to re-aggregate.

### 4. Fire-and-Forget Notifications
Budget breach detection runs asynchronously after transaction creation. A failed SendGrid call never surfaces as a transaction error — it's logged server-side only. This keeps transaction creation latency unaffected by email delivery.

### 5. AI Graceful Degradation
The Groq client initialises as `null` when `GROQ_API_KEY` is absent. Every AI endpoint checks for `null` first and returns `503` with a human-readable message. The rest of the app works fully without an AI key.

### 6. Fallback Exchange Rates
The frontend pre-seeds `FALLBACK_RATES` for all 10 currencies so the UI renders valid numbers immediately, even before the external rate API responds or if it's offline.

### 7. Notification Deduplication
The `notifications` table has a `UNIQUE(budget_id, type, month, year)` constraint with `ON CONFLICT DO NOTHING`. This means each budget can trigger at most one warning and one exceeded alert per month — no spam.

---

## 🧩 Challenges & Solutions

### 1. Cross-Currency Budget Tracking
**Problem:** A budget set in INR was ignoring USD or EUR transactions in the same category — the SQL had `AND t.currency = b.currency` which filtered them out entirely.

**Solution:** Rewrote the budget queries to collect spending per currency using `json_agg`, then created a shared `exchangeRates.js` service that caches live rates for 1 hour. The `budgetController` and `notificationService` both convert all per-currency spending into the budget's currency before calculating percentages.

### 2. Uncategorised Transactions Invisible on Dashboard
**Problem:** Dashboard queries used `INNER JOIN categories` and filtered on `c.type` — uncategorised transactions (where `category_id` is NULL) had no category row, so they vanished from summaries entirely.

**Solution:** Switched to `LEFT JOIN` and added a `type` column directly on the `transactions` table (migration 011). All queries now use `t.type` instead of `c.type`. Uncategorised transactions show as "Uncategorized" in the breakdown.

### 3. Notification System Not Triggering
**Problem:** Multiple issues — `createTransaction` silenced all notification errors with `.catch(() => {})`, `updateTransaction` never called `checkBudgetAndNotify` at all, and the spending query didn't filter by `type = 'expense'` (income was inflating budget spending).

**Solution:** Added proper error logging, added notification checks to `updateTransaction`, filtered spending to expense-only, and added diagnostic `console.log` statements for debugging threshold crossings.

### 4. Groq JSON Output Inconsistency
**Problem:** The `categorize` endpoint expected pure JSON from Groq, but the model occasionally wrapped output in markdown code blocks, causing `JSON.parse()` to throw.

**Solution:** Added regex extraction (`raw.match(/\{[\s\S]*\}/)`) before parsing, dropped temperature to `0.1` for deterministic output, and added a graceful fallback returning `{ category_id: null, confidence: "low" }` instead of a 500 error.

### 5. Express Session + CORS Cookie Issues
**Problem:** Google OAuth required sessions for the OAuth handshake, but cross-origin cookies between Vercel (frontend) and Render (backend) were being blocked.

**Solution:** Configured Express sessions with `cookie: { secure: true, sameSite: "none" }` for production, set `trust proxy`, and ensured CORS allowed credentials from the exact frontend origin (no wildcards).

---

## 👤 Author

**Padam Rathi**  

---