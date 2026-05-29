"""Draft a LinkedIn comment for one post with Gemini. Client passed in so each
user runs against their OWN Gemini key. Prompt preserves the hard-won rules:
no questions, comment is about the POST not the user."""
from __future__ import annotations

from typing import Dict

PROMPT_TEMPLATE = """\
You write LinkedIn comments on behalf of the user described below. The
profile is BACKGROUND CONTEXT about who is commenting and the tone they
use — it is NOT material to showcase in the comment.

USER PROFILE (background only — use for tone, not topic):
{profile}

{style_block}

POST AUTHOR: {author}
POST CONTENT:
\"\"\"
{text}
\"\"\"

═══════════════════════════════════════════════════════════════════════
CORE RULE — THE COMMENT IS ABOUT THE POST
═══════════════════════════════════════════════════════════════════════

The comment must be 90-100% about the POST's content, argument, or topic.
It is NOT a place to talk about the user's projects, company, role, or
journey — even when the post is in the user's field. The user wants to
ADD VALUE to the post's discussion, not advertise themselves.

Mention the user's own work/experience ONLY when:
  (a) it contributes a specific, concrete data point that materially
      sharpens the conversation, AND
  (b) the post doesn't already cover that point, AND
  (c) it can be slipped in as a brief clause, not the focus of the comment.

When in doubt: DO NOT mention the user's projects or identity. Default to
zero self-reference. Comments that simply engage thoughtfully with the
post's substance perform far better than ones that pivot to the commenter.

FORBIDDEN OPENERS / PHRASINGS (these are the failure mode — never use):
  - "As a student founder building AISkillBench..."
  - "At [my project] we see..."
  - "This resonates with what I'm building..."
  - "I'm working on something similar - [pitch]"
  - "Would love to connect / chat / share notes"
  - Any sentence whose subject is "I" or "we" before you've engaged with
    the post's actual content

═══════════════════════════════════════════════════════════════════════
ABSOLUTE RULE: NO QUESTIONS
═══════════════════════════════════════════════════════════════════════

The comment MUST NOT contain a question mark. Do not ask the author
anything. Do not end with "what do you think?", "have you tried X?",
"how do you handle Y?", "thoughts?", or any other interrogative form.
Questions on LinkedIn go unanswered — the user wants comments that
acknowledge what the author is doing, not requests for follow-up.

If your draft contains a "?" — rewrite it as a statement before
outputting. Convert "Have you considered X?" -> "X is worth considering."
Convert "How does this scale?" -> "The scaling angle is the interesting
question here." (Even meta-mentions like "the interesting question" are
fine; literal questions to the author are not.)

═══════════════════════════════════════════════════════════════════════
SHAPE — pick the form that fits. All shapes are STATEMENTS.
═══════════════════════════════════════════════════════════════════════

Choose whichever fits the post best:
  * Acknowledgment of a specific thing the author is doing/saying, with
    one line of why it matters or what's notable about it
  * Specific reaction to one concrete detail from the post
    ("The point about X is what most people miss because Y")
  * Sharp observation that EXTENDS the post's argument with a new angle
  * Specific agreement with nuance ("Yes - and the X part is what most
    teams underestimate, because Y")
  * Counterpoint or alternative framing, stated respectfully as a claim
  * Industry-level data point, example, or reference that supports or
    challenges the post's claim
  * Useful resource or relevant work the post's author might not know of
  * Sincere appreciation anchored to a specific line or claim from the
    post — never bare flattery

═══════════════════════════════════════════════════════════════════════
TONE & FORM
═══════════════════════════════════════════════════════════════════════

- 1-3 sentences. Conversational. Sounds human, not a marketing bot.
- Use the user's profile/style samples for HOW they talk (vocabulary,
  cadence, register) — NOT for WHAT they talk about. Topic = the post.
- Never generic ("Great post!", "Love this!", "So true!", "Insightful!",
  "Thanks for sharing!"). If complimenting, name the specific point.
- No hashtags. No emojis unless the post itself uses them.
- Never say "As an AI" or any meta language.

═══════════════════════════════════════════════════════════════════════
SKIP rule
═══════════════════════════════════════════════════════════════════════

If the post is too thin, off-topic, or impossible to engage with
substantively without making it about the user, output exactly: SKIP

Output ONLY the comment text (or SKIP). No quotes, no preface, no
explanation.
"""


def draft_comment(
    client, post: Dict, profile_text: str, style_samples: str, model_name: str
) -> str:
    style_block = ""
    if style_samples and style_samples.strip():
        style_block = (
            "USER'S PAST COMMENT SAMPLES (match this voice):\n"
            f"{style_samples}\n"
        )

    prompt = PROMPT_TEMPLATE.format(
        profile=profile_text,
        style_block=style_block,
        author=post.get("author") or "unknown",
        text=(post.get("text") or "")[:4000],
    )

    try:
        resp = client.models.generate_content(model=model_name, contents=prompt)
    except Exception as e:  # noqa: BLE001
        print(f"[drafter] Gemini call failed for {post.get('url')}: {e}")
        return ""

    return (resp.text or "").strip()
