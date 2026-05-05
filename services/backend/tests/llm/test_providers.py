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
