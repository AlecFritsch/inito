# Havoc Demo Video Script (3:00)

## Recording Setup

- **Resolution:** 1920x1080
- **Browser:** Chrome (dark mode)
- **Terminal:** Dark theme
- **Tabs ready:**
  1. GitHub Issue
  2. usehavoc.com/dashboard/runs
  3. Terminal with `havoc` CLI

---

## INTRO (0:00 - 0:25)

**[Screen: usehavoc.com landing page]**

> "AI coding tools have a trust problem. They generate code, but developers have no idea WHY changes were made. Every AI-generated PR is a black box.
>
> Havoc fixes this. It's the Trust Layer for AI-Generated Code.
>
> Let me show you how it works."

---

## THE PROBLEM (0:25 - 0:45)

**[Screen: GitHub Issue]**

> "Here's a real GitHub issue - 'Add error handling to the health endpoint'. 
>
> Normally, I'd spend 15-30 minutes writing this code, testing it, and creating a PR.
>
> With Havoc, I just type one command..."

---

## TRIGGER HAVOC (0:45 - 1:05)

**[Screen: Type `/havoc` in comment field, click submit]**

> "...slash havoc."

**[Show comment posted, Havoc acknowledges]**

> "That's it. Havoc now takes over. It's analyzing the codebase, understanding the issue, planning the changes, writing code, running tests, and reviewing its own work."

---

## DASHBOARD (1:05 - 1:35)

**[Screen: Switch to usehavoc.com/dashboard/runs]**

> "In the dashboard, I can see the run in real-time."

**[Point to status badges]**

> "It's going through each stage - Analyzing, Planning, Editing, Testing, Reviewing."

**[Point to confidence score]**

> "And here's the key differentiator - Havoc calculates a Confidence Score. This tells me how certain it is about the changes."

---

## THE PR (1:35 - 2:15)

**[Screen: GitHub PR created by Havoc]**

> "And here's the magic - the Pull Request."

**[Scroll to show Intent Card]**

> "But this isn't just code. Look at this Intent Card."

**[Slowly scroll through Intent Card sections]**

> "It explains:
> - WHAT changed and WHY
> - The confidence breakdown - tests passing, lint clean, complexity score  
> - A self-review where the AI critiques its OWN code
>
> This is transparency. This is trust."

---

## CLI (2:15 - 2:40)

**[Screen: Terminal]**

> "Havoc also has a CLI for developers who prefer the command line."

**[Type and run commands]**

```bash
havoc login
# Show the auth flow

havoc whoami
# Show logged in user

havoc status <run-id>
# Show run status
```

> "Authenticate with one command, check status of any run."

---

## CLOSING (2:40 - 3:00)

**[Screen: usehavoc.com with logo]**

> "Other AI tools say 'Here's your code, good luck.'
>
> Havoc says 'Here's your code, here's WHY, here's my confidence, and here's what I'm uncertain about.'
>
> Trust through transparency. That's Havoc.
>
> Try it at usehavoc.com."

**[Hold on logo for 3 seconds]**

---

## Recording Checklist

Before recording, ensure:

- [ ] Gemini API Key is working
- [ ] `/havoc` triggers a successful run
- [ ] PR is created with Intent Card
- [ ] Dashboard shows real run data
- [ ] CLI is logged in (`havoc whoami` works)
- [ ] Browser bookmarks hidden
- [ ] Notifications off
- [ ] Clean desktop

## Backup Plan

If live demo fails:
1. Use pre-recorded successful run footage
2. Show dashboard with existing run
3. Show existing PR with Intent Card

---

## Key Talking Points

1. **Problem:** AI code = black box, no trust
2. **Solution:** Code that explains itself
3. **How:** Intent Card + Confidence Score + Self-Review
4. **Differentiator:** Transparency = Trust
5. **CTA:** usehavoc.com

## Don't Forget to Mention

- Built with **Google Gemini**
- **Docker sandboxes** for safe execution
- **Policy gates** prevent low-quality PRs
- Works with any GitHub repository
