# Sous-projet — Anthropic switch, staging et CI prod/staging

**Date :** 2026-05-07
**Statut :** Design validé, prêt pour writing-plans
**Périmètre parent :** Suite du Sous-projet 1 (LLM upgrade) — opérationnalisation du modèle gagnant + outillage pour itérer en confiance

## Contexte

L'éval Phase 2 (commits `319dc68` → `6424ce1`, rapport dans `scripts/llm_eval/eval_runs/2026-05-07_12-52-29/report.md`) a tranché : **`anthropic/claude-sonnet-4-6`** est le modèle gagnant pour le pipeline conversationnel d'InvincibleVoice (100 % validité JSON, TTFT 1.2 s, qualité supérieure perçue).

Le backend tourne aujourd'hui en prod sur `cerebras/llama3.1-8b` via la wrapper LiteLLM intégrée en Phase 1. Quatre chantiers dépendants doivent s'enchaîner pour passer en Anthropic en confiance :

1. **A — Code backend Anthropic-compatible** : aujourd'hui `kyutai_constants.py` lit `KYUTAI_LLM_URL` comme obligatoire et le passe systématiquement à LiteLLM. Avec Cerebras (endpoint OpenAI-compatible) ça marche ; avec Anthropic (endpoint propre `/v1/messages`) ça plante. Rendre `LLM_URL`/`LLM_API_KEY` optionnels et forwarder les env vars provider standard.

2. **B — Staging sur le même VPS** : aucun environnement intermédiaire n'existe. Les changements vont directement en prod, ce qui freine l'itération. Sous-domaine `staging.voice.amiral.tech` (DNS déjà pointé sur `178.105.76.90`), même VPS, second compose project.

3. **C — CI** : `vars.SERVER_HOST` (GitHub fork `louisdv/invincible-voice`) pointe sur `89.167.5.166` au lieu de `178.105.76.90` (le serveur a été migré au commit `32114ce`). L'environment GitHub `Deploy to prod` hérité de l'upstream Kyutai a 4 required reviewers Kyutai, ce qui bloque tout déploiement chez nous. Et il manque un workflow staging.

4. **D — Bascule prod sur Anthropic** : opération finale en deux temps (ajout env vars sans changer le modèle, puis bascule du modèle), avec backup et plan de rollback.

## Objectif

À la fin du sous-projet :
- Le backend prod tourne sur `anthropic/claude-sonnet-4-6` avec fallback `cerebras/llama3.1-8b` opérationnel.
- Un environnement staging HTTPS isolé (`staging.voice.amiral.tech`) reçoit la branche `staging` automatiquement à chaque push.
- Le workflow `deploy-prod.yml` est fonctionnel et testé end-to-end.
- Un workflow `deploy-staging.yml` existe et est testé.
- Aucune perte de données prod, aucun écrasement d'env file.

## Décisions cadrées en brainstorm

| Décision | Choix |
|-|-|
| Forme staging | Sous-domaine `staging.voice.amiral.tech`, **même VPS**, second compose project, Traefik prod partagé via labels |
| DNS staging | Géré par l'utilisateur, déjà résolu sur `178.105.76.90` (validé `dig`) |
| Stratégie env vars | **Back-compat** : on garde `KYUTAI_LLM_API_KEY` legacy si défini ; sinon LiteLLM lit `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`CEREBRAS_API_KEY` standard. Permet le fallback cross-provider sans conflit. |
| Protection branche `staging` | Aucune — push direct |

## Critères de succès

| Critère | Mesure |
|-|-|
| Backend prod sur Anthropic | `https://voice.amiral.tech` répond, conversation vocale complète OK, réponses suggérées fluides |
| Fallback opérationnel | Si Anthropic 404, le backend bascule sur Cerebras llama3.1-8b sans panique (vérifié via test unitaire de `_acompletion_with_retry`) |
| Staging HTTPS | `https://staging.voice.amiral.tech` répond avec un certificat Let's Encrypt valide ; isolation totale des volumes/users_data prod |
| CI prod | `deploy-prod.yml` se déclenche sur push `main`, SSH OK, build OK, prod redémarre sans downtime perceptible |
| CI staging | `deploy-staging.yml` se déclenche sur push `staging`, déploie sur `/opt/invincible-voice-staging` |
| Sécurité | Aucune clé API committée ; `.env`, `.env.prod`, `.env.staging` jamais écrasés, toujours édités ligne par ligne |

## Architecture cible

### Chantier A — Switch backend

```
services/backend/backend/
├── kyutai_constants.py     # MODIFIÉ — LLM_URL/LLM_API_KEY optionnels (None si vide)
├── llm/
│   ├── providers.py        # inchangé (gère déjà api_base=None correctement)
│   └── llm_utils.py        # inchangé (relit constants)
└── tests/llm/
    └── test_providers.py   # NEW — vérifie que api_base n'est pas passé si None

docker-compose.yml          # MODIFIÉ — forward ANTHROPIC_API_KEY, OPENAI_API_KEY, CEREBRAS_API_KEY
.env.prod.template          # MODIFIÉ — bloc commenté avec exemples Anthropic + fallback
.env (local, gitignored)    # ÉDITÉ ligne par ligne — pas écrasé
```

**Logique du fix.**

- `kyutai_constants.py` :
  ```python
  LLM_API_KEY = os.environ.get("KYUTAI_LLM_API_KEY") or None
  LLM_URL = os.environ.get("KYUTAI_LLM_URL") or None
  ```
  Le `or None` traite à la fois "absent" et "présent vide".

- `providers.py` n'a pas besoin de modification : il filtre déjà `if api_base is not None` (et idem `api_key`). En passant `None` quand `LLM_URL` est vide, la kwarg n'est plus envoyée à LiteLLM, qui utilise alors l'endpoint natif Anthropic.

- `docker-compose.yml` (service `backend`) ajoute :
  ```yaml
  - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
  - OPENAI_API_KEY=${OPENAI_API_KEY:-}
  - CEREBRAS_API_KEY=${CEREBRAS_API_KEY:-}
  ```
  Quand `KYUTAI_LLM_API_KEY` est absent, LiteLLM lit ces standards de l'environnement directement.

**Stratégie clé en local pour valider Anthropic + fallback Cerebras.**

`.env` (édité ligne par ligne, pas écrasé) :
- `KYUTAI_LLM_URL=` (vide)
- `KYUTAI_LLM_MODEL=anthropic/claude-sonnet-4-6`
- `KYUTAI_LLM_API_KEY=` (vide — laisse Anthropic lire `ANTHROPIC_API_KEY`)
- `KYUTAI_LLM_MODEL_FALLBACK=cerebras/llama3.1-8b`
- ajout `ANTHROPIC_API_KEY=<copiée depuis scripts/llm_eval/.env>`
- ajout `CEREBRAS_API_KEY=<actuel KYUTAI_LLM_API_KEY Cerebras>` pour fallback

**TDD — où le red→green s'applique réellement.**

La vraie nouveauté à tester est le comportement de `kyutai_constants.py` quand `KYUTAI_LLM_URL` est vide ou absent. C'est la modification fonctionnelle qui débloque Anthropic. On y applique la discipline red→green.

Test rouge dans `services/backend/tests/llm/test_kyutai_constants.py` (NEW) :
- `test_llm_url_is_none_when_env_var_empty` : set `os.environ["KYUTAI_LLM_URL"] = ""`, reload le module, asserte `LLM_URL is None`. Échoue actuellement (`os.environ[...]` retourne `""`, et l'affectation ne convertit pas).
- `test_llm_api_key_is_none_when_env_var_empty` : idem pour `LLM_API_KEY`.
- `test_llm_url_is_none_when_env_var_missing` : del de la var, reload, asserte `LLM_URL is None` (ce test fait planter le module aujourd'hui à cause de `os.environ[...]`).

Une fois ces tests rouges, on applique le `or None` dans `kyutai_constants.py` → vert.

Tests additionnels en garde-fou (pas TDD strict, c'est de la couverture de régression) dans `services/backend/tests/llm/test_providers.py` :
- `test_chat_completion_stream_omits_api_base_when_none` : mocke `litellm.acompletion`, appelle avec `api_base=None`, vérifie que `api_base` **n'est pas dans les kwargs** reçus par le mock.
- `test_chat_completion_stream_omits_api_key_when_none` : idem.

Ces deux derniers passent déjà avec la logique en place dans `providers.py:60-66`, mais on les ajoute pour figer le contrat.

**Smoke test (étape humaine déléguée).**

Après tous les commits du chantier A, l'utilisateur :
1. `docker compose up --build`
2. Ouvre `http://localhost`
3. Fait une conversation vocale (10–30 s d'échange)
4. Vérifie qu'au moins 4 réponses suggérées et 10 keywords s'affichent, et qu'elles ne sont pas un message d'erreur
5. Confirme "OK" ou retourne les logs en cas d'échec

### Chantier B — Staging sur même VPS

**Architecture.**

```
voice.amiral.tech (prod)         staging.voice.amiral.tech (staging)
        │                                  │
        └───────── Traefik (compose project: invincible-voice) ─────────┐
                  ports 80/443, ACME LetsEncrypt                        │
                  scanne TOUT le docker daemon → discover labels        │
        ┌──────────────────────────┬───────────────────────────────────┘
        │                          │
   Stack prod                  Stack staging
   /opt/invincible-voice/      /opt/invincible-voice-staging/
   docker compose -p           docker compose -p
   invincible-voice            invincible-voice-staging
   - frontend                  - frontend
   - backend                   - backend
   - redis                     - redis
   - prometheus                (pas de prom/grafana — KISS)
   - grafana
```

**Pourquoi un seul Traefik.** Traefik scanne le docker socket sans filtrer par compose project. En lui exposant des containers staging avec des labels `Host(staging.voice.amiral.tech)`, il route correctement, sans conflit de ports (un seul process tient `:80`/`:443`). L'isolation reste totale : volumes/users_data/redis sont propres au compose project staging.

**Fichier `docker-compose.staging.yml` (NEW, à la racine).**

Stack autonome (n'hérite pas de `docker-compose.yml`) avec uniquement `frontend`, `backend`, `redis`. Mêmes builds (mêmes Dockerfiles `services/frontend/Dockerfile` et `services/backend` target `prod`). Labels Traefik :

```yaml
- "traefik.enable=true"
- "pub_port=80"
- "traefik.http.routers.frontend-staging.rule=Host(`${DOMAIN}`) && PathPrefix(`/`)"
- "traefik.http.routers.frontend-staging.entrypoints=websecure"
- "traefik.http.routers.frontend-staging.tls=true"
- "traefik.http.routers.frontend-staging.tls.certresolver=letsencrypt"
- "traefik.http.routers.frontend-staging.priority=10"
- "traefik.http.services.frontend-staging.loadbalancer.server.port=3000"
```

(Idem pour `backend-staging` avec rule `Host(staging…) && PathPrefix(/api)` et middleware `strip-api-staging` ; nommage suffixe `-staging` pour éviter toute collision avec les routers prod.)

Pas de `letsencrypt:` volume staging (le Traefik prod gère le cert via ACME pour les deux sous-domaines automatiquement).

Volumes staging nommés par compose project → `invincible-voice-staging_users_data`, `invincible-voice-staging_redis_data`. Isolation par construction.

**Sur le serveur (setup initial via Bash SSH).**

```bash
ssh root@178.105.76.90 << 'EOF'
git clone https://github.com/louisdv/invincible-voice.git /opt/invincible-voice-staging
cd /opt/invincible-voice-staging
git checkout staging  # branche créée localement et pushée d'abord
# .env.staging créé via scp ou édité directement ; jamais écrasé
EOF
```

`.env.staging` sur serveur : copie de `.env.prod` avec `DOMAIN=staging.voice.amiral.tech` ; clés API partagées avec prod (KISS, c'est juste de l'isolation infra, pas de l'isolation business).

**Mémoire.**
- Prod observée ≈ 1.5–2 GB RAM
- Staging "lite" (frontend + backend + redis, pas de prom/grafana) ≈ 700 MB–1 GB
- Total estimé ≈ 2.5–3 GB sur 4 GB
- Marge OK ; en cas de pression, désactiver `grafana` + `prometheus` en prod (non-bloquant pour l'app utilisateur)
- Validation : `free -h` sur le serveur avant et après lancement staging, dans le journal d'exécution du plan

**Doc CLAUDE.md.** Bloc ajouté en fin de fichier :

```markdown
## Staging

URL : https://staging.voice.amiral.tech
Serveur : même VPS que prod (178.105.76.90), répertoire `/opt/invincible-voice-staging`
Branche : `staging` (push direct, déploie automatiquement)
Logs : `ssh root@178.105.76.90 'cd /opt/invincible-voice-staging && docker compose -p invincible-voice-staging logs -f --tail=100'`
```

### Chantier C — CI prod fix + staging deploy

**Fix workflow prod.**

1. Mise à jour de la GitHub variable :
   ```bash
   gh variable set SERVER_HOST -b 178.105.76.90 -R louisdv/invincible-voice
   ```
2. `deploy-prod.yml` modifié : `environment: Deploy to prod` → `environment: production` (l'environment `production` existe déjà dans le fork, sans required reviewers).
3. Test E2E : `gh workflow run deploy-prod.yml -R louisdv/invincible-voice` ou push trivial sur `main`. Surveiller via `gh run watch`.

**Nouveau `.github/workflows/deploy-staging.yml`.**

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

Pas d'environment GitHub (pas de protection — KISS, branche staging push-direct).

**`lint.yml` étendu.**

```yaml
push:
  branches: [main, staging]
```

Le `pull_request:` couvre déjà toute base.

### Chantier D — Bascule prod sur Anthropic

Le code en main est déjà compatible (chantier A) ; les workflows CI fonctionnent (chantier C). Il reste à mettre à jour les variables d'environnement prod et redémarrer le backend.

**Procédure (toute en SSH non-interactif depuis le poste local).**

1. Backup : `ssh root@178.105.76.90 'cd /opt/invincible-voice && cp .env.prod .env.prod.bak.$(date -u +%Y%m%d-%H%M%S)'`.
2. Ajout des deux nouvelles env vars (sans toucher MODEL/URL/API_KEY pour l'instant) :
   - `ANTHROPIC_API_KEY=<clé valide depuis scripts/llm_eval/.env local>`
   - `CEREBRAS_API_KEY=<la valeur actuelle de KYUTAI_LLM_API_KEY>`
   Édition ligne par ligne via `ssh ... "cat >> .env.prod <<EOF ..."` (append) ou `sed -i` ciblé.
3. Push trivial sur `main` (ex. : bump de version dans un commentaire) → CI déclenche `deploy-prod.yml` → backend redémarre avec les nouvelles env vars (mais toujours sur Cerebras puisque MODEL inchangé). Surveillance via `gh run watch`.
4. Vérification rapide : `https://voice.amiral.tech` répond, le LLM répond toujours.
5. Bascule effective : éditer `.env.prod` sur serveur ligne par ligne :
   - `KYUTAI_LLM_URL=` (vide)
   - `KYUTAI_LLM_MODEL=anthropic/claude-sonnet-4-6`
   - `KYUTAI_LLM_API_KEY=` (vide — laisse Anthropic lire `ANTHROPIC_API_KEY`)
   - `KYUTAI_LLM_MODEL_FALLBACK=cerebras/llama3.1-8b` (laisse en l'état)
6. Restart backend uniquement : `ssh ... 'cd /opt/invincible-voice && docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d backend'`.
7. ★ Smoke test humain : utilisateur final fait une vraie conversation sur `https://voice.amiral.tech`.

**Plan de rollback.** Si le smoke test 7 est KO :
```
ssh root@178.105.76.90 'cd /opt/invincible-voice && cp .env.prod.bak.<timestamp> .env.prod && docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d backend'
```
Retour exact à l'état pré-bascule en < 30 s.

## Sécurité & garde-fous opérationnels

- **Backup `.env.prod` côté serveur** avant tout touch : `cp .env.prod .env.prod.bak.$(date -u +%Y%m%d-%H%M%S)`.
- **Aucune clé API committée**. Toutes les modifs `.env*` se font ligne par ligne (lecture → edit chirurgical). Les clés Anthropic et Cerebras existent déjà localement (`.env`, `scripts/llm_eval/.env`) et côté serveur dans `.env.prod` ; on les récupère depuis ces sources, jamais on les inscrit en dur dans un fichier suivi.
- **`trash` au lieu de `rm -rf`**.
- **Conventional commits en anglais** (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).
- **Pas de `--no-verify`** sur les commits ; les hooks pre-commit doivent passer.
- **Lint** : `ruff check && ruff format` (Python), `pnpm lint` (frontend) avant chaque commit.

## Ordonnancement

```
A1. Tests red (kyutai_constants) ─→ A2. fix kyutai_constants.py ─→ A3. tests green
                                 ─→ A4. tests régression providers.py
                                 ─→ A5. forward env vars docker-compose.yml
                                 ─→ A6. .env.prod.template
                                 ─→ A7. .env local édité ligne par ligne
                                 ─→ ★ Smoke test humain local
                                                                              │
                                                                              ▼
B0. Créer branche `staging` depuis `main`, push origin
B1. docker-compose.staging.yml ─→ B2. setup serveur (SSH clone + .env.staging)
                              ─→ B3. doc CLAUDE.md
                              ─→ B4. premier déploiement manuel staging
                              ─→ ★ Smoke test humain staging
                                                                              │
                                                                              ▼
C1. fix vars.SERVER_HOST = 178.105.76.90
C2. fix deploy-prod.yml: environment `Deploy to prod` → `production`
C3. extend lint.yml branches main + staging
C4. add deploy-staging.yml
C5. test E2E deploy-staging (push trivial sur branche staging)
                                                                              │
                                                                              ▼
D1. SSH prod : backup .env.prod, ajouter ANTHROPIC_API_KEY + CEREBRAS_API_KEY
D2. test E2E deploy-prod (push trivial sur main, surveiller le run)
D3. SSH prod : éditer .env.prod ligne par ligne (URL vide, MODEL=anthropic/claude-sonnet-4-6, KYUTAI_LLM_API_KEY vide)
D4. SSH prod : redémarrer backend (`docker compose ... up -d backend`)
D5. ★ Smoke test humain prod (https://voice.amiral.tech)
```

**Justification de l'ordre.**
- A → B : on ne fait pas tourner staging avant que le code Anthropic-compatible soit validé localement.
- B → C : on déploie staging manuellement une fois avant d'automatiser, pour ne pas mélanger debug compose et debug CI.
- C → D (chantier final ajouté) : la **bascule prod sur Anthropic** se fait en dernier, en deux temps :
  1. Ajout des nouvelles env vars (ANTHROPIC/CEREBRAS) dans `.env.prod` **sans** changer le modèle. Push code à main → CI déploie. Prod tourne toujours sur Cerebras (rien n'a changé fonctionnellement). Ça valide que la CI fonctionne sans bouger le comportement.
  2. Bascule des variables modèle dans `.env.prod`, restart, smoke test. Si KO, rollback en remettant les anciennes valeurs depuis le `.bak.YYYYMMDD-HHMMSS`.

## Étapes humaines déléguées explicitement

1. **Smoke test conversationnel local** après chantier A (instructions précises données en fin de chantier).
2. **Smoke test conversationnel sur `staging.voice.amiral.tech`** après chantier B (premier deploy manuel).
3. **Surveillance/approbation des `gh run watch`** sur les runs de test E2E (chantier C5 staging et D2 prod).
4. **Smoke test conversationnel prod** après bascule Anthropic (chantier D5).

Toutes les autres étapes (édition fichiers, commits, push, SSH commands non-interactives, `gh variable set`, lecture de logs, edition de `.env.prod` et `.env.staging` côté serveur via SSH non-interactif) sont automatisables et seront exécutées par l'agent.

## Hors-scope

- Pas de feature flag, pas de plateforme A/B testing — staging est un miroir simple.
- Pas de monitoring spécifique staging (Grafana/Prometheus uniquement en prod).
- Pas de migration de données entre prod et staging (staging démarre vide).
- Pas de modification du frontend dans ce sous-projet.
- Pas de promotion automatique staging→prod (le merge `staging`→`main` reste manuel).
