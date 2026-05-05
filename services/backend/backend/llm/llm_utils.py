import logging
from typing import AsyncIterator

import pydantic

from backend import kyutai_constants
from backend.llm.providers import chat_completion_stream

logger = logging.getLogger(__name__)


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
