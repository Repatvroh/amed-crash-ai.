import React, { useState, useEffect } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Legend
} from 'chart.js';
import { analyze, theoreticalP } from './analyzer';
import './App.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

const STORAGE_KEY = 'amed_crash_results_v1';

function loadResults() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveResults(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-2000)));
}

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [results, setResults] = useState(loadResults);
  const [input, setInput] = useState('');
  const [windowSize, setWindowSize] = useState(50);
  const [report, setReport] = useState(null);
  const [csvError, setCsvError] = useState('');

  useEffect(() => saveResults(results), [results]);

  const addResult = (val) => {
    const n = Number(String(val).replace(',', '.'));
    if (!isFinite(n) || n < 1) return;
    setResults(prev => [...prev, +n.toFixed(2)]);
  };

  const handleAdd = () => {
    if (!input.trim()) return;
    input.split(/[\s,;\n]+/).forEach(v => { if (v) addResult(v); });
    setInput('');
  };

  const runAnalysis = () => {
    setReport(analyze(results, windowSize));
    setTab('dashboard');
  };

  const handleCsv = (e) => {
    setCsvError('');
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target.result);
      const numbers = [];
      // Tolère CSV avec ou sans header, "1.23", "1,23", colonnes multiples
      text.split(/\r?\n/).forEach(line => {
        const cells = line.split(/[;,\t]/);
        // Le multiplicateur est souvent la 1re ou la dernière colonne
        for (const c of cells) {
          const n = Number(c.trim().replace(',', '.'));
          if (isFinite(n) && n >= 1 && n < 100000) { numbers.push(+n.toFixed(2)); break; }
        }
      });
      if (!numbers.length) { setCsvError('Aucun multiplicateur valide trouvé dans le CSV.'); return; }
      setResults(prev => [...prev, ...numbers]);
    };
    reader.readAsText(file);
  };

  const clearAll = () => {
    if (confirm('Effacer tout l\'historique local ?')) { setResults([]); setReport(null); }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <span className="logo-mark">⬢</span>
          <div>
            <h1>AMED <span className="gold">CRASH</span> <span className="red">AI</span></h1>
            <p className="tagline">Analyse statistique descriptive · Outil pédagogique</p>
          </div>
        </div>
        <div className="pill">{results.length} rounds stockés</div>
      </header>

      <nav className="tabs">
        {[
          ['dashboard', 'Tableau de bord'],
          ['analyze',   'Analyser'],
          ['history',   'Historique'],
          ['info',      'À propos'],
        ].map(([id, label]) => (
          <button key={id} className={tab === id ? 'tab active' : 'tab'} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      {tab === 'dashboard' && (
        <Dashboard report={report} results={results} onAnalyze={runAnalysis} windowSize={windowSize} setWindowSize={setWindowSize} />
      )}
      {tab === 'analyze' && (
        <Analyze
          input={input} setInput={setInput} onAdd={handleAdd}
          onCsv={handleCsv} csvError={csvError}
          windowSize={windowSize} setWindowSize={setWindowSize}
          onAnalyze={runAnalysis} report={report}
        />
      )}
      {tab === 'history' && <History results={results} clearAll={clearAll} />}
      {tab === 'info' && <Info />}

      <footer className="footer">
        <strong>Avertissement :</strong> Crash est provably fair. Aucune analyse ne prédit les rounds futurs.
        Ne jouez pas d'argent que vous ne pouvez pas perdre. 18+.
      </footer>
    </div>
  );
}

function Dashboard({ report, results, onAnalyze, windowSize, setWindowSize }) {
  if (!results.length) {
    return (
      <div className="card empty">
        <p>Aucune donnée. Saisissez ou importez des multiplicateurs puis cliquez sur <strong>ANALYSER</strong>.</p>
      </div>
    );
  }
  if (!report) {
    return (
      <div className="card">
        <h2>Tableau de bord</h2>
        <p>{results.length} rounds prêts à l'analyse.</p>
        <div className="row">
          <select value={windowSize} onChange={e => setWindowSize(+e.target.value)}>
            {[20, 50, 100, 500].map(w => <option key={w} value={w}>Fenêtre : {w} derniers</option>)}
          </select>
          <button className="btn-primary" onClick={onAnalyze}>ANALYSER</button>
        </div>
      </div>
    );
  }
  if (!report.ok) {
    return <div className="card error"><h2>Analyse impossible</h2><p>{report.reason}</p></div>;
  }

  const lineData = {
    labels: results.slice(-report.count).map((_, i) => i + 1),
    datasets: [{
      label: 'Multiplicateur',
      data: results.slice(-report.count),
      borderColor: '#F4C430',
      backgroundColor: 'rgba(244,196,48,.15)',
      tension: .25, pointRadius: 2,
    }, {
      label: `Moyenne (${report.mean.toFixed(2)})`,
      data: Array(report.count).fill(report.mean),
      borderColor: '#E63946', borderDash: [6, 6], pointRadius: 0,
    }],
  };
  const barData = {
    labels: report.buckets.map(b => b.label),
    datasets: [{
      label: 'Fréquence (%)',
      data: report.buckets.map(b => +b.pct.toFixed(2)),
      backgroundColor: ['#E63946','#F4C430','#7B2CBF','#2A9D8F','#457B9D','#F4A261'],
    }],
  };

  return (
    <div className="dashboard">
      <div className="card">
        <h2>Synthèse — {report.count} derniers rounds</h2>
        <div className="kpis">
          <Kpi label="Moyenne" value={report.mean.toFixed(2)} sub={`IC 95% : ${report.ci95[0].toFixed(2)} – ${report.ci95[1].toFixed(2)}`} />
          <Kpi label="Médiane" value={report.median.toFixed(2)} />
          <Kpi label="Écart-type" value={report.std.toFixed(2)} />
          <Kpi label="Min / Max" value={`${report.min.toFixed(2)} / ${report.max.toFixed(2)}`} />
        </div>
        <p className="disclaimer">⚠️ Ces valeurs décrivent l'échantillon passé. La distribution Crash a une queue lourde : la moyenne varie fortement d'un échantillon à l'autre.</p>
      </div>

      <div className="card">
        <h3>Évolution</h3>
        <Line data={lineData} options={{ responsive: true, plugins: { legend: { labels: { color: '#eee' } } }, scales: { x: { ticks: { color: '#aaa' } }, y: { ticks: { color: '#aaa' }, type: 'logarithmic' } } }} />
      </div>

      <div className="card">
        <h3>Distribution observée</h3>
        <Bar data={barData} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#aaa' } }, y: { ticks: { color: '#aaa' } } } }} />
        <table className="tbl">
          <thead><tr><th>Tranche</th><th>Observé (%)</th><th>Théorique* (%)</th></tr></thead>
          <tbody>
            {report.buckets.map(b => {
              const theo = (theoreticalP(b.min) - theoreticalP(b.max === Infinity ? 0 : b.max + 0.01)) * 100;
              return <tr key={b.label}><td>{b.label}</td><td>{b.pct.toFixed(2)}</td><td>{Math.max(0, theo).toFixed(2)}</td></tr>;
            })}
          </tbody>
        </table>
        <p className="disclaimer">*Distribution théorique provably fair (`P(X≥x) ≈ 0.99/x`), indicative.</p>
      </div>

      <div className="card">
        <h3>Alertes statistiques</h3>
        {report.alerts.length === 0 && <p>Aucune anomalie détectée.</p>}
        <ul className="alerts">
          {report.alerts.map((a, i) => <li key={i} className={`alert ${a.level}`}>{a.text}</li>)}
        </ul>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }) {
  return <div className="kpi"><div className="kpi-label">{label}</div><div className="kpi-value">{value}</div>{sub && <div className="kpi-sub">{sub}</div>}</div>;
}

function Analyze({ input, setInput, onAdd, onCsv, csvError, windowSize, setWindowSize, onAnalyze }) {
  return (
    <div className="card">
      <h2>Analyser</h2>
      <label className="lbl">Multiplicateurs (séparés par espace, virgule ou retour à la ligne)</label>
      <textarea rows={4} value={input} onChange={e => setInput(e.target.value)} placeholder="ex : 1.23 2.45 1.10 8.76 1.05" />
      <div className="row">
        <button className="btn" onClick={onAdd}>+ Ajouter à l'historique</button>
        <label className="btn file">Importer CSV<input type="file" accept=".csv,text/csv" onChange={onCsv} hidden /></label>
        {csvError && <span className="error-text">{csvError}</span>}
      </div>
      <hr />
      <div className="row">
        <select value={windowSize} onChange={e => setWindowSize(+e.target.value)}>
          {[20, 50, 100, 500].map(w => <option key={w} value={w}>Fenêtre : {w} derniers</option>)}
        </select>
        <button className="btn-primary" onClick={onAnalyze}>ANALYSER</button>
      </div>
      <p className="disclaimer">L'analyse ne se lance pas automatiquement sur des données insuffisantes. Un échantillon &lt; 10 est refusé ; &lt; 30 produit un avertissement.</p>
    </div>
  );
}

function History({ results, clearAll }) {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'low' ? results.filter(v => v < 2)
    : filter === 'high' ? results.filter(v => v >= 10) : results;
  return (
    <div className="card">
      <div className="row space-between">
        <h2>Historique ({results.length})</h2>
        <button className="btn danger" onClick={clearAll}>Effacer</button>
      </div>
      <div className="row">
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">Tous</option>
          <option value="low">&lt; 2.00</option>
          <option value="high">≥ 10.00</option>
        </select>
      </div>
      <div className="history-grid">
        {filtered.slice().reverse().map((v, i) => (
          <div key={i} className={`chip ${v < 2 ? 'low' : v >= 10 ? 'high' : ''}`}>{v.toFixed(2)}x</div>
        ))}
      </div>
    </div>
  );
}

function Info() {
  return (
    <div className="card">
      <h2>À propos / Limites</h2>
      <p><strong>AMED CRASH AI</strong> est un outil d'analyse <em>descriptive</em> de l'historique des multiplicateurs.</p>
      <ul>
        <li>✔ Analyse des derniers 20/50/100/500 rounds</li>
        <li>✔ Détection de séries et de distributions</li>
        <li>✔ Alertes statistiques et intervalles de confiance</li>
        <li>✔ Saisie manuelle, import CSV, stockage local (SQLite/LocalStorage)</li>
        <li>✔ Aucun accès à votre compte 1xBet, aucun mot de passe stocké, aucun pari automatique</li>
      </ul>
      <h3>Ce que l'app ne fait PAS</h3>
      <ul>
        <li>✘ Ne prédit pas le prochain multiplicateur (mathématiquement impossible)</li>
        <li>✘ Ne contourne pas les protections de 1xBet</li>
        <li>✘ Ne garantit aucun gain</li>
        <li>✘ N'expose pas de « stratégie gagnante » — Crash est provably fair</li>
      </ul>
      <p className="disclaimer">Distribution théorique : P(X ≥ x) ≈ 0.99/x pour x ≥ 1. Chaque round est indépendant.</p>
    </div>
  );
}
