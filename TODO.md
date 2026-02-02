# TODO

## Demo/Showcase
- Ask-the-PR Chat (Antworten auf PR-Kommentare wie "Why did you change X?")
- Live Issue Progress Comments (Status-Updates direkt ins Issue posten)
- Slack/Discord Connector (Run started / completed / failed Notifications)

## Product Reliability
- Persist run events in DB (not in-memory)
- Webhook dedupe + idempotency by delivery ID
- BullMQ retries/backoff + DLQ for failed jobs
- LLM JSON schema validation + stricter prompts + fallback
- Per-user/repo concurrency limits + rate limiting
- Better failure reporting in dashboard/issue/CLI

## UX/Onboarding
- Guided onboarding checklist in dashboard
- One-click "Install app" + "Run sample issue"
- CLI `havoc init` wizard with defaults
- Run detail tabs: Diff, Tests, Intent Card, Review, Logs

## Security/Compliance
- Redact tokens/secrets in logs
- Audit log per run (who/when/what)
- Data retention + deletion controls
- Sandbox hardening (no network, readonly FS option, limits)

## Growth/Monetization
- Pricing page + usage metering
- Team/org management + roles
- GitHub Marketplace listing

## Ops/Observability
- Metrics: success rate, latency, cost per run
- Alerts on failure spikes
- Background worker health + queue visibility

## Docs
- Production setup guide (GH App, Clerk, envs)
- Troubleshooting + FAQ
- API/CLI docs
