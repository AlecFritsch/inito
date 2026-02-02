# Havoc

**The Trust Layer for AI-Generated Code**

> Every AI-generated PR deserves an explanation. Havoc delivers it.

[![Live Demo](https://img.shields.io/badge/Live-usehavoc.com-blue)](https://usehavoc.com)
[![GitHub App](https://img.shields.io/badge/GitHub%20App-Install-green)](https://github.com/apps/havocapp/installations/new)

---

## What is Havoc?

Havoc is a GitHub Bot that turns Issues into trusted PRs. Unlike other AI coding tools that just generate code, Havoc generates code **that explains itself**.

**Trigger:** Comment `/havoc` on any issue or add the `havoc` label.

**Flow:** Issue → Analyze → Plan → Edit → Test → Review → Policy Check → PR

---

## Quick Start

### 1. Install the GitHub App

[![Install GitHub App](https://img.shields.io/badge/Install-GitHub%20App-brightgreen?style=for-the-badge&logo=github)](https://github.com/apps/havocapp/installations/new)

### 2. Create an Issue

Create an issue in your repository describing a bug fix or feature.

### 3. Trigger Havoc

Comment `/havoc` on the issue or add the `havoc` label.

### 4. Watch the Magic

Havoc will analyze, plan, code, test, and create a PR with a full explanation.

---

## CLI

```bash
# Install
npm install -g havoc

# Login
havoc login

# Run on an issue
havoc run https://github.com/owner/repo/issues/42

# Check status
havoc status <run-id>

# Create config
havoc init
```

---

## Self-Hosting

### Docker Compose

```bash
# Clone
git clone https://github.com/AlecFritsch/inito
cd inito

# Configure
cp env.example .env
# Edit .env with your keys

# Deploy
chmod +x deploy.sh
./deploy.sh
```

Services:
- **Dashboard:** https://your-domain.com
- **API:** https://api.your-domain.com

See [docker/README.md](docker/README.md) for SSL setup with Let's Encrypt.

---

## Features

### Core Pipeline
- **Issue Analysis** - Understands what needs to be done
- **Planning Module** - Creates a step-by-step plan
- **Code Editing Agent** - Makes the actual changes
- **Test Generation** - Writes and runs tests
- **Self-Review** - AI critiques its own code

### Trust Layer
- **Intent Card** - Explains WHY every change was made
- **Confidence Score** - 0-100% based on tests, lint, complexity
- **Policy Gates** - Configurable thresholds before PR creation

### Dashboard
- **Clerk Authentication** - Secure login with GitHub
- **Run History** - View all pipeline runs
- **Repository Management** - Connect and configure repos
- **Real-time Status** - Track runs as they progress

---

## Configuration (.havoc.yaml)

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

## Architecture

```
├── src/              # Backend API (Fastify + TypeScript)
├── dashboard/        # Frontend (Next.js 15 + Clerk)
├── docker/           # Docker Compose (PostgreSQL, Redis, Nginx)
└── bin/              # CLI entry point
```

```
┌─────────────────────────────────────────────────────────────────┐
│  1. TRIGGER                                                      │
│     Comment "/havoc" OR add label "havoc"                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. PIPELINE                                                     │
│     Analyze → Plan → Edit → Test → Review                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. TRUST ARTIFACTS                                              │
│     Intent Card + Confidence Score + Self-Review                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. POLICY GATES                                                 │
│     PASS → Create PR with artifacts                              │
│     FAIL → Post report to issue, NO PR                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **API** | Node.js, Fastify, TypeScript |
| **LLM** | Google Gemini |
| **Queue** | BullMQ + Redis |
| **Database** | PostgreSQL + Drizzle ORM |
| **Dashboard** | Next.js 15, React 19, Tailwind CSS |
| **Auth** | Clerk |
| **Sandbox** | Docker containers |
| **GitHub** | Octokit + GitHub App |

---

## API Endpoints

```
POST /webhooks/github           GitHub webhook receiver
POST /api/runs                  Trigger a run manually
GET  /api/runs/:id              Get run status
GET  /api/runs/:id/intent-card  Get the Intent Card
GET  /api/runs                  List recent runs
GET  /api/repos                 List connected repos
GET  /api/stats                 Get user statistics
GET  /health                    Health check
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key |
| `GITHUB_APP_ID` | GitHub App ID |
| `GITHUB_PRIVATE_KEY` | GitHub App private key |
| `GITHUB_WEBHOOK_SECRET` | Webhook secret |
| `DATABASE_URL` | PostgreSQL connection URL |
| `REDIS_URL` | Redis connection URL |
| `CLERK_PUBLISHABLE_KEY` | Clerk public key |
| `CLERK_SECRET_KEY` | Clerk secret key |

---

## Intent Card Example

```markdown
# 📋 Intent Card

## Issue Summary
**#42:** Fix login button not responding on mobile

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

AGPL-3.0 - See [LICENSE](LICENSE)

---

**[usehavoc.com](https://usehavoc.com)**
