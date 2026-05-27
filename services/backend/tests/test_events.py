"""Verify that Voice WebSocket event types use 'voice.*' prefix."""
from uuid import uuid4

from backend.openai_realtime_api_events import (
    UnmuteAdditionalOutputs,
    UnmuteResponseTextDeltaReady,
    UnmuteResponseAudioDeltaReady,
    UnmuteInterruptedByVAD,
)


def test_additional_outputs_type_is_voice_prefixed():
    ev = UnmuteAdditionalOutputs(args={})
    assert ev.type == "voice.additional_outputs"


def test_text_delta_type_is_voice_prefixed():
    ev = UnmuteResponseTextDeltaReady(delta="hello", response_id=uuid4())
    assert ev.type == "voice.response.text.delta.ready"


def test_audio_delta_type_is_voice_prefixed():
    ev = UnmuteResponseAudioDeltaReady(number_of_samples=1)
    assert ev.type == "voice.response.audio.delta.ready"


def test_interrupted_by_vad_type_is_voice_prefixed():
    ev = UnmuteInterruptedByVAD()
    assert ev.type == "voice.interrupted_by_vad"
