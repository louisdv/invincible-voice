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


@pytest.mark.asyncio
async def test_current_contexts_event_skips_regen_when_unchanged():
    """Empty-to-empty (initial WebSocket OPEN reset) must NOT trigger regen.

    Otherwise the backend generates suggestions on an empty conversation,
    and a user click before any speaker turn lands the assistant message
    at chat-history position 0, breaking chronological ordering.
    """
    from backend.unmute_handler import UnmuteHandler

    user_data = _make_user_data()
    handler = MagicMock(spec=UnmuteHandler)
    handler.chatbot = Chatbot(user_data, dt.datetime(2026, 5, 12, 10, 0))
    handler._generate_response = AsyncMock()
    handler.set_current_contexts = UnmuteHandler.set_current_contexts.__get__(handler)

    # Chatbot starts with current_contexts == []; sending [] is a no-op
    message = ora.CurrentContexts(type="current.contexts", contexts=[])
    await handler.set_current_contexts(message)

    assert handler.chatbot.current_contexts == []
    handler._generate_response.assert_not_awaited()


@pytest.mark.asyncio
async def test_current_contexts_event_triggers_regen_when_cleared():
    """Going from non-empty to empty (user deselected all chips) MUST regen."""
    from backend.unmute_handler import UnmuteHandler

    user_data = _make_user_data()
    handler = MagicMock(spec=UnmuteHandler)
    handler.chatbot = Chatbot(user_data, dt.datetime(2026, 5, 12, 10, 0))
    handler.chatbot.current_contexts = ["Au travail"]
    handler._generate_response = AsyncMock()
    handler.set_current_contexts = UnmuteHandler.set_current_contexts.__get__(handler)

    message = ora.CurrentContexts(type="current.contexts", contexts=[])
    await handler.set_current_contexts(message)

    assert handler.chatbot.current_contexts == []
    handler._generate_response.assert_awaited_once()
