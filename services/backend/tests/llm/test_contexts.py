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
