"""Unit tests for the Context model and UserSettings.contexts field."""

import datetime as dt
import uuid

import pytest

from backend.storage import UserData
from backend.typing import Context, Conversation, Document, UserSettings


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


def test_default_contexts_fr_constant_exposes_five_french_labels():
    from backend.llm.system_prompt import DEFAULT_CONTEXTS_FR
    assert len(DEFAULT_CONTEXTS_FR) == 5
    assert "Au travail" in DEFAULT_CONTEXTS_FR
    assert all(isinstance(c, str) for c in DEFAULT_CONTEXTS_FR)
    assert all(len(c) > 0 and len(c) <= 100 for c in DEFAULT_CONTEXTS_FR)


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
