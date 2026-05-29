# Replier — Web App Deployment Guide

This is the multi-user web version of LinkedIn Replier. Users sign up, connect
their **own** Apify, Gemini, and Telegram keys through a guided onboarding,
choose which LinkedIn profiles to track, pick a daily time, and receive
ready-to-paste comment drafts on Telegram — exactly like the single-user tool,
but self-service and running for many users at once.

> The original GitHub-Actions single-user tool still lives in `src/` and is
> documented in `README.md`. This guide covers the web app in `backend/` and
> `frontend/`.

---

## Architecture

```
            ┌────────────────────────┐
            │  Netlify (static SPA)  │   React + Vite + Tailwind
            │  yourapp.netlify.app   │
            └───────────┬────────────┘
                        │ HTTPS (fetch)
                        ▼
            ┌────────────────────────┐
            │  Caddy  (auto-HTTPS)    │   free Let's Encrypt cert
            │  yourapp.duckdns.org    │   reverse proxy :443 → :8000
            └───────────┬────────────┘
                        ▼
            ┌────────────────────────┐
            │  FastAPI + APScheduler  │   Oracle Cloud Always-Free VM
            │  uvicorn 127.0.0.1:8000 │   systemd service, 1 process
            └───────────┬────────────┘
                        ▼
            ┌────────────────────────┐
            │  SQLite (encrypted keys)│   data/app.db
            └────────────────────────┘
                        │  per user, at their scheduled time
                        ▼
        Apify (fetch) → Gemini (score + draft) → Telegram (deliver)
```

- **One backend process.** APScheduler runs in-process and holds one cron job
  per enabled user. Never run multiple uvicorn workers — that would duplicate
  jobs and send duplicate Telegram reports.
- **Per-user isolation.** Settings, tracked profiles, dedup state, and run
  history are all keyed by `user_id`.
- **Downtime tolerance.** Jobs use `misfire_grace_time=3600`, so a brief VM
  restart near a scheduled time still runs the job when it comes back. This is
  the reliability gap that made plain GitHub cron unreliable.

---

## Security model

| Concern | Mitigation |
|---|---|
| DB / snapshot theft | Every user API key is encrypted with **Fernet** before it touches SQLite. Ciphertext is useless without the master key. |
| Master key exposure | `MASTER_ENCRYPTION_KEY` lives only in the VM's `.env` (chmod 600), never in the repo or database. |
| Password leak | Passwords are **bcrypt**-hashed (never stored or logged in plaintext). |
| Session theft | Short-lived **JWT** bearer tokens signed with `JWT_SECRET`. |
| Backend exposed directly | uvicorn binds `127.0.0.1` only; Caddy is the sole public edge, with HSTS + security headers. |
| Key runaway if anything leaks | Users set **spend caps** on their own Apify and Gemini accounts — bounded blast radius regardless. The onboarding and Keys page both insist on this. |

> **Fundamental tension (by design):** unattended daily runs require the keys
> in plaintext *at runtime*. Encryption at rest defeats the most common theft
> vector (stolen DB/backup). Spend caps cover everything else. This is the
> standard trade-off for any "bring your own key + run on a schedule" service.

**Losing `MASTER_ENCRYPTION_KEY` is unrecoverable** — every stored user key
becomes undecryptable. Back it up somewhere safe (a password manager), separate
from the database.

---

## Repository layout

```
backend/                 FastAPI app (deploys to Oracle VM)
  app/                   routers, models, pipeline, scheduler, crypto, security
  deploy/                Caddyfile, replier.service, setup.sh
  requirements.txt
  .env.example
  smoke_test.py          end-to-end self test
frontend/                React SPA (deploys to Netlify)
  src/                   pages, components, api client, auth context
  netlify.toml
  .env.example
DEPLOY.md                this file
```

---

## Local development

### Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt

cp .env.example .env
# Generate the two required secrets and paste them into .env:
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"   # MASTER_ENCRYPTION_KEY
python -c "import secrets; print(secrets.token_urlsafe(48))"                                  # JWT_SECRET

uvicorn app.main:app --reload --port 8000
# Health check: http://localhost:8000/health
# Sanity test:  python smoke_test.py
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env          # set VITE_API_BASE_URL=http://localhost:8000
npm run dev                   # http://localhost:5173
```

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Notes |
|---|---|---|
| `MASTER_ENCRYPTION_KEY` | **yes** | Fernet key. Encrypts all user API keys. Back it up. |
| `JWT_SECRET` | **yes** | Signs session tokens. Use `secrets.token_urlsafe(48)`. |
| `ALLOWED_ORIGINS` | **yes (prod)** | Comma-separated. Your Netlify URL, e.g. `https://yourapp.netlify.app`. |
| `DATABASE_URL` | no | Defaults to `sqlite:///./data/app.db`. |
| `JWT_EXPIRE_MINUTES` | no | Default 14 days. |
| `APIFY_ACTOR` | no | Default `harvestapi/linkedin-profile-posts`. |
| `DEFAULT_GEMINI_MODEL` | no | Default `gemini-2.5-flash`. |

### Frontend (`frontend/.env`)

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | **yes** | Backend base URL. Prod: `https://yourapp.duckdns.org`. |

---

## Deploy the backend (Oracle Cloud Always-Free VM)

1. **Create the VM.** Oracle Cloud → Compute → Instances → Create.
   - Image: **Ubuntu 22.04** (or newer).
   - Shape: any Always-Free (Ampere ARM `VM.Standard.A1.Flex` is generous).
   - Save the SSH key. Note the **public IP**.

2. **Point a free domain at it (DuckDNS).**
   - Sign in at [duckdns.org](https://www.duckdns.org), create a subdomain,
     set its IP to the VM's public IP.

3. **Open ports 80 and 443 in the Oracle console.**
   Networking → your VCN → Security List → **Add Ingress Rules** for TCP `80`
   and `443` from `0.0.0.0/0`. (Caddy can't get a cert until these are open.)

4. **SSH in, clone, run the setup script.**
   ```bash
   ssh ubuntu@<VM_PUBLIC_IP>
   git clone https://github.com/<you>/<repo>.git ~/replier
   cd ~/replier/backend/deploy
   bash setup.sh
   ```
   The script installs Python + Caddy, creates the venv, **generates your
   `MASTER_ENCRYPTION_KEY` and `JWT_SECRET`**, writes `.env`, installs the
   systemd service, configures Caddy with your domain, and opens the OS
   firewall. It will prompt for your Netlify URL and DuckDNS domain.

5. **Verify.**
   ```bash
   curl https://yourapp.duckdns.org/health      # {"status":"ok"}
   sudo systemctl status replier
   sudo journalctl -u replier -f                # live logs
   ```

### Updating the backend later

```bash
cd ~/replier && git pull
cd backend && ./.venv/bin/pip install -r requirements.txt
sudo systemctl restart replier
```

---

## Deploy the frontend (Netlify)

1. Push the repo to GitHub.
2. Netlify → **Add new site → Import an existing project** → pick the repo.
3. Netlify auto-detects `frontend/netlify.toml` (base `frontend`, build
   `npm run build`, publish `dist`, SPA redirect). Leave defaults.
4. **Site settings → Environment variables** → add
   `VITE_API_BASE_URL = https://yourapp.duckdns.org`.
5. **Deploy.** Then add the resulting `https://yourapp.netlify.app` to the
   backend's `ALLOWED_ORIGINS` (in `~/replier/backend/.env`) and
   `sudo systemctl restart replier`.

---

## Spend limits (tell your users — the UI already nags them)

The whole service is free to run for you (the operator). Users pay only their
own Apify/Gemini usage, which is tiny — but everyone should still cap it:

- **Apify:** Console → **Billing → Limits** → set a monthly USD limit.
- **Gemini:** [AI Studio](https://aistudio.google.com/app/apikey) free tier is
  usually enough; if billing is enabled, set a **budget alert** in Google Cloud
  Billing.
- **Telegram:** free.

These instructions appear in the onboarding wizard and on the Keys page, so
users are reminded at the moments they paste each key.

---

## Cost (operator)

| Component | Cost |
|---|---|
| Netlify (static, free tier) | $0 |
| Oracle Cloud Always-Free VM | $0 |
| DuckDNS domain | $0 |
| Caddy HTTPS (Let's Encrypt) | $0 |
| Apify / Gemini / Telegram | paid by each user, on their own keys |
| **Total to operate** | **$0/month** |

---

## Going-public checklist

Before pushing to a **public** GitHub repo:

- [ ] `backend/.env` is **not** committed (it's gitignored; double-check with
      `git status`).
- [ ] No `*.db` / `data/` from the backend is committed (gitignored).
- [ ] `MASTER_ENCRYPTION_KEY` and `JWT_SECRET` exist **only** on the VM.
- [ ] Frontend `.env` is not committed; the real `VITE_API_BASE_URL` is set in
      Netlify, not in the repo.
- [ ] **Personal legacy files are removed or relocated.** The repo root still
      contains the single-user tool's personal data: `profile.md`,
      `style_samples.md`, `config.yaml` (your tracked profiles), and
      `data/seen_posts.db`. None are API keys, but they are personal.
      **Recommended:** publish the web app from a *separate* repo containing
      only `backend/` + `frontend/` + `DEPLOY.md`, and keep the personal
      single-user tool in your existing private repo.

> Do not run `git push` to a public remote until the boxes above are checked.
