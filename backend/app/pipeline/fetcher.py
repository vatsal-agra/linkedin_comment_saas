"""Fetch LinkedIn posts via Apify, using a single user's Apify token.

Adapted from the original single-user fetcher: the actor, token and limits are
now passed in explicitly so every user runs with their OWN Apify key.
"""
from __future__ import annotations

from typing import Any, Dict, List

from apify_client import ApifyClient


def _name_from(d: Any) -> str:
    if isinstance(d, dict):
        return (
            d.get("name")
            or d.get("fullName")
            or d.get("publicIdentifier")
            or d.get("universalName")
            or ""
        )
    if isinstance(d, str):
        return d
    return ""


def _normalize_one(item: Dict) -> Dict | None:
    """Map a raw harvestapi item to {url, author, text, published_at, source_profile}."""
    url = (
        item.get("linkedinUrl")
        or item.get("shareLinkedinUrl")
        or item.get("url")
        or item.get("postUrl")
        or ""
    )
    if not url:
        return None

    text = item.get("content") or item.get("text") or ""

    original_author = _name_from(item.get("author"))
    reposter = _name_from(item.get("repostedBy"))
    if reposter and original_author and reposter != original_author:
        author_label = f"{original_author} (reposted by {reposter})"
    elif reposter:
        author_label = reposter
    else:
        author_label = original_author or "Unknown"

    posted_raw = item.get("postedAt") or item.get("repostedAt") or {}
    if isinstance(posted_raw, dict):
        published_at = (
            posted_raw.get("date")
            or posted_raw.get("postedAgoText")
            or posted_raw.get("postedAgoShort")
            or ""
        )
    else:
        published_at = str(posted_raw)

    # The tracked profile this post came from — reliable grouping key for the
    # per-account draft cap (ties an account's originals AND reposts together).
    source_profile = ""
    query = item.get("query")
    if isinstance(query, dict):
        source_profile = query.get("profilePublicIdentifier") or ""
    if not source_profile:
        source_profile = author_label

    return {
        "url": url,
        "author": author_label,
        "text": text,
        "published_at": str(published_at),
        "source_profile": source_profile,
    }


def fetch_posts(
    apify_token: str,
    actor_id: str,
    profile_urls: List[str],
    posts_per_profile: int = 10,
) -> List[Dict]:
    """Run the Apify actor and return normalized post dicts."""
    if not apify_token:
        raise RuntimeError("Apify token missing")
    if not profile_urls:
        return []

    client = ApifyClient(apify_token)
    run_input = {"profileUrls": profile_urls, "maxPosts": posts_per_profile}

    print(f"[fetcher] actor={actor_id} profiles={len(profile_urls)} maxPosts={posts_per_profile}")
    run = client.actor(actor_id).call(run_input=run_input)

    # apify-client 3.x returns a Pydantic model; 2.x returned a dict.
    dataset_id = None
    if run is not None:
        if isinstance(run, dict):
            dataset_id = run.get("defaultDatasetId") or run.get("default_dataset_id")
        else:
            dataset_id = (
                getattr(run, "default_dataset_id", None)
                or getattr(run, "defaultDatasetId", None)
            )
    if not dataset_id:
        raise RuntimeError(f"Apify actor returned no dataset id. Run: {run!r}")

    items = list(client.dataset(dataset_id).iterate_items())
    print(f"[fetcher] raw items returned: {len(items)}")

    normalized: List[Dict] = []
    skipped_no_url = skipped_no_text = 0
    for item in items:
        n = _normalize_one(item)
        if n is None:
            skipped_no_url += 1
            continue
        if not n["text"].strip():
            skipped_no_text += 1
            continue
        normalized.append(n)

    print(
        f"[fetcher] normalized: {len(normalized)} "
        f"(skipped {skipped_no_url} no-url, {skipped_no_text} no-text)"
    )
    return normalized
