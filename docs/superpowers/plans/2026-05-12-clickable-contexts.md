# Clickable Contexts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Ajouter à InvincibleVoice un sélecteur de contextes/scénarios cliquables (ex: « Au travail », « Avec ma sœur Sophie ») pour pré-orienter le LLM globalement sur la conversation, complémentaire aux keywords par-réponse existants.

**Architecture :** 5 chantiers (A backend modèle + prompt + WebSocket → B backend seeding → C frontend types + composant → D frontend intégration + Settings + i18n → E staging puis prod). Le backend ajoute un champ `UserSettings.contexts` (rétrocompatible via `default_factory=list`), un état session `Chatbot.current_contexts` et une section conditionnelle dans le system prompt. Le frontend ajoute un composant `ContextsSelector` (chips multi-select, reset par conversation) et un éditeur dans Settings.

**Tech Stack :** Python 3.12 + FastAPI + Pydantic + LiteLLM (backend), Next.js 15 + React 19 + TypeScript + Tailwind (frontend), Vitest (tests frontend), pytest (tests backend), Docker Compose + Traefik + GitHub Actions (CI/CD).

---

## File Structure

| Fichier | Action | Responsabilité |
|-|-|-|
| `services/backend/backend/typing.py` | Modifier | Ajout class `Context` + champ `UserSettings.contexts` |
| `services/backend/backend/llm/system_prompt.py` | Modifier | `DEFAULT_CONTEXTS_FR` constant + renumérotation sections du BASE_SYSTEM_PROMPT |
| `services/backend/backend/storage.py` | Modifier | `to_llm_ready_conversation` reçoit `active_contexts: list[str]` + section `## Active contexts` + seeding au load |
| `services/backend/backend/llm/chatbot.py` | Modifier | `current_contexts: list[str]` state + inclusion dans `proxy_hash` + passage à `to_llm_ready_conversation` |
| `services/backend/backend/openai_realtime_api_events.py` | Modifier | Class `CurrentContexts` + ajout dans `ClientEvent` union |
| `services/backend/backend/unmute_handler.py` | Modifier | Méthode `set_current_contexts` |
| `services/backend/backend/libs/websockets.py` | Modifier | Dispatch `isinstance(message, ora.CurrentContexts)` |
| `services/backend/backend/routes/auth.py` | Modifier | Seed `DEFAULT_CONTEXTS_FR` à la création de `UserSettings` pour un nouveau user |
| `services/backend/tests/llm/test_contexts.py` | Créer | Unit tests : Context model, system prompt section, proxy_hash, seeding |
| `services/backend/tests/llm/test_contexts_e2e.py` | Créer | Integration test WebSocket : envoyer `current.contexts` et vérifier la propagation |
| `services/frontend/src/types/user.ts` | Modifier | Type `Context` + champ `UserSettings.contexts` |
| `services/frontend/src/utils/userData.tsx` | Modifier | Type `Context` + champ `UserSettings.contexts` (miroir) |
| `services/frontend/src/components/ContextsSelector.tsx` | Créer | Composant chips multi-select |
| `services/frontend/src/components/InvincibleVoice.tsx` | Modifier | Intégration `ContextsSelector`, state `activeContextIds`, send WebSocket, reset par conv |
| `services/frontend/src/components/settings/SettingsPopup.tsx` | Modifier | Section CRUD contextes (desktop) |
| `services/frontend/src/components/settings/MobileSettingsPopup.tsx` | Modifier | Section CRUD contextes (mobile) |
| `services/frontend/src/messages/fr.json` | Modifier | Clés i18n FR |
| `services/frontend/src/messages/en.json` | Modifier | Clés i18n EN |
| `services/frontend/src/messages/es.json` | Modifier | Clés i18n ES |
| `services/frontend/src/messages/pt.json` | Modifier | Clés i18n PT |
| `services/frontend/src/messages/de.json` | Modifier | Clés i18n DE |
| `services/frontend/src/app/__tests__/contexts-selector.test.tsx` | Créer | Tests unit composant |
| `services/frontend/src/app/__tests__/current-contexts.test.tsx` | Créer | Tests intégration WebSocket frontend |

---

## Chantier A — Backend modèle + system prompt + WebSocket event

### Task A1 : Types Context + UserSettings (TDD)

**Files:**
- Modify: `services/backend/backend/typing.py`
- Create: `services/backend/tests/llm/test_contexts.py`

- [ ] **Step 1 : Créer le fichier de tests avec un test rouge pour `Context`**

```python
"""Unit tests for the Context model and UserSettings.contexts field."""

import uuid

import pytest

from backend.typing import Context, Document, UserSettings


def test_context_model_parses_and_serializes():
    ctx_id = uuid.uuid4()
    ctx = Context(id=ctx_id, label="Au travail")
    payload = ctx.model_dump_json()
    parsed = Context.model_validate_json(payload)
    assert parsed.id == ctx_id
    assert parsed.label == "Au travail"


def test_user_settings_contexts_defaults_to_empty_list():
    settings = UserSettings(
        name="Alice",
        prompt="hello",
        additional_keywords=[],
        friends=[],
    )
    assert settings.contexts == []


def test_user_settings_legacy_json_loads_without_contexts():
    """Old user_data files without `contexts` must still parse."""
    raw = '{"name": "Alice", "prompt": "hi", "additional_keywords": [], "friends": [], "documents": []}'
    settings = UserSettings.model_validate_json(raw)
    assert settings.contexts == []
```

- [ ] **Step 2 : Lancer le test et vérifier l'échec**

Run : `cd services/backend && uv run pytest tests/llm/test_contexts.py -v`
Expected : 3 tests fail with `ImportError: cannot import name 'Context'`.

- [ ] **Step 3 : Ajouter `Context` et étendre `UserSettings` dans `typing.py`**

Dans `services/backend/backend/typing.py`, ajouter après la class `Document` :

```python
class Context(pydantic.BaseModel):
    id: uuid.UUID
    label: str
```

Et modifier la class `UserSettings` pour ajouter le champ après `documents` :

```python
class UserSettings(pydantic.BaseModel):
    name: str
    prompt: str
    additional_keywords: list[str]
    friends: list[str]
    documents: list[Document] = pydantic.Field(default_factory=list)
    contexts: list[Context] = pydantic.Field(default_factory=list)
    voice: str | None = None
    expected_transcription_language: str | None = None
    accepted_terms_of_services: bool = False
```

- [ ] **Step 4 : Relancer les tests, vérifier qu'ils passent**

Run : `cd services/backend && uv run pytest tests/llm/test_contexts.py -v`
Expected : 3 PASSED.

- [ ] **Step 5 : Commit**

```bash
git add services/backend/backend/typing.py services/backend/tests/llm/test_contexts.py
git commit -m "feat(typing): add Context model and UserSettings.contexts field"
```

---

### Task A2 : DEFAULT_CONTEXTS_FR constant

**Files:**
- Modify: `services/backend/backend/llm/system_prompt.py`
- Modify: `services/backend/tests/llm/test_contexts.py`

- [ ] **Step 1 : Ajouter un test rouge pour la constante**

Ajouter à la fin de `services/backend/tests/llm/test_contexts.py` :

```python
def test_default_contexts_fr_constant_exposes_five_french_labels():
    from backend.llm.system_prompt import DEFAULT_CONTEXTS_FR
    assert len(DEFAULT_CONTEXTS_FR) == 5
    assert "Au travail" in DEFAULT_CONTEXTS_FR
    assert all(isinstance(c, str) for c in DEFAULT_CONTEXTS_FR)
    assert all(len(c) > 0 and len(c) <= 100 for c in DEFAULT_CONTEXTS_FR)
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run : `cd services/backend && uv run pytest tests/llm/test_contexts.py::test_default_contexts_fr_constant_exposes_five_french_labels -v`
Expected : FAIL with `ImportError`.

- [ ] **Step 3 : Ajouter la constante dans `system_prompt.py`**

Dans `services/backend/backend/llm/system_prompt.py`, **avant** `BASE_SYSTEM_PROMPT` :

```python
DEFAULT_CONTEXTS_FR: list[str] = [
    "Conversation décontractée à la maison",
    "Au travail",
    "Déjeuner ou dîner en famille",
    "Rendez-vous médical",
    "Café entre amis",
]
```

- [ ] **Step 4 : Relancer, vérifier que le test passe**

Run : `cd services/backend && uv run pytest tests/llm/test_contexts.py -v`
Expected : 4 PASSED.

- [ ] **Step 5 : Commit**

```bash
git add services/backend/backend/llm/system_prompt.py services/backend/tests/llm/test_contexts.py
git commit -m "feat(prompt): add DEFAULT_CONTEXTS_FR seed list"
```

---

### Task A3 : Section `## Active contexts` dans `to_llm_ready_conversation` (TDD)

**Files:**
- Modify: `services/backend/backend/storage.py`
- Modify: `services/backend/backend/llm/system_prompt.py`
- Modify: `services/backend/tests/llm/test_contexts.py`

- [ ] **Step 1 : Ajouter des tests rouges pour la section system prompt**

Ajouter à `services/backend/tests/llm/test_contexts.py` :

```python
import datetime as dt
import uuid

from backend.storage import UserData
from backend.typing import UserSettings, Conversation


def _make_user_data() -> UserData:
    return UserData(
        user_id=uuid.uuid4(),
        email="alice@example.com",
        hashed_password="x",
        user_settings=UserSettings(
            name="Alice",
            prompt="I am Alice.",
            additional_keywords=[],
            friends=[],
        ),
        conversations=[
            Conversation(messages=[], start_time=dt.datetime(2026, 5, 12, 10, 0))
        ],
    )


def test_system_prompt_includes_active_contexts_section_when_non_empty():
    user_data = _make_user_data()
    messages = user_data.to_llm_ready_conversation(
        user_text_hint=None,
        desired_responses_length="M",
        active_contexts=["Au travail", "Avec Paul"],
    )
    assert len(messages) == 1
    system_text = messages[0].content
    assert "## Active contexts" in system_text
    assert "- Au travail" in system_text
    assert "- Avec Paul" in system_text


def test_system_prompt_omits_active_contexts_section_when_empty():
    user_data = _make_user_data()
    messages = user_data.to_llm_ready_conversation(
        user_text_hint=None,
        desired_responses_length="M",
        active_contexts=[],
    )
    assert "## Active contexts" not in messages[0].content
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

Run : `cd services/backend && uv run pytest tests/llm/test_contexts.py -v`
Expected : nouveaux tests fail (signature `to_llm_ready_conversation` n'accepte pas `active_contexts`).

- [ ] **Step 3 : Modifier `to_llm_ready_conversation` dans `storage.py`**

Dans `services/backend/backend/storage.py`, modifier la signature et l'implémentation :

```python
    def to_llm_ready_conversation(
        self,
        user_text_hint: str | None,
        desired_responses_length: ora.ResponsesLenght,
        active_contexts: list[str],
    ) -> list[LLMMessage]:
        result = []

        prompt = BASE_SYSTEM_PROMPT + "\n"
        prompt += "\n"
        prompt += "## User's name\n"
        prompt += f"The user is {self.user_settings.name}.\n\n"
        prompt += "## User's prompt\n"
        prompt += self.user_settings.prompt + "\n\n"
        if active_contexts:
            prompt += "## Active contexts\n"
            prompt += (
                "The user has indicated they are currently in these situations or "
                "contexts. Use them to orient your suggestions (vocabulary, tone, "
                "topic relevance):\n"
            )
            for ctx in active_contexts:
                prompt += f"- {ctx}\n"
            prompt += "\n"
        prompt += "## User's friends\n"
        prompt += f"The friends of the user are: {self.user_settings.friends}\n\n"
        # ... reste du code existant inchangé (documents, past conversations, etc.)
```

(Conserver tel quel le reste du corps de la méthode après le bloc friends.)

- [ ] **Step 4 : Mettre à jour `BASE_SYSTEM_PROMPT` pour documenter la nouvelle section**

Dans `services/backend/backend/llm/system_prompt.py`, modifier `BASE_SYSTEM_PROMPT` pour insérer "5) Active contexts (if any)" entre l'actuel "5) User name" et "6) User's prompt". Renuméroter les éléments suivants :

```python
BASE_SYSTEM_PROMPT = """
# System prompt
You are the assistant of a user suffering from ALS (Amyotrophic Lateral Sclerosis).

You must help them because they have difficulty writing, and do so my suggesting answers and keywords.

Here are the following information that will be given to you:
1) Desired output
2) Guiding the suggestions
3) Language and style
4) Considerations related to the overall software
5) User name
6) User's prompt
7) Active contexts (if any) — the situations the user is currently in
8) User's friends
9) User's documents (if any)
10) Past conversations with dates
11) Current conversation with the user
12) Desired responses length
13) User's keywords sent to you to guide your answers (if any)

## Desired output
... (corps inchangé)
"""
```

- [ ] **Step 5 : Mettre à jour les appelants existants pour passer une liste vide par défaut**

Chercher tous les appels actuels de `to_llm_ready_conversation` :

```bash
grep -rn "to_llm_ready_conversation" services/backend/backend
```

Attendu : un seul appel dans `services/backend/backend/llm/chatbot.py:130` (méthode `preprocessed_messages`). Le modifier (Task A4 le finalisera ; pour l'instant passer `[]` pour ne pas casser) :

```python
    def preprocessed_messages(self):
        logger.info(f"Length of chat history {len(self.current_conversation)}")
        result = self.user_data.to_llm_ready_conversation(
            self.current_keywords,
            self.desired_responses_length,
            [],  # active_contexts - sera renseigné en Task A4
        )
        messages = [x.model_dump(mode="json") for x in result]
        return messages
```

- [ ] **Step 6 : Relancer les tests, vérifier qu'ils passent**

Run : `cd services/backend && uv run pytest tests/llm/test_contexts.py -v && uv run pytest tests/ -v`
Expected : tous les tests PASSED (les nouveaux + ceux existants).

- [ ] **Step 7 : Commit**

```bash
git add services/backend/backend/storage.py services/backend/backend/llm/system_prompt.py services/backend/backend/llm/chatbot.py services/backend/tests/llm/test_contexts.py
git commit -m "feat(prompt): inject Active contexts section into system prompt"
```

---

### Task A4 : Chatbot.current_contexts state + proxy_hash (TDD)

**Files:**
- Modify: `services/backend/backend/llm/chatbot.py`
- Modify: `services/backend/tests/llm/test_contexts.py`

- [ ] **Step 1 : Ajouter tests rouges pour le state + proxy_hash**

Ajouter à `services/backend/tests/llm/test_contexts.py` :

```python
from backend.llm.chatbot import Chatbot


def test_chatbot_initializes_current_contexts_to_empty_list():
    user_data = _make_user_data()
    chatbot = Chatbot(user_data, dt.datetime(2026, 5, 12, 10, 0))
    assert chatbot.current_contexts == []


def test_chatbot_proxy_hash_changes_when_contexts_change():
    user_data = _make_user_data()
    chatbot = Chatbot(user_data, dt.datetime(2026, 5, 12, 10, 0))
    h0 = chatbot.proxy_hash()

    chatbot.current_contexts = ["Au travail"]
    h1 = chatbot.proxy_hash()
    assert h1 != h0

    chatbot.current_contexts = ["Au travail", "Avec Paul"]
    h2 = chatbot.proxy_hash()
    assert h2 != h1


def test_chatbot_proxy_hash_stable_when_contexts_unchanged():
    user_data = _make_user_data()
    chatbot = Chatbot(user_data, dt.datetime(2026, 5, 12, 10, 0))
    chatbot.current_contexts = ["Au travail"]
    h_a = chatbot.proxy_hash()
    h_b = chatbot.proxy_hash()
    assert h_a == h_b


def test_chatbot_preprocessed_messages_passes_current_contexts():
    user_data = _make_user_data()
    chatbot = Chatbot(user_data, dt.datetime(2026, 5, 12, 10, 0))
    chatbot.current_contexts = ["Au travail"]
    messages = chatbot.preprocessed_messages()
    assert "## Active contexts" in messages[0]["content"]
    assert "- Au travail" in messages[0]["content"]
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

Run : `cd services/backend && uv run pytest tests/llm/test_contexts.py -v`
Expected : 4 nouveaux tests FAIL.

- [ ] **Step 3 : Modifier `Chatbot` pour ajouter le state**

Dans `services/backend/backend/llm/chatbot.py`, modifier `__init__` :

```python
    def __init__(self, user_data: UserData, start_time: dt.datetime):
        self.conversation_state_override: ConversationState | None = None
        self.current_keywords: str | None = None
        self.current_contexts: list[str] = []
        self.user_data = user_data
        self.user_data.conversations.append(
            Conversation(messages=[], start_time=start_time)
        )
        self.desired_responses_length: Literal["XS", "S", "M", "L", "XL"] = "M"
```

Modifier `proxy_hash` :

```python
    def proxy_hash(self) -> int:
        if len(self.user_data.conversations[-1].messages) == 0:
            last_message_len = None
        else:
            last_message_len = len(
                self.user_data.conversations[-1].messages[-1].content
            )
        return hash(
            (
                self.current_keywords,
                tuple(self.current_contexts),
                len(self.user_data.conversations[-1].messages),
                last_message_len,
                self.desired_responses_length,
            )
        )
```

Modifier `preprocessed_messages` :

```python
    def preprocessed_messages(self):
        logger.info(f"Length of chat history {len(self.current_conversation)}")
        result = self.user_data.to_llm_ready_conversation(
            self.current_keywords,
            self.desired_responses_length,
            self.current_contexts,
        )
        messages = [x.model_dump(mode="json") for x in result]
        return messages
```

- [ ] **Step 4 : Relancer les tests, vérifier qu'ils passent**

Run : `cd services/backend && uv run pytest tests/llm/test_contexts.py -v`
Expected : tous PASSED.

- [ ] **Step 5 : Commit**

```bash
git add services/backend/backend/llm/chatbot.py services/backend/tests/llm/test_contexts.py
git commit -m "feat(chatbot): track current_contexts in session state and proxy hash"
```

---

### Task A5 : CurrentContexts WebSocket event + handler + dispatch (TDD)

**Files:**
- Modify: `services/backend/backend/openai_realtime_api_events.py`
- Modify: `services/backend/backend/unmute_handler.py`
- Modify: `services/backend/backend/libs/websockets.py`
- Create: `services/backend/tests/llm/test_contexts_e2e.py`

- [ ] **Step 1 : Créer le test d'intégration rouge**

Créer `services/backend/tests/llm/test_contexts_e2e.py` :

```python
"""Integration test: CurrentContexts event propagates to chatbot state."""

import datetime as dt
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.llm.chatbot import Chatbot
from backend.storage import UserData
from backend.typing import Conversation, UserSettings
from backend import openai_realtime_api_events as ora


def _make_user_data() -> UserData:
    return UserData(
        user_id=uuid.uuid4(),
        email="alice@example.com",
        hashed_password="x",
        user_settings=UserSettings(
            name="Alice",
            prompt="I am Alice.",
            additional_keywords=[],
            friends=[],
        ),
        conversations=[
            Conversation(messages=[], start_time=dt.datetime(2026, 5, 12, 10, 0))
        ],
    )


@pytest.mark.asyncio
async def test_current_contexts_event_updates_chatbot_and_regenerates():
    """Sending CurrentContexts must update chatbot.current_contexts and trigger generation."""
    from backend.unmute_handler import UnmuteHandler

    user_data = _make_user_data()
    handler = MagicMock(spec=UnmuteHandler)
    handler.chatbot = Chatbot(user_data, dt.datetime(2026, 5, 12, 10, 0))
    handler._generate_response = AsyncMock()

    # Bind the real method to the mock
    handler.set_current_contexts = UnmuteHandler.set_current_contexts.__get__(handler)

    message = ora.CurrentContexts(
        type="current.contexts",
        contexts=["Au travail", "Avec Paul"],
    )
    await handler.set_current_contexts(message)

    assert handler.chatbot.current_contexts == ["Au travail", "Avec Paul"]
    handler._generate_response.assert_awaited_once()


def test_current_contexts_event_parses_from_json():
    payload = '{"type": "current.contexts", "contexts": ["A", "B"]}'
    msg = ora.CurrentContexts.model_validate_json(payload)
    assert msg.contexts == ["A", "B"]
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run : `cd services/backend && uv run pytest tests/llm/test_contexts_e2e.py -v`
Expected : FAIL `AttributeError: module ... has no attribute 'CurrentContexts'`.

- [ ] **Step 3 : Ajouter `CurrentContexts` à `openai_realtime_api_events.py`**

Après `class CurrentKeywords(BaseEvent[Literal["current.keywords"]])` (ligne ~122) :

```python
class CurrentContexts(BaseEvent[Literal["current.contexts"]]):
    contexts: list[str]
```

Et étendre l'union `ClientEvent` (vers la ligne 187) :

```python
ClientEvent = Union[
    InputAudioBufferAppend,
    ResponseSelectedByWriter,
    CurrentKeywords,
    CurrentContexts,
    DesiredResponsesLenght,
]
```

- [ ] **Step 4 : Ajouter `set_current_contexts` à `unmute_handler.py`**

Dans `services/backend/backend/unmute_handler.py`, après `add_keywords` (ligne ~155) :

```python
    async def set_current_contexts(self, message: ora.CurrentContexts) -> None:
        self.chatbot.current_contexts = message.contexts
        logger.info("Active contexts set to %s", message.contexts)
        await self._generate_response()
```

- [ ] **Step 5 : Ajouter le dispatch dans `libs/websockets.py`**

Dans `services/backend/backend/libs/websockets.py`, après le bloc `elif isinstance(message, ora.CurrentKeywords):` (ligne ~176) :

```python
        elif isinstance(message, ora.CurrentContexts):
            await handler.set_current_contexts(message)
```

- [ ] **Step 6 : Relancer les tests, vérifier qu'ils passent**

Run : `cd services/backend && uv run pytest tests/llm/test_contexts_e2e.py -v && uv run pytest tests/ -v`
Expected : tous PASSED.

- [ ] **Step 7 : Commit**

```bash
git add services/backend/backend/openai_realtime_api_events.py services/backend/backend/unmute_handler.py services/backend/backend/libs/websockets.py services/backend/tests/llm/test_contexts_e2e.py
git commit -m "feat(ws): add current.contexts event and handler"
```

---

## Chantier B — Seeding par défaut

### Task B1 : Seeding au load si liste vide (TDD)

**Files:**
- Modify: `services/backend/backend/storage.py`
- Modify: `services/backend/tests/llm/test_contexts.py`

- [ ] **Step 1 : Ajouter tests rouges pour le seeding au load**

Ajouter à `services/backend/tests/llm/test_contexts.py` :

```python
def test_seed_default_contexts_on_load_when_empty(tmp_path, monkeypatch):
    """get_user_data_from_storage should seed DEFAULT_CONTEXTS_FR if contexts is empty."""
    from backend import kyutai_constants
    from backend.storage import get_user_data_from_storage

    monkeypatch.setattr(
        kyutai_constants, "USERS_SETTINGS_AND_HISTORY_DIR", tmp_path
    )

    legacy = UserData(
        user_id=uuid.uuid4(),
        email="legacy@example.com",
        hashed_password="x",
        user_settings=UserSettings(
            name="Legacy",
            prompt="hi",
            additional_keywords=[],
            friends=[],
        ),
        conversations=[],
    )
    (tmp_path / "legacy@example.com.json").write_text(legacy.model_dump_json())

    loaded = get_user_data_from_storage("legacy@example.com")
    assert len(loaded.user_settings.contexts) == 5
    labels = [c.label for c in loaded.user_settings.contexts]
    assert "Au travail" in labels

    # Persisted to disk
    reloaded = get_user_data_from_storage("legacy@example.com")
    assert len(reloaded.user_settings.contexts) == 5
    # IDs are stable across reloads
    assert [c.id for c in loaded.user_settings.contexts] == [
        c.id for c in reloaded.user_settings.contexts
    ]


def test_seed_skipped_if_contexts_already_populated(tmp_path, monkeypatch):
    from backend import kyutai_constants
    from backend.storage import get_user_data_from_storage

    monkeypatch.setattr(
        kyutai_constants, "USERS_SETTINGS_AND_HISTORY_DIR", tmp_path
    )

    existing_ctx_id = uuid.uuid4()
    user = UserData(
        user_id=uuid.uuid4(),
        email="user@example.com",
        hashed_password="x",
        user_settings=UserSettings(
            name="User",
            prompt="hi",
            additional_keywords=[],
            friends=[],
            contexts=[Context(id=existing_ctx_id, label="Custom")],
        ),
        conversations=[],
    )
    (tmp_path / "user@example.com.json").write_text(user.model_dump_json())

    loaded = get_user_data_from_storage("user@example.com")
    assert len(loaded.user_settings.contexts) == 1
    assert loaded.user_settings.contexts[0].id == existing_ctx_id
    assert loaded.user_settings.contexts[0].label == "Custom"
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

Run : `cd services/backend && uv run pytest tests/llm/test_contexts.py::test_seed_default_contexts_on_load_when_empty tests/llm/test_contexts.py::test_seed_skipped_if_contexts_already_populated -v`
Expected : FAIL (pas de seeding).

- [ ] **Step 3 : Implémenter le seeding dans `get_user_data_from_storage`**

Dans `services/backend/backend/storage.py`, ajouter en haut du fichier (après les imports existants) :

```python
from backend.llm.system_prompt import DEFAULT_CONTEXTS_FR
from backend.typing import Context
```

Modifier `get_user_data_from_storage` :

```python
def get_user_data_from_storage(user_email: str) -> UserData:
    user_data_path = get_user_data_path(user_email)
    if not user_data_path.exists():
        raise UserDataNotFoundError(f"No user data found for email: {user_email}")
    user_data = UserData.model_validate_json(user_data_path.read_text())
    if not user_data.user_settings.contexts:
        user_data.user_settings.contexts = [
            Context(id=uuid.uuid4(), label=label) for label in DEFAULT_CONTEXTS_FR
        ]
        user_data.save()
    return user_data
```

(Ajouter `import uuid` si pas déjà présent.)

- [ ] **Step 4 : Relancer les tests, vérifier qu'ils passent**

Run : `cd services/backend && uv run pytest tests/llm/test_contexts.py -v`
Expected : tous PASSED.

- [ ] **Step 5 : Commit**

```bash
git add services/backend/backend/storage.py services/backend/tests/llm/test_contexts.py
git commit -m "feat(storage): seed default FR contexts on user data load when empty"
```

---

### Task B2 : Seeding à l'inscription (TDD)

**Files:**
- Modify: `services/backend/backend/routes/auth.py`
- Modify: `services/backend/tests/llm/test_contexts.py`

L'instanciation cible se trouve dans `get_new_user(email: str, language: str, hashed_password: str = "")` à `services/backend/backend/routes/auth.py:42-135`. La fonction construit `UserData(user_settings=UserSettings(...))` à la ligne 124-135.

- [ ] **Step 1 : Ajouter un test rouge pour le seeding à l'inscription**

Ajouter à `services/backend/tests/llm/test_contexts.py` :

```python
def test_get_new_user_seeds_default_contexts():
    """A freshly registered user must already have DEFAULT_CONTEXTS_FR seeded."""
    from backend.routes.auth import get_new_user

    user = get_new_user(email="new@example.com", language="fr", hashed_password="x")
    assert len(user.user_settings.contexts) == 5
    labels = [c.label for c in user.user_settings.contexts]
    assert "Au travail" in labels
    # Each context has a unique UUID
    ids = [c.id for c in user.user_settings.contexts]
    assert len(set(ids)) == 5


def test_get_new_user_seeds_default_contexts_regardless_of_language():
    """Defaults are FR regardless of selected language (FR is project's primary language)."""
    from backend.routes.auth import get_new_user

    user_en = get_new_user(email="en@example.com", language="en", hashed_password="x")
    user_de = get_new_user(email="de@example.com", language="de", hashed_password="x")
    fr_labels = [c.label for c in user_en.user_settings.contexts]
    de_labels = [c.label for c in user_de.user_settings.contexts]
    assert "Au travail" in fr_labels
    assert "Au travail" in de_labels
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run : `cd services/backend && uv run pytest tests/llm/test_contexts.py::test_get_new_user_seeds_default_contexts -v`
Expected : FAIL (`contexts` empty).

- [ ] **Step 3 : Modifier `get_new_user` dans `auth.py`**

Dans `services/backend/backend/routes/auth.py`, ajouter en haut du fichier (à côté des imports existants) :

```python
from backend.llm.system_prompt import DEFAULT_CONTEXTS_FR
from backend.typing import Context
```

Puis modifier le bloc `return UserData(...)` à la ligne 124-135 :

```python
    return UserData(
        user_id=uuid.uuid4(),
        email=email,
        hashed_password=hashed_password,
        user_settings=UserSettings(
            name=default_names[language],
            prompt="",
            additional_keywords=default_keywords[language],
            friends=[],
            contexts=[
                Context(id=uuid.uuid4(), label=label)
                for label in DEFAULT_CONTEXTS_FR
            ],
        ),
        conversations=[],
    )
```

- [ ] **Step 4 : Relancer les tests, vérifier qu'ils passent**

Run : `cd services/backend && uv run pytest tests/llm/test_contexts.py -v`
Expected : tous PASSED.

- [ ] **Step 5 : Commit**

```bash
git add services/backend/backend/routes/auth.py services/backend/tests/llm/test_contexts.py
git commit -m "feat(auth): seed default FR contexts at user registration"
```

---

## Chantier C — Frontend types + composant ContextsSelector

### Task C1 : Types Context côté frontend

**Files:**
- Modify: `services/frontend/src/types/user.ts`
- Modify: `services/frontend/src/utils/userData.tsx`

- [ ] **Step 1 : Ajouter `Context` et le champ `contexts` dans `types/user.ts`**

```typescript
export interface Document {
  title: string;
  content: string;
}

export interface Context {
  id: string;
  label: string;
}

export interface UserSettings {
  name: string;
  prompt: string;
  additional_keywords: string[];
  friends: string[];
  documents: Document[];
  contexts: Context[];
  voice: string | null;
  expected_transcription_language: string | null;
  accepted_terms_of_services: boolean;
}

export interface UserData {
  email: string;
  user_settings: UserSettings;
}
```

- [ ] **Step 2 : Refléter dans `utils/userData.tsx`**

Inspecter le fichier (`cat services/frontend/src/utils/userData.tsx | head -60`) puis ajouter le type `Context` (export) et le champ `contexts: Context[]` dans `UserSettings`. Si une copie locale du type existe, la mettre à jour à l'identique.

- [ ] **Step 3 : Lancer la compilation TypeScript pour confirmer l'absence d'erreur**

Run : `cd services/frontend && pnpm exec tsc --noEmit`
Expected : pas d'erreur.

- [ ] **Step 4 : Commit**

```bash
git add services/frontend/src/types/user.ts services/frontend/src/utils/userData.tsx
git commit -m "feat(types): add Context type and UserSettings.contexts (frontend)"
```

---

### Task C2 : Composant ContextsSelector + tests unit (TDD)

**Files:**
- Create: `services/frontend/src/components/ContextsSelector.tsx`
- Create: `services/frontend/src/app/__tests__/contexts-selector.test.tsx`

- [ ] **Step 1 : Créer le test unit (rouge)**

Créer `services/frontend/src/app/__tests__/contexts-selector.test.tsx` :

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ContextsSelector from '@/components/ContextsSelector';
import type { Context } from '@/types/user';

vi.mock('@/i18n', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('ContextsSelector', () => {
  const contexts: Context[] = [
    { id: '1', label: 'Au travail' },
    { id: '2', label: 'Famille' },
    { id: '3', label: 'Médical' },
  ];

  it('renders one button per context', () => {
    render(
      <ContextsSelector
        contexts={contexts}
        activeContextIds={new Set()}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Au travail' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Famille' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Médical' })).toBeInTheDocument();
  });

  it('calls onToggle with the context id when clicked', () => {
    const onToggle = vi.fn();
    render(
      <ContextsSelector
        contexts={contexts}
        activeContextIds={new Set()}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Au travail' }));
    expect(onToggle).toHaveBeenCalledWith('1');
  });

  it('marks active contexts with aria-pressed="true"', () => {
    render(
      <ContextsSelector
        contexts={contexts}
        activeContextIds={new Set(['2'])}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Famille' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Au travail' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('shows empty hint when no contexts', () => {
    render(
      <ContextsSelector
        contexts={[]}
        activeContextIds={new Set()}
        onToggle={vi.fn()}
      />,
    );
    expect(
      screen.getByText('conversation.noContextsAdded'),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run : `cd services/frontend && pnpm test -- contexts-selector`
Expected : FAIL (composant inexistant).

- [ ] **Step 3 : Créer le composant**

Créer `services/frontend/src/components/ContextsSelector.tsx` :

```typescript
import { FC } from 'react';
import { useTranslations } from '@/i18n';
import type { Context } from '@/types/user';

interface ContextsSelectorProps {
  contexts: Context[];
  activeContextIds: Set<string>;
  onToggle: (contextId: string) => void;
}

const ContextsSelector: FC<ContextsSelectorProps> = ({
  contexts,
  activeContextIds,
  onToggle,
}) => {
  const t = useTranslations();

  return (
    <div className='w-full px-6 py-4 bg-[#101010] rounded-[40px]'>
      <div className='mb-1 text-sm font-medium text-white'>
        {t('conversation.contexts')}
      </div>
      <div className='flex flex-wrap gap-1.5 min-h-6 max-h-32 overflow-y-auto overflow-x-hidden py-2 px-0.5'>
        {contexts.length === 0 && (
          <p className='text-xs italic text-gray-500'>
            {t('conversation.noContextsAdded')}
          </p>
        )}
        {contexts.map((ctx) => {
          const isActive = activeContextIds.has(ctx.id);
          return (
            <button
              key={ctx.id}
              type='button'
              aria-pressed={isActive}
              onClick={() => onToggle(ctx.id)}
              className={`h-10 p-px transition-colors cursor-pointer rounded-2xl focus:outline-none focus:ring-2 ${
                isActive
                  ? 'orange-to-light-orange-gradient focus:ring-orange-500'
                  : 'border border-gray-600 focus:ring-gray-500'
              }`}
            >
              <div
                className={`flex flex-col justify-center px-3 h-full text-sm text-white font-medium rounded-2xl ${
                  isActive ? 'bg-[#181818]' : 'bg-[#1B1B1B]'
                }`}
              >
                {ctx.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ContextsSelector;
```

- [ ] **Step 4 : Relancer les tests, vérifier qu'ils passent**

Run : `cd services/frontend && pnpm test -- contexts-selector`
Expected : tous PASSED.

- [ ] **Step 5 : Commit**

```bash
git add services/frontend/src/components/ContextsSelector.tsx services/frontend/src/app/__tests__/contexts-selector.test.tsx
git commit -m "feat(frontend): add ContextsSelector component with unit tests"
```

---

### Task C3 : Intégration `InvincibleVoice.tsx` + tests intégration (TDD)

**Files:**
- Modify: `services/frontend/src/components/InvincibleVoice.tsx`
- Create: `services/frontend/src/app/__tests__/current-contexts.test.tsx`

- [ ] **Step 1 : Créer le test d'intégration WebSocket (rouge)**

Inspecter d'abord `services/frontend/src/app/__tests__/current-keywords.test.tsx` pour reprendre le pattern (mocks, harness). Puis créer `services/frontend/src/app/__tests__/current-contexts.test.tsx` calqué dessus :

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InvincibleVoice from '@/components/InvincibleVoice';

// Reuse the same mocks scaffolding as current-keywords.test.tsx:
//   - mock useWebSocket from react-use-websocket
//   - mock fetch for /api/v1/health and getUserData
//   - mock useAudioProcessor, useMicrophoneAccess
// Provide userData with three contexts:
//   { contexts: [{id:'1',label:'Au travail'}, {id:'2',label:'Famille'}, {id:'3',label:'Médical'}] }

// See current-keywords.test.tsx for the exact mock harness; the test below
// assumes `sendMessageMock` and a userData fixture are in scope as in that file.

describe('current.contexts WebSocket dispatch', () => {
  beforeEach(() => {
    // identical setup to current-keywords.test.tsx, then ensure the connection is "open"
  });

  it('sends current.contexts message when a context chip is clicked', async () => {
    render(<InvincibleVoice />);
    // simulate connection open (same trick as current-keywords.test.tsx)
    fireEvent.click(await screen.findByRole('button', { name: 'Au travail' }));
    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith(
        JSON.stringify({ type: 'current.contexts', contexts: ['Au travail'] }),
      );
    });
  });

  it('toggles off when the same chip is clicked twice', async () => {
    render(<InvincibleVoice />);
    fireEvent.click(await screen.findByRole('button', { name: 'Au travail' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Au travail' }));
    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenLastCalledWith(
        JSON.stringify({ type: 'current.contexts', contexts: [] }),
      );
    });
  });

  it('supports multi-select', async () => {
    render(<InvincibleVoice />);
    fireEvent.click(await screen.findByRole('button', { name: 'Au travail' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Famille' }));
    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenLastCalledWith(
        JSON.stringify({
          type: 'current.contexts',
          contexts: ['Au travail', 'Famille'],
        }),
      );
    });
  });

  it('resets active contexts when a new conversation starts (WebSocket OPEN)', async () => {
    render(<InvincibleVoice />);
    fireEvent.click(await screen.findByRole('button', { name: 'Au travail' }));
    // simulate disconnect then reconnect
    triggerReadyStateChange('CLOSED');
    triggerReadyStateChange('OPEN');
    // active set is empty again; the initial send should be []
    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith(
        JSON.stringify({ type: 'current.contexts', contexts: [] }),
      );
    });
  });
});
```

Pour finaliser ce test, importer/réutiliser exactement les helpers (`sendMessageMock`, `triggerReadyStateChange`, harness mock) du fichier `current-keywords.test.tsx`. Si les helpers ne sont pas exportés, dupliquer le scaffolding minimal.

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run : `cd services/frontend && pnpm test -- current-contexts`
Expected : FAIL (composant pas intégré dans `InvincibleVoice.tsx`).

- [ ] **Step 3 : Importer `ContextsSelector` dans `InvincibleVoice.tsx`**

Dans `services/frontend/src/components/InvincibleVoice.tsx`, ajouter l'import (vers la ligne 17, à côté des autres composants) :

```typescript
import ContextsSelector from '@/components/ContextsSelector';
```

Et le type :

```typescript
import type { Context } from '@/types/user';
```

- [ ] **Step 4 : Ajouter l'état `activeContextIds` et le callback `handleContextToggle`**

Dans le composant `InvincibleVoice`, après `const [lastSentKeywords, ...]` (vers la ligne 96) :

```typescript
const [activeContextIds, setActiveContextIds] = useState<Set<string>>(new Set());
const [lastSentContexts, setLastSentContexts] = useState<string[] | null>(null);
```

Et après `sendCurrentKeywords` (vers la ligne 329) :

```typescript
const sendCurrentContexts = useCallback(
  (labels: string[]) => {
    const sortedA = [...labels].sort();
    const sortedB = lastSentContexts ? [...lastSentContexts].sort() : null;
    if (
      sortedB === null ||
      JSON.stringify(sortedA) !== JSON.stringify(sortedB)
    ) {
      sendMessage(
        JSON.stringify({ type: 'current.contexts', contexts: labels }),
      );
      setLastSentContexts(labels);
    }
  },
  [sendMessage, lastSentContexts],
);

const handleContextToggle = useCallback(
  (contextId: string) => {
    setActiveContextIds((prev) => {
      const next = new Set(prev);
      if (next.has(contextId)) {
        next.delete(contextId);
      } else {
        next.add(contextId);
      }
      const labels = (userData?.user_settings?.contexts ?? [])
        .filter((c) => next.has(c.id))
        .map((c) => c.label);
      sendCurrentContexts(labels);
      return next;
    });
  },
  [sendCurrentContexts, userData?.user_settings?.contexts],
);
```

- [ ] **Step 5 : Reset `activeContextIds` à l'ouverture de connexion**

Dans le `useEffect` qui se déclenche sur `readyState === ReadyState.OPEN` (vers la ligne 1024-1044), ajouter avant le `setRawChatHistory([])` :

```typescript
setActiveContextIds(new Set());
setLastSentContexts(null);
sendMessage(JSON.stringify({ type: 'current.contexts', contexts: [] }));
```

- [ ] **Step 6 : Rendre `ContextsSelector` au-dessus de la card friends (desktop)**

Localiser le bloc `<div className='w-full px-6 py-4 bg-[#101010] rounded-[40px]'>` qui contient `t('common.friends')` (vers la ligne 1305). Insérer juste **avant** ce bloc :

```typescript
<ContextsSelector
  contexts={userData?.user_settings?.contexts ?? []}
  activeContextIds={activeContextIds}
  onToggle={handleContextToggle}
/>
```

- [ ] **Step 7 : Rendre `ContextsSelector` en mobile**

Localiser `MobileConversationLayout` (`services/frontend/src/components/mobile/MobileConversationLayout.tsx`) et :

1. Ajouter les props `contexts`, `activeContextIds`, `onContextToggle` à son interface.
2. Rendre `<ContextsSelector ... />` au-dessus du bloc "keywords" (à l'emplacement choisi en exécution selon contraintes d'espace ; sinon collapsible/accordion via `<details>` natif).
3. Dans `InvincibleVoice.tsx`, passer ces props à `<MobileConversationLayout ... />` (vers la ligne 1086).

- [ ] **Step 8 : Relancer les tests, vérifier qu'ils passent**

Run : `cd services/frontend && pnpm test -- contexts-selector current-contexts`
Expected : tous PASSED.

- [ ] **Step 9 : Lancer la compilation**

Run : `cd services/frontend && pnpm exec tsc --noEmit`
Expected : pas d'erreur.

- [ ] **Step 10 : Commit**

```bash
git add services/frontend/src/components/InvincibleVoice.tsx services/frontend/src/components/mobile/MobileConversationLayout.tsx services/frontend/src/app/__tests__/current-contexts.test.tsx
git commit -m "feat(frontend): wire ContextsSelector into conversation flow with reset on connect"
```

---

## Chantier D — Settings editor + i18n

### Task D1 : Settings editor desktop (CRUD contextes)

**Files:**
- Modify: `services/frontend/src/components/settings/SettingsPopup.tsx`

- [ ] **Step 1 : Étendre la signature de `handleInputChange`**

Dans `SettingsPopup.tsx` (vers la ligne 73), modifier la signature de `handleInputChange` pour accepter `Context[]` :

```typescript
const handleInputChange = useCallback(
  (
    field: keyof UserSettings,
    value: string | string[] | Document[] | Context[] | boolean | null,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  },
  [],
);
```

Ajouter l'import du type :

```typescript
import type { Context } from '@/utils/userData';
```

(Si le type `Context` n'est pas exporté depuis `userData`, l'exporter dans Task C1 ou importer depuis `@/types/user`.)

- [ ] **Step 2 : Ajouter l'état local pour le champ d'input**

Après `const [newKeywordInput, setNewKeywordInput] = useState<string>('');` (ligne ~48) :

```typescript
const [newContextInput, setNewContextInput] = useState<string>('');
const [contextInputError, setContextInputError] = useState<string | null>(null);
```

- [ ] **Step 3 : Ajouter handlers add / remove / keypress**

Après le bloc `handleKeywordInputKeyPress` (vers la ligne 145) :

```typescript
const handleAddContext = useCallback(() => {
  const label = newContextInput.trim();
  if (!label) return;
  if (label.length > 100) {
    setContextInputError(t('settings.contextTooLong'));
    return;
  }
  const exists = formData.contexts.some(
    (c) => c.label.toLowerCase() === label.toLowerCase(),
  );
  if (exists) {
    setContextInputError(t('settings.contextDuplicate'));
    return;
  }
  handleInputChange('contexts', [
    ...formData.contexts,
    { id: crypto.randomUUID(), label },
  ]);
  setNewContextInput('');
  setContextInputError(null);
}, [formData.contexts, handleInputChange, newContextInput, t]);

const handleRemoveContext = useCallback(
  (contextId: string) => {
    handleInputChange(
      'contexts',
      formData.contexts.filter((c) => c.id !== contextId),
    );
  },
  [formData.contexts, handleInputChange],
);

const handleContextInputKeyPress = useCallback(
  (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddContext();
    }
  },
  [handleAddContext],
);
```

- [ ] **Step 4 : Insérer la section dans le rendu JSX**

Localiser la section additional_keywords dans le JSX (juste après le bloc qui affiche `t('settings.additionalKeywords')`). Insérer **après** cette section une section parallèle :

```typescript
<div className='mb-6'>
  <label className='block mb-2 text-sm font-medium text-white'>
    {t('settings.contexts')}
  </label>
  <div className='flex gap-2 mb-2'>
    <input
      type='text'
      value={newContextInput}
      onChange={(e) => {
        setNewContextInput(e.target.value);
        setContextInputError(null);
      }}
      onKeyDown={handleContextInputKeyPress}
      placeholder={t('settings.addContextPlaceholder')}
      maxLength={100}
      className='flex-1 px-3 py-2 text-white bg-[#1B1B1B] border border-gray-600 rounded-lg focus:outline-none focus:border-green'
    />
    <button
      type='button'
      onClick={handleAddContext}
      className='px-4 py-2 text-white bg-green rounded-lg hover:bg-green-600'
    >
      {t('common.add')}
    </button>
  </div>
  {contextInputError && (
    <p className='text-xs text-red-400 mb-2'>{contextInputError}</p>
  )}
  <div className='flex flex-wrap gap-2'>
    {formData.contexts.length === 0 && (
      <p className='text-xs italic text-gray-500'>
        {t('settings.noContextsAdded')}
      </p>
    )}
    {formData.contexts.map((ctx) => (
      <div
        key={ctx.id}
        className='flex items-center gap-2 px-3 py-1 bg-[#1B1B1B] border border-gray-600 rounded-lg'
      >
        <span className='text-sm text-white'>{ctx.label}</span>
        <button
          type='button'
          onClick={() => handleRemoveContext(ctx.id)}
          aria-label={`Remove ${ctx.label}`}
          className='text-gray-400 hover:text-red-400'
        >
          <X size={14} />
        </button>
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 5 : Lancer la compilation**

Run : `cd services/frontend && pnpm exec tsc --noEmit`
Expected : pas d'erreur.

- [ ] **Step 6 : Commit**

```bash
git add services/frontend/src/components/settings/SettingsPopup.tsx
git commit -m "feat(settings): add contexts CRUD in desktop settings popup"
```

---

### Task D2 : Settings editor mobile

**Files:**
- Modify: `services/frontend/src/components/settings/MobileSettingsPopup.tsx`

- [ ] **Step 1 : Inspecter `MobileSettingsPopup.tsx`**

Run : `wc -l services/frontend/src/components/settings/MobileSettingsPopup.tsx`
Lire le fichier pour repérer la section additional_keywords (calquée sur desktop).

- [ ] **Step 2 : Dupliquer le même pattern que Task D1 dans `MobileSettingsPopup.tsx`**

Ajouter l'état local (`newContextInput`, `contextInputError`), les handlers (`handleAddContext`, `handleRemoveContext`, `handleContextInputKeyPress`), et le bloc JSX (identique à Task D1, éventuellement avec quelques classes Tailwind ajustées pour le mobile, ex: `text-base` au lieu de `text-sm`).

Si la section keywords mobile a une UX différente du desktop (ex: liste verticale au lieu de flex-wrap), aligner le pattern contextes sur le pattern keywords mobile.

- [ ] **Step 3 : Lancer la compilation**

Run : `cd services/frontend && pnpm exec tsc --noEmit`
Expected : pas d'erreur.

- [ ] **Step 4 : Commit**

```bash
git add services/frontend/src/components/settings/MobileSettingsPopup.tsx
git commit -m "feat(settings): add contexts CRUD in mobile settings popup"
```

---

### Task D3 : i18n FR / EN / ES / PT / DE

**Files:**
- Modify: `services/frontend/src/messages/fr.json`
- Modify: `services/frontend/src/messages/en.json`
- Modify: `services/frontend/src/messages/es.json`
- Modify: `services/frontend/src/messages/pt.json`
- Modify: `services/frontend/src/messages/de.json`

- [ ] **Step 1 : Ajouter les clés FR**

Dans `services/frontend/src/messages/fr.json`, sous la section `"conversation"`, ajouter :

```json
"contexts": "Contextes",
"noContextsAdded": "Aucun contexte. Ajoutez-en dans les paramètres.",
```

Sous la section `"settings"`, ajouter :

```json
"contexts": "Contextes",
"addContextPlaceholder": "Ajoutez un contexte (ex: au travail)",
"noContextsAdded": "Aucun contexte ajouté pour le moment.",
"contextTooLong": "Le contexte doit faire moins de 100 caractères",
"contextDuplicate": "Ce contexte existe déjà"
```

- [ ] **Step 2 : Ajouter les clés EN**

```json
// conversation
"contexts": "Contexts",
"noContextsAdded": "No contexts. Add them in settings.",

// settings
"contexts": "Contexts",
"addContextPlaceholder": "Add a context (e.g. at work)",
"noContextsAdded": "No contexts added yet.",
"contextTooLong": "Context must be under 100 characters",
"contextDuplicate": "This context already exists"
```

- [ ] **Step 3 : Ajouter les clés ES**

```json
// conversation
"contexts": "Contextos",
"noContextsAdded": "Sin contextos. Añádelos en los ajustes.",

// settings
"contexts": "Contextos",
"addContextPlaceholder": "Añade un contexto (ej: en el trabajo)",
"noContextsAdded": "Aún no se han añadido contextos.",
"contextTooLong": "El contexto debe tener menos de 100 caracteres",
"contextDuplicate": "Este contexto ya existe"
```

- [ ] **Step 4 : Ajouter les clés PT**

```json
// conversation
"contexts": "Contextos",
"noContextsAdded": "Sem contextos. Adicione-os nas configurações.",

// settings
"contexts": "Contextos",
"addContextPlaceholder": "Adicione um contexto (ex: no trabalho)",
"noContextsAdded": "Nenhum contexto adicionado ainda.",
"contextTooLong": "O contexto deve ter menos de 100 caracteres",
"contextDuplicate": "Este contexto já existe"
```

- [ ] **Step 5 : Ajouter les clés DE**

```json
// conversation
"contexts": "Kontexte",
"noContextsAdded": "Keine Kontexte. Fügen Sie sie in den Einstellungen hinzu.",

// settings
"contexts": "Kontexte",
"addContextPlaceholder": "Kontext hinzufügen (z. B. bei der Arbeit)",
"noContextsAdded": "Noch keine Kontexte hinzugefügt.",
"contextTooLong": "Der Kontext darf maximal 100 Zeichen lang sein",
"contextDuplicate": "Dieser Kontext existiert bereits"
```

- [ ] **Step 6 : Valider la cohérence JSON**

Run : `cd services/frontend && node -e "['fr','en','es','pt','de'].forEach(l => JSON.parse(require('fs').readFileSync('src/messages/' + l + '.json', 'utf8')))"`
Expected : pas d'erreur de parsing.

- [ ] **Step 7 : Commit**

```bash
git add services/frontend/src/messages/
git commit -m "i18n: add contexts translations in fr/en/es/pt/de"
```

---

## Chantier E — Validation staging + bascule prod

### Task E1 : Push staging + smoke test E2E

**Files:** (aucun ; opérations git + SSH)

- [ ] **Step 1 : Vérifier l'état du worktree et la branche**

Run : `git status && git log --oneline -15`
Expected : worktree propre, ~13 commits chantiers A-D, branche `worktree-subproject-3-clickable-contexts`.

- [ ] **Step 2 : Lancer la suite de tests complète backend**

Run : `cd services/backend && uv run pytest tests/ -v`
Expected : tous PASSED (anciens + nouveaux).

- [ ] **Step 3 : Lancer la suite de tests frontend**

Run : `cd services/frontend && pnpm test`
Expected : tous PASSED (anciens + nouveaux).

- [ ] **Step 4 : Merger la branche worktree dans `staging`**

```bash
# Depuis le worktree
WORKTREE_BRANCH=$(git rev-parse --abbrev-ref HEAD)
cd /Users/louis/claude-local/invincible-voice  # repo principal
git fetch origin
git checkout staging
git pull origin staging
git merge --no-ff "$WORKTREE_BRANCH" -m "feat: clickable contexts (sous-projet 3)"
git push origin staging
```

- [ ] **Step 5 : Suivre le déploiement CI staging**

Run : `gh run watch -R louisdv/invincible-voice` (ou ouvrir https://github.com/louisdv/invincible-voice/actions)
Expected : workflow `deploy-staging.yml` SUCCESS en ~10s.

- [ ] **Step 6 : Smoke test manuel sur https://staging.voice.amiral.tech**

Procédure :

1. Ouvrir https://staging.voice.amiral.tech en navigateur, se connecter.
2. Vérifier que les 5 contextes par défaut sont visibles dans la colonne droite (au-dessus d'Amis).
3. Aller dans Paramètres : vérifier la section Contextes, ajouter un contexte custom (ex: « Avec ma sœur Sophie »), sauvegarder.
4. Revenir sur la page conversation, démarrer une conversation, cliquer sur 1-2 contextes.
5. Parler à voix haute pour déclencher une suggestion. Vérifier que les suggestions reflètent les contextes choisis (qualitatif).
6. Terminer la conversation, en redémarrer une nouvelle : vérifier que les contextes sont visuellement désélectionnés.
7. Désactiver un contexte (re-clic) en cours de conversation : vérifier que la suggestion suivante change.

- [ ] **Step 7 : Si bug détecté → fix sur la branche staging, re-push, re-smoke. Sinon → procéder à E2.**

---

### Task E2 : Bascule prod + validation utilisateur

**Files:** (aucun ; opérations git)

- [ ] **Step 1 : Merger staging dans main**

```bash
git checkout main
git pull origin main
git merge --no-ff staging -m "feat: clickable contexts (sous-projet 3) — promote to prod"
git push origin main
```

- [ ] **Step 2 : Suivre le déploiement CI prod**

Run : `gh run watch -R louisdv/invincible-voice`
Expected : workflow `deploy-prod.yml` SUCCESS en ~15s.

- [ ] **Step 3 : Smoke test prod**

Procédure identique à E1 step 6 mais sur https://voice.amiral.tech.

- [ ] **Step 4 : Si OK → tagger la phase ; si KO → rollback**

OK :

```bash
git tag phase-3-clickable-contexts
git push origin phase-3-clickable-contexts
```

KO (rollback) :

```bash
# Identifier le commit de merge sur main (premier git log)
git revert -m 1 <merge-commit-sha>
git push origin main
# CI redeploy automatique
```

- [ ] **Step 5 : Valider en usage réel pendant 2-3 conversations**

Procédure non automatisable : Louis utilise l'app en prod sur quelques jours, confirme qualitativement que les suggestions teintées par contextes sont plus pertinentes qu'avec keywords seuls. Si pas concluant, ouvrir un ticket d'ajustement (ex: renforcer le wording de la section system prompt) sans bloquer la phase.

- [ ] **Step 6 : Documenter la phase**

Créer `docs/phases/<date>-phase-summary-execution-sous-projet-3.md` calqué sur le sous-projet 2 : ce qui a été fait par chantier, bugs imprévus rencontrés, leçons. Pas de checklist à exécuter dans ce doc — c'est un rapport.

---

## Notes opérationnelles

- **Hook pre-commit** : ne jamais utiliser `--no-verify`. Si un hook échoue, lire le message et corriger.
- **Conventional commits** : `feat()`, `fix()`, `docs()`, `test()`, `chore()`, `i18n` (sans scope OK pour celui-ci).
- **TDD strict** : rouge → vert → commit. Pas de skip.
- **Lint frontend pré-existant cassé** (cf sous-projet 2) : non bloquant, ne pas chercher à le corriger dans cette phase.
- **Mémoire VPS** : ~2.5 GB libres en prod ; build + restart Cloud Run-style sans risque.
