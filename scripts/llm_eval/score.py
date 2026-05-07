"""Score raw eval runs: JSON validity, semantic diversity, length, latency."""

from __future__ import annotations

import json
from pathlib import Path
from statistics import mean
from typing import Any

from openai import OpenAI

LENGTH_TO_NB_WORDS = {
    "XS": (1, 5),
    "S": (3, 10),
    "M": (5, 15),
    "L": (8, 20),
    "XL": (12, 25),
}


def parse_runs(runs_dir: Path) -> list[dict[str, Any]]:
    """Load all run_*.json files under a directory tree."""
    out: list[dict[str, Any]] = []
    for f in sorted(runs_dir.rglob("run_*.json")):
        out.append(json.loads(f.read_text()))
    return out


def is_valid_json(raw: str) -> tuple[bool, dict[str, Any] | None]:
    if raw.startswith("__ERROR__"):
        return False, None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return False, None
    if not isinstance(parsed, dict):
        return False, None
    if "suggested_keywords" not in parsed or "suggested_answers" not in parsed:
        return False, None
    return True, parsed


def length_score(answers: list[str], desired: str) -> float:
    """Fraction of answers whose word count falls in the expected range."""
    min_w, max_w = LENGTH_TO_NB_WORDS[desired]
    if not answers:
        return 0.0
    ok = sum(1 for a in answers if min_w <= len(a.split()) <= max_w)
    return ok / len(answers)


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def diversity(answers: list[str], embedder: OpenAI) -> float:
    """Mean cosine distance (1 - similarity) over all pairs."""
    if len(answers) < 2:
        return 0.0
    resp = embedder.embeddings.create(model="text-embedding-3-small", input=answers)
    embs = [d.embedding for d in resp.data]
    distances: list[float] = []
    for i in range(len(embs)):
        for j in range(i + 1, len(embs)):
            distances.append(1 - cosine(embs[i], embs[j]))
    return mean(distances)


def score_run(run: dict[str, Any], desired_length: str, embedder: OpenAI) -> dict[str, Any]:
    valid, parsed = is_valid_json(run["raw"])
    if not valid or parsed is None:
        return {
            "model": run["model"],
            "case_id": run["case_id"],
            "valid_json": False,
            "diversity": None,
            "length_score": None,
            "ttft_ms": run["ttft_ms"],
            "total_ms": run["total_ms"],
        }

    answers = parsed.get("suggested_answers", [])
    return {
        "model": run["model"],
        "case_id": run["case_id"],
        "valid_json": True,
        "diversity": diversity(answers, embedder),
        "length_score": length_score(answers, desired_length),
        "ttft_ms": run["ttft_ms"],
        "total_ms": run["total_ms"],
        "answers": answers,
        "keywords": parsed.get("suggested_keywords", []),
    }


def aggregate(scores: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Aggregate per model: mean diversity, JSON validity rate, mean ttft, etc."""
    by_model: dict[str, list[dict[str, Any]]] = {}
    for s in scores:
        by_model.setdefault(s["model"], []).append(s)

    agg: dict[str, dict[str, Any]] = {}
    for model, runs in by_model.items():
        valid = [r for r in runs if r["valid_json"]]
        ttfts = [r["ttft_ms"] for r in runs if r["ttft_ms"] > 0]
        totals = [r["total_ms"] for r in runs if r["total_ms"] > 0]
        agg[model] = {
            "n_runs": len(runs),
            "valid_json_rate": len(valid) / len(runs) if runs else 0,
            "mean_diversity": mean(r["diversity"] for r in valid) if valid else None,
            "mean_length_score": mean(r["length_score"] for r in valid) if valid else None,
            "mean_ttft_ms": mean(ttfts) if ttfts else None,
            "mean_total_ms": mean(totals) if totals else None,
        }
    return agg
