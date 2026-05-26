"""Set required environment variables before any backend module is imported."""
import os

os.environ.setdefault("STT_IS_GRADIUM", "false")
os.environ.setdefault("KYUTAI_STT_URL", "ws://localhost")
os.environ.setdefault("TTS_IS_GRADIUM", "false")
os.environ.setdefault("TTS_SERVER", "ws://localhost")
os.environ.setdefault("KYUTAI_LLM_MODEL", "test-model")
os.environ.setdefault("KYUTAI_USERS_DATA_PATH", "/tmp/test_users")
