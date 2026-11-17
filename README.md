# AI Product Manager

A product management command centre built from the master build prompt. It covers company context, customer problem extraction, opportunities with RICE/ICE prioritisation, a traceable roadmap, versioned PRDs with approval, a decision log, and an AI assistant grounded in your own data. The Anthropic API key stays on the server.

## What is working (Phase 1 core, plus parts of Phase 2)

| Area | Status | Notes |
|---|---|---|
| Overview | Working | Product health score with its formula shown. Rule-based recommendations. |
| AI Product Manager | Working | Grounded in company context. Labels claims as verified, hypothesis, assumption or recommendation. Requires an API key. |
| Company Intelligence | Working | Profile, strategic objectives, and labelled knowledge items. Verified items need a source. Items older than 180 days are flagged. |
| Customer Insights | Working | AI extracts problems from pasted feedback. Only quotes found verbatim in the input are kept. Human review required before scoring. |
| Opportunities | Working | Backlog with status tracking. Prioritise tab with RICE and ICE, plus strategic overrides that always carry a rationale. |
| Roadmaps | Working | Now / Next / Later. Items must link to a problem or opportunity, an objective and a metric. |
| PRDs & Documentation | Working | 15-section template. AI draft (not saved until you save). Versioning, line-level diff, review and approval. Editing an approved PRD returns it to draft. |
| Product Strategy | Working (decision log) | Permanent decision log with context, alternatives, trade-offs, owner and later outcome. |
| Settings | Working | AI connection status, access token, JSON export/import, clear data. |
| Market Research, Design, Engineering, Analytics, Experiments, Finance, Reports, Integrations, Agent Management | Scaffold | Each page states what the spec requires and what is needed to build it. None of them shows fake data or pretends to be connected. |

## Architecture

- **Frontend:** Vite, React 18, TypeScript, React Router. Built as a static site.
- **Serverless AI proxy:** `netlify/functions/ai.mts`. Validates input, enforces size limits, optionally checks an access token, calls the Anthropic Messages API, and returns only the text. Upstream errors are logged by status code only.
- **Storage:** browser `localStorage`, behind a single store module. This suits a single user. A multi-user production deployment needs a server database (PostgreSQL is recommended in the spec). This is the main gap to close before sharing with a team.
- **Security headers:** a strict Content-Security-Policy, frame denial and nosniff are set in `netlify.toml`.

## Run locally

```bash
npm install
npm run dev          # UI only; AI features show "not configured" unless you run the function locally
npm test             # unit tests for scoring, health score and the anti-fabrication parser
npm run build        # typecheck + production build into dist/
```

To exercise the AI features locally, install the Netlify CLI (`npm i -g netlify-cli`), copy `.env.example` to `.env`, set `ANTHROPIC_API_KEY`, then run `netlify dev`.

## Deploy to Netlify

**Option A: from the Netlify UI (recommended)**
1. Push this folder to a Git repository.
2. In Netlify, choose *Add new site → Import an existing project* and select the repository. `netlify.toml` supplies the build settings.
3. Under *Site configuration → Environment variables*, add `ANTHROPIC_API_KEY`. Add `APP_ACCESS_TOKEN` as well if the site is not private.
4. Trigger a deploy.

**Option B: from the command line**
```bash
npm i -g netlify-cli
export NETLIFY_AUTH_TOKEN=...        # personal access token from Netlify user settings
netlify sites:create --name ai-pm-platform
netlify env:set ANTHROPIC_API_KEY "sk-ant-..."
netlify env:set APP_ACCESS_TOKEN "$(openssl rand -hex 24)"
netlify deploy --build --prod
```

After deploying, open *Settings* in the app, enter the access token if you set one, and confirm the AI connection shows as connected.

## Known limitations

- Data lives in the browser. Clearing site data, or switching devices, loses it unless you export. Use Export JSON regularly.
- The access token is a shared secret, not user accounts. For real multi-user access, add Netlify Identity or enable Netlify site protection, and move storage to a server database.
- Scores are only as good as their inputs. RICE and ICE are shown with their formulas, and overrides are flagged, but the numbers are the user's estimates.
- AI output is a draft. The assistant is instructed not to invent facts, but it can still be wrong. Verify before acting.
- Integrations, analytics, experimentation and the other scaffolded modules are not built. Their pages list the requirements.

## Project layout

```
netlify/functions/ai.mts     server-side AI proxy
netlify.toml                 build, headers, SPA fallback
src/lib/types.ts             domain model
src/lib/scoring.ts           RICE, ICE, priority overrides, health score
src/lib/prompts.ts           governance prompt, company context, quote-verified extraction parser
src/lib/store.tsx            persisted state and import/export helpers
src/lib/ai.ts                browser client for the function
src/pages/                   one file per module; Scaffold.tsx holds the not-yet-built modules
```
