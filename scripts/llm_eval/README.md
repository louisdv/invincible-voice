# LLM eval harness

Compare InvincibleVoice LLM candidates on a fixed corpus.

## Usage

```bash
cd scripts/llm_eval
uv sync

# Renseigner les API keys dans .env (gitignored, chargé automatiquement) :
#   CEREBRAS_API_KEY=...
#   OPENAI_API_KEY=...        # requis (utilisé pour les embeddings de scoring)
#   ANTHROPIC_API_KEY=...
#   GROQ_API_KEY=...          # optionnel
#   GEMINI_API_KEY=...        # optionnel

uv run python run_eval.py
```

Le rapport est généré dans `eval_runs/<timestamp>/report.md`.
Les artefacts ne sont pas commités (cf. `.gitignore`).

## Configuration

- `MODELS` dans `run_eval.py` : liste des candidats LiteLLM.
- `RUNS_PER_CASE` dans `run_eval.py` : nombre de runs par (modèle × cas) — défaut 5.
- `corpus.yaml` : cas testés, `UserSettings` simulés, hint keywords, longueur attendue.

## Que mesure le harness ?

| Métrique | Description |
|-|-|
| Validité JSON | % des runs où la sortie parse au schéma `{suggested_keywords, suggested_answers}` |
| Diversité sémantique | Cosine distance moyenne entre les 4 réponses, embeddings via `text-embedding-3-small` |
| Length-score | % de réponses dont la longueur est dans la range attendue (`LENGTH_TO_NB_WORDS`) |
| TTFT (ms) | Latence du premier token reçu |
| Total (ms) | Latence end-to-end de la génération |

Le **verdict final reste humain** : c'est un filtre d'exploration, pas un juge.
