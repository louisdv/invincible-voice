# Phase Summary — Planning Sous-Projet 2 (Anthropic switch + Staging + CI)

**Date :** 2026-05-07
**Phase terminée :** Brainstorming + spec + plan d'implémentation pour le Sous-projet 2
**Phase suivante :** Exécution du plan en 4 chantiers (A code → B staging → C CI → D bascule prod)

---

## Vision globale du projet

| # | Sous-projet | Statut |
|-|-|-|
| 1.A | LiteLLM migration (Phase 1 — sous-projet 1) | ✅ Terminée (`phase-1-litellm-migration` + fix `2904a30`) |
| 1.B | Eval harness (Phase 2 — sous-projet 1) | ✅ Terminée (`319dc68` → `6424ce1`) |
| 1.C | Choix du modèle gagnant | ✅ `anthropic/claude-sonnet-4-6` (rapport `scripts/llm_eval/eval_runs/2026-05-07_12-52-29/`) |
| **2** | **Anthropic switch + Staging + CI** | 🟡 **Plan rédigé, exécution à démarrer** |
| 3 | Contextes/scénarios cliquables (UI + storage) | Non démarré |
| 4 | Mémoire long-terme (résumés + RAG) | Non démarré |

Le sous-projet 2 est l'opérationnalisation du modèle gagnant de la Phase 2 + l'outillage qui rend les itérations futures (sous-projets 3 & 4) sûres : env staging HTTPS isolé, CI prod stable, env vars provider standardisées.

---

## Ce qui a été fait dans cette phase

### Décisions prises au brainstorm

| Question | Choix |
|-|-|
| Forme staging | **Sous-domaine `staging.voice.amiral.tech`** sur le **même VPS** (pas un second VPS, pas un path dédié, pas du local-only) ; second compose project, Traefik prod partagé via labels |
| DNS staging | Géré par l'utilisateur, déjà résolu sur `178.105.76.90` (validé `dig`) |
| Stratégie env vars provider | **Back-compat** : on garde `KYUTAI_LLM_API_KEY` legacy si défini ; sinon LiteLLM lit `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`CEREBRAS_API_KEY` standard. Permet le fallback cross-provider sans conflit. |
| Protection branche `staging` | Aucune — push direct |

### Découvertes pendant l'exploration

- **Bug GitHub CI prod** : `vars.SERVER_HOST` (fork `louisdv/invincible-voice`) pointe sur `89.167.5.166` au lieu de `178.105.76.90` (le serveur a été migré au commit `32114ce`). Le workflow `deploy-prod.yml` est donc **actuellement cassé** avant même qu'on touche à Anthropic.
- **Bug GitHub environment** : l'environment `Deploy to prod` hérité de l'upstream Kyutai a 4 required reviewers Kyutai (`gabrieldemarmiesse`, `vvolhejn`, `rfbr`, `ptrckprz`) ; ils ne peuvent pas approuver les déploiements du fork. Solution : passer à l'environment `production` (déjà existant dans le fork, sans protection rules).
- **Problème technique racine du switch Anthropic** : `kyutai_constants.py:29` fait `os.environ["KYUTAI_LLM_URL"]` (crash si absent) ; `llm_utils.py:44` passe systématiquement ce `LLM_URL` à LiteLLM. Avec `https://api.cerebras.ai/v1` ça force LiteLLM à l'utiliser même pour Anthropic (qui n'est pas OpenAI-compatible). Fix : rendre `LLM_URL` et `LLM_API_KEY` optionnels (`os.environ.get(...) or None`).

### Artefacts produits

- `docs/superpowers/specs/2026-05-07-anthropic-switch-staging-and-ci-design.md` — spec validé (commit `82cc929`)
- `docs/superpowers/plans/2026-05-07-anthropic-switch-staging-and-ci.md` — plan 22 tasks en 4 chantiers (commit `2240751`)
- Ce phase summary

---

## Architecture cible (résumé)

### Backend

`kyutai_constants.LLM_URL` et `LLM_API_KEY` deviennent `Optional[str]` (`None` si vide ou absent). `providers.py` filtre déjà `if api_base is not None` / `if api_key is not None` → quand ces vars sont vides, LiteLLM utilise les endpoints provider natifs et lit les env vars standards `ANTHROPIC_API_KEY`/etc. Pas de breaking change : `KYUTAI_LLM_API_KEY` legacy continue à fonctionner s'il est défini.

### Staging

```
voice.amiral.tech (prod)         staging.voice.amiral.tech (staging)
        │                                  │
        └────── Traefik (compose project: invincible-voice) ──────────┐
                ports 80/443, ACME LetsEncrypt                        │
                scanne TOUT le docker daemon → discover labels        │
        ┌────────────────────────────┬─────────────────────────────────┘
        │                            │
   Stack prod                    Stack staging
   /opt/invincible-voice/        /opt/invincible-voice-staging/
   docker compose -p             docker compose -p
   invincible-voice              invincible-voice-staging
   - frontend                    - frontend
   - backend                     - backend
   - redis                       - redis
   - prometheus                  (pas de prom/grafana — KISS)
   - grafana
```

Stack staging "lite" : 3 services seulement, pas de Traefik (réutilise celui de la prod), pas de Prom/Grafana. Volumes nommés auto-préfixés par compose project name → isolation totale par construction.

### CI

- `deploy-prod.yml` : `environment: production` (au lieu de `Deploy to prod` qui bloque), `vars.SERVER_HOST=178.105.76.90` (au lieu de l'IP morte).
- `deploy-staging.yml` (nouveau) : trigger sur push `staging`, SSH même VPS, dans `/opt/invincible-voice-staging`, compose project `invincible-voice-staging`.
- `lint.yml` : étendu à la branche `staging` en plus de `main`.

---

## Plan d'exécution — 22 tasks en 4 chantiers

| Chantier | Tasks | Étapes humaines |
|-|-|-|
| **A — Code Anthropic-compat** | A1 (TDD red), A2 (fix kyutai_constants), A3 (regression tests providers), A4 (compose env vars), A5 (.env.prod.template), A6 (.env local), A7 (smoke local) | A7 (smoke local) |
| **B — Staging infra** | B1 (compose.staging.yml), B2 (branche staging), B3 (setup serveur SSH), B4 (CLAUDE.md), B5 (smoke staging) | B5 (smoke staging) |
| **C — CI** | C1 (SERVER_HOST), C2 (env production), C3 (lint staging), C4 (deploy-staging.yml), C5 (sync staging branch + test E2E) | aucune (tout automatisé) |
| **D — Bascule prod** | D1 (backup .env.prod), D2 (append clés), D3 (CI deploy sans changement), D4 (flip MODEL/URL/API_KEY), D5 (smoke prod), D6 (rollback si KO) | D5 (smoke prod), D6 si rollback |

Discipline TDD localisée sur `kyutai_constants.py` (la vraie nouveauté qui crash aujourd'hui sur env var manquante) ; tests régression sur `providers.py` ajoutés en garde-fou. Plan de rollback explicite en D6 (`cp .env.prod.bak.<timestamp> .env.prod && restart backend`).

---

## Contraintes & rappels importants pour l'exécution

- **CLAUDE.md global** : ne JAMAIS écraser `.env` / `.env.prod`. Toutes les modifs `.env*` se font ligne par ligne (Edit tool ou `sed -i 's|^KEY=.*|KEY=NEW|'`). Backup `.env.prod.bak.YYYYMMDD-HHMMSS` côté serveur **avant** tout touch.
- **CLAUDE.md projet** : KISS, `trash` au lieu de `rm -rf`.
- **API keys** : aucune ne doit être inscrite dans un fichier suivi par git. Sources autorisées : `.env` local (gitignored), `scripts/llm_eval/.env` local (gitignored), `.env.prod` côté serveur (gitignored), `.env.staging` côté serveur (gitignored).
- **Conventional commits anglais** ; un commit par task.
- **Lint** : `cd services/backend && uv run ruff check && uv run ruff format` ; `pnpm lint` côté frontend si touché.
- **Pas de hooks `--no-verify`**.
- **SSH automatique** : ne pas demander à l'utilisateur de coller des commandes SSH. Utiliser `ssh root@178.105.76.90 ...` directement avec heredocs.
- **Mémoire serveur** : Hetzner CAX11 a 4 GB. Vérifier `free -h` avant et après lancement staging. Si `available < 500 MB`, alerter l'utilisateur (proposition : désactiver Grafana/Prometheus prod).

---

## Étapes humaines déléguées explicitement

1. **A7** — Smoke test conversationnel local sur `http://localhost` après chantier A.
2. **B5** — Smoke test conversationnel sur `https://staging.voice.amiral.tech` après chantier B.
3. **C5/D3** — Surveillance des `gh run watch` (l'agent les déclenche, l'utilisateur valide la santé du run).
4. **D5** — Smoke test conversationnel sur `https://voice.amiral.tech` après bascule Anthropic (avec verdict "OK prod" / "KO" / "rollback").

---

## Prompt prêt à coller pour la phase suivante

Pour reprendre dans une nouvelle session :

> Je veux exécuter le plan `docs/superpowers/plans/2026-05-07-anthropic-switch-staging-and-ci.md` (22 tasks en 4 chantiers strictement séquentiels : A code Anthropic-compat → B staging infra → C CI → D bascule prod).
>
> Approche : **subagent-driven** (skill `superpowers:subagent-driven-development`). Dispatche un subagent par task en lui donnant la task complète extraite du plan ; auto mode actif, donc enchaîne sans valider entre tasks **sauf** pour les étapes humaines explicites :
> - A7 (smoke test local après chantier A)
> - B5 (smoke test staging après chantier B)
> - C5/D3 (surveillance des `gh run watch` — l'agent peut les déclencher, mais demande à l'utilisateur de confirmer si le run est vert avant de continuer)
> - D5 (smoke test prod après bascule Anthropic — STOP obligatoire ; sur "rollback" exécuter D6)
>
> État au démarrage : working tree clean, branche `main`. Sous-projet 1 (LLM migration + eval harness) terminé. Spec et plan du sous-projet 2 committés (`82cc929`, `2240751`). Voir `docs/phases/2026-05-07-phase-summary-planning-sous-projet-2.md` pour le détail.
>
> Contraintes à respecter (rappel) :
> - **KISS** — pas d'over-engineering, pas de feature flag, pas d'A/B sur staging.
> - **Ne jamais écraser** `.env` / `.env.prod` / `.env.staging` — toujours lire et append/modify ligne par ligne. Backup timestampé `.env.prod.bak.YYYYMMDD-HHMMSS` côté serveur avant tout touch.
> - **Aucune clé API committée**. Les clés vivent dans `.env*` gitignored ou en variables de session SSH.
> - **Conventional commits anglais**, un par task.
> - **`trash`** au lieu de `rm -rf`.
> - **SSH** : utiliser `ssh root@178.105.76.90 ...` directement, ne pas demander à l'utilisateur de coller des commandes.
> - **Lint** : `cd services/backend && uv run ruff check && uv run ruff format` après chaque modif Python.
> - **Pas de `--no-verify`** sur les commits.
>
> Ressources clés :
> - Spec : `docs/superpowers/specs/2026-05-07-anthropic-switch-staging-and-ci-design.md`
> - Plan : `docs/superpowers/plans/2026-05-07-anthropic-switch-staging-and-ci.md`
> - Phase summary (contexte étendu) : `docs/phases/2026-05-07-phase-summary-planning-sous-projet-2.md`
>
> Démarre par la **Task A1** (tests rouges pour `kyutai_constants.py`).

---

## À surveiller pendant l'exécution

- **Mémoire VPS** : Hetzner CAX11 a 4 GB. Sur les tests B3 step 1 (`free -h` avant) et B3 step 5 (après lancement staging), noter la valeur. Si `available` < 500 MB après staging, alerter l'utilisateur (proposition : désactiver Grafana/Prometheus en prod, ils ne sont pas critiques pour l'app).
- **Cert HTTPS staging** : ACME peut prendre 30–60 s la première fois. B3 step 6 prévoit un `sleep 30` puis retry. Si > 2 min sans succès, vérifier les logs Traefik : `docker logs $(docker ps -q -f name=traefik)`.
- **Bug UX hors-scope** (rappel de la Phase 1) : `services/backend/backend/routes/auth.py:148-153` retourne 401 trompeur quand l'email à enregistrer existe déjà. **À ne pas traiter dans ce sous-projet** ; ticket séparé plus tard.
