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
- **Cross-Currency Budget Aggregation** — A budget set in INR also tracks USD/EUR/GBP expenses in the same category, auto-converted via live exchange rates
- **Smart Notifications** — Automatic alerts at 80% (warning) and 100% (exceeded) thresholds
- **Email Alerts** — SendGrid-powered email notifications when budget thresholds are crossed
- **In-App Notification Centre** — Bell icon with unread badge, mark-as-read, and bulk clear actions

### AI-Powered Intelligence
- **Financial Advisor Chat** — Multi-turn conversational AI (Groq `llama-3.3-70b-versatile`) that knows your real financial data — balances, budgets, spending patterns — and gives personalised advice
- **Auto-Categorisation** — ✨ Sparkle button on transactions uses AI to match descriptions to your category list automatically

### Authentication & Security
- **JWT Authentication** — Stateless token-based auth with secure `Authorization: Bearer` header patterns
- **Google OAuth 2.0** — One-click Google sign-in via Passport.js
- **Protected Routes** — All finance endpoints require valid tokens; the frontend redirects unauthenticated users automatically

### Dashboard & Visualisation
- **Financial Summary Cards** — Total income, expenses, and net savings with live currency conversion
- **Monthly Trends Chart** — Bar chart (Recharts) showing income vs expenses across the last 12 months
- **Budget Progress Bars** — Visual indicators with colour-coded status (green / amber / red) on the dashboard
- **Budget Detail Page** — Dedicated budgets page showing per-category spending limits and progress, independent of the global summary
- **Currency Switcher** — View all dashboard data in any of the 10 supported currencies instantly

---

## 🛠 Tech Stack

### Backend

| Technology | Purpose |
|---|---|
| **Node.js 20** + **Express 5** | REST API server — Express 5's native async error propagation eliminates manual `try/catch` boilerplate |
| **PostgreSQL** (Neon) | Relational database — foreign keys enforce data integrity across users → categories → transactions → budgets |
| **Prisma ORM 6** | Type-safe database client — schema-driven models, auto-generated queries, and graceful connection pool management |
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
│  │  Pages   │ │ + Charts   │ │ Notifs   │ │  + AutoCat      │   │
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
└───────┼─────────┼─────────────────────────────────────────────-─┘
        │         │
        ▼         ▼
┌─────────────────────────────────────────┐
│         PostgreSQL (Neon)               │
│    accessed via Prisma ORM              │
│                                         │
│  users · categories · transactions      │
│  budgets · notifications                │
└─────────────────────────────────────────┘
```

**Data Flow:**
1. User interacts with React frontend → Axios sends request with JWT in `Authorization` header
2. Express middleware verifies JWT → extracts `req.user.id`
3. Controller executes queries against PostgreSQL via the **Prisma client**
4. For expense transactions: `notificationService` asynchronously checks budget thresholds, converts cross-currency spending via the `exchangeRates` service, and triggers SendGrid email + in-app notification if 80%/100% is breached
5. AI endpoints inject the user's real financial context into the Groq system prompt for personalised responses

---

## 📁 Project Structure

```
FinTrack/
│
├── backend/
│   ├── config/
│   │   ├── currencies.js          # Supported currency codes
│   │   ├── db.js                  # Legacy pg Pool (kept for compatibility)
│   │   ├── email.js               # SendGrid wrapper (graceful fallback if no key)
│   │   ├── groq.js                # Groq client singleton (null if key absent)
│   │   ├── migrate.js             # Auto-runs pending SQL migrations on startup
│   │   ├── passport.js            # Google OAuth 2.0 strategy
│   │   ├── prisma.js              # Prisma client singleton
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
│   ├── prisma/
│   │   └── schema.prisma          # Prisma data model (users, categories,
│   │                              #   transactions, budgets, notifications)
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
        │   ├── Budgets.jsx            # Budget CRUD + per-category progress bars
        │   ├── Categories.jsx         # Category management
        │   ├── Dashboard.jsx          # Financial overview + charts + budget summary
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

Managed via **Prisma ORM** with the schema defined in `backend/prisma/schema.prisma`. Prisma handles query building and connection pool management against a Neon-hosted PostgreSQL instance.

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

- **Node.js** ≥ 20.19 (or ≥ 22.12) — required by Vite 7
- **PostgreSQL** — [Neon](https://neon.tech) free tier recommended
- **Groq API Key** — Free at [console.groq.com](https://console.groq.com)
- **SendGrid API Key** *(optional)* — Free at [sendgrid.com](https://sendgrid.com) for email notifications
- **Google OAuth Credentials** *(optional)* — [Google Cloud Console](https://console.cloud.google.com)

### 1. Clone & Install

```bash
git clone https://github.com/IronwallxR5/FinTrack.git
cd FinTrack

# Backend
cd backend
cp .env.example .env    # Fill in your values (see Environment Variables section)
npm install

# Frontend
cd ../frontend
cp .env.example .env    # Set VITE_API_URL=http://localhost:3000/api
npm install
```

### 2. Generate Prisma Client

```bash
cd backend
npx prisma generate
```

> This step is required before starting the server for the first time. It generates the type-safe Prisma client from `prisma/schema.prisma`.

### 3. Start Backend

```bash
cd backend
npm run dev
# ✅ Server starts on http://localhost:3000
# ✅ Prisma connects to your Neon PostgreSQL database
```

### 4. Start Frontend

```bash
cd frontend
npm run dev
# ✅ Vite dev server starts on http://localhost:5173
```

### 5. Open the App

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

> **Note:** Both Google OAuth and SendGrid are optional. The app works fully without them — the Google login button won't appear, and budget alerts fall back to console logging instead of sending emails.

---

## 🌐 Deployment

| Service | Component | Configuration |
|---------|-----------|---------------|
| **Render** | Backend | Root Directory: `backend/`, Build: `npm install && npx prisma generate`, Start: `node server.js` |
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

### 1. Prisma ORM for Database Access
All database interactions use **Prisma Client 6**, generated from a single `schema.prisma` file. This gives type-safe queries, automatic connection pool management, and a single source of truth for the data model. The schema is maintained in `backend/prisma/schema.prisma`.

### 2. Server-Side Cross-Currency Budget Aggregation
Budget spending is converted to the budget's currency on the backend using a shared exchange rate cache (`exchangeRates.js`, 1-hour TTL). This ensures the API response is immediately usable and consistent — the frontend doesn't need to re-aggregate. The budget page displays only per-category spending progress; the global income/expense summary lives exclusively on the Dashboard.

### 3. Fire-and-Forget Notifications
Budget breach detection runs asynchronously after transaction creation. A failed SendGrid call never surfaces as a transaction error — it's logged server-side only. This keeps transaction creation latency unaffected by email delivery.

### 4. AI Graceful Degradation
The Groq client initialises as `null` when `GROQ_API_KEY` is absent. Every AI endpoint checks for `null` first and returns `503` with a human-readable message. The rest of the app works fully without an AI key.

### 5. Fallback Exchange Rates on the Frontend
The frontend pre-seeds `FALLBACK_RATES` for all 10 currencies so the dashboard renders valid numbers immediately, even before the external rate API responds or if it's temporarily offline.

### 6. Notification Deduplication
The `notifications` table has a `UNIQUE(budget_id, type, month, year)` constraint. This means each budget can trigger at most one warning and one exceeded alert per calendar month — no duplicate notifications.

### 7. Separation of Concerns: Dashboard vs Budgets
The **Dashboard** is the home for global financial summaries (total income, total expenses, net savings) and the monthly trend chart. The **Budgets** page focuses exclusively on per-category spending limits and progress bars. This avoids redundancy and keeps each page purposeful.

---

## 🧩 Challenges & Solutions

### 1. Cross-Currency Budget Tracking
**Problem:** A budget set in INR was ignoring USD or EUR transactions in the same category — the original query had `AND t.currency = b.currency` which filtered them out entirely.

**Solution:** Rewrote the budget queries to collect spending per currency using `json_agg`, then created a shared `exchangeRates.js` service that caches live rates for 1 hour. Both `budgetController` and `notificationService` convert all per-currency spending into the budget's currency before calculating percentages.

### 2. Uncategorised Transactions Invisible on Dashboard
**Problem:** Dashboard queries used `INNER JOIN categories` and filtered on `c.type` — uncategorised transactions (where `category_id` is NULL) had no category row, so they vanished from summaries entirely.

**Solution:** Switched to `LEFT JOIN` and added a `type` column directly on the `transactions` table. All queries now use `t.type` instead of `c.type`. Uncategorised transactions appear as "Uncategorized" in the breakdown.

### 3. Notification System Not Triggering
**Problem:** Multiple issues — `createTransaction` silenced all notification errors with `.catch(() => {})`, `updateTransaction` never called `checkBudgetAndNotify` at all, and the spending query didn't filter by `type = 'expense'` (income was inflating budget spending figures).

**Solution:** Added proper error logging, added notification checks to `updateTransaction`, filtered spending to expense-only, and added diagnostic `console.log` statements for tracing threshold crossings.

### 4. Groq JSON Output Inconsistency
**Problem:** The `categorize` endpoint expected pure JSON from Groq, but the model occasionally wrapped output in markdown code blocks, causing `JSON.parse()` to throw.

**Solution:** Added regex extraction (`raw.match(/\{[\s\S]*\}/)`) before parsing, dropped temperature to `0.1` for deterministic output, and added a graceful fallback returning `{ category_id: null, confidence: "low" }` instead of a 500 error.

### 5. Express Session + CORS Cookie Issues with Google OAuth
**Problem:** Google OAuth required sessions for the handshake, but cross-origin cookies between Vercel (frontend) and Render (backend) were being blocked by the browser.

**Solution:** Configured Express sessions with `cookie: { secure: true, sameSite: "none" }` for production, set `trust proxy`, and ensured CORS allowed credentials from the exact frontend origin (no wildcards).

### 6. Migrating from Raw SQL to Prisma ORM
**Problem:** The codebase originally used the `pg` library for raw SQL queries. Migrating to Prisma required replacing all manual SQL strings with type-safe Prisma client methods while preserving the existing business logic, especially complex aggregation queries for budgets and dashboard summaries.

**Solution:** Migrated all controllers to use `prisma.*` model methods. The Prisma schema was introspected from the existing PostgreSQL database using `prisma db pull`, ensuring the models matched the production schema exactly. A singleton `prisma.js` config handles client instantiation and graceful `$disconnect()` on `SIGTERM`/`SIGINT`.

---

## 👤 Author

**Padam Rathi**

---
