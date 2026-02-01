# Havoc

**The Trust Layer for AI-Generated Code**

> Every AI-generated PR deserves an explanation. Havoc delivers it.

---

## What is Havoc?

Havoc is a GitHub Bot that turns Issues into trusted PRs. Unlike other AI coding tools that just generate code, Havoc generates code **that explains itself**.

**Flow:** Issue → Webhook → Sandbox Container → Analyze → Plan → Edit → Test → Review → Policy Check → PR

---

## Architecture

```
├── src/              # Backend API (Fastify + BullMQ)
├── dashboard/        # Frontend (Next.js + Clerk)
├── docker/           # Docker Compose (PostgreSQL, Redis, API, Dashboard)
└── bin/              # CLI entry point
```

---

## Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Clone
git clone https://github.com/usehavoc/havoc
cd havoc

# Configure
cp env.example .env
# Edit .env with your GEMINI_API_KEY, GITHUB_TOKEN, etc.

# Build sandbox image
docker build -t havoc-sandbox -f docker/Dockerfile.sandbox .

# Start all services
cd docker
docker-compose up -d
```

Services:
- **Dashboard:** http://localhost:3000
- **API:** http://localhost:3001
- **PostgreSQL:** localhost:5432
- **Redis:** localhost:6379

### Option 2: Local Development

```bash
# Install API dependencies
npm install

# Install Dashboard dependencies
cd dashboard && npm install && cd ..

# Start PostgreSQL and Redis (Docker)
docker run -d --name havoc-postgres -e POSTGRES_USER=havoc -e POSTGRES_PASSWORD=havoc_secret -e POSTGRES_DB=havoc -p 5432:5432 postgres:16-alpine
docker run -d --name havoc-redis -p 6379:6379 redis:7-alpine

# Configure
cp env.example .env
cp dashboard/env.example.txt dashboard/.env.local
# Edit both files with your keys

# Run database migrations
npm run db:push

# Start API
npm run dev

# Start Dashboard (new terminal)
cd dashboard && npm run dev
```

---

## Features

### Core Features
- **Issue to Spec Conversion** - Understands what needs to be done
- **Planning Module** - Creates a step-by-step plan
- **Code Editing Agent** - Makes the actual changes
- **Test Generation** - Writes and runs tests
- **Intent Card** - Explains WHY every change was made
- **GitHub PR Automation** - Creates the PR automatically

### Trust Features
- **Self-Review Agent** - AI critiques its own code before PR
- **Confidence Score** - 0-100% score based on tests, lint, complexity
- **Policy Gates** - Configurable thresholds before PR is created

### Dashboard Features
- **Clerk Authentication** - Secure login with GitHub
- **Run History** - View all your pipeline runs
- **Repository Management** - Connect and configure repos
- **Real-time Status** - Track runs as they progress

### Configuration (.havoc.yaml)

```yaml
version: 1
min_confidence: 70          # Minimum confidence to create PR
min_test_pass_rate: 90      # Minimum test pass rate
allowed_commands:
  - git
  - npm
  - yarn
protected_files:
  - .env
  - "*.key"
```

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  1. TRIGGER                                                      │
│     GitHub Issue gets label "havoc" OR comment "/havoc run"      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. HAVOC API                                                    │
│     Enqueues job → BullMQ → Spawns sandbox container             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. SANDBOX CONTAINER                                            │
│     Clone → Analyze → Plan → Edit → Test → Review                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. TRUST ARTIFACTS                                              │
│     Intent Card + Confidence Score + Self-Review                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. POLICY GATES                                                 │
│     PASS → Create PR with artifacts                              │
│     FAIL → Post report to issue, NO PR                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## CLI Commands

```bash
# Run on a GitHub issue
havoc run <issue-url>

# Start the API server
havoc server

# Check run status
havoc status <run-id>

# Create .havoc.yaml template
havoc init
```

---

## API Endpoints

```
POST /webhooks/github     - GitHub webhook receiver
POST /api/runs            - Trigger a run manually
GET  /api/runs/:id        - Get run status
GET  /api/runs/:id/intent-card - Get the Intent Card
GET  /api/runs            - List recent runs
GET  /api/queue/stats     - Get queue statistics
GET  /health              - Health check
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **API** | Node.js, Fastify, TypeScript |
| **LLM** | Google Gemini (via @google/genai) |
| **Queue** | BullMQ + Redis |
| **Database** | PostgreSQL + Drizzle ORM |
| **Dashboard** | Next.js 15, React 19, Tailwind CSS |
| **Auth** | Clerk |
| **Sandbox** | Docker containers |
| **GitHub** | Octokit + GitHub App |

---

## Environment Variables

### API (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Google Gemini API key | - |
| `GITHUB_TOKEN` | Personal access token (for CLI) | - |
| `GITHUB_APP_ID` | GitHub App ID (for webhooks) | - |
| `GITHUB_PRIVATE_KEY` | GitHub App private key | - |
| `GITHUB_WEBHOOK_SECRET` | Webhook secret | - |
| `DATABASE_URL` | PostgreSQL connection URL | `postgres://havoc:havoc_secret@localhost:5432/havoc` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `PORT` | Server port | `3001` |
| `SANDBOX_IMAGE` | Docker sandbox image name | `havoc-sandbox` |
| `MAX_CONCURRENT_RUNS` | Max parallel runs | `3` |

### Dashboard (.env.local)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Havoc API URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `DATABASE_URL` | PostgreSQL connection URL |

---

## Intent Card Example

```markdown
# 📋 Intent Card

## Issue Summary
**#42:** Fix login button not responding on mobile

Bug is isolated to mobile viewport. Touch events not being handled.

## Files Changed
| File | Action | Rationale |
|------|--------|-----------|
| src/LoginButton.tsx | modified | Added touch event handler |
| tests/LoginButton.test.tsx | created | Mobile touch test coverage |

## Confidence Score: 87%
| Signal | Score |
|--------|-------|
| Tests Passing | 100% |
| Lint Clean | 100% |
| Change Complexity | 85% |
| Self-Review | 80% |

## Self-Review Summary
Changes look good. Consider manual QA on physical device.
```

---

## License

AGPL-3.0 (Open Source)
Commercial license available for Enterprise features.

---

**usehavoc.dev**
