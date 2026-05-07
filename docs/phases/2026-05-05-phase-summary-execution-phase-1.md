# Phase Summary — Exécution Phase 1 (Migration LiteLLM)

**Date :** 2026-05-05
**Phase terminée :** Exécution Phase 1 du plan LLM upgrade & eval harness (tasks 1–9 + un fix imprévu)
**Phase suivante :** Exécution Phase 2 du plan (eval harness, tasks 10–17)

---

## Vision globale du projet

Refonte de l'intelligence d'InvincibleVoice en 3 sous-projets séquentiels :

| # | Sous-projet | Statut |
|-|-|-|
| 1.A | LiteLLM migration (Phase 1) | ✅ **Terminée** |
| 1.B | Eval harness (Phase 2) | 🟡 Plan rédigé, exécution à démarrer |
| 2 | Contextes/scénarios cliquables (UI + storage) | Non démarré |
| 3 | Mémoire long-terme (résumés + RAG) | Non démarré |

---

## Ce qui a été fait dans cette phase

### Tasks exécutées (subagent-driven, un commit par task)

| # | Commit | Sujet |
|-|-|-|
| 1 | `af7cb3e` | chore(deps): add litellm and pytest-asyncio to backend |
| 2 | `9936718` | test(llm): add failing test for providers.chat_completion_stream |
| 3 | `0ede61b` | feat(llm): add LiteLLM-backed chat_completion_stream wrapper |
| 4 | `d790766` | test(llm): cover rate-limit retry behavior in providers wrapper |
| 5 | `0162337` | test(llm): cover model fallback on NotFoundError in providers wrapper |
| 6 | `a474bce` | feat(llm): introduce KYUTAI_LLM_MODEL_FALLBACK env var |
| 7 | `af4f616` | refactor(llm): migrate VLLMStream to LiteLLM-backed providers wrapper |
| 8 | `473e2bd` | feat(health): expose llm_on_fallback in HealthStatus |
| 9 | (tag uniquement) | tag local `phase-1-litellm-migration` |
| Fix | `2904a30` | fix(llm): forward api_key and api_base to LiteLLM |

### Décisions / écarts par rapport au plan

- **Task 1** : `pytest>=8.3.5` et `pytest-asyncio>=0.26.0` étaient déjà présents dans `[dependency-groups]` dev → seul `litellm>=1.55.0` a été ajouté à `dependencies`. Versions installées : `litellm 1.83.0`.
- **Task 6** : `.env` est gitignored localement → modification appliquée sur disque mais pas commitée (correct, on ne veut pas pousser les secrets). Les fichiers committés sont `kyutai_constants.py` et `.env.prod.template`.
- **Task 7** : J'ai **dropé les imports morts** que le plan listait littéralement (`uuid`, `ora`, `BASE_SYSTEM_PROMPT`, `Conversation`, `LLMMessage`, `SpeakerMessage`, `UserSettings`, `LENGHT_TO_NB_WORDS`) — ils n'étaient utilisés nulle part. `llm_utils.py` est passé de 89 à 44 lignes (-51 %). Le plan était trop bavard, KISS prime.
- **Task 8** : Le plan disait de modifier `main.py`, mais l'instanciation réelle de `HealthStatus` est dans `services/backend/backend/libs/health.py`. C'est là que `llm_on_fallback=False` a été ajouté.
- **Task 9** (tests manuels) : tag posé. Smoke test conversationnel + test fallback laissés à l'utilisateur (microphone requis).

### Bug imprévu trouvé en sanity check

Après les tasks 1–9, l'app retournait une erreur `CerebrasException - Missing credentials` à la première conversation. Cause :
- LiteLLM lit par convention `CEREBRAS_API_KEY` (pas `KYUTAI_LLM_API_KEY`).
- LiteLLM utilise son endpoint Cerebras par défaut, pas `KYUTAI_LLM_URL`.
- Les tests unitaires ne le détectaient pas (mock complet de `litellm.acompletion`).

**Fix (`2904a30`)** : ajout de paramètres optionnels `api_key` et `api_base` à `chat_completion_stream`, propagés depuis `kyutai_constants.LLM_API_KEY` et `LLM_URL` dans `VLLMStream`. Test ajouté pour vérifier le forwarding. Vérification réelle réussie depuis le container : appel Cerebras retourne le JSON schema attendu.

**Leçon pour Phase 2** : tester les providers en mockant n'est PAS suffisant — il faut au minimum un test d'intégration qui appelle un endpoint réel pour valider le câblage des credentials. Pour l'eval harness Phase 2, tous les providers (OpenAI, Anthropic, Groq, Gemini, Cerebras) auront le même genre de piège — soit setter les env vars standards (`OPENAI_API_KEY`, etc.) soit passer `api_key`/`api_base` explicitement par modèle.

### Bug UX repéré mais NON corrigé (à traiter séparément)

`auth.py:148-153` : quand on tente de register avec un email déjà existant, le backend renvoie 401 `"Incorrect username or password"` — message trompeur. Devrait être 409 `"Email already in use"`. Pas critique pour Phase 1, à traiter dans une PR séparée.

---

## État du backend après Phase 1

- **Architecture LLM** : `unmute_handler.py` → `VLLMStream` (dans `llm_utils.py`) → `chat_completion_stream` (dans `providers.py`) → `litellm.acompletion`.
- **Providers supportés via LiteLLM** : Cerebras, OpenAI, Anthropic, Groq, Gemini (et tout ce que litellm ≥ 1.55 supporte).
- **Fallback automatique** : sur `NotFoundError` ou `BadRequestError` du modèle principal, retry une fois avec `KYUTAI_LLM_MODEL_FALLBACK` (défaut : `cerebras/llama3.1-8b`).
- **Retry rate-limit** : exponential backoff 1, 2, 4, 8 secondes.
- **Health endpoint** : `GET /v1/health` renvoie `{stt_up, llm_up, llm_on_fallback, ok}`. Le champ `llm_on_fallback` est exposé mais pas encore alimenté dynamiquement (toujours `False` — câblage prévu plus tard).
- **Env vars** :
  - `KYUTAI_LLM_MODEL` au format LiteLLM `<provider>/<model>` (ex : `cerebras/llama3.1-8b`).
  - `KYUTAI_LLM_MODEL_FALLBACK` (défaut : `cerebras/llama3.1-8b`).
  - `KYUTAI_LLM_API_KEY` + `KYUTAI_LLM_URL` toujours utilisés, propagés explicitement à LiteLLM.
- **Tests** : 4/4 passent dans `services/backend/tests/llm/test_providers.py`.

---

## Ce qui reste à faire — Phase 2 (eval harness, tasks 10–17)

| Task | Sujet | File |
|-|-|-|
| 10 | Scaffold `scripts/llm_eval/` (`pyproject.toml`, `README.md`) | NEW |
| 11 | Corpus YAML (11 cas représentatifs FR/EN/ES, hint, longueurs variables) | NEW |
| 12 | Orchestrateur `run_eval.py` : N runs × M cas × P modèles → JSON bruts | NEW |
| 13 | Scoring : validité JSON, diversité cosine, length-score, latence TTFT/total | NEW |
| 14 | Template Jinja2 du rapport markdown | NEW |
| 15 | Wiring scoring → rapport dans `run_eval.py`, ajout `eval_runs/` au `.gitignore` | MODIFY |
| 16 | Doc API keys dans le README | MODIFY |
| 17 | Run final + choix humain + déploiement (étape humaine) | (manuel) |

**Modèles candidats listés dans le plan** :
- `cerebras/llama3.1-8b` (baseline actuelle)
- `cerebras/llama-3.3-70b`
- `cerebras/qwen-3-235b-a22b-instruct-2507`
- `openai/gpt-5-mini`
- `anthropic/claude-sonnet-4-6`
- `groq/llama-3.3-70b-versatile`
- `gemini/gemini-2.5-flash`

**Pré-requis humain pour Phase 2 task 17** : avoir des API keys valides pour les providers à tester (au minimum Cerebras + OpenAI pour les embeddings de scoring). Sans clé pour un provider, retirer le modèle de la liste `MODELS` dans `run_eval.py`.

### Sous-projets 2 et 3

À spécifier après la mise en production du modèle gagnant (Phase 2 task 17) et 1 semaine de feedback utilisateur réel.

---

## Contraintes & rappels importants pour Phase 2

- **CLAUDE.md global** : ne jamais écraser `.env` / `.env.prod`. Toujours lire d'abord, puis append/modify.
- **CLAUDE.md projet** : KISS, pas de `rm -rf` (utiliser `trash`), pas de `platform: linux/amd64` dans compose.
- **API keys non commitées** : les clés des providers Phase 2 doivent vivre dans `.env` (gitignored) ou être exportées dans le shell, jamais dans le code ni dans `pyproject.toml`.
- **`scripts/llm_eval/eval_runs/`** doit être ajouté au `.gitignore` racine (artefacts locaux).
- **Hot-reload backend** : `services/backend/backend/` est mounted en volume dans `docker-compose.yml` → toute modif Python en local est appliquée sans rebuild. Pratique pour Phase 2 si on touche au backend au passage (mais on ne devrait pas y toucher — eval harness est isolé).

---

## Prompt prêt à coller pour la phase suivante

Pour reprendre dans une nouvelle session :

> Je veux exécuter la **Phase 2** du plan `docs/superpowers/plans/2026-05-05-llm-upgrade-and-eval-harness.md` (tasks 10 à 17, eval harness reproductible permettant de comparer les LLM candidats).
>
> Approche : **subagent-driven**. Dispatche un subagent par task en lui donnant la task complète extraite du plan ; auto mode actif, donc enchaîne sans valider entre tasks sauf pour la task 17 qui est explicitement humaine (run final + choix du modèle gagnant). Si une task échoue, propose une correction.
>
> État au démarrage : Phase 1 est done (tag `phase-1-litellm-migration`, plus le fix `2904a30` pour le forwarding `api_key`/`api_base`). Working tree clean, branche `main`. Voir `docs/phases/2026-05-05-phase-summary-execution-phase-1.md` pour le détail.
>
> Contraintes à respecter (rappel) :
> - KISS — ne pas dupliquer les patterns Phase 1 si le plan ne les demande pas.
> - Ne jamais écraser `.env` / `.env.prod` — toujours lire et append/modify.
> - Commits fréquents (un par task).
> - Pas de `rm -rf` ; utiliser `trash` si besoin.
> - Lint Python : `ruff check`, format `ruff format`.
> - Avant la task 17 (run final), me demander quelles API keys sont disponibles → ajuster `MODELS` dans `run_eval.py` en conséquence.
>
> Spec source : `docs/superpowers/specs/2026-05-05-llm-upgrade-and-eval-harness-design.md`
> Plan source : `docs/superpowers/plans/2026-05-05-llm-upgrade-and-eval-harness.md`
>
> Démarre par la Task 10 (scaffold `scripts/llm_eval/`).

---

## Bug UX hors-scope à traiter à part

Petit ticket pour plus tard : `services/backend/backend/routes/auth.py:148-153` renvoie un message d'erreur trompeur (`"Incorrect username or password"`) quand l'email à enregistrer existe déjà. Devrait être `409 Conflict` avec `"Email already in use"`. Frontend devra peut-être mapper ce nouveau code aussi.
