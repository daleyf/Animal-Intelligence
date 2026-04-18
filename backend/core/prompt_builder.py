"""
Prompt construction utilities.

Handles:
  - System prompt generation with optional personalization context
  - Context window management with smart token budget allocation

Context window strategy:
  - ``min_recent_messages``: always keep the N most recent exchanges regardless
    of token count (prevents the assistant losing track of the immediate context
    when a long system prompt crowds out recent turns).
  - ``memory_budget_ratio``: explicitly allocate a fraction of the available
    budget for memory-injected context, leaving the rest for conversation
    history.  Default 0.25 reserves 25 % for memory and 75 % for history.
  - Returns ``(messages, stats)`` so callers can surface utilisation metrics.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from db.models import Message, UserProfile


def estimate_tokens(text: str) -> int:
    """Fast token count approximation: word count × 1.3 + 1."""
    return int(len(text.split()) * 1.3) + 1


def build_system_prompt(
    profile: "UserProfile | None",
    personalization_enabled: bool,
) -> str:
    """
    Build the system prompt prepended to every LLM request.

    Injects user profile data when personalization is enabled.
    """
    base = (
        "You are Anchorpoint, a private, helpful AI assistant. "
        "All conversations happen locally on the user's device — "
        "no data is sent to the cloud. "
        "Be concise, direct, and thoughtful in your responses."
    )

    if not personalization_enabled or profile is None:
        return base

    parts = [base, "\n\nAbout the user:"]

    if profile.name:
        parts.append(f"- Name: {profile.name}")
    if profile.home_location:
        parts.append(f"- Home location: {profile.home_location}")
    if profile.work_location:
        parts.append(f"- Work location: {profile.work_location}")
    if profile.interests:
        interests_str = ", ".join(profile.interests)
        parts.append(f"- Interests: {interests_str}")
    if profile.projects:
        projects_str = ", ".join(profile.projects)
        parts.append(f"- Current projects: {projects_str}")

    parts.append(
        "\nTailor your responses to be personally relevant when appropriate, "
        "but don't force personal context into unrelated answers."
    )

    return "\n".join(parts)


def build_context_messages(
    all_messages: "list[Message]",
    system_prompt: str,
    max_tokens: int = 4096,
    response_buffer: int = 512,
    min_recent_messages: int = 4,
    memory_budget_ratio: float = 0.25,
) -> tuple[list[dict], dict]:
    """
    Select which messages to include in the LLM context given a token budget.

    Strategy:
      1. Reserve ``response_buffer`` tokens for the LLM response.
      2. Deduct system-prompt tokens from the remaining budget.
      3. Always include the ``min_recent_messages`` most recent non-system
         messages, regardless of their token cost.  This guarantees the model
         never loses the immediate conversational context.
      4. Of the remaining budget, reserve ``memory_budget_ratio`` for future
         memory-injected context (caller may prepend memory snippets to the
         system prompt within this allowance).
      5. Fill any leftover budget with older messages (newest-first).

    Returns:
      ``(messages, stats)`` where *messages* is a list of
      ``{"role": ..., "content": ...}`` dicts for Ollama and *stats* is a dict
      with token accounting information.
    """
    # ── Budget calculation ──────────────────────────────────────────────────
    system_tokens = estimate_tokens(system_prompt)
    total_budget = max_tokens - response_buffer - system_tokens
    if total_budget <= 0:
        # System prompt alone exceeds the budget — still honour min_recent_messages.
        non_sys = [m for m in all_messages if m.role != "system"]
        guaranteed = non_sys[-min_recent_messages:] if non_sys else []
        history_tokens = sum(estimate_tokens(m.content) for m in guaranteed)
        stats = {
            "max_tokens": max_tokens,
            "system_tokens": system_tokens,
            "history_tokens": history_tokens,
            "memory_budget_reserved": 0,
            "messages_included": len(guaranteed),
            "messages_total": len(non_sys),
            "budget_exhausted": True,
        }
        return [{"role": m.role, "content": m.content} for m in guaranteed], stats

    # Budget split: history gets (1 - ratio), rest implicitly reserved for memory
    history_budget = int(total_budget * (1.0 - memory_budget_ratio))

    # ── Non-system messages (newest-first for processing) ──────────────────
    non_system = [m for m in all_messages if m.role != "system"]
    if not non_system:
        return [], {"max_tokens": max_tokens, "system_tokens": system_tokens,
                    "history_tokens": 0, "messages_included": 0,
                    "messages_total": 0, "budget_exhausted": False}

    # ── Step 1: Always include min_recent_messages most recent turns ────────
    guaranteed = non_system[-min_recent_messages:]
    guaranteed_tokens = sum(estimate_tokens(m.content) for m in guaranteed)
    remaining_budget = history_budget - guaranteed_tokens

    # ── Step 2: Fill remaining budget with older messages ──────────────────
    older = non_system[: max(0, len(non_system) - min_recent_messages)]
    extra: list["Message"] = []
    for msg in reversed(older):  # newest-first within "older" slice
        cost = estimate_tokens(msg.content)
        if remaining_budget - cost < 0:
            break
        extra.insert(0, msg)
        remaining_budget -= cost

    selected = extra + guaranteed
    history_tokens_used = guaranteed_tokens + sum(estimate_tokens(m.content) for m in extra)

    stats = {
        "max_tokens": max_tokens,
        "system_tokens": system_tokens,
        "history_tokens": history_tokens_used,
        "memory_budget_reserved": total_budget - history_budget,
        "messages_included": len(selected),
        "messages_total": len(non_system),
        "budget_exhausted": len(selected) < len(non_system),
    }

    return [{"role": m.role, "content": m.content} for m in selected], stats
