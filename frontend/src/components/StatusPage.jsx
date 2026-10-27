import { useState, useEffect, useCallback, useRef } from 'react';
import './StatusPage.css';

const POLL_INTERVAL_MS = 10_000;
const FETCH_TIMEOUT_MS = 5_000;
const MAX_HISTORY = 30;

function formatUptime(seconds) {
  const s = Math.round(seconds);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function dbDotClass(status) {
  if (!status) return 'sp-db-disconnected';
  return `sp-db-${status.toLowerCase()}`;
}

export default function StatusPage() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [responseTimeMs, setResponseTimeMs] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [checkHistory, setCheckHistory] = useState([]);
  const [totalChecks, setTotalChecks] = useState(0);
  const [successfulChecks, setSuccessfulChecks] = useState(0);
  const timerRef = useRef(null);

  const doCheck = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const start = Date.now();
    try {
      const res = await fetch('/api/health', { signal: controller.signal });
      const elapsed = Date.now() - start;
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealthData(data);
      setError(false);
      setResponseTimeMs(elapsed);
      setLastChecked(new Date().toLocaleTimeString());
      setTotalChecks(t => t + 1);
      setSuccessfulChecks(s => s + 1);
      setCheckHistory(h => [
        ...h.slice(-(MAX_HISTORY - 1)),
        { ok: true, timestamp: new Date().toISOString() }
      ]);
    } catch {
      clearTimeout(timeout);
      setError(true);
      setHealthData(null);
      setResponseTimeMs(null);
      setLastChecked(new Date().toLocaleTimeString());
      setTotalChecks(t => t + 1);
      setCheckHistory(h => [
        ...h.slice(-(MAX_HISTORY - 1)),
        { ok: false, timestamp: new Date().toISOString() }
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCheckNow = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    doCheck();
    timerRef.current = setInterval(doCheck, POLL_INTERVAL_MS);
  }, [doCheck]);

  useEffect(() => {
    doCheck();
    timerRef.current = setInterval(doCheck, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [doCheck]);

  const availability = totalChecks > 0
    ? ((successfulChecks / totalChecks) * 100).toFixed(2)
    : null;

  let bannerClass = 'sp-banner sp-loading';
  let bannerIcon = '⏳';
  let bannerText = 'Checking…';
  if (!loading) {
    if (error) {
      bannerClass = 'sp-banner sp-fail';
      bannerIcon = '✗';
      bannerText = 'Service unavailable';
    } else {
      bannerClass = 'sp-banner sp-ok';
      bannerIcon = '✓';
      bannerText = 'Operational';
    }
  }

  return (
    <div className="sp-page">
      <header className="sp-header">
        <h1>System Status</h1>
        <button
          type="button"
          className="sp-check-btn"
          onClick={handleCheckNow}
          disabled={loading}
          aria-label="Check health now"
        >
          Check now
        </button>
      </header>

      <section className="sp-content">
        <div className={bannerClass} role="status" aria-live="polite">
          <span className="sp-banner-icon" aria-hidden="true">{bannerIcon}</span>
          <span className="sp-banner-text">{bannerText}</span>
        </div>

        <div className="sp-cards">
          <div className="sp-card">
            <div className="sp-card-label">Server Uptime</div>
            <div className="sp-card-value">
              {healthData ? formatUptime(healthData.uptimeSeconds) : '—'}
            </div>
          </div>
          <div className="sp-card">
            <div className="sp-card-label">Database</div>
            <div className="sp-card-value">
              {healthData ? (
                <>
                  <span
                    className={`sp-db-dot ${dbDotClass(healthData.database)}`}
                    aria-hidden="true"
                  />
                  {healthData.database}
                </>
              ) : '—'}
            </div>
          </div>
          <div className="sp-card">
            <div className="sp-card-label">Last Checked</div>
            <div className="sp-card-value">{lastChecked || '—'}</div>
          </div>
          <div className="sp-card">
            <div className="sp-card-label">Response Time</div>
            <div className="sp-card-value">
              {responseTimeMs !== null ? `${responseTimeMs}ms` : '—'}
            </div>
          </div>
        </div>

        <section className="sp-availability" aria-labelledby="avail-heading">
          <h2 id="avail-heading">Availability this session</h2>
          <p className="sp-avail-stat">
            {totalChecks > 0
              ? `${successfulChecks} / ${totalChecks} checks successful (${availability}%)`
              : 'No checks yet'}
          </p>
          <div className="sp-history" role="list" aria-label="Check history">
            {checkHistory.map((c, i) => (
              <span
                key={i}
                role="listitem"
                className={`sp-sq ${c.ok ? 'sp-sq-ok' : 'sp-sq-fail'}`}
                title={c.timestamp}
                aria-label={`${c.ok ? 'Up' : 'Down'} at ${c.timestamp}`}
              />
            ))}
          </div>
          <p className="status-note">Measured while this page is open. The monthly 99% figure comes from the uptime monitor on the deployed site.</p>
        </section>

        <p className="sp-footer-note">
          Target: 99% monthly availability (CSQ-NF-003)
        </p>
      </section>
    </div>
  );
}
