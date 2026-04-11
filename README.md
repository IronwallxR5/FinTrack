# FinTrack — Personal Finance Tracker

A full-stack personal finance management application with multi-currency support, AI-powered insights, budget monitoring with email alerts, savings goals tracking, and receipt management.

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

### Savings Goals (Sinking Funds)
- **Goal Creation** — Set a target name, amount, currency, and deadline for any savings target (e.g. "New Laptop", "Trip to Goa"); defaults to 1 month from today
- **Income Allocation** — When logging income, split any percentage or flat amount across multiple savings goals in a single transaction — each allocation is routed through the live FX service if goal and transaction currencies differ
- **Dynamic Progress Tracking** — Goal balances are computed on-the-fly from the `transaction_goal_allocations` join table — no stale `current_amount` column that can drift
- **Radial Progress Rings** — SVG-animated rings show completion percentage per goal with colour-coded status (active / overdue / completed)
- **Monthly Savings Rate** — Each active goal displays the required monthly contribution to hit the deadline
- **Goal Deadline Alerts** — When a goal has 7 or fewer days remaining, an in-app notification and SendGrid email are automatically triggered (deduplicated to once per goal per month — same pattern as budget alerts)
- **Data Integrity on Edit/Delete** — Editing a transaction's amount or currency automatically re-computes all its allocations atomically; deleting a transaction cascades and removes its allocations via database-level `ON DELETE CASCADE`
- **Dashboard Widget** — Top 3 active goals shown on the main dashboard with progress bars and a "View all →" link

### Budget Monitoring & Alerts
- **Monthly Budgets** — Set spending limits per expense category with real-time progress tracking
- **Cross-Currency Budget Aggregation** — A budget set in INR also tracks USD/EUR/GBP expenses in the same category, auto-converted via live exchange rates
- **Smart Notifications** — Automatic alerts at 80% (warning) and 100% (exceeded) budget thresholds; and a 7-day deadline warning for savings goals
- **Email Alerts** — SendGrid-powered email notifications for both budget breaches and goal deadline warnings
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
- **Savings Goals Widget** — Top goals with progress bars and monthly savings rates, rendered directly on the dashboard
- **Currency Switcher** — View all dashboard data in any of the 10 supported currencies instantly

---

## 🛠 Tech Stack

### Backend

| Technology | Purpose |
|---|---|
| **Node.js 22** + **Express 5** | REST API server |
| **PostgreSQL** (Neon) | Relational database — foreign keys enforce data integrity across users → categories → transactions → budgets → goals |
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
│  │  Pages   │ │+Goals Wdgt │ │ Notifs   │ │  + AutoCat      │   │
│  └────┬─────┘ └─────┬──────┘ └────┬─────┘ └───────┬─────────┘   │
│       │             │             │               │             │
│  ┌────▼─────────────▼─────────────▼───────────────▼────────┐    │
│  │            AuthContext (JWT)  +  Axios Interceptors     │    │
│  └────────────────────────────┬────────────────────────────┘    │
└───────────────────────────────┼─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       BACKEND (Render)                          │
│                                                                 │
│  Node.js 22 + Express 5                                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Middleware Layer                     │    │
│  │  CORS · JWT Auth · Error Handler · Multer (uploads)     │    │
│  └──┬──────────┬──────────┬──────────┬──────────┬──────────┘    │
│     │          │          │          │          │               │
│  Auth      Categories  Transact-  Budgets    Goals              │
│  Ctrl       Ctrl       ions Ctrl   Ctrl       Ctrl              │
│     │          │          │          │          │               │
│     │          │    ┌─────▼──────────▼──────────▼──────────┐    │
│     │          │    │        goalAllocationService         │    │
│     │          │    │  FX conversion · Decimal precision   │    │
│     │          │    │  Multi-goal split · 100% guard       │    │
│     │          │    └──────────────────────────────────────┘    │
│     │          │          │                                     │
│     │          │    ┌─────▼────┐  ┌──────────────────────┐      │
│     │          │    │  Notif   │  │   Exchange Rates     │      │
│     │          │    │ Service  │  │   Service (1hr cache)│      │
│     │          │    └─────┬────┘  └──────────────────────┘      │
│     │          │          │                                     │
│     │          │    ┌─────▼────┐  ┌───────────────┐             │
│     │          │    │SendGrid  │  │  Groq LLM     │             │
│     │          │    │ (email)  │  │  (chat+categ.)│             │
│     │          │    └──────────┘  └───────────────┘             │
└─────┼──────────┼──────────────────────────────────────────────-─┘
      │          │
      ▼          ▼
┌─────────────────────────────────────────┐
│         PostgreSQL (Neon)               │
│    accessed via Prisma ORM              │
│                                         │
│  users · categories · transactions      │
│  budgets · notifications · goals        │
│  transaction_goal_allocations           │
└─────────────────────────────────────────┘
```

**Data Flow:**
1. User interacts with React frontend → Axios sends request with JWT in `Authorization` header
2. Express middleware verifies JWT → extracts `req.user.id`
3. Controller executes queries against PostgreSQL via the **Prisma client**
4. For income transactions with goal allocations: `goalAllocationService` validates, FX-converts, and atomically writes allocations inside a `prisma.$transaction` block
5. After `getGoals` responds: `checkGoalDeadlineAndNotify` runs fire-and-forget to check if any active goal has ≤ 7 days remaining and raises an in-app + email alert (deduplicated per goal per month)
6. For expense transactions: `notificationService` asynchronously checks budget thresholds, converts cross-currency spending via the `exchangeRates` service, and triggers SendGrid email + in-app notification if 80%/100% is breached
7. AI endpoints inject the user's real financial context into the Groq system prompt for personalised responses

---

## 📁 Project Structure

```
FinTrack/
│
├── backend/
│   ├── config/
│   │   ├── currencies.js          # Supported currency codes list
│   │   ├── email.js               # SendGrid wrapper (graceful fallback if no key)
│   │   ├── groq.js                # Groq client singleton (null if key absent)
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
│   │   ├── goalController.js      # CRUD for savings goals + dynamic progress enrichment
│   │   ├── notificationController.js  # List, read, delete notifications
│   │   └── transactionController.js   # CRUD + receipt upload/delete + goal allocation
│   │
│   ├── middlewares/
│   │   ├── authMiddleware.js      # JWT verification → req.user
│   │   ├── errorHandler.js        # Global Express error handler
│   │   └── validate.js            # UUID + date format validators
│   │
│   ├── prisma/
│   │   └── schema.prisma          # Prisma data model (users, categories,
│   │                              #   transactions, budgets, notifications,
│   │                              #   goals, transaction_goal_allocations)
│   │
│   ├── routes/                    # Express Router files (1:1 with controllers)
│   │   ├── aiRoutes.js
│   │   ├── authRoutes.js
│   │   ├── budgetRoutes.js
│   │   ├── categoryRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── goalRoutes.js
│   │   ├── notificationRoutes.js
│   │   └── transactionRoutes.js
│   │
│   ├── services/
│   │   ├── exchangeRates.js           # Shared exchange rate cache (1-hour TTL)
│   │   ├── goalAllocationService.js   # Dual-mode allocation resolver + FX conversion
│   │   └── notificationService.js     # Budget breach detection + goal deadline alerts + email dispatch
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
        │   ├── Dashboard.jsx          # Financial overview + charts + goals widget
        │   ├── Goals.jsx              # Savings goals CRUD + radial progress rings
        │   ├── Login.jsx              # Email/password + Google OAuth
        │   ├── Notifications.jsx      # In-app notification centre
        │   ├── OAuthCallback.jsx      # Google OAuth token handler
        │   ├── Profile.jsx            # Update name + preferred currency
        │   ├── Register.jsx           # New account creation
        │   └── Transactions.jsx       # Transaction list + form + receipt + goal allocation
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
└──────────┬───────────────────┬───────────────────┘
           │                   │
   ┌───────┴──────┐    ┌───────┴──────────────┐
   ▼              ▼    ▼                       ▼
┌──────────┐  ┌──────────────┐  ┌─────────────────────┐
│  goals   │  │  categories  │  │    notifications    │
├──────────┤  ├──────────────┤  ├─────────────────────┤
│ id (PK)  │  │ id (UUID PK) │  │ id (UUID PK)        │
│ user_id  │  │ user_id (FK) │  │ user_id (FK)        │
│ name     │  │ name         │  │ budget_id (FK)      │
│ target_  │  │ type (income │  │ type, title, message│
│  amount  │  │  | expense)  │  │ is_read BOOLEAN     │
│ target_  │  │ created_at   │  │ month, year         │
│  date    │  └──────┬───────┘  │ UNIQUE(budget_id,   │
│ currency │         │          │   type, month, year)│
│ created_ │    ┌────┴──────────┴──┐                  │
│  at      │    ▼                  ▼                  │
└────┬─────┘  ┌───────────────┐ ┌──────────────┐      │
     │        │  transactions │ │   budgets    │      │
     │        ├───────────────┤ ├──────────────┤      │
     │        │ id (UUID PK)  │ │ id (UUID PK) │      │
     │        │ user_id (FK)  │ │ user_id (FK) │      │
     │        │ category_id   │ │ category_id  │      │
     │        │ amount        │ │ monthly_limit│      │
     │        │ type          │ │ currency     │      │
     │        │ description   │ │ UNIQUE(user, │      │
     │        │ date          │ │  category)   │──────┘
     │        │ currency      │ └──────────────┘
     │        │ receipt_url   │
     │        └───────┬───────┘
     │                │
     │                ▼
     │  ┌──────────────────────────────────┐
     └─►│   transaction_goal_allocations   │
        ├──────────────────────────────────┤
        │ id (UUID PK)                     │
        │ transaction_id (FK → CASCADE)    │
        │ goal_id (FK → CASCADE)           │
        │ allocation_pct  DECIMAL(5,2)     │
        │ allocated_amount DECIMAL(12,2)   │
        │ created_at                       │
        │ UNIQUE(transaction_id, goal_id)  │
        └──────────────────────────────────┘
```

**Key integrity rules:**
- Deleting a transaction → cascades to `transaction_goal_allocations` automatically (no orphaned allocation rows)
- Deleting a goal → cascades to its allocation rows (goal balance never references a dead goal)
- Editing a transaction's amount or currency → controller atomically wipes and re-inserts its allocations in a single `prisma.$transaction` block

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
| `PUT` | `/me` | ✓ | Update name / password / preferred_currency |

### Transactions — `/api/transactions`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/` | ✓ | List transactions (filter: `type`, `currency`, `category_id`, `from`, `to`) |
| `POST` | `/` | ✓ | Create transaction — accepts optional `goal_allocations[]` array for income |
| `GET` | `/:id` | ✓ | Get single transaction |
| `PUT` | `/:id` | ✓ | Update transaction — re-computes goal allocations atomically if amount/currency changes |
| `DELETE` | `/:id` | ✓ | Delete transaction (cascades allocations) |
| `POST` | `/:id/receipt` | ✓ | Upload receipt (multipart/form-data) |
| `DELETE` | `/:id/receipt` | ✓ | Remove receipt |

**Goal allocation payload (income transactions only):**
```json
{
  "type": "income",
  "amount": 10000,
  "currency": "INR",
  "goal_allocations": [
    { "goal_id": "<uuid>", "allocation_pct": 20 },
    { "goal_id": "<uuid>", "allocated_amount": 1500 }
  ]
}
```
> Each entry accepts either `allocation_pct` OR `allocated_amount`. Total cannot exceed 100% of the transaction amount.

### Goals — `/api/goals`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/` | ✓ | List all goals with computed progress (current_amount, completion_pct, status, required_monthly_savings) |
| `POST` | `/` | ✓ | Create goal (name, target_amount, target_date, currency) |
| `GET` | `/:id` | ✓ | Get single goal with progress |
| `PUT` | `/:id` | ✓ | Update goal fields |
| `DELETE` | `/:id` | ✓ | Delete goal (cascades allocations) |

**Goal response shape:**
```json
{
  "id": "...",
  "name": "New Laptop",
  "target_amount": 80000,
  "current_amount": 24500.00,
  "currency": "INR",
  "completion_pct": 30.6,
  "months_remaining": 4,
  "days_remaining": 127,
  "status": "active",
  "required_monthly_savings": 13875.00
}
```

### Categories — `/api/categories`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/` | ✓ | List categories (filter: `type`) |
| `POST` | `/` | ✓ | Create category |
| `PUT` | `/:id` | ✓ | Update category |
| `DELETE` | `/:id` | ✓ | Delete category — linked transactions are moved to uncategorized (category_id set to null) |

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
npm install             # postinstall automatically runs `prisma migrate deploy && prisma generate`

# Frontend
cd ../frontend
cp .env.example .env    # Set VITE_API_URL=http://localhost:3000/api
npm install
```

### 2. Apply Migrations to Database

```bash
cd backend
npm run migrate:deploy
```

> This runs `prisma migrate deploy` which applies all migration files from `prisma/migrations/` to your Neon database, then regenerates the Prisma client. All tables will be created automatically.

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
| **Render** | Backend | Root Directory: `backend/`, Build: `npm install` *(postinstall runs `prisma migrate deploy && prisma generate` automatically)*, Start: `node server.js` |
| **Vercel** | Frontend | Root Directory: `frontend/`, Framework: Vite, Output: `dist/` |
| **Neon** | Database | Serverless PostgreSQL with connection pooling |

**Key deployment settings:**
- Backend: Set `NODE_ENV=production`, `FRONTEND_URL=https://your-vercel-url.vercel.app`
- Frontend: Set `VITE_API_URL=https://your-render-url.onrender.com/api`
- Add `vercel.json` with rewrites for SPA routing:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```

> **How deployments work:** On every `npm install`, the `postinstall` script runs `prisma migrate deploy` (applies any pending migrations from `prisma/migrations/`) then `prisma generate` (rebuilds the JS client from the schema). This is the standard Prisma production workflow — no manual steps required on Render.

---

## 🎯 Key Design Decisions

### 1. Prisma ORM for Database Access
All database interactions use **Prisma Client 6**, generated from a single `schema.prisma` file. Schema history is tracked in `prisma/migrations/` using the standard Prisma migration workflow:
- **Locally:** `npm run migrate:dev -- --name <description>` creates a new migration SQL file and applies it
- **Production (Render):** `postinstall` automatically runs `prisma migrate deploy` (applies pending migrations) then `prisma generate` (rebuilds the JS client)

This gives type-safe queries, a full migration audit trail, and zero-downtime deploys — the same workflow as any greenfield Prisma project.

### 2. Dynamic Goal Aggregation (No Stale State)
The `goals` table has **no `current_amount` column**. Progress is computed on-the-fly by summing `allocated_amount` from `transaction_goal_allocations` in a single Prisma query with `include: { allocations }`, followed by an in-memory `.reduce()`. This eliminates state desync — edits and deletes automatically correct the goal balance without any compensating update logic.

### 3. Floating-Point Safe Decimal Arithmetic
Goal balances are summed using `Prisma.Decimal` arithmetic throughout the reduce loop — never native JavaScript `Number` addition. Casting to a primitive only happens at the final `.toNumber()` call before the JSON response. This prevents floating-point accumulation errors (e.g. `100.10 + 200.20 ≠ 300.30` in JS) from corrupting financial figures over hundreds of allocations.

### 4. Atomic Allocation Writes
Both `createTransaction` and `updateTransaction` run inside a `prisma.$transaction` block. The create path inserts the transaction row and all its allocation rows together. The update path re-computes allocations and does a wipe+re-insert of allocation rows in the same block. Either everything commits or nothing does — there is no partial state.

### 5. Multi-Currency FX Conversion at Write Time (Locked Rate)
When an income transaction in USD allocates to a goal tracked in INR, `goalAllocationService` calls the shared `convertCurrency()` utility at write time and stores the converted `allocated_amount` in the join table. The FX rate is **locked at that moment**. This means goal balances remain stable even if market rates change later — a standard practice in financial systems.

### 6. Dual-Mode Allocation Input
`goalAllocationService.resolveAllocations()` accepts either `allocation_pct` (percentage) or `allocated_amount` (flat amount) per goal, normalising both into stored `(allocation_pct, allocated_amount)` pairs. This solves the rounding frustration of always having to work in percentages.

### 7. Server-Side Cross-Currency Budget Aggregation
Budget spending is converted to the budget's currency on the backend using the shared exchange rate cache (`exchangeRates.js`, 1-hour TTL). The API response is immediately usable and consistent — the frontend doesn't need to re-aggregate.

### 8. Fire-and-Forget Notifications
Budget breach detection runs asynchronously after transaction creation. A failed SendGrid call never surfaces as a transaction error — it's logged server-side only. This keeps transaction creation latency unaffected by email delivery.

### 9. AI Graceful Degradation
The Groq client initialises as `null` when `GROQ_API_KEY` is absent. Every AI endpoint checks for `null` first and returns `503` with a human-readable message. The rest of the app works fully without an AI key.

### 10. Stateless Server — No In-Memory Session Store
All user state is encoded in the JWT. The Express session is used only for the Google OAuth handshake (short-lived, 5-minute cookie) and discarded immediately after the callback redirects. This means multiple Render instances or a server restart never causes authentication failures.

### 11. Goal Deadline Notifications (Unified Alert System)
Goal deadline alerts reuse the existing `notifications` table and the `UNIQUE(budget_id, type, month, year)` deduplication constraint by storing `goal_id` in the `budget_id` column (a nullable FK) and using `type = 'goal_deadline_warning'`. No schema migration was required — the constraint already handles both cases. The check runs fire-and-forget from `getGoals` after the response is already sent, so it never adds latency to page load.

---

## 🧩 Challenges & Solutions

### 1. Prisma Client Not Regenerated on Deploy
**Problem:** Render's build command was only `npm install`. The Prisma client cached in `node_modules/@prisma/client` was generated before the new schema models (goals, transaction_goal_allocations) were added. Every call to `prisma.goals.*` on the production server returned a 500 because the model didn't exist in the deployed client.

**Solution:** Switched to a proper Prisma migrations workflow. A baseline migration (`0001_init`) was generated from the existing schema using `prisma migrate diff`, marked as applied with `prisma migrate resolve --applied`, and committed to `prisma/migrations/`. The `postinstall` script now runs `prisma migrate deploy && prisma generate` so every deploy applies pending migrations and rebuilds the JS client from the committed schema.

### 2. Goals Fetch Crashing the Transactions Page
**Problem:** `Transactions.jsx` fetched transactions, categories, and goals inside a single `Promise.all`. When `/api/goals` returned 500 (due to the missing Prisma client issue above), the entire `Promise.all` rejected — transactions and categories were never set, leaving the page blank.

**Solution:** Separated the goals fetch into its own independent `try/catch` block that runs after the core data loads. A goals failure logs a warning only — transactions always load regardless.

### 3. Cross-Currency Allocation Corruption
**Problem:** Early designs incremented `goal.current_amount += allocated_amount` directly without considering currency mismatches. A ₹500 allocation would be added to a $500 goal as-is, silently corrupting the balance.

**Solution:** All allocations are routed through `goalAllocationService.resolveAllocations()`, which checks `goal.currency !== txCurrency` and calls `convertCurrency()` before storing. The converted amount is locked in the join table at write time.

### 4. Cross-Currency Budget Tracking
**Problem:** A budget set in INR was ignoring USD or EUR transactions in the same category — the original query had `AND t.currency = b.currency` which filtered them out entirely.

**Solution:** Rewrote the budget queries to collect spending per currency using `json_agg`, then created a shared `exchangeRates.js` service that caches live rates for 1 hour. Both `budgetController` and `notificationService` convert all per-currency spending into the budget's currency before calculating percentages.

### 5. Uncategorised Transactions Invisible on Dashboard
**Problem:** Dashboard queries used `INNER JOIN categories` and filtered on `c.type` — uncategorised transactions (where `category_id` is NULL) had no category row, so they vanished from summaries entirely.

**Solution:** Switched to `LEFT JOIN` and added a `type` column directly on the `transactions` table. All queries now use `t.type` instead of `c.type`. Uncategorised transactions appear as "Uncategorized" in the breakdown.

### 6. Groq JSON Output Inconsistency
**Problem:** The `categorize` endpoint expected pure JSON from Groq, but the model occasionally wrapped output in markdown code blocks, causing `JSON.parse()` to throw.

**Solution:** Added regex extraction (`raw.match(/\{[\s\S]*\}/)`) before parsing, dropped temperature to `0.1` for deterministic output, and added a graceful fallback returning `{ category_id: null, confidence: "low" }` instead of a 500 error.

### 7. Express Session + CORS Cookie Issues with Google OAuth
**Problem:** Google OAuth required sessions for the handshake, but cross-origin cookies between Vercel (frontend) and Render (backend) were being blocked by the browser.

**Solution:** Configured Express sessions with `cookie: { secure: true, sameSite: "none" }` for production, set `trust proxy`, and ensured CORS allowed credentials from the exact frontend origin (no wildcards).

### 8. Migrating from Raw SQL to Prisma ORM
**Problem:** The codebase originally used the `pg` library for raw SQL queries. Migrating to Prisma required replacing all manual SQL strings with type-safe Prisma client methods while preserving the existing business logic, especially complex aggregation queries for budgets and dashboard summaries.

**Solution:** Migrated all controllers to use `prisma.*` model methods. The Prisma schema was introspected from the existing PostgreSQL database using `prisma db pull`, ensuring the models matched the production schema exactly. A singleton `prisma.js` config handles client instantiation and graceful `$disconnect()` on `SIGTERM`/`SIGINT`.

### 9. Cross-Currency Allocation Percentage Corruption on Edit
**Problem:** When a transaction was created in a non-INR currency (e.g., `$100 USD`) with a goal allocation of 20%, the backend correctly stored `allocation_pct: 20` and `allocated_amount: 1660` (converted to the goal's INR currency). However, when the user opened the edit form, `handleEdit` pre-populated the locked pill using `allocated_amount: 1660` with `mode: "amount"`. On submit, the backend received `{ allocated_amount: 1660 }` against a `$100` transaction and calculated `1660 ÷ 100 × 100 = 1660%` — immediately rejected with "exceeds 100% of the transaction".

**Solution:** Changed `handleEdit` to pre-populate locked pills using `allocation_pct` (the stored percentage) with `mode: "pct"` instead of `allocated_amount`. The percentage is always relative to the transaction amount and is currency-agnostic — it survives any currency combination without corruption. The pill label was also updated to display `"20% of transaction"` instead of a misleading currency amount that was denominated in the goal's currency, not the transaction's currency.

---

## 👤 Author

**Padam Rathi**

---
