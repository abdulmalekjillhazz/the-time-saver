#!/usr/bin/env python3
"""Writes SYNTHETIC completions for testing the pipeline. Never use this for a real model.

Usage: python ml/make_synthetic.py ml/data/synthetic.csv [--users 120] [--days 90]
"""
import argparse
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

START_STARTS = [6 * 60, 7 * 60 + 30, 9 * 60, 13 * 60, 18 * 60, 21 * 60]


def generate(users, days, seed=7):
    rng = np.random.default_rng(seed)
    rows = []
    base = date(2026, 6, 1)
    for u in range(users):
        user_hash = f"{rng.integers(0, 2**63):016x}"
        # Every fake user has their own discipline level (some steady, some struggling).
        discipline = float(rng.normal(0.0, 0.8))
        for d in range(days):
            day = base + timedelta(days=d)
            weekday = (day.weekday() + 1) % 7  # Sunday = 0
            weekend = weekday in (5, 6)  # Friday + Saturday
            for _ in range(int(rng.integers(2, 5))):
                start = int(rng.choice(START_STARTS))
                duration = int(rng.choice([15, 30, 45, 60, 90, 120]))
                priority = str(rng.choice(["low", "medium", "high"]))
                # Richer synthetic rule, still for testing only:
                # early mornings, late nights, long sessions, low priority and
                # weekends raise the miss chance; high priority and discipline lower it.
                logit = -1.4 - discipline
                logit += 1.6 if start < 8 * 60 else 0.0
                logit += 0.9 if start >= 22 * 60 else 0.0
                logit += 0.012 * (duration - 30)
                logit += 0.8 if priority == "low" else 0.0
                logit -= 0.7 if priority == "high" else 0.0
                logit += 0.5 if weekend else 0.0
                p_miss = 1.0 / (1.0 + np.exp(-logit))
                rows.append({
                    "user_hash": user_hash,
                    "day": day.isoformat(),
                    "start_hour": start // 60,
                    "duration_min": duration,
                    "weekday": weekday,
                    "priority": priority,
                    "missed": int(rng.random() < min(max(p_miss, 0.02), 0.97)),
                })
    return pd.DataFrame(rows)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("out")
    parser.add_argument("--users", type=int, default=120)
    parser.add_argument("--days", type=int, default=90)
    args = parser.parse_args()
    df = generate(args.users, args.days)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(args.out, index=False)
    print(f"SYNTHETIC data: {len(df)} rows written to {args.out}. Do not use for a real model.")
