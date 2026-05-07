# Anthropic switch + Staging env + CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrer le backend prod sur `anthropic/claude-sonnet-4-6` avec fallback Cerebras, monter un environnement staging HTTPS isolé sur le même VPS, et stabiliser les workflows CI prod + staging.

**Architecture :** 4 chantiers strictement séquentiels (A code → B staging infra → C CI → D bascule prod). Le code backend devient provider-agnostic via des env vars optionnelles ; le staging réutilise le Traefik prod via labels, sans Prom/Grafana ; la CI passe à l'environment GitHub `production` (sans required reviewers) et un nouveau workflow gère la branche `staging`.

**Tech Stack :** FastAPI + LiteLLM + uv (backend) ; Docker Compose + Traefik + Let's Encrypt (infra) ; GitHub Actions + appleboy/ssh-action (CI) ; Hetzner CAX11 ARM64 (serveur).

---

## File Structure

| Fichier | Action | Responsabilité |
|-|-|-|
| `services/backend/backend/kyutai_constants.py` | Modifier | Rendre `LLM_URL` et `LLM_API_KEY` optionnels (None si vide ou absent) |
| `services/backend/tests/llm/test_kyutai_constants.py` | Créer | TDD : valider le comportement optionnel |
| `services/backend/tests/llm/test_providers.py` | Modifier | Ajouter tests régression pour omission `api_base`/`api_key` quand None |
| `docker-compose.yml` | Modifier | Forward `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `CEREBRAS_API_KEY` |
| `docker-compose.staging.yml` | Créer | Stack staging autonome (frontend + backend + redis), labels Traefik suffixe `-staging` |
| `.env.prod.template` | Modifier | Bloc commenté avec exemples Anthropic primaire + Cerebras fallback |
| `.env` (local, gitignored) | Éditer ligne par ligne | Pointage local sur Anthropic |
| `.github/workflows/lint.yml` | Modifier | Étendre `push.branches` à `main` + `staging` |
| `.github/workflows/deploy-prod.yml` | Modifier | `environment: Deploy to prod` → `production` |
| `.github/workflows/deploy-staging.yml` | Créer | Workflow déploiement staging |
| `CLAUDE.md` | Modifier | Documenter accès staging |

---

## Chantier A — Code backend Anthropic-compatible

### Task A1 : Tests rouges pour `kyutai_constants.py` (TDD)

**Files:**
- Create: `services/backend/tests/llm/test_kyutai_constants.py`

- [ ] **Step 1 : Créer le fichier de tests**

```python
"""Unit tests for backend.kyutai_constants env var handling."""

import importlib

import pytest


@pytest.fixture
def required_env(monkeypatch, tmp_path):
    """Set the env vars required for kyutai_constants to import without errors."""
    monkeypatch.setenv("STT_IS_GRADIUM", "true")
    monkeypatch.setenv("KYUTAI_STT_URL", "wss://test.example/asr")
    monkeypatch.setenv("TTS_IS_GRADIUM", "true")
    monkeypatch.setenv("TTS_SERVER", "test.example")
    monkeypatch.setenv("KYUTAI_LLM_MODEL", "cerebras/llama3.1-8b")
    monkeypatch.setenv("KYUTAI_USERS_DATA_PATH", str(tmp_path))
    return monkeypatch


def test_llm_url_is_none_when_env_var_empty(required_env):
    required_env.setenv("KYUTAI_LLM_URL", "")
    required_env.setenv("KYUTAI_LLM_API_KEY", "test-key")
    from backend import kyutai_constants

    importlib.reload(kyutai_constants)
    assert kyutai_constants.LLM_URL is None


def test_llm_api_key_is_none_when_env_var_empty(required_env):
    required_env.setenv("KYUTAI_LLM_URL", "https://api.test/v1")
    required_env.setenv("KYUTAI_LLM_API_KEY", "")
    from backend import kyutai_constants

    importlib.reload(kyutai_constants)
    assert kyutai_constants.LLM_API_KEY is None


def test_llm_url_is_none_when_env_var_missing(required_env):
    required_env.delenv("KYUTAI_LLM_URL", raising=False)
    required_env.setenv("KYUTAI_LLM_API_KEY", "test-key")
    from backend import kyutai_constants

    importlib.reload(kyutai_constants)
    assert kyutai_constants.LLM_URL is None


def test_llm_api_key_is_none_when_env_var_missing(required_env):
    required_env.setenv("KYUTAI_LLM_URL", "https://api.test/v1")
    required_env.delenv("KYUTAI_LLM_API_KEY", raising=False)
    from backend import kyutai_constants

    importlib.reload(kyutai_constants)
    assert kyutai_constants.LLM_API_KEY is None
```

- [ ] **Step 2 : Lancer les tests, vérifier qu'ils échouent**

Run: `cd services/backend && uv run pytest tests/llm/test_kyutai_constants.py -v`

Expected: `test_llm_url_is_none_when_env_var_missing` et `test_llm_api_key_is_none_when_env_var_missing` échouent avec `KeyError: 'KYUTAI_LLM_URL'` (ou `KYUTAI_LLM_API_KEY`). `test_llm_url_is_none_when_env_var_empty` échoue avec `assert '' is None` (ou similaire). Idem pour le test API_KEY empty.

- [ ] **Step 3 : Ne pas committer encore — passer à A2 pour la fix**

### Task A2 : Fix `kyutai_constants.py`

**Files:**
- Modify: `services/backend/backend/kyutai_constants.py:28-29`

- [ ] **Step 1 : Modifier les deux affectations LLM**

Remplacer :
```python
LLM_API_KEY = os.environ["KYUTAI_LLM_API_KEY"]
LLM_URL = os.environ["KYUTAI_LLM_URL"]
```

Par :
```python
LLM_API_KEY = os.environ.get("KYUTAI_LLM_API_KEY") or None
LLM_URL = os.environ.get("KYUTAI_LLM_URL") or None
```

- [ ] **Step 2 : Lancer les tests, vérifier qu'ils passent**

Run: `cd services/backend && uv run pytest tests/llm/test_kyutai_constants.py -v`

Expected: 4 tests PASS.

- [ ] **Step 3 : Lancer la suite de tests complète pour vérifier qu'aucune régression**

Run: `cd services/backend && uv run pytest -v`

Expected: tous les tests existants passent (notamment `tests/llm/test_providers.py`).

- [ ] **Step 4 : Lint**

Run: `cd services/backend && uv run ruff check && uv run ruff format`

Expected: aucune erreur.

- [ ] **Step 5 : Commit**

```bash
git add services/backend/backend/kyutai_constants.py services/backend/tests/llm/test_kyutai_constants.py
git commit -m "fix(llm): make KYUTAI_LLM_URL and KYUTAI_LLM_API_KEY optional

Allow empty or missing values for these env vars so the backend can use
provider-native endpoints (Anthropic) without forcing an OpenAI-compatible
api_base. Add unit tests covering empty and missing cases."
```

### Task A3 : Tests régression pour `providers.py`

**Files:**
- Modify: `services/backend/tests/llm/test_providers.py`

- [ ] **Step 1 : Ajouter deux tests à la fin du fichier**

```python
@pytest.mark.asyncio
async def test_chat_completion_stream_omits_api_base_when_none():
    """When api_base=None, the kwarg must not appear in the litellm call."""
    from backend.llm.providers import chat_completion_stream

    fake_chunk = type(
        "Chunk", (), {"choices": [type("C", (), {"delta": type("D", (), {"content": "x"})()})()]}
    )()

    async def fake_stream():
        yield fake_chunk

    seen_kwargs: dict = {}

    async def acompletion(**kwargs):
        seen_kwargs.update(kwargs)
        return fake_stream()

    with patch("backend.llm.providers.litellm.acompletion", new=acompletion):
        async for _ in chat_completion_stream(
            messages=[{"role": "user", "content": "hi"}],
            model="anthropic/claude-sonnet-4-6",
            api_key="sk-ant-test",
            api_base=None,
        ):
            pass

    assert "api_base" not in seen_kwargs
    assert seen_kwargs.get("api_key") == "sk-ant-test"


@pytest.mark.asyncio
async def test_chat_completion_stream_omits_api_key_when_none():
    """When api_key=None, the kwarg must not appear in the litellm call."""
    from backend.llm.providers import chat_completion_stream

    fake_chunk = type(
        "Chunk", (), {"choices": [type("C", (), {"delta": type("D", (), {"content": "x"})()})()]}
    )()

    async def fake_stream():
        yield fake_chunk

    seen_kwargs: dict = {}

    async def acompletion(**kwargs):
        seen_kwargs.update(kwargs)
        return fake_stream()

    with patch("backend.llm.providers.litellm.acompletion", new=acompletion):
        async for _ in chat_completion_stream(
            messages=[{"role": "user", "content": "hi"}],
            model="anthropic/claude-sonnet-4-6",
            api_key=None,
            api_base=None,
        ):
            pass

    assert "api_key" not in seen_kwargs
    assert "api_base" not in seen_kwargs
```

- [ ] **Step 2 : Lancer les tests, vérifier qu'ils passent**

Run: `cd services/backend && uv run pytest tests/llm/test_providers.py -v`

Expected: les 6 tests passent (4 anciens + 2 nouveaux).

- [ ] **Step 3 : Lint**

Run: `cd services/backend && uv run ruff check && uv run ruff format`

- [ ] **Step 4 : Commit**

```bash
git add services/backend/tests/llm/test_providers.py
git commit -m "test(llm): add regression tests for api_key/api_base omission

Lock in the contract that providers.chat_completion_stream does not
forward api_key or api_base to litellm.acompletion when their value is
None. Required to avoid leaking a Cerebras api_base into Anthropic calls."
```

### Task A4 : Forward env vars provider standard dans `docker-compose.yml`

**Files:**
- Modify: `services/backend/../docker-compose.yml` (the root-level `docker-compose.yml`)

- [ ] **Step 1 : Ajouter trois lignes dans `services.backend.environment`**

Trouver la ligne :
```yaml
      - KYUTAI_LLM_API_KEY=${KYUTAI_LLM_API_KEY}
```

Et après celle-ci, insérer :
```yaml
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
      - OPENAI_API_KEY=${OPENAI_API_KEY:-}
      - CEREBRAS_API_KEY=${CEREBRAS_API_KEY:-}
```

- [ ] **Step 2 : Aussi rendre `KYUTAI_LLM_URL` et `KYUTAI_LLM_API_KEY` tolérants au vide**

Remplacer :
```yaml
      - KYUTAI_LLM_URL=${KYUTAI_LLM_URL}
      - KYUTAI_LLM_API_KEY=${KYUTAI_LLM_API_KEY}
```

Par :
```yaml
      - KYUTAI_LLM_URL=${KYUTAI_LLM_URL:-}
      - KYUTAI_LLM_API_KEY=${KYUTAI_LLM_API_KEY:-}
```

- [ ] **Step 3 : Vérifier que le compose parse**

Run: `docker compose -f docker-compose.yml config --quiet`

Expected: pas d'erreur (juste un warning éventuel sur env vars manquantes, OK).

- [ ] **Step 4 : Commit**

```bash
git add docker-compose.yml
git commit -m "chore(compose): forward provider-standard API keys to backend

Add ANTHROPIC_API_KEY, OPENAI_API_KEY, and CEREBRAS_API_KEY to the
backend service environment so LiteLLM can read them when
KYUTAI_LLM_API_KEY is not set. Also tolerate empty KYUTAI_LLM_URL and
KYUTAI_LLM_API_KEY to allow Anthropic native endpoint usage."
```

### Task A5 : Mettre à jour `.env.prod.template`

**Files:**
- Modify: `.env.prod.template`

- [ ] **Step 1 : Restructurer le bloc LLM**

Remplacer :
```
# LLM
KYUTAI_LLM_URL=https://api.cerebras.ai/v1
# Format LiteLLM: <provider>/<model>. Exemples:
#   cerebras/llama3.1-8b, cerebras/qwen-3-235b-a22b-instruct-2507,
#   anthropic/claude-sonnet-4-6, openai/gpt-5-mini, gemini/gemini-2.5-flash
KYUTAI_LLM_MODEL=cerebras/llama3.1-8b
# Modèle utilisé en fallback si KYUTAI_LLM_MODEL est indisponible (404)
KYUTAI_LLM_MODEL_FALLBACK=cerebras/llama3.1-8b
KYUTAI_LLM_API_KEY=
```

Par :
```
# LLM
# Format LiteLLM: <provider>/<model>. Exemples:
#   cerebras/llama3.1-8b, cerebras/qwen-3-235b-a22b-instruct-2507,
#   anthropic/claude-sonnet-4-6, openai/gpt-5-mini, gemini/gemini-2.5-flash
KYUTAI_LLM_MODEL=anthropic/claude-sonnet-4-6
# Modèle utilisé en fallback si KYUTAI_LLM_MODEL est indisponible (404 / rate limit)
KYUTAI_LLM_MODEL_FALLBACK=cerebras/llama3.1-8b
# Optionnel : api_base custom (ex: Cerebras OpenAI-compat). Laisser vide pour
# Anthropic, OpenAI, Gemini natifs.
KYUTAI_LLM_URL=
# Optionnel : si défini, force cette clé pour TOUS les providers (legacy).
# Laisser vide pour que LiteLLM lise les vars provider-standard ci-dessous.
KYUTAI_LLM_API_KEY=

# Clés provider-standard (lues automatiquement par LiteLLM si KYUTAI_LLM_API_KEY est vide).
# Permet d'utiliser un provider primaire et un autre en fallback (ex: Anthropic + Cerebras).
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
CEREBRAS_API_KEY=
```

- [ ] **Step 2 : Vérifier le diff**

Run: `git diff .env.prod.template`

Expected: la section LLM est restructurée avec le nouveau bloc `*_API_KEY` standard.

- [ ] **Step 3 : Commit**

```bash
git add .env.prod.template
git commit -m "docs(env): document provider-standard API keys in prod template

Default to anthropic/claude-sonnet-4-6 with cerebras fallback (winner
of the Phase 2 eval). Document KYUTAI_LLM_URL and KYUTAI_LLM_API_KEY as
optional, and add ANTHROPIC_API_KEY/OPENAI_API_KEY/CEREBRAS_API_KEY
provider-standard fields."
```

### Task A6 : Éditer `.env` local pour pointer sur Anthropic

**Files:**
- Edit (line-by-line, never overwrite): `.env`

> ⚠️ Lire d'abord avec `Read`, puis `Edit` pour chaque ligne. Ne **jamais** utiliser `Write`.

- [ ] **Step 1 : Lire `.env` pour identifier les lignes à toucher**

Run: `Read tool on /Users/louis/claude-local/invincible-voice/.env`

Noter les valeurs actuelles de `KYUTAI_LLM_URL`, `KYUTAI_LLM_MODEL`, `KYUTAI_LLM_API_KEY`. Cette dernière (qui commence par `csk-`) sera réutilisée comme `CEREBRAS_API_KEY`.

- [ ] **Step 2 : Lire la clé Anthropic depuis `scripts/llm_eval/.env`**

Run: `Read tool on /Users/louis/claude-local/invincible-voice/scripts/llm_eval/.env`

Récupérer la valeur de `ANTHROPIC_API_KEY`.

- [ ] **Step 3 : Éditer `.env` ligne par ligne — `KYUTAI_LLM_URL`**

Edit :
- old: `KYUTAI_LLM_URL=https://api.cerebras.ai/v1`
- new: `KYUTAI_LLM_URL=`

- [ ] **Step 4 : Éditer `.env` — `KYUTAI_LLM_MODEL`**

Edit :
- old: `KYUTAI_LLM_MODEL=cerebras/llama3.1-8b`
- new: `KYUTAI_LLM_MODEL=anthropic/claude-sonnet-4-6`

- [ ] **Step 5 : Éditer `.env` — vider `KYUTAI_LLM_API_KEY`**

Edit :
- old: `KYUTAI_LLM_API_KEY=csk-<...>` (la valeur lue à l'étape 1, en entier)
- new: `KYUTAI_LLM_API_KEY=`

- [ ] **Step 6 : Append `ANTHROPIC_API_KEY` et `CEREBRAS_API_KEY` à la fin de `.env`**

Run via Bash :
```bash
cat >> .env <<'EOF'

# Provider-standard keys (added 2026-05-07 — switch to Anthropic primary + Cerebras fallback)
ANTHROPIC_API_KEY=<valeur lue à l'étape 2>
CEREBRAS_API_KEY=<valeur csk-... lue à l'étape 1>
EOF
```

(L'agent substitue les valeurs au moment de l'exécution. Les clés ne doivent jamais apparaître dans le commit puisque `.env` est gitignored.)

- [ ] **Step 7 : Vérifier que `.env` est toujours gitignored**

Run: `git check-ignore .env && echo "OK gitignored" || echo "DANGER: .env tracké"`

Expected: `OK gitignored`.

- [ ] **Step 8 : Pas de commit (fichier gitignored).**

### Task A7 : Smoke test conversationnel local — ★ ÉTAPE HUMAINE

- [ ] **Step 1 : Build & up**

Run: `docker compose up --build`

Attendre que les logs montrent `backend_1  | INFO:     Application startup complete.`

- [ ] **Step 2 : Demander à l'utilisateur de tester**

Message à l'utilisateur :
> Le backend tourne maintenant sur Anthropic. Va sur **http://localhost** dans ton navigateur, fais une conversation vocale d'environ 30 s (parle, attends les keywords/réponses, clique sur une réponse, vérifie que le TTS lit). Reviens avec :
> - "OK" si tout fonctionne (suggestions variées, TTS lit la réponse choisie),
> - les **dernières 50 lignes** des logs `docker compose logs backend --tail=50` si quelque chose plante.

- [ ] **Step 3 : Sur "OK" de l'utilisateur, passer à B. Sur erreur, debug avant de continuer.**

---

## Chantier B — Staging sur le même VPS

### Task B1 : Écrire `docker-compose.staging.yml`

**Files:**
- Create: `docker-compose.staging.yml` (à la racine du repo)

- [ ] **Step 1 : Créer le fichier**

```yaml
# Staging stack — lite (frontend + backend + redis only).
# Réutilise le Traefik prod via labels (Host=staging.voice.amiral.tech).
# À lancer avec : docker compose -p invincible-voice-staging --env-file .env.staging \
#   -f docker-compose.staging.yml up -d --build
services:

  frontend:
    image: invincible-voice-staging-frontend:latest
    build:
      context: services/frontend/
      dockerfile: Dockerfile
    environment:
      - NEXT_PUBLIC_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
    labels:
      - "traefik.enable=true"
      - "pub_port=80"
      - "traefik.http.routers.frontend-staging.rule=Host(`${DOMAIN}`) && PathPrefix(`/`)"
      - "traefik.http.routers.frontend-staging.entrypoints=websecure"
      - "traefik.http.routers.frontend-staging.tls=true"
      - "traefik.http.routers.frontend-staging.tls.certresolver=letsencrypt"
      - "traefik.http.routers.frontend-staging.priority=10"
      - "traefik.http.services.frontend-staging.loadbalancer.server.port=3000"
    restart: unless-stopped

  backend:
    image: invincible-voice-staging-backend:latest
    build:
      context: services/backend
      target: prod
    volumes:
      - users_data:/users_data
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - TTS_LOCK_TTL_SECONDS=300
      - STT_LOCK_TTL_SECONDS=600
      - KYUTAI_LLM_URL=${KYUTAI_LLM_URL:-}
      - KYUTAI_LLM_API_KEY=${KYUTAI_LLM_API_KEY:-}
      - KYUTAI_LLM_MODEL=${KYUTAI_LLM_MODEL}
      - KYUTAI_LLM_MODEL_FALLBACK=${KYUTAI_LLM_MODEL_FALLBACK:-cerebras/llama3.1-8b}
      - KYUTAI_USERS_DATA_PATH=/users_data
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GRADIUM_API_KEY=${GRADIUM_API_KEY}
      - TTS_VOICE_ID=${TTS_VOICE_ID}
      - STT_IS_GRADIUM=${STT_IS_GRADIUM}
      - KYUTAI_STT_URL=${KYUTAI_STT_URL}
      - TTS_IS_GRADIUM=${TTS_IS_GRADIUM}
      - TTS_SERVER=${TTS_SERVER}
      - KYUTAI_API_KEY=${KYUTAI_API_KEY:-}
      - ALLOW_PASSWORD=${ALLOW_PASSWORD:-true}
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - CORS_ALLOW_ORIGINS=https://${DOMAIN}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
      - OPENAI_API_KEY=${OPENAI_API_KEY:-}
      - CEREBRAS_API_KEY=${CEREBRAS_API_KEY:-}
    labels:
      - "traefik.enable=true"
      - "pub_port=80"
      - "traefik.http.routers.backend-staging.rule=Host(`${DOMAIN}`) && PathPrefix(`/api`)"
      - "traefik.http.routers.backend-staging.middlewares=strip-api-staging"
      - "traefik.http.middlewares.strip-api-staging.replacepathregex.regex=^/api/(.*)"
      - "traefik.http.middlewares.strip-api-staging.replacepathregex.replacement=/$$1"
      - "traefik.http.routers.backend-staging.entrypoints=websecure"
      - "traefik.http.routers.backend-staging.tls=true"
      - "traefik.http.routers.backend-staging.tls.certresolver=letsencrypt"
      - "traefik.http.services.backend-staging.loadbalancer.server.port=80"
      - "traefik.http.routers.backend-staging.priority=100"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    restart: unless-stopped

volumes:
  users_data:
```

- [ ] **Step 2 : Vérifier que le compose parse (avec un .env.staging stub local)**

Run :
```bash
cat > /tmp/.env.staging.test <<'EOF'
DOMAIN=staging.voice.amiral.tech
KYUTAI_LLM_MODEL=anthropic/claude-sonnet-4-6
JWT_SECRET_KEY=stub
GOOGLE_CLIENT_ID=stub
GRADIUM_API_KEY=stub
TTS_VOICE_ID=stub
STT_IS_GRADIUM=true
KYUTAI_STT_URL=wss://test
TTS_IS_GRADIUM=true
TTS_SERVER=test
REDIS_PASSWORD=stub
EOF
docker compose --env-file /tmp/.env.staging.test -f docker-compose.staging.yml config --quiet && echo "OK" || echo "FAIL"
trash /tmp/.env.staging.test
```

Expected: `OK`.

- [ ] **Step 3 : Commit**

```bash
git add docker-compose.staging.yml
git commit -m "feat(staging): add docker-compose.staging.yml for shared-VPS staging

Lite stack (frontend + backend + redis) reusing the prod Traefik via
labels with Host(staging.voice.amiral.tech). Volumes are isolated by
compose project name. No Prometheus/Grafana to keep memory footprint
minimal on the 4 GB ARM64 host."
```

### Task B2 : Créer la branche `staging` depuis `main` et la push

- [ ] **Step 1 : Créer la branche locale et la push**

Run :
```bash
git checkout -b staging
git push -u origin staging
git checkout main
```

Expected: la branche `staging` existe sur `origin` (vérifiable via `gh api repos/louisdv/invincible-voice/branches/staging --jq .name`).

### Task B3 : Setup serveur staging via SSH

- [ ] **Step 1 : Vérifier l'état mémoire avant**

Run : `ssh root@178.105.76.90 'free -h'`

Noter la valeur dans le log (résultat attendu : `available` ≥ 2 GB sur les 4 GB).

- [ ] **Step 2 : Cloner le repo dans `/opt/invincible-voice-staging`**

Run :
```bash
ssh root@178.105.76.90 << 'EOF'
set -e
if [ -d /opt/invincible-voice-staging ]; then
  echo "Already exists — skipping clone"
else
  git clone https://github.com/louisdv/invincible-voice.git /opt/invincible-voice-staging
fi
cd /opt/invincible-voice-staging
git fetch origin
git checkout staging
git pull origin staging
EOF
```

Expected: le clone existe et est sur la branche `staging`.

- [ ] **Step 3 : Backup et création de `.env.staging` à partir de `.env.prod`**

Run :
```bash
ssh root@178.105.76.90 << 'EOF'
set -e
cd /opt/invincible-voice-staging
if [ -f .env.staging ]; then
  cp .env.staging .env.staging.bak.$(date -u +%Y%m%d-%H%M%S)
else
  cp /opt/invincible-voice/.env.prod .env.staging
fi
# Modifier DOMAIN ligne par ligne
sed -i 's|^DOMAIN=.*|DOMAIN=staging.voice.amiral.tech|' .env.staging
# Vérifier
grep '^DOMAIN=' .env.staging
EOF
```

Expected: `DOMAIN=staging.voice.amiral.tech` affiché.

- [ ] **Step 4 : Premier déploiement manuel**

Run :
```bash
ssh root@178.105.76.90 << 'EOF'
set -e
cd /opt/invincible-voice-staging
docker compose -p invincible-voice-staging --env-file .env.staging -f docker-compose.staging.yml up -d --build
docker compose -p invincible-voice-staging -f docker-compose.staging.yml ps
EOF
```

Expected: 3 containers (frontend, backend, redis) en `running`.

- [ ] **Step 5 : Vérifier l'état mémoire après**

Run : `ssh root@178.105.76.90 'free -h && docker stats --no-stream'`

Expected: `available` mémoire ≥ 500 MB. Si < 500 MB, alerter l'utilisateur (proposer désactivation Grafana/Prometheus prod).

- [ ] **Step 6 : Vérifier que le HTTPS répond (cert Let's Encrypt peut prendre 30 s)**

Run :
```bash
sleep 30
curl -sI https://staging.voice.amiral.tech/ | head -5
```

Expected: `HTTP/2 200` (ou redirect 30x). Si `404` ou erreur cert, attendre 60 s de plus et retry — ACME peut prendre du temps au premier coup.

### Task B4 : Documenter staging dans `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1 : Ajouter une section staging avant la section "Serveur prod"**

Insérer après la section "## Serveur prod" (ou à la fin du fichier si plus pratique) :

```markdown
## Staging

- **URL** : https://staging.voice.amiral.tech
- **Serveur** : même VPS que prod (`178.105.76.90`)
- **Répertoire** : `/opt/invincible-voice-staging`
- **Branche** : `staging` (push direct, déployée auto via `.github/workflows/deploy-staging.yml`)
- **Stack** : frontend + backend + redis (pas de Prometheus/Grafana — KISS)
- **Compose project** : `invincible-voice-staging` (volumes isolés de la prod)

### Logs staging
```bash
ssh root@178.105.76.90 'cd /opt/invincible-voice-staging && docker compose -p invincible-voice-staging -f docker-compose.staging.yml logs -f --tail=100'
```

### Forcer un redeploy staging
```bash
ssh root@178.105.76.90 'cd /opt/invincible-voice-staging && git pull origin staging && docker compose -p invincible-voice-staging --env-file .env.staging -f docker-compose.staging.yml up -d --build'
```

### Éditer `.env.staging`
```bash
ssh root@178.105.76.90 'cd /opt/invincible-voice-staging && cp .env.staging .env.staging.bak.$(date -u +%Y%m%d-%H%M%S) && nano .env.staging'
```
```

- [ ] **Step 2 : Commit (sur `main`)**

```bash
git add CLAUDE.md
git commit -m "docs(claude): document staging environment

Document URL, server location, branch, stack composition, and common
operational commands for the staging environment introduced alongside
the Anthropic switch."
```

- [ ] **Step 3 : Mettre la branche `staging` à jour avec ce commit**

```bash
git checkout staging
git merge main --ff-only
git push origin staging
git checkout main
```

### Task B5 : Smoke test staging — ★ ÉTAPE HUMAINE

- [ ] **Step 1 : Demander à l'utilisateur**

Message :
> Va sur **https://staging.voice.amiral.tech** (vérifier que le cert HTTPS est valide). Tente une conversation vocale de 30 s. Reviens avec "OK staging" ou les logs `ssh root@178.105.76.90 'cd /opt/invincible-voice-staging && docker compose -p invincible-voice-staging -f docker-compose.staging.yml logs --tail=80 backend'` en cas de souci.

- [ ] **Step 2 : Sur "OK", passer à C.**

---

## Chantier C — CI prod fix + staging deploy

### Task C1 : Fix `vars.SERVER_HOST` GitHub

- [ ] **Step 1 : Mettre à jour la variable**

Run :
```bash
gh variable set SERVER_HOST -b 178.105.76.90 -R louisdv/invincible-voice
gh variable list -R louisdv/invincible-voice
```

Expected: `SERVER_HOST  178.105.76.90`.

- [ ] **Step 2 : Pas de commit** (changement GitHub only).

### Task C2 : Fix environment dans `deploy-prod.yml`

**Files:**
- Modify: `.github/workflows/deploy-prod.yml:11`

- [ ] **Step 1 : Remplacer `Deploy to prod` par `production`**

Edit :
- old: `    environment: Deploy to prod`
- new: `    environment: production`

- [ ] **Step 2 : Vérifier le diff**

Run: `git diff .github/workflows/deploy-prod.yml`

Expected: une seule ligne changée.

- [ ] **Step 3 : Commit**

```bash
git add .github/workflows/deploy-prod.yml
git commit -m "fix(ci): use production environment without required reviewers

The legacy 'Deploy to prod' environment inherited from the upstream
Kyutai repo has 4 required reviewers from their team, blocking all
deployments on this fork. Switch to the existing 'production'
environment which has no protection rules."
```

### Task C3 : Étendre `lint.yml` à la branche `staging`

**Files:**
- Modify: `.github/workflows/lint.yml`

- [ ] **Step 1 : Ajouter `staging` au trigger push**

Edit :
- old:
  ```
  on:
    pull_request:
    push:
      branches:
        - main
  ```
- new:
  ```
  on:
    pull_request:
    push:
      branches:
        - main
        - staging
  ```

- [ ] **Step 2 : Commit**

```bash
git add .github/workflows/lint.yml
git commit -m "ci(lint): run on push to staging branch

Match the same lint coverage as main so direct pushes to staging
get linted before deployment."
```

### Task C4 : Ajouter `deploy-staging.yml`

**Files:**
- Create: `.github/workflows/deploy-staging.yml`

- [ ] **Step 1 : Créer le fichier**

```yaml
name: Deploy to staging

on:
  push:
    branches: [staging]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ vars.SERVER_HOST }}
          username: root
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/invincible-voice-staging
            git pull origin staging
            docker compose -p invincible-voice-staging --env-file .env.staging -f docker-compose.staging.yml up -d --build
            docker image prune -f
```

- [ ] **Step 2 : Commit**

```bash
git add .github/workflows/deploy-staging.yml
git commit -m "feat(ci): add staging deploy workflow

Trigger on push to staging branch (or manual dispatch). SSH to the
shared prod VPS, pull and rebuild the staging compose project. No
GitHub environment — staging accepts direct pushes."
```

### Task C5 : Synchroniser la branche `staging` avec C2/C3/C4

- [ ] **Step 1 : Merger main dans staging**

```bash
git checkout staging
git merge main --ff-only
git push origin staging
```

Expected: la branche staging contient maintenant les 3 commits CI. **Le push déclenche `lint.yml` (sur staging) ET `deploy-staging.yml`.**

- [ ] **Step 2 : Surveiller le run `deploy-staging.yml`**

Run :
```bash
sleep 5
gh run list -R louisdv/invincible-voice --workflow=deploy-staging.yml --limit 1
RUN_ID=$(gh run list -R louisdv/invincible-voice --workflow=deploy-staging.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch -R louisdv/invincible-voice $RUN_ID
```

Expected: le run termine en succès.

- [ ] **Step 3 : Vérifier que staging répond toujours**

Run: `curl -sI https://staging.voice.amiral.tech/ | head -3`

Expected: `HTTP/2 200`.

- [ ] **Step 4 : Retour sur main**

```bash
git checkout main
```

---

## Chantier D — Bascule prod sur Anthropic

### Task D1 : Backup `.env.prod` côté serveur

- [ ] **Step 1 : Créer une sauvegarde timestampée**

Run :
```bash
ssh root@178.105.76.90 << 'EOF'
set -e
cd /opt/invincible-voice
ts=$(date -u +%Y%m%d-%H%M%S)
cp .env.prod .env.prod.bak.${ts}
echo "Backup: .env.prod.bak.${ts}"
ls -la .env.prod.bak.* | tail -5
EOF
```

Noter le nom exact du backup (à utiliser pour le rollback en cas d'échec).

### Task D2 : Append `ANTHROPIC_API_KEY` et `CEREBRAS_API_KEY` à `.env.prod`

- [ ] **Step 1 : Lire la valeur actuelle de `KYUTAI_LLM_API_KEY` côté serveur**

Run :
```bash
ssh root@178.105.76.90 'cd /opt/invincible-voice && grep "^KYUTAI_LLM_API_KEY=" .env.prod | cut -d= -f2-'
```

Stocker cette valeur (la clé Cerebras `csk-...`) en variable de session locale `CEREBRAS_KEY` (ne pas la committer).

- [ ] **Step 2 : Lire la clé Anthropic depuis `scripts/llm_eval/.env` local**

Run: `Read tool on /Users/louis/claude-local/invincible-voice/scripts/llm_eval/.env` et extraire `ANTHROPIC_API_KEY`. Stocker en variable de session locale `ANTHROPIC_KEY`.

- [ ] **Step 3 : Append les deux clés dans `.env.prod`**

Run (substituer les valeurs au moment de l'exécution) :
```bash
ssh root@178.105.76.90 << EOF
set -e
cd /opt/invincible-voice
if grep -q '^ANTHROPIC_API_KEY=' .env.prod; then
  echo "ANTHROPIC_API_KEY already present — skipping"
else
  cat >> .env.prod << 'INNER'

# Provider-standard keys (added 2026-05-07 — Phase 3 Anthropic switch)
ANTHROPIC_API_KEY=${ANTHROPIC_KEY}
CEREBRAS_API_KEY=${CEREBRAS_KEY}
INNER
fi
grep -E '^(ANTHROPIC_API_KEY|CEREBRAS_API_KEY)=' .env.prod | sed 's/=.*$/=<masked>/'
EOF
```

Expected: les deux clés présentes (valeurs masquées dans le retour).

### Task D3 : Premier deploy CI prod (validation E2E sans changement de comportement)

- [ ] **Step 1 : Créer un commit vide sur main pour déclencher le workflow**

Run :
```bash
git checkout main
git commit --allow-empty -m "chore: trigger CI deploy after prod env vars provisioning"
git push origin main
```

(Commit vide pour éviter tout effet de bord sur le code ou les hooks pre-commit.)

- [ ] **Step 2 : Surveiller le run**

Run :
```bash
sleep 5
RUN_ID=$(gh run list -R louisdv/invincible-voice --workflow=deploy-prod.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch -R louisdv/invincible-voice $RUN_ID
```

Expected: le run termine en succès (~2-3 min).

- [ ] **Step 3 : Vérifier que prod répond toujours**

Run: `curl -sI https://voice.amiral.tech/ | head -3`

Expected: `HTTP/2 200`.

- [ ] **Step 4 : Vérifier les logs backend prod (sanity)**

Run: `ssh root@178.105.76.90 'cd /opt/invincible-voice && docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml logs backend --tail=20'`

Expected: pas de panic, logs normaux. Le modèle dit toujours `cerebras/llama3.1-8b` à ce stade.

### Task D4 : Bascule effective du modèle dans `.env.prod`

- [ ] **Step 1 : Éditer `.env.prod` ligne par ligne**

Run :
```bash
ssh root@178.105.76.90 << 'EOF'
set -e
cd /opt/invincible-voice
# Trois éditions ligne par ligne — pas d'écrasement
sed -i 's|^KYUTAI_LLM_URL=.*|KYUTAI_LLM_URL=|' .env.prod
sed -i 's|^KYUTAI_LLM_MODEL=.*|KYUTAI_LLM_MODEL=anthropic/claude-sonnet-4-6|' .env.prod
sed -i 's|^KYUTAI_LLM_API_KEY=.*|KYUTAI_LLM_API_KEY=|' .env.prod
# Vérification
grep -E '^(KYUTAI_LLM_URL|KYUTAI_LLM_MODEL|KYUTAI_LLM_API_KEY)=' .env.prod
EOF
```

Expected:
```
KYUTAI_LLM_URL=
KYUTAI_LLM_MODEL=anthropic/claude-sonnet-4-6
KYUTAI_LLM_API_KEY=
```

- [ ] **Step 2 : Restart backend uniquement (pas de rebuild — l'image est OK)**

Run :
```bash
ssh root@178.105.76.90 << 'EOF'
set -e
cd /opt/invincible-voice
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d backend
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml logs backend --tail=20
EOF
```

Expected: container `backend` est `running`, logs montrent `INFO     Application startup complete.`. Pas de panic.

### Task D5 : Smoke test conversationnel prod — ★ ÉTAPE HUMAINE

- [ ] **Step 1 : Demander à l'utilisateur**

Message :
> Prod tourne maintenant sur **`anthropic/claude-sonnet-4-6`**. Va sur **https://voice.amiral.tech**, fais une conversation vocale de 30 s avec ton flow habituel. Compare la qualité des suggestions à ce que tu avais avant. Reviens avec :
> - "OK prod" si la qualité est meilleure / au moins équivalente,
> - "KO" + logs si quelque chose plante,
> - "rollback" si tu veux revenir à Cerebras tout de suite (je lance la procédure D6).

### Task D6 : Rollback (uniquement si KO ou rollback demandé)

- [ ] **Step 1 : Restaurer `.env.prod` depuis le backup**

Run (substituer le timestamp du backup créé en D1) :
```bash
ssh root@178.105.76.90 << EOF
set -e
cd /opt/invincible-voice
cp .env.prod.bak.<TIMESTAMP> .env.prod
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d backend
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml logs backend --tail=20
EOF
```

Expected: prod revient à l'état pré-bascule en < 30 s.

- [ ] **Step 2 : Vérifier que prod répond**

Run: `curl -sI https://voice.amiral.tech/ | head -3`

- [ ] **Step 3 : Si rollback effectué, debug avant re-tentative.**

---

## Self-Review

1. **Spec coverage**
   - Chantier A : kyutai_constants optional ✓ (A1, A2), forward env vars docker-compose ✓ (A4), .env.prod.template ✓ (A5), .env local ✓ (A6), tests TDD ✓ (A1+A2), tests régression providers ✓ (A3), smoke test local ✓ (A7).
   - Chantier B : compose staging ✓ (B1), branche staging ✓ (B2), setup serveur ✓ (B3), doc CLAUDE.md ✓ (B4), smoke test staging ✓ (B5).
   - Chantier C : SERVER_HOST fix ✓ (C1), environment fix ✓ (C2), lint étendu ✓ (C3), deploy-staging.yml ✓ (C4), test E2E staging ✓ (C5).
   - Chantier D : backup ✓ (D1), append clés ✓ (D2), test E2E prod sans changement ✓ (D3), bascule modèle ✓ (D4), smoke test prod ✓ (D5), rollback ✓ (D6).
   - **Note** : le smoke test conversationnel prod après chantier C couvre aussi le test E2E `deploy-prod.yml` (D3 = test E2E déguisé).

2. **Placeholder scan** : aucun TBD/TODO/"add error handling" trouvé. Les valeurs de clé API sont substituées au moment de l'exécution par l'agent (cf. A6 step 6, D2 step 3) — c'est explicite et nécessaire (les clés ne peuvent pas être en dur dans le plan).

3. **Type consistency** : nommage cohérent (`-staging` suffix sur tous les routers/services Traefik staging ; `LLM_URL`/`LLM_API_KEY` partout ; `SERVER_HOST` en GitHub variable, pas secret).

4. **Sécurité** :
   - Aucune clé n'est inscrite dans un fichier suivi par git (toutes dans `.env`/`.env.prod`/`.env.staging` gitignored ou inline dans des SSH heredocs).
   - Les `.env*` sont édités ligne par ligne (Edit tool ou `sed -i 's|^KEY=.*|KEY=NEW|'`), jamais écrasés.
   - Backup `.env.prod` avant tout touch en D1.
   - Plan de rollback explicite en D6.
   - `trash` utilisé au lieu de `rm -rf` (cf. B1 step 2).
