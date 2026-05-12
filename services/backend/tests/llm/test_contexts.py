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


def test_default_contexts_fr_constant_exposes_five_french_labels():
    from backend.llm.system_prompt import DEFAULT_CONTEXTS_FR
    assert len(DEFAULT_CONTEXTS_FR) == 5
    assert "Au travail" in DEFAULT_CONTEXTS_FR
    assert all(isinstance(c, str) for c in DEFAULT_CONTEXTS_FR)
    assert all(len(c) > 0 and len(c) <= 100 for c in DEFAULT_CONTEXTS_FR)
