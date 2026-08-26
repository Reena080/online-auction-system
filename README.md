# 🏛️ Online Auction System

A high-concurrency, real-time Online Auction Platform built for **Bellcorp Studio's Placement Assessment**. The system enforces absolute transactional integrity and strict concurrency safety using **PostgreSQL row-level locking (`SELECT ... FOR UPDATE`)**, paired with **Redis** for auction caching and user rate limiting, **MongoDB** for asynchronous audit logging, and a modern **React + Vite** frontend.

---

## 📌 Problem Statement

In online auctions, users place bids against an item where each new bid must be strictly higher than the current highest bid, and bidding automatically closes when a fixed time window expires. 

### The Core Concurrency Challenge
When multiple users submit identical or competing bids (e.g. User A bids ₹700 and User B bids ₹700 when the current bid is ₹650) within milliseconds of each other:
1. **Exactly one bid must be accepted** (HTTP 201).
2. **The competing bid must be rejected** (HTTP 409).
3. **The system must never allow duplicate winners or phantom highest bids**.
4. **Any bid arriving after auction expiration must be rejected** by authoritative database time checks inside the transaction.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   React 18 UI (Vite)                    │
│  - Live Countdown & State Indicator                     │
│  - Real-time Polling (3s) & Instant Refresh             │
│  - Bid Placement Form with Validation & Feedback        │
│  - Paginated Bid History Table                          │
└────────────────────────────┬────────────────────────────┘
                             │ REST (JSON / Bearer JWT)
                             ▼
┌─────────────────────────────────────────────────────────┐
│               Node.js + Express REST API                │
│  - Auth / Auction / Bid Routes                          │
│  - Zod Input Validation & JWT Auth Middleware           │
│  - Redis Token Bucket Rate Limiting (10 req/min)        │
│  - Centralized Error Handling                           │
└──────────────┬──────────────────────────┬───────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────────────┐ ┌────────────────────────┐
│     PostgreSQL (Primary)     │ │     Redis (Cache)      │
│     *SOURCE OF TRUTH*        │ │ - Auction TTL Cache    │
│ - Users, Auctions, Bids      │ │   (5–10s)              │
│ - Transactional Concurrency  │ │ - Immediate            │
│   via SELECT ... FOR UPDATE  │ │   Invalidation on Bid  │
│ - Authoritative DB Clock     │ │ - User Rate Limiting   │
└──────────────┬───────────────┘ └────────────────────────┘
               │
               ▼ (Asynchronous / Non-blocking)
┌──────────────────────────────┐
│     MongoDB (Secondary)      │
│ - Audit & Event Logging      │
│   (USER_REGISTERED,          │
│    USER_LOGIN, BID_PLACED,   │
│    BID_REJECTED,             │
│    AUCTION_ENDED)            │
└──────────────────────────────┘
```

---

## 🔒 Concurrency & Architectural Decisions

### 1. Why PostgreSQL is the Single Source of Truth
Financial and auction systems require strict **ACID guarantees** (Atomicity, Consistency, Isolation, Durability). PostgreSQL ensures that bid insertion, highest-bid updates, and auction state changes occur as a single atomic unit.

### 2. Why Row-Level Locking (`SELECT ... FOR UPDATE`) is Used
Without locking, concurrent requests cause a classic **Time-of-Check to Time-of-Use (TOCTOU) Race Condition**:
```
User A: Reads highest bid = ₹650
User B: Reads highest bid = ₹650
User A: Validates ₹700 > ₹650 (OK)
User B: Validates ₹700 > ₹650 (OK)
User A: Writes ₹700 -> SUCCESS
User B: Writes ₹700 -> OVERWRITES (CORRUPT STATE: Two ₹700 bids accepted!)
```

**Our Row-Level Locking Solution:**
```sql
BEGIN;
SELECT * FROM auctions WHERE id = $1 FOR UPDATE;
-- Database places exclusive lock on this auction row.
-- Any concurrent bid on this auction WAITS until this transaction completes.
-- 1. Check: auction.status == 'ACTIVE'
-- 2. Check: NOW() < auction.end_time
-- 3. Check: submitted_amount > auction.current_highest_bid
-- 4. INSERT INTO bids (id, auction_id, bidder_id, amount, created_at) VALUES (...);
-- 5. UPDATE auctions SET current_highest_bid = $amount, highest_bidder_id = $bidder_id WHERE id = $id;
COMMIT; -- Lock is released.
```
When User B's queued transaction resumes, it reads the updated committed state (`current_highest_bid = ₹700`), detects `₹700 <= ₹700`, immediately aborts, rolls back, and returns `HTTP 409 CONFLICT` with error code `BID_TOO_LOW`.

### 3. Why Redis is NOT Used as the Authoritative Bid Store
While Redis offers atomic operations (e.g. `INCR`, Lua scripts), using Redis as the primary source of truth introduces serious split-brain and durability risks:
- In-memory data loss or asynchronous persistence (RDB/AOF) lag during network partitions or crashes.
- Dual-write inconsistencies between Redis and relational databases.
- **Role in our architecture**: Redis is strictly a read-through cache with a 5–10s TTL (invalidated on every successful bid) and a sliding-window rate limiter (10 bids/min). PostgreSQL always validates and governs the actual bid acceptance.

### 4. Authoritative Backend Auction Expiry
The frontend countdown timer is purely for visual UX. The backend enforces expiration inside the database transaction by checking `NOW() < end_time`. Any bid arriving after expiration is rejected with `HTTP 409 AUCTION_ENDED`.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18, Vite, JavaScript, Vanilla CSS | Interactive UI, live countdown, polling, bid history |
| **Backend** | Node.js, Express.js | REST API, centralized error handling |
| **Primary Database** | PostgreSQL 15 | Source of Truth, ACID transactions, `FOR UPDATE` locking |
| **Secondary Database**| MongoDB 6 | Non-blocking audit/activity logs |
| **Cache & Limiter** | Redis 7 (`ioredis`) | 5–10s TTL caching, 10 req/min rate limiting |
| **Auth & Security** | JWT, bcryptjs, Helmet, CORS | Passwords hashed (salt 10), bearer token authentication |
| **Validation** | Zod | Runtime request body and query schema enforcement |
| **Testing** | Jest, Supertest, pg-mem, ioredis-mock | Unit, integration, and high-concurrency race condition tests |

---

## 📁 Project Structure

```
online-auction-system/
├── client/                      # React Frontend (Vite)
│   ├── src/
│   │   ├── components/          # Navbar, Countdown, BidForm, BidHistory, StatusBadge
│   │   ├── context/             # AuthContext (JWT management & session)
│   │   ├── hooks/               # useCountdown
│   │   ├── pages/               # AuctionPage, LoginPage, RegisterPage
│   │   ├── services/            # API client (fetch wrapper with token injection)
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css            # Custom dark gold design system
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── server/                      # Node.js Express Backend
│   ├── migrations/              # Reproducible SQL migrations & seeder
│   │   ├── 001_create_users.sql
│   │   ├── 002_create_auctions.sql
│   │   ├── 003_create_bids.sql
│   │   ├── runMigrations.js
│   │   └── seed.js
│   ├── src/
│   │   ├── config/              # PostgreSQL, Redis, MongoDB, and Env configs
│   │   ├── controllers/         # Auth, Auction, and Bid controllers
│   │   ├── middleware/          # JWT auth, Redis rate limiting, validation, error handler
│   │   ├── repositories/        # SQL queries and row locking operations
│   │   ├── routes/              # Express route definitions
│   │   ├── services/            # Business logic, FOR UPDATE transactions, audit logging
│   │   ├── utils/               # Response formatters and Zod schemas
│   │   ├── app.js               # Express application configuration
│   │   └── server.js            # Server entry point & graceful shutdown
│   └── package.json
├── tests/                       # Automated Test Suite (Jest + Supertest)
│   ├── auth.test.js             # Registration, duplicate email, login, JWT verification
│   ├── auction.test.js          # Active retrieval, status, 404 handling
│   ├── bid.test.js              # Higher bid, lower bid (409), equal bid (409), expiry (409)
│   ├── concurrency.test.js      # Critical simultaneous ₹700 race condition test & swarm test
│   ├── redis.test.js            # Cache set/get, invalidation on bid, 10 req/min rate limit (429)
│   ├── mongo.test.js            # Audit log creation for BID_PLACED & BID_REJECTED
│   └── testHelper.js            # In-memory test harness
├── docker-compose.yml           # Multi-container setup for PostgreSQL, Redis, and MongoDB
├── .env.example                 # Example environment variables
├── .gitignore
├── README.md                    # Complete technical and operational guide
└── DESIGN.md                    # Detailed High-Level & Low-Level Design Document
```

---

## 🗄️ Database Schema

### `users`
| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PRIMARY KEY |
| `name` | VARCHAR(255) | NOT NULL |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL |
| `password_hash` | VARCHAR(255) | NOT NULL |
| `created_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP |

### `auctions`
| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PRIMARY KEY |
| `title` | VARCHAR(255) | NOT NULL |
| `description` | TEXT | |
| `starting_price` | NUMERIC(12, 2) | NOT NULL |
| `current_highest_bid` | NUMERIC(12, 2) | NOT NULL |
| `highest_bidder_id` | UUID | REFERENCES users(id) ON DELETE SET NULL |
| `start_time` | TIMESTAMPTZ | NOT NULL |
| `end_time` | TIMESTAMPTZ | NOT NULL |
| `status` | VARCHAR(20) | NOT NULL DEFAULT 'ACTIVE' |
| `created_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP |

### `bids`
| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PRIMARY KEY |
| `auction_id` | UUID | REFERENCES auctions(id) ON DELETE CASCADE |
| `bidder_id` | UUID | REFERENCES users(id) ON DELETE CASCADE |
| `amount` | NUMERIC(12, 2) | NOT NULL |
| `created_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP |

**Indexes Created:**
- `idx_users_email` on `users(email)`
- `idx_auctions_status` on `auctions(status)`
- `idx_auctions_end_time` on `auctions(end_time)`
- `idx_bids_auction_id` on `bids(auction_id)`
- `idx_bids_bidder_id` on `bids(bidder_id)`
- `idx_bids_created_at` on `bids(created_at DESC)`

---

## 🌐 API Specification

### Standard Response Formats

#### Success Response (`HTTP 200 / 201`)
```json
{
  "success": true,
  "message": "Bid accepted.",
  "data": {
    "bid": {
      "id": "c1f7a4e2-...",
      "amount": 700,
      "bidderName": "Alice Walker",
      "createdAt": "2026-08-26T14:30:00.000Z"
    },
    "auction": {
      "currentHighestBid": 700,
      "highestBidderName": "Alice Walker",
      "status": "ACTIVE"
    }
  }
}
```

#### Error Response (`HTTP 400 / 401 / 404 / 409 / 429 / 500`)
```json
{
  "success": false,
  "error": "BID_TOO_LOW",
  "message": "Bid must be higher than the current highest bid of ₹650.00."
}
```

### Endpoints

| Method | Endpoint | Auth | Description | Status Codes |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | No | Register new user | `201`, `400`, `409` |
| `POST` | `/api/auth/login` | No | Login and obtain JWT | `200`, `400`, `401` |
| `GET` | `/api/auth/me` | Bearer JWT | Retrieve current user profile | `200`, `401` |
| `GET` | `/api/auction` | No | Get current active auction (Redis cached) | `200`, `404` |
| `GET` | `/api/auction/status` | No | Get auction status & time remaining | `200` |
| `GET` | `/api/auction/:id` | No | Get specific auction details | `200`, `404` |
| `POST` | `/api/auction/:id/bids` | Bearer JWT | Place a bid (Row-locked transaction) | `201`, `400`, `401`, `409`, `429` |
| `GET` | `/api/auction/:id/bids` | No | Paginated bid history (`?page=1&limit=20`)| `200`, `400` |
| `GET` | `/api/health` | No | Health check | `200` |

---

## ⚡ Redis Strategy

1. **Auction Cache (`auction:{auctionId}` & `auction:current`)**:
   - Stores pre-serialized auction JSON (title, prices, leader name, end time).
   - Configured with a short **5–10 second TTL**.
   - **Invalidated immediately** on every successful bid commit so subsequent reads fetch fresh data.
2. **Rate Limiting (`ratelimit:bid:{userId}`)**:
   - Atomic sliding counter (`INCR` + `EXPIRE`) allowing a maximum of **10 bids per user per minute**.
   - Exceeding attempts immediately return `HTTP 429 RATE_LIMIT_EXCEEDED`.
3. **Resilience**: If Redis is offline, the system gracefully falls back to direct database reads and memory-bucket rate limiting without corrupting auction consistency.

---

## 🪵 MongoDB Audit Logging Strategy

MongoDB stores an immutable chronological audit trail of all business events:
- `USER_REGISTERED`
- `USER_LOGIN`
- `BID_PLACED` (captures `auctionId`, `userId`, `amount`, `bidId`, `timestamp`)
- `BID_REJECTED` (captures error code, submitted amount, failure reason)
- `AUCTION_ENDED` (captures final winning bid and winner ID)

**Fault Tolerance**: MongoDB logging is asynchronous and strictly decoupled from the PostgreSQL transaction. If MongoDB is down or slow, the error is logged and the PostgreSQL bid transaction completes without interruption.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- npm (v9+)
- Docker & Docker Compose (Optional for local databases)

### 2. Environment Setup
Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```

### 3. Database Services (Docker Compose)
To start PostgreSQL, Redis, and MongoDB in background:
```bash
docker compose up -d
```

### 4. Running Database Migrations & Seed Data
```bash
cd server
npm run migrate
npm run seed
```

### 5. Running the Backend Server
```bash
cd server
npm start
# Express runs on http://localhost:5000
```

### 6. Running the React Frontend
```bash
cd client
npm run dev
# Vite runs on http://localhost:3000
```

---

## 🧪 Running Automated Tests

The test suite runs with in-memory adapters (`pg-mem`, `ioredis-mock`, memory audit logger) guaranteeing 100% test execution in any environment:

```bash
cd server
npm test
```

### Test Coverage Summary (26 Tests Across 6 Test Suites):
- `tests/concurrency.test.js`:
  - **Simultaneous ₹700 Bids Test**: Two concurrent requests on ₹650 auction $\rightarrow$ Exactly one 201 ACCEPTED, one 409 CONFLICT.
  - **Swarm Test**: Multi-user concurrent batch maintains exact sequential consistency and updates leader to highest bidder.
- `tests/bid.test.js`:
  - Valid higher bid (201).
  - Lower bid rejected with 409 `BID_TOO_LOW`.
  - Equal bid rejected with 409 `BID_TOO_LOW`.
  - Unauthenticated bid rejected with 401 `UNAUTHORIZED`.
  - Expired auction rejects bids with 409 `AUCTION_ENDED`.
  - Bid history pagination (`GET /api/auction/:id/bids?page=1&limit=2`).
- `tests/auth.test.js`:
  - Register success (201 + JWT).
  - Duplicate email rejected (409 `EMAIL_EXISTS`).
  - Login success (200 + JWT).
  - Invalid password rejected (401 `INVALID_CREDENTIALS`).
  - Protected `/api/auth/me` endpoint.
- `tests/redis.test.js`:
  - Cache set on read, invalidated on bid.
  - Rate limiting (10 bids/min $\rightarrow$ 11th request returns 429).
- `tests/mongo.test.js`:
  - Audit logging for `BID_PLACED` and `BID_REJECTED`.
- `tests/auction.test.js`:
  - Active auction retrieval, status endpoint, 404 handling.

---

## 📈 Scalability to 100x Traffic

To scale from single-server to 100,000+ active bidders:
1. **Load Balancing**: Deploy multiple Node.js Express instances behind NGINX / AWS ALB with round-robin or least-connections.
2. **Stateless App Servers**: Authentication uses self-contained JWTs and Redis rate-limiting, allowing effortless horizontal scaling.
3. **Database Connection Pooling & Read Replicas**:
   - Connection pooler (`PgBouncer`) handling thousands of client connections.
   - Read-heavy queries (browse auctions, auction info, historical bids) routed to PostgreSQL Read Replicas.
   - Write bids strictly sent to the Primary Writer node with `FOR UPDATE` row locking.
4. **Redis Edge Caching**: Redis cluster caching auction snapshots with sub-second TTL reduces 95% of database read traffic.
5. **WebSocket / SSE Gateway**: For 100k live watchers, push price updates through a dedicated Redis Pub/Sub WebSocket cluster.

---

## 🛡️ Security Implementation
- **Password Hashing**: `bcryptjs` with 10 salt rounds. Plaintext passwords never stored.
- **JWT Authentication**: Signed with environment secret; expiry enforced.
- **Parameterized SQL**: All database queries use `$1, $2` parameters, completely preventing SQL injection.
- **Input Validation**: Zod schemas validate and sanitize all request payloads.
- **HTTP Security Headers**: `helmet` enabled.
- **Rate Limiting**: Protects against brute-force bid spamming.


