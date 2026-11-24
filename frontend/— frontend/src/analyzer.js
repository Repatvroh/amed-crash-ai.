// Moteur statistique descriptif — AMED CRASH AI
// Rappel : les rounds Crash sont indépendants. Ce moteur DÉCRIT le passé.

const BUCKETS = [
  { label: '1.00–1.49', min: 1.00, max: 1.49 },
  { label: '1.50–1.99', min: 1.50, max: 1.99 },
  { label: '2.00–2.99', min: 2.00, max: 2.99 },
  { label: '3.00–4.99', min: 3.00, max: 4.99 },
  { label: '5.00–9.99', min: 5.00, max: 9.99 },
  { label: '10.00+',   min: 10.00, max: Infinity },
];

export function analyze(multipliers, window = 50, threshold = 2.0) {
  const data = multipliers
    .slice(-window)
    .map(Number)
    .filter(n => isFinite(n) && n >= 1);

  if (data.length === 0) {
    return { ok: false, reason: 'Aucune donnée valide saisie.' };
  }
  if (data.length < 10) {
    return {
      ok: false,
      reason: `Échantillon insuffisant (${data.length} valeurs). Minimum recommandé : 10.`,
      partial: { count: data.length },
    };
  }

  const sorted = [...data].sort((a, b) => a - b);
  const sum = data.reduce((a, b) => a + b, 0);
  const mean = sum / data.length;
  const median = sorted.length % 2
    ? sorted[Math.floor(sorted.length / 2)]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const variance = data.reduce((a, v) => a + (v - mean) ** 2, 0) / data.length;
  const std = Math.sqrt(variance);

  const buckets = BUCKETS.map(b => {
    const count = data.filter(v => v >= b.min && v <= b.max).length;
    return { ...b, count, pct: (count / data.length) * 100 };
  });

  // Séries consécutives au-dessus / en-dessous du seuil
  const streaks = [];
  let current = null;
  for (const v of data) {
    const type = v >= threshold ? 'high' : 'low';
    if (current && current.type === type) current.length++;
    else {
      if (current) streaks.push(current);
      current = { type, length: 1, startValue: v };
    }
  }
  if (current) streaks.push(current);

  const longLow  = streaks.filter(s => s.type === 'low'  && s.length >= 3);
  const longHigh = streaks.filter(s => s.type === 'high' && s.length >= 3);

  // IC à 95 % sur la MOYENNE HISTORIQUE (pas une prédiction du futur)
  const sem = std / Math.sqrt(data.length);
  const ci95 = [mean - 1.96 * sem, mean + 1.96 * sem];

  // Alertes statistiques honnêtes
  const alerts = [];
  if (longLow.length)  alerts.push({ level: 'info',    text: `Série(s) de ${longLow.length} petit(s) multiplicateur(s) observée(s) (≥ 3 consécutifs < ${threshold.toFixed(2)}).` });
  if (longHigh.length) alerts.push({ level: 'info',    text: `Série(s) de ${longHigh.length} grand(s) multiplicateur(s) observée(s) (≥ 3 consécutifs ≥ ${threshold.toFixed(2)}).` });
  if (data.length < 30) alerts.push({ level: 'warn',   text: `Échantillon limité (${data.length} rounds). IC 95 % large : [${ci95[0].toFixed(2)} – ${ci95[1].toFixed(2)}].` });
  const lastTen = data.slice(-10);
  const lastTenMean = lastTen.reduce((a, b) => a + b, 0) / lastTen.length;
  if (Math.abs(lastTenMean - mean) / mean > 0.3) {
    alerts.push({ level: 'warn', text: `Écart notable entre la moyenne des 10 derniers (${lastTenMean.toFixed(2)}) et la moyenne de l'échantillon (${mean.toFixed(2)}).` });
  }
  if (data.some(v => v < 1 || !isFinite(v))) alerts.push({ level: 'error', text: 'Données anormales détectées (valeurs < 1.00 ou non finies).' });

  return {
    ok: true, count: data.length, window,
    mean, median, std,
    min: sorted[0], max: sorted[sorted.length - 1],
    buckets, streaks, longLow, longHigh,
    ci95, threshold, alerts,
    lastTenMean,
    sampleSizeAdequate: data.length >= 30,
    disclaimer: "Statistiques descriptives uniquement. Ne prédit pas les rounds futurs.",
  };
}

export function theoreticalP(x) {
  // Distribution théorique Crash (house edge ~1 %)
  if (x <= 1) return 1;
  return Math.min(1, 0.99 / x);
}
