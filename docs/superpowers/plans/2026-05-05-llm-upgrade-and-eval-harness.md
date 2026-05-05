# LLM upgrade & eval harness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrer le backend vers LiteLLM (provider-agnostique) et fournir un harness d'éval reproductible permettant de comparer plusieurs LLM candidats avant de remplacer `cerebras/llama3.1-8b` par un modèle plus capable.

**Architecture:** Phase 1 = wrapper `providers.py` autour de LiteLLM, `llm_utils.py` migré, fallback de modèle automatique, l'app continue de marcher exactement pareil. Phase 2 = `scripts/llm_eval/` autonome qui charge un corpus YAML, appelle N modèles, score (validité JSON, diversité sémantique, latence), produit un rapport markdown. Le choix final du modèle est humain.

**Tech Stack:** Python 3.12, LiteLLM (multi-provider), pytest + pytest-asyncio (TDD), Jinja2 (rapport), PyYAML (corpus), OpenAI embeddings `text-embedding-3-small` (scoring diversité).

**Spec source:** `docs/superpowers/specs/2026-05-05-llm-upgrade-and-eval-harness-design.md`

---

## File structure

**Backend (Phase 1) :**

| Fichier | Statut | Responsabilité |
|-|-|-|
| `services/backend/pyproject.toml` | MODIFY | Ajouter `litellm`, `pytest-asyncio` |
| `services/backend/backend/llm/providers.py` | NEW | Wrapper LiteLLM unique : streaming, retry, fallback de modèle, JSON schema vs tool-use |
| `services/backend/backend/llm/llm_utils.py` | MODIFY | Utiliser `providers.py` au lieu d'`AsyncOpenAI` direct |
| `services/backend/backend/typing.py` | MODIFY | Étendre `HealthStatus` avec `llm_on_fallback: bool` |
| `services/backend/backend/main.py` | MODIFY | Health check renvoie le nouveau champ |
| `services/backend/backend/kyutai_constants.py` | MODIFY | Lire `KYUTAI_LLM_MODEL_FALLBACK` env var |
| `services/backend/tests/__init__.py` | NEW | Marquer le dossier comme package |
| `services/backend/tests/llm/__init__.py` | NEW | Marquer le sous-package |
| `services/backend/tests/llm/test_providers.py` | NEW | Tests unitaires du wrapper LiteLLM |
| `.env.prod.template` | MODIFY | Documenter `KYUTAI_LLM_MODEL_FALLBACK` et le nouveau format de modèle |
| `.env` | MODIFY | Ajouter le format `cerebras/llama3.1-8b` |

**Eval harness (Phase 2) :**

| Fichier | Statut | Responsabilité |
|-|-|-|
| `scripts/llm_eval/pyproject.toml` | NEW | Deps isolées de l'harness (litellm, pyyaml, jinja2, openai) |
| `scripts/llm_eval/corpus.yaml` | NEW | 10 cas typiques avec contexte simulé |
| `scripts/llm_eval/run_eval.py` | NEW | Orchestrateur : pour chaque cas × modèle, génère N runs, stocke JSON |
| `scripts/llm_eval/score.py` | NEW | Calcule validité JSON, diversité (cosine), longueur, latence |
| `scripts/llm_eval/report.md.j2` | NEW | Template Jinja2 du rapport markdown final |
| `scripts/llm_eval/README.md` | NEW | Comment lancer l'harness |

---

# Phase 1 — Migration LiteLLM (l'app reste fonctionnelle, modèle inchangé)

## Task 1 : Ajouter LiteLLM et pytest-asyncio aux dépendances

**Files:**
- Modify: `services/backend/pyproject.toml`

- [ ] **Step 1 : Ajouter les deps**

Modifier la section `dependencies` de `services/backend/pyproject.toml` en ajoutant `"litellm>=1.55.0"` à la liste, et créer une section `[dependency-groups]` (uv conventions) avec les deps de dev. Le fichier final aura :

```toml
dependencies = [
    "fastapi[standard]>=0.115.12",
    "fastrtc==0.0.23",
    "litellm>=1.55.0",
    "mistralai>=1.5.1",
    "msgpack>=1.1.0",
    "msgpack-types>=0.5.0",
    "openai>=1.70.0",
    "plotly>=6.0.1",
    "sphn>=0.2.0",
    "prometheus-fastapi-instrumentator==7.1.0",
    "prometheus-client==0.21.0",
    "ruamel-yaml>=0.18.10",
    "redis>=6.0.0",
    "aiohttp>=3.12.13",
    "humanize>=4.12.3",
    "gradium==0.5.4",
    "pyjwt==2.10.1",
    "pwdlib[argon2]",
    "av==14.0.1",
    "cloudpathlib[s3]>=0.23.0",
]

[dependency-groups]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.24",
]
```

- [ ] **Step 2 : Synchroniser le lockfile**

Run: `cd services/backend && uv sync`
Expected: `uv.lock` mis à jour, pas d'erreur d'installation.

- [ ] **Step 3 : Vérifier que litellm est importable**

Run: `cd services/backend && uv run python -c "import litellm; print(litellm.__version__)"`
Expected: une version >= 1.55.0 affichée.

- [ ] **Step 4 : Commit**

```bash
git add services/backend/pyproject.toml services/backend/uv.lock
git commit -m "chore(deps): add litellm and pytest-asyncio to backend"
```

---

## Task 2 : Squelette tests + premier test failing pour `chat_completion_stream`

**Files:**
- Create: `services/backend/tests/__init__.py`
- Create: `services/backend/tests/llm/__init__.py`
- Create: `services/backend/tests/llm/test_providers.py`

- [ ] **Step 1 : Créer les `__init__.py` vides**

Create `services/backend/tests/__init__.py` (empty file).
Create `services/backend/tests/llm/__init__.py` (empty file).

- [ ] **Step 2 : Écrire le test failing**

Create `services/backend/tests/llm/test_providers.py` :

```python
"""Unit tests for the LiteLLM provider wrapper."""

from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_chat_completion_stream_yields_strings():
    """The wrapper must yield string content chunks from a stream."""
    from backend.llm.providers import chat_completion_stream

    fake_chunks = [
        type("Chunk", (), {"choices": [type("C", (), {"delta": type("D", (), {"content": "Hel"})()})()]})(),
        type("Chunk", (), {"choices": [type("C", (), {"delta": type("D", (), {"content": "lo"})()})()]})(),
    ]

    async def fake_stream():
        for c in fake_chunks:
            yield c

    with patch("backend.llm.providers.litellm.acompletion", new=AsyncMock(return_value=fake_stream())):
        result = []
        async for piece in chat_completion_stream(
            messages=[{"role": "user", "content": "hi"}],
            model="cerebras/llama3.1-8b",
        ):
            result.append(piece)

    assert result == ["Hel", "lo"]
```

- [ ] **Step 3 : Lancer le test pour vérifier qu'il fail**

Run: `cd services/backend && uv run pytest tests/llm/test_providers.py -v`
Expected: FAIL avec `ModuleNotFoundError: No module named 'backend.llm.providers'`.

- [ ] **Step 4 : Commit (test rouge)**

```bash
git add services/backend/tests/
git commit -m "test(llm): add failing test for providers.chat_completion_stream"
```

---

## Task 3 : Implémentation minimale de `providers.py` (mode happy path)

**Files:**
- Create: `services/backend/backend/llm/providers.py`

- [ ] **Step 1 : Créer la fonction minimale**

Create `services/backend/backend/llm/providers.py` :

```python
"""Provider-agnostic LLM wrapper using LiteLLM.

Handles streaming chat completions across Cerebras, OpenAI, Anthropic, Groq,
Gemini and others through a single API. The legacy `AsyncOpenAI` client used
in `llm_utils.py` is replaced by this module.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, AsyncIterator

import litellm

logger = logging.getLogger(__name__)


async def chat_completion_stream(
    messages: list[dict[str, Any]],
    model: str,
    *,
    temperature: float = 1.0,
    response_format: dict[str, Any] | None = None,
    fallback_model: str | None = None,
) -> AsyncIterator[str]:
    """Yield text chunks from an LLM streaming chat completion.

    Args:
        messages: OpenAI-style chat messages.
        model: LiteLLM model identifier (e.g. ``cerebras/llama3.1-8b``).
        temperature: Sampling temperature.
        response_format: Optional ``{"type": "json_schema", ...}`` dict. Passed
            through to LiteLLM, which forwards to providers that support it
            and converts to tool-use for Anthropic transparently.
        fallback_model: If set and the primary model fails with a non-retryable
            error (e.g. 404 / model not found), retry once with this model.

    Yields:
        Successive text chunks from ``delta.content``.
    """
    kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": True,
        "temperature": temperature,
    }
    if response_format is not None:
        kwargs["response_format"] = response_format

    stream = await _acompletion_with_retry(kwargs, fallback_model)
    async for chunk in stream:
        if not chunk.choices:
            continue
        content = chunk.choices[0].delta.content
        if content is None:
            continue
        yield content


async def _acompletion_with_retry(
    kwargs: dict[str, Any],
    fallback_model: str | None,
) -> AsyncIterator[Any]:
    """Call litellm.acompletion with rate-limit backoff and model fallback."""
    last_exc: Exception | None = None
    for delay in (1, 2, 4, 8):
        try:
            return await litellm.acompletion(**kwargs)
        except litellm.RateLimitError as e:
            logger.warning("Rate limit hit, retrying in %ss. Error: %s", delay, e)
            last_exc = e
            await asyncio.sleep(delay)
        except (litellm.NotFoundError, litellm.BadRequestError) as e:
            if fallback_model is None or kwargs["model"] == fallback_model:
                raise
            logger.warning(
                "Model %s unavailable (%s), falling back to %s",
                kwargs["model"],
                e,
                fallback_model,
            )
            kwargs["model"] = fallback_model
            return await litellm.acompletion(**kwargs)

    raise RuntimeError(
        f"Failed to get response from LLM after retries; last error: {last_exc}"
    )
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il passe**

Run: `cd services/backend && uv run pytest tests/llm/test_providers.py::test_chat_completion_stream_yields_strings -v`
Expected: PASS.

- [ ] **Step 3 : Commit**

```bash
git add services/backend/backend/llm/providers.py
git commit -m "feat(llm): add LiteLLM-backed chat_completion_stream wrapper"
```

---

## Task 4 : Test + implémentation du retry sur rate-limit

**Files:**
- Modify: `services/backend/tests/llm/test_providers.py`

- [ ] **Step 1 : Ajouter le test failing**

Append to `services/backend/tests/llm/test_providers.py` :

```python
@pytest.mark.asyncio
async def test_chat_completion_stream_retries_on_rate_limit():
    """The wrapper must retry on RateLimitError before giving up."""
    from backend.llm.providers import chat_completion_stream
    import litellm

    fake_chunk = type(
        "Chunk", (), {"choices": [type("C", (), {"delta": type("D", (), {"content": "ok"})()})()]}
    )()

    async def fake_stream():
        yield fake_chunk

    call_count = {"n": 0}

    async def flaky_acompletion(**kwargs):
        call_count["n"] += 1
        if call_count["n"] == 1:
            raise litellm.RateLimitError("slow down", model="cerebras/llama3.1-8b", llm_provider="cerebras")
        return fake_stream()

    with (
        patch("backend.llm.providers.litellm.acompletion", new=flaky_acompletion),
        patch("backend.llm.providers.asyncio.sleep", new=AsyncMock()),  # skip real sleep
    ):
        result = []
        async for piece in chat_completion_stream(
            messages=[{"role": "user", "content": "hi"}],
            model="cerebras/llama3.1-8b",
        ):
            result.append(piece)

    assert result == ["ok"]
    assert call_count["n"] == 2
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il passe**

L'implémentation gère déjà ce cas (retry boucle `for delay in (1, 2, 4, 8)`). Le test doit déjà passer.

Run: `cd services/backend && uv run pytest tests/llm/test_providers.py::test_chat_completion_stream_retries_on_rate_limit -v`
Expected: PASS.

- [ ] **Step 3 : Commit**

```bash
git add services/backend/tests/llm/test_providers.py
git commit -m "test(llm): cover rate-limit retry behavior in providers wrapper"
```

---

## Task 5 : Test + comportement de fallback de modèle sur 404

**Files:**
- Modify: `services/backend/tests/llm/test_providers.py`

- [ ] **Step 1 : Ajouter le test failing**

Append to `services/backend/tests/llm/test_providers.py` :

```python
@pytest.mark.asyncio
async def test_chat_completion_stream_falls_back_on_not_found():
    """If the primary model 404s and a fallback is given, retry with fallback."""
    from backend.llm.providers import chat_completion_stream
    import litellm

    fake_chunk = type(
        "Chunk", (), {"choices": [type("C", (), {"delta": type("D", (), {"content": "fb"})()})()]}
    )()

    async def fake_stream():
        yield fake_chunk

    seen_models: list[str] = []

    async def acompletion(**kwargs):
        seen_models.append(kwargs["model"])
        if kwargs["model"] == "cerebras/qwen-3-235b":
            raise litellm.NotFoundError(
                "model not found", model=kwargs["model"], llm_provider="cerebras"
            )
        return fake_stream()

    with patch("backend.llm.providers.litellm.acompletion", new=acompletion):
        result = []
        async for piece in chat_completion_stream(
            messages=[{"role": "user", "content": "hi"}],
            model="cerebras/qwen-3-235b",
            fallback_model="cerebras/llama3.1-8b",
        ):
            result.append(piece)

    assert result == ["fb"]
    assert seen_models == ["cerebras/qwen-3-235b", "cerebras/llama3.1-8b"]
```

- [ ] **Step 2 : Lancer le test**

Run: `cd services/backend && uv run pytest tests/llm/test_providers.py::test_chat_completion_stream_falls_back_on_not_found -v`
Expected: PASS (l'implémentation gère déjà via le `except (NotFoundError, BadRequestError)`).

- [ ] **Step 3 : Commit**

```bash
git add services/backend/tests/llm/test_providers.py
git commit -m "test(llm): cover model fallback on NotFoundError in providers wrapper"
```

---

## Task 6 : Ajouter `LLM_MODEL_FALLBACK` aux constants et `.env`

**Files:**
- Modify: `services/backend/backend/kyutai_constants.py`
- Modify: `.env` (ajouter la nouvelle variable, ne pas écraser le reste)
- Modify: `.env.prod.template`

- [ ] **Step 1 : Lire `.env` actuel pour préserver son contenu**

Run: `cat .env`
Note tout ce qui est présent — il NE FAUT PAS l'écraser (cf. CLAUDE.md global).

- [ ] **Step 2 : Modifier `kyutai_constants.py`**

Trouver la ligne ``LLM_MODEL = os.environ["KYUTAI_LLM_MODEL"]`` dans `services/backend/backend/kyutai_constants.py:30` et la remplacer par :

```python
LLM_MODEL = os.environ["KYUTAI_LLM_MODEL"]
LLM_MODEL_FALLBACK = os.environ.get("KYUTAI_LLM_MODEL_FALLBACK") or "cerebras/llama3.1-8b"
```

- [ ] **Step 3 : Mettre à jour `.env` (sans écraser)**

Ouvrir `.env`, lire son contenu, ajouter ces deux lignes à la fin (ou modifier la valeur existante de `KYUTAI_LLM_MODEL`) :

```
# Modèle LiteLLM principal (format provider/model)
KYUTAI_LLM_MODEL=cerebras/llama3.1-8b
# Modèle utilisé en fallback automatique si le principal renvoie 404
KYUTAI_LLM_MODEL_FALLBACK=cerebras/llama3.1-8b
```

Si `KYUTAI_LLM_MODEL` existait déjà avec la valeur `llama3.1-8b`, la remplacer par `cerebras/llama3.1-8b` (préfixe provider).

- [ ] **Step 4 : Mettre à jour `.env.prod.template`**

Modifier `.env.prod.template:7` pour passer au format LiteLLM, et ajouter le fallback :

```diff
 KYUTAI_LLM_URL=https://api.cerebras.ai/v1
-KYUTAI_LLM_MODEL=llama3.1-8b
+# Format LiteLLM: <provider>/<model>. Exemples:
+#   cerebras/llama3.1-8b, cerebras/qwen-3-235b-a22b-instruct-2507,
+#   anthropic/claude-sonnet-4-6, openai/gpt-5-mini, gemini/gemini-2.5-flash
+KYUTAI_LLM_MODEL=cerebras/llama3.1-8b
+# Modèle utilisé en fallback si KYUTAI_LLM_MODEL est indisponible (404)
+KYUTAI_LLM_MODEL_FALLBACK=cerebras/llama3.1-8b
 KYUTAI_LLM_API_KEY=
```

- [ ] **Step 5 : Commit**

```bash
git add services/backend/backend/kyutai_constants.py .env .env.prod.template
git commit -m "feat(llm): introduce KYUTAI_LLM_MODEL_FALLBACK env var"
```

---

## Task 7 : Migrer `llm_utils.py` vers le wrapper providers

**Files:**
- Modify: `services/backend/backend/llm/llm_utils.py`

- [ ] **Step 1 : Réécrire `VLLMStream` pour utiliser `providers.chat_completion_stream`**

Modifier `services/backend/backend/llm/llm_utils.py`. Remplacer le bloc `def get_openai_client`, la classe `VLLMStream` et tout son contenu par :

```python
import logging
import uuid
from typing import AsyncIterator, Literal

import pydantic

from backend import kyutai_constants
from backend import openai_realtime_api_events as ora
from backend.llm.providers import chat_completion_stream
from backend.llm.system_prompt import BASE_SYSTEM_PROMPT
from backend.typing import Conversation, LLMMessage, SpeakerMessage, UserSettings

logger = logging.getLogger(__name__)


LENGHT_TO_NB_WORDS = {
    "XS": (1, 5),
    "S": (3, 10),
    "M": (5, 15),
    "L": (8, 20),
    "XL": (12, 25),
}


class StructuredLLMResponse(pydantic.BaseModel):
    suggested_keywords: list[str]
    suggested_answers: list[str]


class VLLMStream:
    """Streams structured LLM completions through the LiteLLM wrapper."""

    def __init__(self, temperature: float = 1.0):
        self.model = kyutai_constants.LLM_MODEL
        self.fallback_model = kyutai_constants.LLM_MODEL_FALLBACK
        self.temperature = temperature

    async def chat_completion(
        self, messages: list[dict[str, str]]
    ) -> AsyncIterator[str]:
        response_format = {
            "type": "json_schema",
            "json_schema": {
                "name": "response_suggestion",
                "strict": True,
                "schema": StructuredLLMResponse.model_json_schema(),
            },
        }
        logger.info("Starting LLM stream with model %s", self.model)
        async for chunk in chat_completion_stream(
            messages=messages,
            model=self.model,
            temperature=self.temperature,
            response_format=response_format,
            fallback_model=self.fallback_model,
        ):
            yield chunk
```

Conserver intact la suite du fichier (`UserData`, `to_llm_ready_conversation`, etc.) qui n'utilisait pas `VLLMStream` directement.

- [ ] **Step 2 : Vérifier les call sites de `VLLMStream` et `get_openai_client`**

Run: `grep -rn "VLLMStream\|get_openai_client" services/backend/backend/`
Expected output : repérer tous les usages. Si un appelant fait `VLLMStream(client=..., temperature=...)`, le mettre à jour pour ne plus passer le client.

- [ ] **Step 3 : Mettre à jour les call sites**

Pour chaque ligne où `VLLMStream` est instancié avec un `client=`, retirer cet argument. Pour chaque appel `get_openai_client()`, supprimer l'import et l'appel.

Exemple typique (dans `unmute_handler.py` probablement) :

```diff
- client = get_openai_client()
- stream = VLLMStream(client=client, temperature=1.0)
+ stream = VLLMStream(temperature=1.0)
```

- [ ] **Step 4 : Lancer la suite de tests**

Run: `cd services/backend && uv run pytest tests/ -v`
Expected: tous les tests passent.

- [ ] **Step 5 : Lancer le linter**

Run: `cd services/backend && uv run ruff check backend/llm/`
Expected: pas d'erreur (ou seulement les ignorées par config).

- [ ] **Step 6 : Sanity check end-to-end manuel**

Run: `docker compose up --build` puis ouvrir `http://localhost`, lancer une conversation courte, vérifier que les 4 réponses + 10 keywords arrivent normalement.

Si tout marche : continuer. Sinon, debugger avant de commit.

- [ ] **Step 7 : Commit**

```bash
git add services/backend/backend/llm/llm_utils.py services/backend/backend/unmute_handler.py
git commit -m "refactor(llm): migrate VLLMStream to LiteLLM-backed providers wrapper"
```

(Adapter la liste de fichiers staged selon ce que `grep` a montré à l'étape 2.)

---

## Task 8 : Étendre `HealthStatus` pour signaler le mode fallback

**Files:**
- Modify: `services/backend/backend/typing.py`
- Modify: `services/backend/backend/main.py`

- [ ] **Step 1 : Étendre le modèle `HealthStatus`**

Modifier `services/backend/backend/typing.py:45-53` :

```python
class HealthStatus(pydantic.BaseModel):
    stt_up: bool
    llm_up: bool
    llm_on_fallback: bool = False  # True si on tourne sur LLM_MODEL_FALLBACK

    @computed_field
    @property
    def ok(self) -> bool:
        return self.stt_up and self.llm_up
```

- [ ] **Step 2 : Vérifier l'usage de `HealthStatus` dans `main.py`**

Run: `grep -n "HealthStatus\|llm_up\|stt_up" services/backend/backend/main.py`
Expected: localiser le handler `/v1/health` et où `HealthStatus` est instancié.

- [ ] **Step 3 : Ajouter `llm_on_fallback` à l'instanciation**

Dans le handler de `/v1/health` (`main.py`), passer `llm_on_fallback=False` lors de l'instanciation initiale (la détection réelle d'état "fallback" est hors scope ici — c'est juste l'attribut qui devient lisible côté frontend).

- [ ] **Step 4 : Lancer la suite de tests**

Run: `cd services/backend && uv run pytest tests/ -v`
Expected: PASS.

- [ ] **Step 5 : Lancer le serveur et vérifier l'endpoint**

Run: `cd services/backend && uv run uvicorn backend.main:app --port 8081 &`
Run: `curl http://localhost:8081/v1/health`
Expected: JSON avec `"llm_on_fallback": false`.
Run: `kill %1` pour stopper.

- [ ] **Step 6 : Commit**

```bash
git add services/backend/backend/typing.py services/backend/backend/main.py
git commit -m "feat(health): expose llm_on_fallback in HealthStatus"
```

---

## Task 9 : Sanity check de la phase 1 et tag de validation

**Files:** aucun (juste vérification)

- [ ] **Step 1 : Lancer la stack complète**

Run: `docker compose up --build`
Attendre que tous les services soient healthy.

- [ ] **Step 2 : Test conversationnel manuel**

Ouvrir `http://localhost`, démarrer une conversation, dire « comment ça va ? », vérifier que :
- 10 keywords s'affichent en streaming
- 4 réponses s'affichent
- Pas d'erreur dans `docker compose logs backend`
- Le format JSON sortant n'a pas changé

- [ ] **Step 3 : Test du fallback**

Modifier temporairement `.env` : `KYUTAI_LLM_MODEL=cerebras/inexistent-model-xyz`. Redémarrer le backend (`docker compose restart backend`). Lancer une conversation. Vérifier dans les logs qu'on voit le warning `Model cerebras/inexistent-model-xyz unavailable (...) falling back to cerebras/llama3.1-8b` et que la conversation marche quand même.

Remettre `.env` à sa valeur normale après le test.

- [ ] **Step 4 : Tag git de fin de phase 1**

```bash
git tag phase-1-litellm-migration
```

(Pas besoin de commit ici, juste un tag local.)

---

# Phase 2 — Harness d'évaluation

## Task 10 : Initialiser `scripts/llm_eval/` avec ses dépendances isolées

**Files:**
- Create: `scripts/llm_eval/pyproject.toml`
- Create: `scripts/llm_eval/README.md`

- [ ] **Step 1 : Créer le pyproject**

Create `scripts/llm_eval/pyproject.toml` :

```toml
[project]
name = "llm-eval"
version = "0.1.0"
description = "InvincibleVoice LLM evaluation harness"
requires-python = ">=3.12"
dependencies = [
    "litellm>=1.55.0",
    "openai>=1.70.0",
    "pyyaml>=6.0",
    "jinja2>=3.1",
    "humanize>=4.12",
    "pydantic>=2.0",
]

[build-system]
requires = ["setuptools >= 77.0.3"]
build-backend = "setuptools.build_meta"
```

- [ ] **Step 2 : Créer le README**

Create `scripts/llm_eval/README.md` :

```markdown
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
```

- [ ] **Step 3 : Synchroniser les deps**

Run: `cd scripts/llm_eval && uv sync`
Expected: lockfile créé, pas d'erreur.

- [ ] **Step 4 : Commit**

```bash
git add scripts/llm_eval/pyproject.toml scripts/llm_eval/README.md scripts/llm_eval/uv.lock
git commit -m "chore(eval): scaffold scripts/llm_eval package"
```

---

## Task 11 : Définir le corpus YAML

**Files:**
- Create: `scripts/llm_eval/corpus.yaml`

- [ ] **Step 1 : Créer le fichier**

Create `scripts/llm_eval/corpus.yaml` :

```yaml
# 10 cas typiques pour évaluer les LLM candidats.
# Chaque cas simule un état au moment où le LLM est appelé.

user_settings:
  name: "Pierre"
  prompt: |
    Je suis Pierre, j'ai 52 ans, je vis avec ma femme Marie et notre fils Lucas.
    Je suis atteint de la SLA et je communique grâce à cette application.
  friends: ["Marie", "Lucas", "Sophie", "Antoine"]
  language: "fr"

cases:
  - id: "comment_ca_va_no_context"
    desired_length: "M"
    hint: null
    history:
      - role: speaker
        content: "Coucou Pierre, comment ça va aujourd'hui ?"

  - id: "comment_ca_va_with_hint"
    desired_length: "M"
    hint: "fatigué"
    history:
      - role: speaker
        content: "Coucou Pierre, comment ça va aujourd'hui ?"

  - id: "resto_invitation"
    desired_length: "M"
    hint: null
    history:
      - role: speaker
        content: "Tu veux qu'on aille au resto ce soir ?"

  - id: "soeur_news"
    desired_length: "M"
    hint: null
    history:
      - role: speaker
        content: "J'ai vu ta sœur Sophie ce matin, elle m'a dit qu'elle passerait dimanche."

  - id: "long_conversation"
    desired_length: "M"
    hint: null
    history:
      - role: speaker
        content: "Bonjour, alors ce week-end ?"
      - role: writer
        content: "Très bien, on a fait du jardinage avec Marie."
      - role: speaker
        content: "Vous avez planté quoi ?"
      - role: writer
        content: "Des tomates, du basilic, et quelques fleurs."
      - role: speaker
        content: "Ça donne envie. Et Lucas, il aide ?"
      - role: writer
        content: "Un peu. Il préfère arroser que désherber."
      - role: speaker
        content: "Et toi tu te sens comment depuis la semaine dernière ?"

  - id: "english_case"
    desired_length: "M"
    hint: null
    history:
      - role: speaker
        content: "Hi Pierre, how was your day?"

  - id: "spanish_case"
    desired_length: "M"
    hint: null
    history:
      - role: speaker
        content: "Hola Pierre, ¿qué tal estás?"

  - id: "topic_change"
    desired_length: "M"
    hint: "vacances"
    history:
      - role: speaker
        content: "C'était chaud aujourd'hui à la pharmacie, j'ai attendu 30 min."

  - id: "very_short"
    desired_length: "XS"
    hint: null
    history:
      - role: speaker
        content: "Tu veux du café ?"

  - id: "very_long"
    desired_length: "XL"
    hint: null
    history:
      - role: speaker
        content: "Raconte-moi un peu tes souvenirs d'enfance, tes vacances en bord de mer."

  - id: "stt_typo"
    desired_length: "M"
    hint: null
    history:
      - role: speaker
        content: "Lucas rentre en classe de CO2 cette année, c'est ça ?"
```

- [ ] **Step 2 : Vérifier que le YAML parse correctement**

Run: `cd scripts/llm_eval && uv run python -c "import yaml; print(len(yaml.safe_load(open('corpus.yaml'))['cases']))"`
Expected: `11` (11 cas).

- [ ] **Step 3 : Commit**

```bash
git add scripts/llm_eval/corpus.yaml
git commit -m "feat(eval): add corpus of 11 typical conversation cases"
```

---

## Task 12 : Implémenter `run_eval.py`

**Files:**
- Create: `scripts/llm_eval/run_eval.py`

- [ ] **Step 1 : Créer le script orchestrateur**

Create `scripts/llm_eval/run_eval.py` :

```python
"""Run all candidate models against the corpus and store raw outputs."""

from __future__ import annotations

import asyncio
import datetime as dt
import json
import os
import time
from pathlib import Path
from typing import Any

import litellm
import yaml
from pydantic import BaseModel


MODELS: list[str] = [
    "cerebras/llama3.1-8b",
    "cerebras/llama-3.3-70b",
    "cerebras/qwen-3-235b-a22b-instruct-2507",
    "openai/gpt-5-mini",
    "anthropic/claude-sonnet-4-6",
    "groq/llama-3.3-70b-versatile",
    "gemini/gemini-2.5-flash",
]

RUNS_PER_CASE = 5
TEMPERATURE = 1.0

LENGTH_TO_NB_WORDS = {
    "XS": (1, 5),
    "S": (3, 10),
    "M": (5, 15),
    "L": (8, 20),
    "XL": (12, 25),
}


class StructuredLLMResponse(BaseModel):
    suggested_keywords: list[str]
    suggested_answers: list[str]


def build_prompt(user_settings: dict[str, Any], case: dict[str, Any]) -> list[dict[str, str]]:
    """Replicate (a simplified version of) backend/llm/llm_utils.py prompt building."""
    name = user_settings["name"]
    user_prompt = user_settings["prompt"]
    friends = ", ".join(user_settings["friends"])
    min_w, max_w = LENGTH_TO_NB_WORDS[case["desired_length"]]
    hint = case.get("hint")

    sys = (
        "You are an assistant suggesting answers for a person with ALS who cannot speak. "
        "Output JSON: {suggested_keywords: list[str] of length 10, suggested_answers: list[str] of length 4}.\n\n"
        f"## User name\n{name}\n\n"
        f"## User prompt\n{user_prompt}\n\n"
        f"## User's friends\n{friends}\n\n"
        "## Current conversation\n"
    )
    for msg in case["history"]:
        if msg["role"] == "speaker":
            sys += f"* Speaker: {msg['content']}\n"
        else:
            sys += f"* {name} says: {msg['content']}\n"

    sys += f"\n## Desired responses length\nEach response between {min_w} and {max_w} words.\n"
    if hint:
        sys += f"\n## User keyword hint\nUse the concept '{hint}' in all responses.\n"

    return [{"role": "system", "content": sys}]


async def run_one(model: str, messages: list[dict[str, str]]) -> tuple[str, float, float]:
    """Return (raw_text, ttft_ms, total_ms)."""
    response_format = {
        "type": "json_schema",
        "json_schema": {
            "name": "response_suggestion",
            "strict": True,
            "schema": StructuredLLMResponse.model_json_schema(),
        },
    }
    t0 = time.perf_counter()
    ttft: float | None = None
    chunks: list[str] = []

    try:
        stream = await litellm.acompletion(
            model=model,
            messages=messages,
            stream=True,
            temperature=TEMPERATURE,
            response_format=response_format,
        )
    except Exception as e:
        return f"__ERROR__:{type(e).__name__}: {e}", -1.0, -1.0

    async for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta.content
        if delta is None:
            continue
        if ttft is None:
            ttft = (time.perf_counter() - t0) * 1000
        chunks.append(delta)

    total = (time.perf_counter() - t0) * 1000
    return "".join(chunks), ttft if ttft is not None else -1.0, total


async def main() -> None:
    here = Path(__file__).parent
    corpus = yaml.safe_load((here / "corpus.yaml").read_text())

    timestamp = dt.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    out_root = here / "eval_runs" / timestamp
    out_root.mkdir(parents=True, exist_ok=True)

    user_settings = corpus["user_settings"]
    cases = corpus["cases"]

    for model in MODELS:
        for case in cases:
            messages = build_prompt(user_settings, case)
            for i in range(RUNS_PER_CASE):
                text, ttft, total = await run_one(model, messages)
                out_dir = out_root / model.replace("/", "__") / case["id"]
                out_dir.mkdir(parents=True, exist_ok=True)
                (out_dir / f"run_{i}.json").write_text(
                    json.dumps(
                        {
                            "model": model,
                            "case_id": case["id"],
                            "raw": text,
                            "ttft_ms": ttft,
                            "total_ms": total,
                        },
                        ensure_ascii=False,
                        indent=2,
                    )
                )
                print(f"  {model} / {case['id']} / run {i}: ttft={ttft:.0f}ms total={total:.0f}ms")

    (out_root / "_meta.json").write_text(
        json.dumps({"timestamp": timestamp, "models": MODELS, "runs_per_case": RUNS_PER_CASE}, indent=2)
    )
    print(f"\nDone. Raw outputs in {out_root}")


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2 : Smoke test sur un seul modèle**

Modifier temporairement `MODELS` pour ne contenir que `["cerebras/llama3.1-8b"]` et `RUNS_PER_CASE = 1`.

Run: `cd scripts/llm_eval && uv run python run_eval.py`
Expected: génération de fichiers `eval_runs/<ts>/cerebras__llama3.1-8b/<case>/run_0.json` pour chaque cas, et un `_meta.json`. Au moins quelques runs réussis.

Remettre `MODELS` et `RUNS_PER_CASE` à leurs valeurs normales avant de commit.

- [ ] **Step 3 : Commit**

```bash
git add scripts/llm_eval/run_eval.py
git commit -m "feat(eval): add run_eval orchestrator for multi-model corpus runs"
```

---

## Task 13 : Implémenter `score.py`

**Files:**
- Create: `scripts/llm_eval/score.py`

- [ ] **Step 1 : Créer le module de scoring**

Create `scripts/llm_eval/score.py` :

```python
"""Score raw eval runs: JSON validity, semantic diversity, length, latency."""

from __future__ import annotations

import json
import os
from pathlib import Path
from statistics import mean
from typing import Any

from openai import OpenAI

LENGTH_TO_NB_WORDS = {
    "XS": (1, 5),
    "S": (3, 10),
    "M": (5, 15),
    "L": (8, 20),
    "XL": (12, 25),
}


def parse_runs(runs_dir: Path) -> list[dict[str, Any]]:
    """Load all run_*.json files under a directory tree."""
    out: list[dict[str, Any]] = []
    for f in sorted(runs_dir.rglob("run_*.json")):
        out.append(json.loads(f.read_text()))
    return out


def is_valid_json(raw: str) -> tuple[bool, dict[str, Any] | None]:
    if raw.startswith("__ERROR__"):
        return False, None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return False, None
    if not isinstance(parsed, dict):
        return False, None
    if "suggested_keywords" not in parsed or "suggested_answers" not in parsed:
        return False, None
    return True, parsed


def length_score(answers: list[str], desired: str) -> float:
    """Fraction of answers whose word count falls in the expected range."""
    min_w, max_w = LENGTH_TO_NB_WORDS[desired]
    if not answers:
        return 0.0
    ok = sum(1 for a in answers if min_w <= len(a.split()) <= max_w)
    return ok / len(answers)


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def diversity(answers: list[str], embedder: OpenAI) -> float:
    """Mean cosine distance (1 - similarity) over all pairs."""
    if len(answers) < 2:
        return 0.0
    resp = embedder.embeddings.create(model="text-embedding-3-small", input=answers)
    embs = [d.embedding for d in resp.data]
    distances: list[float] = []
    for i in range(len(embs)):
        for j in range(i + 1, len(embs)):
            distances.append(1 - cosine(embs[i], embs[j]))
    return mean(distances)


def score_run(run: dict[str, Any], desired_length: str, embedder: OpenAI) -> dict[str, Any]:
    valid, parsed = is_valid_json(run["raw"])
    if not valid or parsed is None:
        return {
            "model": run["model"],
            "case_id": run["case_id"],
            "valid_json": False,
            "diversity": None,
            "length_score": None,
            "ttft_ms": run["ttft_ms"],
            "total_ms": run["total_ms"],
        }

    answers = parsed.get("suggested_answers", [])
    return {
        "model": run["model"],
        "case_id": run["case_id"],
        "valid_json": True,
        "diversity": diversity(answers, embedder),
        "length_score": length_score(answers, desired_length),
        "ttft_ms": run["ttft_ms"],
        "total_ms": run["total_ms"],
        "answers": answers,
        "keywords": parsed.get("suggested_keywords", []),
    }


def aggregate(scores: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Aggregate per model: mean diversity, JSON validity rate, mean ttft, etc."""
    by_model: dict[str, list[dict[str, Any]]] = {}
    for s in scores:
        by_model.setdefault(s["model"], []).append(s)

    agg: dict[str, dict[str, Any]] = {}
    for model, runs in by_model.items():
        valid = [r for r in runs if r["valid_json"]]
        agg[model] = {
            "n_runs": len(runs),
            "valid_json_rate": len(valid) / len(runs) if runs else 0,
            "mean_diversity": mean(r["diversity"] for r in valid) if valid else None,
            "mean_length_score": mean(r["length_score"] for r in valid) if valid else None,
            "mean_ttft_ms": mean(r["ttft_ms"] for r in runs if r["ttft_ms"] > 0) if runs else None,
            "mean_total_ms": mean(r["total_ms"] for r in runs if r["total_ms"] > 0) if runs else None,
        }
    return agg
```

- [ ] **Step 2 : Test rapide du module**

Run: `cd scripts/llm_eval && uv run python -c "from score import is_valid_json, length_score; print(is_valid_json('{\"suggested_keywords\":[],\"suggested_answers\":[]}'))"`
Expected: `(True, {...})`.

- [ ] **Step 3 : Commit**

```bash
git add scripts/llm_eval/score.py
git commit -m "feat(eval): add scoring (json validity, diversity, length, latency)"
```

---

## Task 14 : Template Jinja2 du rapport

**Files:**
- Create: `scripts/llm_eval/report.md.j2`

- [ ] **Step 1 : Créer le template**

Create `scripts/llm_eval/report.md.j2` :

```jinja
# LLM eval report — {{ timestamp }}

**Corpus:** {{ n_cases }} cases × {{ runs_per_case }} runs each
**Models tested:** {{ models | length }}

## Aggregate scores

| Model | Valid JSON | Mean diversity | Mean length-score | Mean TTFT (ms) | Mean total (ms) |
|-|-|-|-|-|-|
{% for model, m in aggregates.items() -%}
| `{{ model }}` | {{ "%.0f%%" % (m.valid_json_rate * 100) }} | {{ "%.3f" % m.mean_diversity if m.mean_diversity is not none else "—" }} | {{ "%.0f%%" % (m.mean_length_score * 100) if m.mean_length_score is not none else "—" }} | {{ "%.0f" % m.mean_ttft_ms if m.mean_ttft_ms is not none else "—" }} | {{ "%.0f" % m.mean_total_ms if m.mean_total_ms is not none else "—" }} |
{% endfor %}

> **Diversity** = mean cosine distance over pairs of the 4 suggested answers (higher is more diverse).
> **Length-score** = fraction of answers whose word count is within the expected range for the case's `desired_length`.

## Per-case sample outputs

{% for case_id in case_ids %}
### Case `{{ case_id }}`

{% for model in models %}
**`{{ model }}`** — first run :
{% set sample = samples[model][case_id] %}
{% if sample is none %}_invalid run_{% else %}
- **Keywords:** {{ sample.keywords | join(", ") }}
- **Answers:**
{% for a in sample.answers %}  {{ loop.index }}. {{ a }}
{% endfor %}
{% endif %}
{% endfor %}
{% endfor %}
```

- [ ] **Step 2 : Commit**

```bash
git add scripts/llm_eval/report.md.j2
git commit -m "feat(eval): add Jinja2 template for the markdown report"
```

---

## Task 15 : Wirer la génération de rapport dans `run_eval.py`

**Files:**
- Modify: `scripts/llm_eval/run_eval.py`

- [ ] **Step 1 : Ajouter une étape de scoring + rendu en fin de `main()`**

À la toute fin de `scripts/llm_eval/run_eval.py`, juste avant `if __name__ == "__main__":`, modifier `main()` pour appeler le scoring puis générer le rapport :

```python
async def main() -> None:
    here = Path(__file__).parent
    corpus = yaml.safe_load((here / "corpus.yaml").read_text())

    timestamp = dt.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    out_root = here / "eval_runs" / timestamp
    out_root.mkdir(parents=True, exist_ok=True)

    user_settings = corpus["user_settings"]
    cases = corpus["cases"]

    # --- Generation phase ---
    for model in MODELS:
        for case in cases:
            messages = build_prompt(user_settings, case)
            for i in range(RUNS_PER_CASE):
                text, ttft, total = await run_one(model, messages)
                out_dir = out_root / model.replace("/", "__") / case["id"]
                out_dir.mkdir(parents=True, exist_ok=True)
                (out_dir / f"run_{i}.json").write_text(
                    json.dumps(
                        {
                            "model": model,
                            "case_id": case["id"],
                            "raw": text,
                            "ttft_ms": ttft,
                            "total_ms": total,
                        },
                        ensure_ascii=False,
                        indent=2,
                    )
                )
                print(f"  {model} / {case['id']} / run {i}: ttft={ttft:.0f}ms total={total:.0f}ms")

    (out_root / "_meta.json").write_text(
        json.dumps({"timestamp": timestamp, "models": MODELS, "runs_per_case": RUNS_PER_CASE}, indent=2)
    )

    # --- Scoring phase ---
    from openai import OpenAI
    from jinja2 import Template

    from score import parse_runs, score_run, aggregate

    case_by_id = {c["id"]: c for c in cases}
    embedder = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    runs = parse_runs(out_root)
    scores = [score_run(r, case_by_id[r["case_id"]]["desired_length"], embedder) for r in runs]
    aggregates = aggregate(scores)

    # First-run sample per (model, case) for the report
    samples: dict[str, dict[str, Any]] = {}
    seen: set[tuple[str, str]] = set()
    for s in scores:
        key = (s["model"], s["case_id"])
        if key in seen:
            continue
        seen.add(key)
        samples.setdefault(s["model"], {})[s["case_id"]] = (
            {"keywords": s.get("keywords", []), "answers": s.get("answers", [])}
            if s["valid_json"] else None
        )

    template_text = (here / "report.md.j2").read_text()
    rendered = Template(template_text).render(
        timestamp=timestamp,
        n_cases=len(cases),
        runs_per_case=RUNS_PER_CASE,
        models=MODELS,
        case_ids=[c["id"] for c in cases],
        aggregates=aggregates,
        samples=samples,
    )
    (out_root / "report.md").write_text(rendered)

    print(f"\nDone. Report at {out_root / 'report.md'}")
```

- [ ] **Step 2 : Test E2E sur un seul modèle**

Modifier temporairement `MODELS = ["cerebras/llama3.1-8b"]` et `RUNS_PER_CASE = 2`.

Run: `cd scripts/llm_eval && OPENAI_API_KEY=$OPENAI_API_KEY uv run python run_eval.py`
Expected: génération des runs ET d'un fichier `report.md` lisible avec un tableau et des sample outputs.

- [ ] **Step 3 : Vérifier visuellement le rapport**

Run: `cat scripts/llm_eval/eval_runs/<ts>/report.md`
Expected: Markdown bien formé, tableau exploitable.

- [ ] **Step 4 : Remettre les valeurs normales et commit**

Remettre `MODELS` à la liste complète et `RUNS_PER_CASE = 5`. Ne pas commit le dossier `eval_runs/`.

Ajouter au `.gitignore` racine :

```
# LLM eval runs (artefacts locaux)
scripts/llm_eval/eval_runs/
```

- [ ] **Step 5 : Commit**

```bash
git add scripts/llm_eval/run_eval.py .gitignore
git commit -m "feat(eval): generate markdown report from scored runs"
```

---

## Task 16 : Documenter les API keys requises

**Files:**
- Modify: `scripts/llm_eval/README.md`

- [ ] **Step 1 : Compléter le README avec la liste des env vars**

Remplacer le contenu de `scripts/llm_eval/README.md` par :

````markdown
# LLM eval harness

Compare InvincibleVoice LLM candidates on a fixed corpus.

## Usage

```bash
cd scripts/llm_eval
uv sync

# API keys (selon les modèles activés dans run_eval.py)
export CEREBRAS_API_KEY=...
export OPENAI_API_KEY=...        # requis (utilisé pour les embeddings de scoring)
export ANTHROPIC_API_KEY=...
export GROQ_API_KEY=...
export GEMINI_API_KEY=...

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
````

- [ ] **Step 2 : Commit**

```bash
git add scripts/llm_eval/README.md
git commit -m "docs(eval): document API keys and metrics in eval harness README"
```

---

## Task 17 : Run final sur le corpus complet (étape humaine)

**Files:** aucun

- [ ] **Step 1 : Vérifier les API keys**

Vérifier que les variables d'env Cerebras, OpenAI, Anthropic, Groq, Gemini sont disponibles. Si certains modèles ne sont pas testables (clé manquante), les retirer temporairement de `MODELS` dans `run_eval.py`.

- [ ] **Step 2 : Lancer l'éval complète**

Run: `cd scripts/llm_eval && uv run python run_eval.py`

Durée attendue : ~5–15 min selon les latences providers et le nombre de modèles activés.

- [ ] **Step 3 : Lire le rapport**

Run: `cat scripts/llm_eval/eval_runs/<ts>/report.md`

Identifier :
- Le ou les modèles avec validité JSON >= 99 %
- Parmi ceux-là, ceux avec la meilleure diversité sémantique
- Vérifier qualitativement les sample outputs (le score automatique ne capte pas tout)

- [ ] **Step 4 : Choix humain**

Discuter avec l'ami utilisateur final ou faire un test vocal sur 2–3 candidats short-listés. Choisir le modèle gagnant.

- [ ] **Step 5 : Mettre à jour `.env` (local) et `.env.prod` (sur le serveur)**

Modifier la valeur de `KYUTAI_LLM_MODEL` dans `.env` (local, pour test) et `.env.prod` (sur le serveur Hetzner via `ssh`) avec le modèle gagnant.

- [ ] **Step 6 : Commit + déploiement**

Si le `.env.prod.template` doit pointer vers le nouveau défaut :

```bash
git add .env.prod.template
git commit -m "chore(env): default to <gagnant> as KYUTAI_LLM_MODEL"
git push origin main
```

Le push-to-deploy CI/CD redéploiera automatiquement (cf. `.github/workflows/`).

- [ ] **Step 7 : Monitoring 1 semaine**

Surveiller Grafana et le ressenti utilisateur sur 7 jours. Si dégradation, revert via env var sans redéploiement de code.

---

# Hors scope de ce plan (à venir dans des plans séparés)

- **Mode hybride keywords/responses** — uniquement si l'éval démontre qu'aucun modèle unique n'est satisfaisant. Plan à écrire ensuite.
- **Retry sur JSON malformé** (mentionné dans le spec §1.6) — non implémenté ici car incompatible avec le streaming pur du wrapper (il faudrait bufferiser tout le stream avant de parser, ce qui annule l'intérêt du streaming progressif côté frontend). À reprendre seulement si l'éval révèle un taux de validité JSON < 99 % sur le modèle gagnant. Le frontend tolère déjà le JSON partiel pendant le streaming.
- **Sous-projet 2** — Contextes/scénarios cliquables (UI + storage)
- **Sous-projet 3** — Mémoire long-terme (résumés + RAG des conversations passées)
