# Phase Summary — Planning Sous-Projet 1 (LLM upgrade & eval harness)

**Date :** 2026-05-05
**Phase terminée :** Brainstorming + design + plan d'implémentation
**Phase suivante :** Exécution Phase 1 du plan (Migration LiteLLM)

---

## Vision globale du projet

Refonte de l'intelligence d'InvincibleVoice en 3 sous-projets séquentiels :

| # | Sous-projet | Statut |
|-|-|-|
| 1 | **LLM upgrade + eval harness** | Plan rédigé, exécution à démarrer |
| 2 | Contextes/scénarios cliquables (UI + storage) | Non démarré |
| 3 | Mémoire long-terme (résumés + RAG) | Non démarré |

Priorité validée par l'utilisateur : **A > B > C** (LLM, puis contextes, puis mémoire).

## Ce qui a été fait dans cette phase

### Décisions prises

- **Tradeoff latence/qualité** : la latence LLM est absorbée par le temps de lecture/choix de l'utilisateur (3–10s). Une latence de 1–2s est acceptable.
- **Recommandation modèle** : passer de `cerebras/llama3.1-8b` à un modèle plus capable, choix final basé sur un eval reproductible.
- **API uniforme** : adopter LiteLLM pour parler à Cerebras / OpenAI / Anthropic / Groq / Gemini sans coupler le code à un provider unique.
- **Méthode de sélection** : harness d'éval avec scoring automatique (validité JSON, diversité cosine, longueur, latence) + verdict humain final.
- **Budget** : souple, ~€10–30/mois (usage perso d'un ami atteint de SLA qui dépend réellement de l'app).
- **Hors scope explicite** : retry sur JSON malformé (incompatible streaming pur), mode hybride keywords/réponses (uniquement si l'éval le justifie), modifications frontend, fine-tuning, RAG.

### Artefacts produits

- `docs/superpowers/specs/2026-05-05-llm-upgrade-and-eval-harness-design.md` — spec complet (commit `2d19b63`)
- `docs/superpowers/plans/2026-05-05-llm-upgrade-and-eval-harness.md` — plan d'implémentation 17 tasks en 2 phases (commit `43e40a0`)
- Ce document de phase summary

### Contraintes & rappels importants pour la suite

- **CLAUDE.md global** : ne JAMAIS écraser `.env` / `.env.local` / `.env.prod`. Toujours lire d'abord, puis append/modify.
- **CLAUDE.md projet** : KISS, pas de `rm -rf`, pas de `platform: linux/amd64` dans compose.
- **Testing** : il n'existe AUCUN test côté backend aujourd'hui — la première task crée la structure (`tests/__init__.py`, `tests/llm/`).
- **Hooks Claude** : un hook `claude-glance` peut bloquer certaines commandes Bash. Les commits doivent être faits explicitement par l'utilisateur si c'est le cas.

## Ce qui reste à faire

### Phase 1 du plan (exécution)

Tasks 1–9 : migration LiteLLM, sans changement de comportement en prod.

- Task 1 : ajouter `litellm` + `pytest-asyncio` aux deps backend
- Task 2 : structure tests + premier test failing (`test_chat_completion_stream_yields_strings`)
- Task 3 : implémentation minimale de `providers.py`
- Task 4 : test + comportement retry sur rate-limit
- Task 5 : test + fallback de modèle sur 404
- Task 6 : `KYUTAI_LLM_MODEL_FALLBACK` env var
- Task 7 : migration `llm_utils.py` + appelants vers le nouveau wrapper
- Task 8 : `HealthStatus.llm_on_fallback`
- Task 9 : sanity check end-to-end + tag `phase-1-litellm-migration`

### Phase 2 du plan (exécution)

Tasks 10–17 : harness d'éval, run final, choix humain, déploiement.

- Tasks 10–14 : scaffold `scripts/llm_eval/`, corpus, runner, scoring, template rapport
- Task 15 : wirage scoring → rapport
- Task 16 : doc API keys
- Task 17 : run final + choix humain + déploiement

### Sous-projets 2 et 3

À spécifier après la mise en production du modèle gagnant et 1 semaine de feedback utilisateur réel.

---

## Prompt prêt à coller pour la phase suivante

Pour reprendre dans une nouvelle session :

> Je veux exécuter la **Phase 1** du plan `docs/superpowers/plans/2026-05-05-llm-upgrade-and-eval-harness.md` (tasks 1 à 9, migration vers LiteLLM sans changement de comportement en prod).
>
> Approche : **subagent-driven**. Dispatche un subagent par task en lui donnant la task complète extraite du plan ; entre chaque task, montre-moi le diff et attends ma validation avant de passer à la suivante. Si une task échoue, propose une correction au lieu de la poursuivre.
>
> Contraintes à respecter (rappel) :
> - TDD strict — test failing d'abord, implémentation minimale ensuite
> - Ne jamais écraser `.env` / `.env.prod` — toujours lire et append/modify
> - Commits fréquents (un par task ou logique de task)
> - Pas de `rm -rf` ; utiliser `trash` si besoin
> - Lint Python : `ruff check`, format `ruff format`
> - Spec source : `docs/superpowers/specs/2026-05-05-llm-upgrade-and-eval-harness-design.md`
>
> Démarre par la Task 1 (ajout des deps).
