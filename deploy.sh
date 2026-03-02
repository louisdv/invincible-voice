#!/usr/bin/env bash
set -euo pipefail

# InvincibleVoice — Production deployment script for Debian/Ubuntu (Hetzner)
# Usage: curl the script or scp it to the server, then run as root.

REPO_URL="https://github.com/louisdv/invincible-voice.git"
INSTALL_DIR="/opt/invincible-voice"

echo "=== 1. Installing Docker ==="
if ! command -v docker &>/dev/null; then
    apt-get update
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # Detect distro (debian or ubuntu)
    . /etc/os-release
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
        > /etc/apt/sources.list.d/docker.list

    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    echo "Docker installed."
else
    echo "Docker already installed, skipping."
fi

echo "=== 2. Configuring firewall (ufw) ==="
if command -v ufw &>/dev/null; then
    ufw allow 22/tcp   # SSH
    ufw allow 80/tcp   # HTTP (for ACME challenge + redirect)
    ufw allow 443/tcp  # HTTPS
    ufw --force enable
    echo "Firewall configured."
else
    apt-get install -y ufw
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
    echo "ufw installed and configured."
fi

echo "=== 3. Cloning repository ==="
if [ -d "$INSTALL_DIR" ]; then
    echo "Directory $INSTALL_DIR already exists, pulling latest..."
    cd "$INSTALL_DIR"
    git pull
else
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

echo "=== 4. Environment file ==="
if [ ! -f .env ]; then
    cp .env.prod.template .env
    echo "Created .env from template. EDIT IT with your API keys before starting!"
    echo "  nano $INSTALL_DIR/.env"
    echo ""
    echo "Then start with:"
    echo "  cd $INSTALL_DIR"
    echo "  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build"
    exit 0
else
    echo ".env already exists, keeping it."
fi

echo "=== 5. Starting services ==="
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

echo ""
echo "=== Done! ==="
echo "Check status: docker compose -f docker-compose.yml -f docker-compose.prod.yml ps"
echo "View logs:    docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f"
