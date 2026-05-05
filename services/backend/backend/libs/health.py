from backend.typing import HealthStatus


async def get_health():
    return HealthStatus(
        stt_up=True,
        llm_up=True,
        llm_on_fallback=False,
    )
