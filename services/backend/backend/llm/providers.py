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
