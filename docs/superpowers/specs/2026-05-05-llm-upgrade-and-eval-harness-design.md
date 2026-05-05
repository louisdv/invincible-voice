# Sous-projet 1 — LLM upgrade & harness d'éval

**Date :** 2026-05-05
**Statut :** Design validé, prêt pour writing-plans
**Périmètre parent :** Refonte de l'intelligence d'InvincibleVoice (3 sous-projets)

## Contexte

InvincibleVoice est une interface conversationnelle pour utilisateurs souffrant de SLA. Le pipeline est : interlocuteur parle → STT (Gradium) → LLM → 4 réponses suggérées + 10 keywords → l'utilisateur clique → TTS lit la réponse avec sa voix.

Aujourd'hui, le LLM utilisé est `llama3.1-8b` via Cerebras (commit `a03c294`, mars 2026). Sur des relances banales (« comment ça va ? »), le modèle propose des réponses peu variées et mécaniques. Le ressenti de l'utilisateur final (un ami de Louis qui dépend réellement de l'app) est que **l'app n'est pas assez intelligente**.

Trois axes de travail ont été identifiés, par ordre de priorité décidé avec l'utilisateur :

1. **LLM upgrade + harness d'éval** (ce spec)
2. Contextes/scénarios cliquables (spec ultérieur)
3. Mémoire long-terme intelligente (spec ultérieur)

Ce spec couvre **uniquement le sous-projet 1**. Les sous-projets 2 et 3 auront chacun leur propre spec et leur propre cycle d'implémentation.

## Objectif

Que sur des relances banales, l'app propose 4 réponses sémantiquement variées et naturelles, plutôt que des paraphrases du même fond. La latence p95 du premier mot affiché doit rester sous 1.5 s.

## Critères de succès

| Critère | Mesure | Cible |
|-|-|-|
| Diversité sémantique | Cosine distance moyenne entre embeddings des 4 réponses (sur le corpus d'éval) | Hausse significative vs baseline `llama3.1-8b` |
| Validité format | % de sorties JSON valides au schéma `StructuredLLMResponse` | ≥ 99 % |
| Latence TTFT | p95 du premier token, sur le corpus d'éval | < 1.5 s |
| Validation humaine | Sanity check par Louis et son ami sur 1 semaine d'usage réel | Confirmation subjective de qualité |

## Hypothèses & contraintes

- **Budget LLM :** souple, ~€10–30/mois pour usage perso d'un seul utilisateur final.
- **Sortie JSON structurée requise** : tout candidat doit pouvoir produire `{suggested_keywords: list[str], suggested_answers: list[str]}` de manière fiable.
- **Multilingue** : FR, EN, ES, PT, DE (FR principal pour l'utilisateur cible).
- **Temps de lecture/choix de l'utilisateur** : 3–10 s. Ça absorbe une latence LLM jusqu'à ~2 s sans dégrader l'UX, à condition que le streaming progressif (`one.response`, `one.keyword` qui existe déjà) soit préservé.
- **Pas de modification du frontend** dans ce sous-projet.

## Architecture cible

```
services/backend/backend/llm/
├── providers.py          # NEW — wrapper LiteLLM uniformisé
├── llm_utils.py          # MODIFIÉ — utilise providers.py
├── chatbot.py            # inchangé
└── system_prompt.py      # inchangé

scripts/llm_eval/         # NEW — harness d'éval réutilisable
├── corpus.yaml
├── run_eval.py
├── score.py
└── report.md.j2
```

### `providers.py` — wrapper LiteLLM

Une seule fonction publique `chat_completion_stream(messages, model, **kwargs) -> AsyncIterator[str]`.

Sous le capot : `litellm.acompletion(...)` qui parle à Cerebras / OpenAI / Anthropic / Groq / Gemini / DeepSeek via une API uniforme. Gère :

- `response_format=json_schema` natif quand supporté (Cerebras, OpenAI, Gemini)
- Fallback automatique vers `tools=[...]` + `tool_choice` pour Anthropic
- Retry exponential backoff sur rate-limit (1s, 2s, 4s, 8s — préserve le comportement actuel de `llm_utils.py`)
- Fallback de modèle automatique vers `KYUTAI_LLM_MODEL_FALLBACK` si le modèle principal renvoie 404 / model not found

L'env var `KYUTAI_LLM_MODEL` accepte maintenant le format LiteLLM : `cerebras/llama3.1-8b`, `anthropic/claude-sonnet-4-6`, `openai/gpt-5-mini`, etc.

### Mode simple vs hybride

- **Mode simple (par défaut)** : un seul modèle pour keywords + réponses, contrôlé par `KYUTAI_LLM_MODEL`.
- **Mode hybride (opt-in)** : `KYUTAI_KEYWORDS_MODEL` (rapide) + `KYUTAI_RESPONSES_MODEL` (capable), gérés par 2 appels parallèles. Si `KYUTAI_KEYWORDS_MODEL` est vide ou non défini, on retombe sur le mode simple.

Le mode hybride n'est implémenté que si l'éval démontre qu'un seul modèle ne couvre pas bien à la fois "rapide pour keywords" et "intelligent pour réponses longues".

### Harness d'éval (`scripts/llm_eval/`)

**`corpus.yaml`** — ~10 cas typiques en YAML, chacun avec :
- Historique de conversation simulé (liste de `SpeakerMessage` / `WriterMessage`)
- `UserSettings` fictif (nom, prompt système utilisateur, friends, language)
- Hint keyword optionnel
- `desired_responses_length`

Cas inclus minimum :
- « comment ça va ? » sans contexte
- « comment ça va ? » avec hint keyword "fatigué"
- « tu veux qu'on aille au resto ? »
- « j'ai vu ta sœur ce matin »
- Conversation longue (10+ tours) pour stress-test du contexte
- Cas multilingue (EN, ES)
- Cas avec changement de sujet
- Cas avec friend mentionné dans le contexte
- Cas court XS, cas long XL
- Cas avec transcription bruitée (typo STT)

**`run_eval.py`** — pour chaque cas × chaque modèle candidat, génère 5 fois (mesure de stabilité), stocke les sorties JSON brutes dans `eval_runs/<timestamp>/<model>/<case>/run_<n>.json`.

**`score.py`** — scoring automatique :
1. Validité JSON (parse + schéma `StructuredLLMResponse`)
2. Diversité sémantique : cosine distance moyenne entre les 4 réponses, embeddings via `text-embedding-3-small` (OpenAI). Local fallback : `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`.
3. Longueur respectée vs `desired_responses_length` (défini dans `llm_utils.py:LENGHT_TO_NB_WORDS`)
4. Latence TTFT et tokens/sec

**`report.md.j2`** — template Jinja2 produisant un rapport markdown comparatif final dans `eval_runs/<timestamp>/report.md`. Tableau par cas, tableau global, exemples de sorties.

Le verdict qualitatif final reste humain : le score automatique est un **filtre**, pas un juge.

## Modèles candidats à évaluer

| Provider | Modèle (LiteLLM ID) | Pourquoi |
|-|-|-|
| Cerebras | `cerebras/llama3.1-8b` | Baseline (current prod) |
| Cerebras | `cerebras/llama-3.3-70b` | Upgrade in-place, toujours ultra-rapide |
| Cerebras | `cerebras/qwen-3-235b-a22b-instruct-2507` | Le plus intelligent open-weight ; vérifier que la dispo non-preview est levée |
| OpenAI | `openai/gpt-5-mini` | Bon rapport qualité/prix, JSON strict natif |
| Anthropic | `anthropic/claude-sonnet-4-6` | Réputé excellent en français et naturel |
| Groq | `groq/llama-3.3-70b-versatile` | Alternative à Cerebras pour résilience |
| Google | `gemini/gemini-2.5-flash` | Très rapide, très peu cher |

## Data flow

Le frontend ne change pas. Le WebSocket envoie toujours les mêmes messages (`current.keywords`, `desired.responses.length`, `input_audio_buffer.append`, etc.) et reçoit `one.response` / `one.keyword` / `unmute.additional_outputs`. Tout le changement est interne à `services/backend/backend/llm/`.

## Gestion d'erreurs

| Cas | Comportement |
|-|-|
| Rate limit (429) | Retry exponential backoff : 1s, 2s, 4s, 8s |
| 404 / model not found | Log warning + fallback automatique vers `KYUTAI_LLM_MODEL_FALLBACK` (défaut `cerebras/llama3.1-8b`) |
| JSON malformé | Retry 1× avec température légèrement réduite ; sinon yield un objet vide structurellement valide pour ne pas casser le frontend |
| Provider injoignable (timeout) | Même fallback que 404 |

`HealthStatus` (typing.py) étendu pour distinguer "LLM joignable" et "modèle nominal joignable" (vs sur fallback).

## Tests

- **Tests unitaires** : `providers.py` avec mocks LiteLLM. Vérifie :
  - Retry sur rate-limit
  - Fallback de modèle sur 404
  - Conversion `response_format=json_schema` ↔ `tools` selon provider
  - Préservation du streaming
- **Test d'intégration léger** : 1 vrai appel à Cerebras 8B en CI (clé en GitHub secret). Doit se compléter et produire un JSON valide. Pas plus.
- **L'harness d'éval n'est PAS un test** : il tourne à la demande (`uv run python scripts/llm_eval/run_eval.py`), pas en CI.

## Ordre de build

1. **Migration LiteLLM** — `providers.py` + `llm_utils.py` migrés. Modèle inchangé (`cerebras/llama3.1-8b`). L'app continue de marcher exactement pareil. Validation : tous les tests passent, manuel sanity check avec une vraie conversation.
2. **Harness d'éval** — corpus, run_eval, score, report. Validation : produit un rapport markdown lisible.
3. **Décision humaine** — Louis + son ami décident du modèle gagnant sur la base du rapport et d'un sanity check vocal. Ce n'est pas une étape de code.
4. **Déploiement** — `KYUTAI_LLM_MODEL` mis à jour dans `.env.prod`, redéploiement via CI/CD push-to-deploy. Monitoring sur 1 semaine.
5. **(Optionnel)** Mode hybride keywords/responses — uniquement si l'éval le justifie. Implémenté en deuxième plan d'implémentation séparé.

## Hors scope

- Pas de fine-tuning
- Pas de cache LLM (faible hit-rate attendu vu la dépendance au contexte)
- Pas de migration des conversations historiques (sous-projet 3)
- Pas de modification du frontend (sous-projet 2)
- Pas de système de feedback in-app sur la qualité des suggestions
- Pas d'agent / tool use (au-delà du JSON structuré)

## Annexe — Notes sur l'historique

- Le commit `a03c294` (3 mars 2026) a reverté `qwen-3-235b-a22b-instruct-2507` → `llama3.1-8b` car Qwen 235B était en preview avec free-tier rate-limits cassés (404 sur chat completions). Le contexte de mai 2026 doit être re-vérifié dans l'éval, c'est peut-être passé en GA.
- `temperature=1.0` est déjà au max raisonnable côté `llm_utils.py:33` ; le problème de répétitivité ne se résoudra pas en jouant sur la température, il faut un meilleur modèle.
