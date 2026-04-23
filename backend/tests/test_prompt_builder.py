"""
Unit tests for prompt_builder utilities.

don't require any external services, so we can test the core logic in isolation.
"""

from unittest.mock import MagicMock
from core.prompt_builder import build_system_prompt, build_context_messages, estimate_tokens


# Estimate tokens tests
# -------------- #
class TestEstimateTokens:
    def test_empty_string(self):
        """Test that an empty string returns at least 1 token (some models treat empty input as 1 token)."""
        assert estimate_tokens("") == 1

    def test_single_word(self):
        """Test that a single word returns at least 1 token."""
        assert estimate_tokens("hello") >= 1

    def test_scales_with_length(self):
        """Test that a longer string returns more tokens than a shorter string."""
        short = estimate_tokens("hello")
        long = estimate_tokens("hello world foo bar baz qux")
        assert long > short


# Build system prompt tests
# -------------- #
class TestBuildSystemPrompt:
    def test_no_profile(self):
        """Test that if no profile is provided, the prompt still includes basic Anchorpoint info."""
        result = build_system_prompt(profile=None, personalization_enabled=True)
        assert "Anchorpoint" in result
        assert "private" in result

    def test_personalization_disabled(self):
        """Test that if personalization is disabled, profile info is not included even if profile is provided."""
        profile = MagicMock()
        profile.name = "Alice"
        result = build_system_prompt(profile=profile, personalization_enabled=False)
        assert "Alice" not in result

    def test_personalization_enabled_with_name(self):
        """Test that if personalization is enabled and profile has a name, it is included in the system prompt."""
        profile = MagicMock()
        profile.name = "Alice"
        profile.home_location = "Pittsburgh"
        profile.work_location = None
        profile.interests = ["hiking", "coding"]
        profile.projects = ["Anchorpoint"]
        result = build_system_prompt(profile=profile, personalization_enabled=True)
        assert "Alice" in result
        assert "Pittsburgh" in result
        assert "hiking" in result
        assert "Anchorpoint" in result

    def test_partial_profile_no_errors(self):
        """Test that if the profile has some None fields, it does not cause errors and includes available info."""
        profile = MagicMock()
        profile.name = None
        profile.home_location = None
        profile.work_location = None
        profile.interests = None
        profile.projects = None
        # Should not raise even with all-None profile
        result = build_system_prompt(profile=profile, personalization_enabled=True)
        assert "Anchorpoint" in result


# Build context messages tests
# -------------- #
class TestBuildContextMessages:
    def _make_message(self, role: str, content: str):
        """message factory to avoid repetition in tests"""
        msg = MagicMock()
        msg.role = role
        msg.content = content
        return msg

    def test_empty_history(self):
        """Test that empty message history returns an empty list and correct stats."""
        result, stats = build_context_messages([], system_prompt="sys", max_tokens=4096)
        assert result == []
        assert stats["messages_included"] == 0

    def test_includes_messages_within_budget(self):
        """Test that messages that fit within the token budget are included in the result."""
        messages = [
            self._make_message("user", "Hello"),
            self._make_message("assistant", "Hi there"),
        ]
        result, stats = build_context_messages(messages, system_prompt="sys", max_tokens=4096)
        assert len(result) == 2
        assert stats["messages_included"] == 2

    def test_skips_system_role_messages(self):
        """Test that messages with role 'system' are not included in the context messages (system prompt is separate)."""
        messages = [
            self._make_message("system", "This is a system message"),
            self._make_message("user", "Hello"),
        ]
        result, _stats = build_context_messages(messages, system_prompt="sys", max_tokens=4096)
        # system-role message should not be included in the result
        assert all(m["role"] != "system" for m in result)

    def test_truncates_oldest_messages_first(self):
        """Test that when the token budget is exceeded, the oldest messages are truncated first."""
        # Make messages that would overflow a tiny budget
        messages = [
            self._make_message("user", "old message " * 100),
            self._make_message("assistant", "old reply " * 100),
            self._make_message("user", "recent"),
        ]
        result, stats = build_context_messages(messages, system_prompt="", max_tokens=50)
        # Most recent message should always be included
        assert result[-1]["content"] == "recent"

    def test_newest_message_always_included(self):
        """Test that the newest message is always included even if it alone exceeds the token budget."""
        msg = self._make_message("user", "final question")
        result, stats = build_context_messages([msg], system_prompt="", max_tokens=10)
        assert len(result) == 1
        assert result[0]["content"] == "final question"

    def test_stats_returned(self):
        """Test that the stats dictionary includes expected keys and values."""
        messages = [self._make_message("user", "Hello")]
        _result, stats = build_context_messages(messages, system_prompt="sys", max_tokens=4096)
        assert "system_tokens" in stats
        assert "history_tokens" in stats
        assert "messages_included" in stats
        assert "budget_exhausted" in stats

    def test_min_recent_messages_always_included(self):
        """min_recent_messages most recent turns always appear even under tight budget."""
        messages = [
            self._make_message("user", "old " * 200),
            self._make_message("assistant", "old reply " * 200),
            self._make_message("user", "recent question"),
            self._make_message("assistant", "recent answer"),
        ]
        result, _stats = build_context_messages(
            messages, system_prompt="", max_tokens=100, min_recent_messages=2
        )
        contents = [m["content"] for m in result]
        assert "recent question" in contents
        assert "recent answer" in contents
