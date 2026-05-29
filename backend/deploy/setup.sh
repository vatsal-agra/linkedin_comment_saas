#!/usr/bin/env bash
#
# Replier backend provisioning for a fresh Ubuntu VM
# (designed for Oracle Cloud Always-Free, works on any Ubuntu 22.04+).
#
# Prereqs: you've already cloned the repo to ~/replier, e.g.
#   git clone https://github.com/<you>/<repo>.git ~/replier
#
# Then run:
#   cd ~/replier/backend/deploy && bash setup.sh
#
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/replier}"
BACKEND_DIR="$REPO_DIR/backend"

if [ ! -d "$BACKEND_DIR" ]; then
  echo "ERROR: $BACKEND_DIR not found. Clone the repo to $REPO_DIR first."
  exit 1
fi

echo "==> Installing system packages"
sudo apt-get update -y
sudo apt-get install -y python3 python3-venv python3-pip git curl \
  debian-keyring debian-archive-keyring apt-transport-https

echo "==> Installing Caddy (auto-HTTPS reverse proxy)"
if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y caddy
fi

echo "==> Python virtualenv + dependencies"
cd "$BACKEND_DIR"
python3 -m venv .venv
./.venv/bin/pip install --upgrade pip
./.venv/bin/pip install -r requirements.txt
mkdir -p data

echo "==> Creating .env (generates encryption + JWT secrets if missing)"
if [ ! -f .env ]; then
  MASTER_KEY="$(./.venv/bin/python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')"
  JWT_SECRET="$(./.venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(48))')"
  read -rp "Your Netlify site URL (e.g. https://yourapp.netlify.app): " ORIGINS
  cat > .env <<EOF
MASTER_ENCRYPTION_KEY=$MASTER_KEY
JWT_SECRET=$JWT_SECRET
ALLOWED_ORIGINS=$ORIGINS
DATABASE_URL=sqlite:///./data/app.db
EOF
  chmod 600 .env
  echo "    .env created. BACK UP MASTER_ENCRYPTION_KEY — losing it makes every"
  echo "    stored user key unrecoverable. NEVER commit this file."
else
  echo "    .env already exists — leaving it untouched."
fi

echo "==> Installing systemd service"
sudo cp deploy/replier.service /etc/systemd/system/replier.service
sudo systemctl daemon-reload
sudo systemctl enable --now replier
sleep 2
sudo systemctl --no-pager --full status replier | head -n 8 || true

echo "==> Configuring Caddy"
read -rp "Your DuckDNS domain (e.g. yourapp.duckdns.org): " DOMAIN
sudo mkdir -p /var/log/caddy
sed "s/REPLACE_ME.duckdns.org/$DOMAIN/" deploy/Caddyfile | sudo tee /etc/caddy/Caddyfile >/dev/null
sudo systemctl reload caddy || sudo systemctl restart caddy

echo "==> Opening firewall ports 80 and 443 (Oracle Ubuntu blocks these by default)"
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT || true
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT || true
if command -v netfilter-persistent >/dev/null 2>&1; then
  sudo netfilter-persistent save || true
else
  sudo bash -c 'mkdir -p /etc/iptables && iptables-save > /etc/iptables/rules.v4' || true
fi

echo ""
echo "============================================================"
echo " Done."
echo "  Backend health check: https://$DOMAIN/health"
echo ""
echo " IMPORTANT — also open ports 80 and 443 in the Oracle Cloud"
echo " console:  Networking > VCN > Security List > Add Ingress"
echo " Rules for TCP 80 and 443 from 0.0.0.0/0. Caddy cannot get"
echo " an HTTPS certificate until those are open."
echo ""
echo " Then set VITE_API_BASE_URL=https://$DOMAIN in Netlify and"
echo " redeploy the frontend."
echo "============================================================"
