"""Suggest LinkedIn profiles to follow, based on the user's About Me, via Gemini.

The model is asked for real, notable public figures whose work aligns with the
user's profile. Output is parsed down to bare linkedin.com/in/ URLs — the user
reviews and picks which to actually track, so a wrong guess is harmless.
"""
from __future__ import annotations

import re
from typing import List

from google import genai

PROMPT = """\
Based on the professional profile below, suggest exactly 10 real, notable
LinkedIn profiles this person should follow and engage with — founders,
builders, researchers, investors, and thought leaders whose public work
aligns with their field, interests, and goals.

PROFILE:
{profile}

Rules:
- Suggest real, well-known public figures likely to have a LinkedIn presence.
- Prefer people active in the same domains the profile describes.
- Output ONLY the profile URLs, one per line.
- Each line must be a full URL of the form https://www.linkedin.com/in/<handle>
- No names, no numbering, no commentary, no blank lines — just the 10 URLs.
"""

_URL_RE = re.compile(r"https?://(?:www\.)?linkedin\.com/in/[^\s,)]+", re.IGNORECASE)


def suggest_linkedin_profiles(
    gemini_key: str, profile_text: str, model_name: str
) -> List[str]:
    client = genai.Client(api_key=gemini_key)
    prompt = PROMPT.format(profile=profile_text[:6000])
    resp = client.models.generate_content(model=model_name, contents=prompt)
    raw = resp.text or ""

    urls: List[str] = []
    seen: set[str] = set()
    for match in _URL_RE.findall(raw):
        url = match.rstrip("/.,)\"'")
        key = url.lower()
        if key not in seen:
            seen.add(key)
            urls.append(url)
    return urls[:10]
