import numpy as np
import pandas as pd

BUCKETS = [
    ("1.00–1.49", 1.00, 1.49), ("1.50–1.99", 1.50, 1.99),
    ("2.00–2.99", 2.00, 2.99), ("3.00–4.99", 3.00, 4.99),
    ("5.00–9.99", 5.00, 9.99), ("10.00+", 10.00, np.inf),
]

def analyze(multipliers: list[float], window: int = 50, threshold: float = 2.0) -> dict:
    s = pd.Series(multipliers[-window:], dtype="float64").dropna()
    s = s[s >= 1]
    if len(s) == 0: return {"ok": False, "reason": "Aucune donnée valide."}
    if len(s) < 10: return {"ok": False, "reason": f"Échantillon insuffisant ({len(s)})."}

    mean = float(s.mean()); median = float(s.median()); std = float(s.std(ddof=0))
    ci95 = (mean - 1.96 * std / np.sqrt(len(s)), mean + 1.96 * std / np.sqrt(len(s)))

    buckets = []
    for label, lo, hi in BUCKETS:
        count = int(((s >= lo) & (s <= hi)).sum())
        buckets.append({"label": label, "count": count, "pct": count / len(s) * 100})

    types = np.where(s.values >= threshold, "high", "low")
    streaks, cur = [], None
    for t in types:
        if cur and cur["type"] == t: cur["length"] += 1
        else:
            if cur: streaks.append(cur)
            cur = {"type": t, "length": 1}
    if cur: streaks.append(cur)

    alerts = []
    if any(x["type"] == "low" and x["length"] >= 3 for x in streaks):
        alerts.append({"level": "info", "text": f"Série(s) de petits multiplicateurs < {threshold}."})
    if len(s) < 30:
        alerts.append({"level": "warn", "text": f"Échantillon limité ({len(s)}). IC 95% large."})

    return {
        "ok": True, "count": len(s), "window": window,
        "mean": mean, "median": median, "std": std,
        "min": float(s.min()), "max": float(s.max()),
        "ci95": list(ci95), "buckets": buckets, "streaks": streaks,
        "alerts": alerts,
        "disclaimer": "Analyse descriptive uniquement — ne prédit pas les rounds futurs.",
    }
