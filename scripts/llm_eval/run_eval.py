"""Run all candidate models against the corpus and store raw outputs."""

from __future__ import annotations

import asyncio
import datetime as dt
import json
import os
import time
from pathlib import Path
from typing import Any

import litellm
import yaml
from pydantic import BaseModel


MODELS: list[str] = [
    "cerebras/llama3.1-8b",
    "cerebras/llama-3.3-70b",
    "cerebras/qwen-3-235b-a22b-instruct-2507",
    "openai/gpt-5-mini",
    "anthropic/claude-sonnet-4-6",
    "groq/llama-3.3-70b-versatile",
    "gemini/gemini-2.5-flash",
]

RUNS_PER_CASE = 5
TEMPERATURE = 1.0

LENGTH_TO_NB_WORDS = {
    "XS": (1, 5),
    "S": (3, 10),
    "M": (5, 15),
    "L": (8, 20),
    "XL": (12, 25),
}


class StructuredLLMResponse(BaseModel):
    suggested_keywords: list[str]
    suggested_answers: list[str]


def build_prompt(user_settings: dict[str, Any], case: dict[str, Any]) -> list[dict[str, str]]:
    """Replicate (a simplified version of) backend/llm/llm_utils.py prompt building."""
    name = user_settings["name"]
    user_prompt = user_settings["prompt"]
    friends = ", ".join(user_settings["friends"])
    min_w, max_w = LENGTH_TO_NB_WORDS[case["desired_length"]]
    hint = case.get("hint")

    sys = (
        "You are an assistant suggesting answers for a person with ALS who cannot speak. "
        "Output JSON: {suggested_keywords: list[str] of length 10, suggested_answers: list[str] of length 4}.\n\n"
        f"## User name\n{name}\n\n"
        f"## User prompt\n{user_prompt}\n\n"
        f"## User's friends\n{friends}\n\n"
        "## Current conversation\n"
    )
    for msg in case["history"]:
        if msg["role"] == "speaker":
            sys += f"* Speaker: {msg['content']}\n"
        else:
            sys += f"* {name} says: {msg['content']}\n"

    sys += f"\n## Desired responses length\nEach response between {min_w} and {max_w} words.\n"
    if hint:
        sys += f"\n## User keyword hint\nUse the concept '{hint}' in all responses.\n"

    return [{"role": "system", "content": sys}]


async def run_one(model: str, messages: list[dict[str, str]]) -> tuple[str, float, float]:
    """Return (raw_text, ttft_ms, total_ms)."""
    response_format = {
        "type": "json_schema",
        "json_schema": {
            "name": "response_suggestion",
            "strict": True,
            "schema": StructuredLLMResponse.model_json_schema(),
        },
    }
    t0 = time.perf_counter()
    ttft: float | None = None
    chunks: list[str] = []

    try:
        stream = await litellm.acompletion(
            model=model,
            messages=messages,
            stream=True,
            temperature=TEMPERATURE,
            response_format=response_format,
        )
    except Exception as e:
        return f"__ERROR__:{type(e).__name__}: {e}", -1.0, -1.0

    async for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta.content
        if delta is None:
            continue
        if ttft is None:
            ttft = (time.perf_counter() - t0) * 1000
        chunks.append(delta)

    total = (time.perf_counter() - t0) * 1000
    return "".join(chunks), ttft if ttft is not None else -1.0, total


async def main() -> None:
    here = Path(__file__).parent
    corpus = yaml.safe_load((here / "corpus.yaml").read_text())

    timestamp = dt.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    out_root = here / "eval_runs" / timestamp
    out_root.mkdir(parents=True, exist_ok=True)

    user_settings = corpus["user_settings"]
    cases = corpus["cases"]

    # --- Generation phase ---
    for model in MODELS:
        for case in cases:
            messages = build_prompt(user_settings, case)
            for i in range(RUNS_PER_CASE):
                text, ttft, total = await run_one(model, messages)
                out_dir = out_root / model.replace("/", "__") / case["id"]
                out_dir.mkdir(parents=True, exist_ok=True)
                (out_dir / f"run_{i}.json").write_text(
                    json.dumps(
                        {
                            "model": model,
                            "case_id": case["id"],
                            "raw": text,
                            "ttft_ms": ttft,
                            "total_ms": total,
                        },
                        ensure_ascii=False,
                        indent=2,
                    )
                )
                print(f"  {model} / {case['id']} / run {i}: ttft={ttft:.0f}ms total={total:.0f}ms")

    (out_root / "_meta.json").write_text(
        json.dumps({"timestamp": timestamp, "models": MODELS, "runs_per_case": RUNS_PER_CASE}, indent=2)
    )

    # --- Scoring phase ---
    from openai import OpenAI
    from jinja2 import Template

    from score import parse_runs, score_run, aggregate

    case_by_id = {c["id"]: c for c in cases}
    embedder = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    runs = parse_runs(out_root)
    scores = [score_run(r, case_by_id[r["case_id"]]["desired_length"], embedder) for r in runs]
    aggregates = aggregate(scores)

    # First-run sample per (model, case) for the report
    samples: dict[str, dict[str, Any]] = {}
    seen: set[tuple[str, str]] = set()
    for s in scores:
        key = (s["model"], s["case_id"])
        if key in seen:
            continue
        seen.add(key)
        samples.setdefault(s["model"], {})[s["case_id"]] = (
            {"keywords": s.get("keywords", []), "answers": s.get("answers", [])}
            if s["valid_json"] else None
        )

    template_text = (here / "report.md.j2").read_text()
    rendered = Template(template_text).render(
        timestamp=timestamp,
        n_cases=len(cases),
        runs_per_case=RUNS_PER_CASE,
        models=MODELS,
        case_ids=[c["id"] for c in cases],
        aggregates=aggregates,
        samples=samples,
    )
    (out_root / "report.md").write_text(rendered)

    print(f"\nDone. Report at {out_root / 'report.md'}")


if __name__ == "__main__":
    asyncio.run(main())
