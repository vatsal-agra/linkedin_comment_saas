"""Score a post's relevance to a user with Gemini. Client is passed in so each
user runs against their OWN Gemini key."""
from __future__ import annotations

import json
import re
from typing import Dict

PROMPT_TEMPLATE = """\
You are scoring how relevant a LinkedIn post is to the user described below.
The user wants to engage with posts that genuinely align with their work,
interests, and goals — not generic "interesting!" engagement.

USER PROFILE:
{profile}

POST AUTHOR: {author}
POST CONTENT:
\"\"\"
{text}
\"\"\"

Score relevance 0-10:
- 0-3: off-topic for the user, do not engage
- 4-5: tangentially related, low priority
- 6-7: relevant, worth a thoughtful comment
- 8-10: highly relevant, definitely engage

Respond with ONLY a JSON object, no markdown, no extra prose:
{{"score": <int 0-10>, "reason": "<one short sentence>"}}
"""


def score_post(client, post: Dict, profile_text: str, model_name: str) -> Dict:
    """Return {'score': int, 'reason': str}. Failsoft: errors return score 0."""
    prompt = PROMPT_TEMPLATE.format(
        profile=profile_text,
        author=post.get("author") or "unknown",
        text=(post.get("text") or "")[:4000],
    )
    try:
        resp = client.models.generate_content(model=model_name, contents=prompt)
        raw = (resp.text or "").strip()
    except Exception as e:  # noqa: BLE001
        print(f"[relevance] Gemini call failed: {e}")
        return {"score": 0, "reason": f"gemini-error: {e}"}

    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        data = json.loads(raw)
        score = max(0, min(10, int(data.get("score", 0))))
        return {"score": score, "reason": str(data.get("reason", ""))[:200]}
    except Exception as e:  # noqa: BLE001
        print(f"[relevance] Couldn't parse Gemini JSON, defaulting to 0. Raw: {raw[:200]!r} ({e})")
        return {"score": 0, "reason": "parse-error"}
