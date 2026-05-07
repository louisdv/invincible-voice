# LLM eval harness

Compare InvincibleVoice LLM candidates on a fixed corpus.

## Usage

```bash
cd scripts/llm_eval
uv sync
# Configure your provider keys in the parent .env (CEREBRAS_API_KEY,
# OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, GEMINI_API_KEY).
uv run python run_eval.py
```

Le rapport est généré dans `eval_runs/<timestamp>/report.md`.

## Configuration

Modifier la liste `MODELS` dans `run_eval.py` pour ajouter/retirer des candidats.
Modifier `corpus.yaml` pour changer les cas testés.
