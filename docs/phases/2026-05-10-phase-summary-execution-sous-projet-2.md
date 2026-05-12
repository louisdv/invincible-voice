# Phase Summary — Exécution Sous-Projet 2 (Anthropic switch + Staging + CI)

**Date :** 2026-05-10
**Phase terminée :** Exécution complète des 4 chantiers (A code, B staging, C CI, D bascule prod)
**Phase suivante :** Sous-projet 3 (Contextes/scénarios cliquables) — non démarré

---

## Vision globale du projet

| # | Sous-projet | Statut |
|-|-|-|
| 1.A | LiteLLM migration | ✅ Terminée |
| 1.B | Eval harness | ✅ Terminée |
| 1.C | Choix modèle gagnant | ✅ Anthropic Sonnet 4.6 |
| 2 | **Anthropic switch + Staging + CI** | ✅ **Terminée** |
| 3 | Contextes/scénarios cliquables | Non démarré |
| 4 | Mémoire long-terme | Non démarré |

---

## Ce qui a été fait

### Chantier A — Code backend Anthropic-compatible

| # | Commit | Sujet |
|-|-|-|
| A1+A2 | `ec1ca56` | fix(llm): make KYUTAI_LLM_URL and KYUTAI_LLM_API_KEY optional (avec 4 tests TDD) |
| A3 | `5486819` | test(llm): regression tests for api_key/api_base omission |
| A4 | `e8304ac` | chore(compose): forward provider-standard API keys to backend |
| A5 | `59b58a7` | docs(env): document provider-standard API keys in prod template |
| A6 | (.env local édité, gitignored) | Pointage local sur Anthropic |
| A6.5 (hotfix imprévu) | `4b0e839` | fix(llm): enable litellm.modify_params for Anthropic conversation start |

**Bug imprévu trouvé en smoke test local A7 :**
- Anthropic rejetait le tout premier appel avec `BadRequestError - Anthropic requires at least one non-system message`. Au démarrage de conversation, le backend envoie un payload avec uniquement le system prompt (avant que le STT ait produit le premier user message).
- Fix : `litellm.modify_params = True` au chargement de `providers.py`. LiteLLM auto-injecte un user dummy. Même fix que celui déjà présent dans `scripts/llm_eval/run_eval.py` (commit `6424ce1`) — non répliqué dans le backend lors de la Phase 1.
- Test ajouté : `test_modify_params_is_enabled_at_import`.

**Leçon** : un test d'intégration par provider dès la Phase 1 aurait détecté ça (déjà documenté comme leçon Phase 1, à appliquer plus rigoureusement).

### Chantier B — Staging sur même VPS

| # | Commit | Sujet |
|-|-|-|
| B1 | `4be9c18` + `46e0914` (redis version fix) + `d9faf46` (network fix) | feat(staging): add docker-compose.staging.yml |
| B2 | (git-only) | Création branche `staging` + push origin |
| B3 | (SSH-only) | Setup serveur staging (clone + .env.staging + first deploy) |
| B4 | `b2e2736` | docs(claude): document staging environment |

**Bug imprévu pendant chantier C5 (test E2E deploy-staging) :**
- Premier `docker-compose.staging.yml` initial fonctionnait par chance — frontend et backend étaient sur `invincible-voice-staging_default`, Traefik sur `invincible-voice_default`. Les containers étaient uniquement joignables via internal IPs partagées sur le bridge docker0 par hasard.
- Quand le workflow CI a recréé les containers (`up -d --build`), Traefik n'a plus pu les atteindre → 504 timeout en HTTPS externe.
- Fix permanent (`d9faf46`) : déclarer le réseau `invincible-voice_default` en `external` dans `docker-compose.staging.yml` et y attacher explicitement `frontend` et `backend`. `redis` reste sur le réseau staging-privé (Traefik n'a pas besoin de l'atteindre).

**Leçon** : pour partager Traefik entre deux compose projects, il faut **explicitement** déclarer le réseau Traefik en external côté staging — ne pas compter sur le bridge docker0 par défaut.

### Chantier C — CI

| # | Commit | Sujet |
|-|-|-|
| C1 | (gh variable seul) | `vars.SERVER_HOST` : `89.167.5.166` → `178.105.76.90` |
| C2 | `c6b1d1f` | fix(ci): use production environment without required reviewers |
| C3 | `457d954` | ci(lint): run on push to staging branch |
| C4 | `09b9dae` | feat(ci): add staging deploy workflow |
| C5 | (git ops + monitor) | Sync staging branch + test E2E |

**Bug imprévu pendant C5 (premier run deploy-staging E2E) :**
- Le workflow utilise `${{ secrets.SSH_PRIVATE_KEY }}` (clé `github_actions_deploy`). La pub key correspondante n'était pas dans `/root/.ssh/authorized_keys` du nouveau serveur (c'est l'ancien serveur 89.167.5.166 qui l'avait).
- Fix : append `~/.ssh/github_actions_deploy.pub` à `/root/.ssh/authorized_keys` du serveur (3 clés au total maintenant : la clé 1Password "Hetzner Amiral Tech" originale, mon `id_ed25519`, et `github_actions_deploy`).

**Validation E2E** : le run `25607045037` a SSH, pulled, rebuilt, restarted en 8s. Routing préservé. Workflow staging fonctionne.

### Chantier D — Bascule prod sur Anthropic

| # | Commit/Action | Sujet |
|-|-|-|
| D1 | (SSH) | Backup `.env.prod.bak.20260509-172019` |
| D2 | (SSH) | Append `ANTHROPIC_API_KEY` + `CEREBRAS_API_KEY` à `.env.prod` |
| D3 | `2e955c8` (empty commit) | Trigger CI deploy-prod — workflow run `25613732955` succès en 15s |
| D4 | (SSH) | Flip `KYUTAI_LLM_URL=`, `KYUTAI_LLM_MODEL=anthropic/claude-sonnet-4-6`, `KYUTAI_LLM_API_KEY=` + restart backend |
| D5 | (humain) | Smoke test prod validé — "ok prod" |

**Aucun rollback D6 nécessaire.**

---

## État de l'écosystème après ce sous-projet

### Backend
- **Modèle prod** : `anthropic/claude-sonnet-4-6`
- **Fallback prod** : `cerebras/llama3.1-8b` (avec `CEREBRAS_API_KEY` provider-standard, prêt à prendre le relais sur 404/BadRequestError)
- `litellm.modify_params = True` activé au chargement
- Tests : 11/11 passent dans `services/backend/tests/llm/`

### Infra
- **Prod** : `https://voice.amiral.tech` (compose project `invincible-voice`)
- **Staging** : `https://staging.voice.amiral.tech` (compose project `invincible-voice-staging`)
- Même VPS Hetzner CAX11 ARM64. Mémoire observée : ~1.2 GB used, ~2.5 GB available (marge confortable).
- Cert Let's Encrypt valide pour les deux sous-domaines via Traefik partagé.
- Réseau : `invincible-voice_default` (prod, attaché à Traefik), `invincible-voice-staging_default` (staging-privé pour redis), staging frontend/backend dual-attachés.

### CI
- **deploy-prod.yml** : push `main` → SSH → rebuild → restart. Environment GitHub `production` (sans required reviewers). `vars.SERVER_HOST=178.105.76.90`.
- **deploy-staging.yml** : push `staging` → SSH → rebuild → restart. Pas d'environment GitHub.
- **lint.yml** : pull_request + push sur `main` et `staging`.
- ⚠️ **Lint pré-existant cassé** : `pnpm 11.0.9` incompatible avec Node.js 20 (`ERR_UNKNOWN_BUILTIN_MODULE`). Erreur antérieure aux changements de ce sous-projet (visible dès `2026-05-04`). À traiter dans un ticket séparé — bumper le setup-node à v24 (ou downgrader pnpm).

### Branches git
- `main` et `staging` à HEAD `2e955c8`, en sync.
- Tag `phase-2-anthropic-staging-ci` à poser optionnellement (non posé — le user pourra le faire manuellement s'il veut marquer cette étape).

---

## Bugs hors-scope identifiés (à traiter à part)

1. **Lint workflow cassé** : `pnpm 11.0.9` vs Node.js 20. Symptôme : tous les runs de `lint.yml` échouent depuis le 2026-05-04. Fix probable : `node-version: '24'` dans `setup-node` step + `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`. Pas critique tant que le déploiement fonctionne (le workflow Lint et le workflow Deploy sont indépendants).

2. **Bug UX 401 sur register email existant** (rappel Phase 1) : `services/backend/backend/routes/auth.py:148-153` retourne 401 trompeur quand l'email à enregistrer existe déjà. Devrait être 409 + message explicite. Toujours non corrigé.

3. **3 clés dans `/root/.ssh/authorized_keys`** : 1Password "Hetzner Amiral Tech" + `id_ed25519` (Louis) + `github_actions_deploy` (CI). Si la clé 1Password est unique à un agent qui peut être perdu, conserver les autres comme back-up est sain. Pas d'action requise.

4. **Pas de swap configuré sur le VPS** : 4 GB RAM, 0 swap. Si pic mémoire (build + traffic), OOM kill instantané. À envisager (file swap 2 GB) — pas urgent vu la marge confortable observée.

---

## Contraintes respectées

- ✅ Aucune clé API committée (toutes dans `.env*` gitignored ou heredocs SSH éphémères)
- ✅ `.env.prod` jamais écrasé — backup timestampé `bak.20260509-172019` créé avant tout touch
- ✅ `.env` local jamais écrasé — édité ligne par ligne via Edit + append
- ✅ Conventional commits anglais
- ✅ Pas de `--no-verify`, hooks pre-commit respectés
- ✅ `trash` utilisé au lieu de `rm -rf`
- ✅ TDD appliqué sur la nouveauté fonctionnelle (kyutai_constants optional env vars + modify_params)
- ✅ Étapes humaines explicitement déléguées avec instructions précises (A7, B5, D5)

---

## Ce qui reste à faire

### Sous-projet 3 — Contextes/scénarios cliquables

À spécifier après quelques jours d'usage réel d'Anthropic en prod par l'utilisateur final. Si ressenti positif, on attaque le scope suivant : permettre à l'utilisateur de cliquer sur un contexte ("au boulot", "déjeuner avec ma sœur", etc.) pour orienter le LLM.

### Sous-projet 4 — Mémoire long-terme

Plus tard. Dépend de retours sur sous-projet 3.

### Bugs hors-scope listés ci-dessus

À batcher dans une PR de "tech debt cleanup" quand le user le décidera.

---

## Prompt prêt à coller pour la phase suivante (sous-projet 3)

> Je veux démarrer le sous-projet 3 — contextes/scénarios cliquables permettant à l'utilisateur de pré-orienter le LLM via un click rapide ("au boulot", "déjeuner avec ma sœur", "rendez-vous médical", etc.) plutôt que tout exprimer vocalement. Le but : réduire la charge cognitive sur l'utilisateur final et rendre les premières réponses plus pertinentes.
>
> Approche : **brainstorming d'abord** (skill `superpowers:brainstorming`) pour clarifier UX, persistance, et stratégie de prompt. Puis **plan rédigé** (`superpowers:writing-plans`), puis **exécution subagent-driven**.
>
> État au démarrage : sous-projet 2 terminé (Anthropic Sonnet 4.6 en prod, staging fonctionnel sur `https://staging.voice.amiral.tech`, CI prod + staging stabilisée). Tag actuel : pas de tag phase-2 posé. Voir `docs/phases/2026-05-10-phase-summary-execution-sous-projet-2.md` pour le contexte complet.
>
> Premières questions à explorer en brainstorm :
> 1. Combien de contextes par défaut ? Liste fixe ou éditable par l'utilisateur ?
> 2. Persistance : par utilisateur (DB) ou statique (config) ?
> 3. UX : sélecteur en haut de la conversation, ou modal au démarrage ?
> 4. Effet sur le prompt : système prompt augmenté, ou message d'init en début de chat ?
> 5. Multilingue (FR principal, EN/ES/PT/DE secondaires) ?
>
> Spec source attendu : `docs/superpowers/specs/<date>-clickable-contexts-design.md`
> Plan source attendu : `docs/superpowers/plans/<date>-clickable-contexts.md`

---

## Métriques

- **Durée d'exécution** : ~21h calendaires (du 2026-05-09 12:30 au 2026-05-10 11:00 environ), avec pauses humaines pour smoke tests A7/B5/D5
- **Commits** : 16 commits sur main (chantier A: 6, B: 4, C: 3, D: 1 empty, + sync commits)
- **Tests** : 4 nouveaux tests TDD + 3 tests régression = 7 tests (passe de 4 à 11 tests dans `tests/llm/`)
- **Bugs imprévus rencontrés et corrigés** : 3 (modify_params manquant, network staging-Traefik, SSH key serveur)
- **Rollback prod déclenché** : 0
