# CLAUDE.md — InvincibleVoice

Fork de [kyutai-labs/invincible-voice](https://github.com/kyutai-labs/invincible-voice) (ex-Unmute). Interface vocale temps réel pour LLMs : STT → LLM → TTS, le tout dans le navigateur.

## Stack

| Composant | Tech |
|-|-|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind, pnpm |
| Backend | Python 3.12, FastAPI, uv, Rust (sphn) |
| Infra | Docker Compose, Traefik (reverse proxy + HTTPS), Redis, Prometheus, Grafana |
| LLM | Cerebras API (Qwen 3 235B) |
| STT/TTS | Gradium API |

## Architecture

```
services/
  frontend/     # Next.js app (port 3000)
  backend/      # FastAPI (port 80 interne), routes dans backend/routes/
  grafana/      # Dashboards + provisioning
  prometheus/   # Config scraping
```

Traefik route par PathPrefix : `/api` → backend, `/grafana` → grafana, `/` → frontend.

## Commandes

### Dev local
```bash
docker compose up --build          # HTTP sur localhost:80
```

### Production (Hetzner CAX11 ARM64)
```bash
# Sur le serveur
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Déployé sur : **https://voice.amiral.tech**

### Backend seul (dev)
```bash
cd services/backend
uv run uvicorn backend.main:app --reload --port 80
```

## Fichiers clés

| Fichier | Rôle |
|-|-|
| `docker-compose.yml` | Config dev (hot-reloading, HTTP) |
| `docker-compose.prod.yml` | Override prod (HTTPS Let's Encrypt, named volumes, restart) |
| `.env` | Variables locales (gitignored) |
| `.env.prod` | Variables prod sur le serveur (gitignored) |
| `.env.prod.template` | Template documenté des variables prod |
| `deploy.sh` | Script setup serveur (Docker, ufw, clone) |
| `services/backend/backend/main.py` | Entrypoint FastAPI, CORS configurable via `CORS_ALLOW_ORIGINS` |

## Conventions

- **KISS** : pas d'over-engineering.
- **Ne pas utiliser `rm -rf`** : utiliser `trash`.
- Le CORS est configurable via env var `CORS_ALLOW_ORIGINS` (virgule-séparé). Défaut : `http://localhost,http://localhost:3000`.
- Pas de `platform: linux/amd64` dans le compose (ARM64 compatible).
- Le backend a besoin de `libopus-dev`, `cmake`, `build-essential` pour compiler `sphn` sur ARM64 (ajouté dans le Dockerfile).

## Serveur prod

- **Hetzner CAX11** : 2 vCPU ARM64 (Ampere), 4 GB RAM, €3.29/mois
- **IP** : 89.167.5.166
- **Domaine** : voice.amiral.tech
- **OS** : Ubuntu 24.04 aarch64
- **Répertoire** : `/opt/invincible-voice`
- **Certificat** : Let's Encrypt auto via Traefik
