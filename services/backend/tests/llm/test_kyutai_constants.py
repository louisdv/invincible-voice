"""Unit tests for backend.kyutai_constants env var handling."""

import importlib

import pytest


@pytest.fixture
def required_env(monkeypatch, tmp_path):
    """Set the env vars required for kyutai_constants to import without errors."""
    monkeypatch.setenv("STT_IS_GRADIUM", "true")
    monkeypatch.setenv("KYUTAI_STT_URL", "wss://test.example/asr")
    monkeypatch.setenv("TTS_IS_GRADIUM", "true")
    monkeypatch.setenv("TTS_SERVER", "test.example")
    monkeypatch.setenv("KYUTAI_LLM_MODEL", "cerebras/llama3.1-8b")
    monkeypatch.setenv("KYUTAI_USERS_DATA_PATH", str(tmp_path))
    return monkeypatch


def test_llm_url_is_none_when_env_var_empty(required_env):
    required_env.setenv("KYUTAI_LLM_URL", "")
    required_env.setenv("KYUTAI_LLM_API_KEY", "test-key")
    from backend import kyutai_constants

    importlib.reload(kyutai_constants)
    assert kyutai_constants.LLM_URL is None


def test_llm_api_key_is_none_when_env_var_empty(required_env):
    required_env.setenv("KYUTAI_LLM_URL", "https://api.test/v1")
    required_env.setenv("KYUTAI_LLM_API_KEY", "")
    from backend import kyutai_constants

    importlib.reload(kyutai_constants)
    assert kyutai_constants.LLM_API_KEY is None


def test_llm_url_is_none_when_env_var_missing(required_env):
    required_env.delenv("KYUTAI_LLM_URL", raising=False)
    required_env.setenv("KYUTAI_LLM_API_KEY", "test-key")
    from backend import kyutai_constants

    importlib.reload(kyutai_constants)
    assert kyutai_constants.LLM_URL is None


def test_llm_api_key_is_none_when_env_var_missing(required_env):
    required_env.setenv("KYUTAI_LLM_URL", "https://api.test/v1")
    required_env.delenv("KYUTAI_LLM_API_KEY", raising=False)
    from backend import kyutai_constants

    importlib.reload(kyutai_constants)
    assert kyutai_constants.LLM_API_KEY is None
