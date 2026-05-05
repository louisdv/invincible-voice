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
