"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

type Stats = {
  p25: string;
  p50: string;
  p75: string;
  avg: string;
  worst: string;
  best: string;
  pct: string;
  mb: string;
};

const empty: Stats = {
  p25: "-",
  p50: "-",
  p75: "-",
  avg: "-",
  worst: "-",
  best: "-",
  pct: "-",
  mb: "-",
};

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return NaN;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function fmt(n: number, digits = 1) {
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(digits);
}

export default function SpeedTestPage() {
  const [running, setRunning] = useState(false);
  const [latency, setLatency] = useState<Stats>(empty);
  const [download, setDownload] = useState<{ rate: Stats; latency: Stats }>({
    rate: empty,
    latency: empty,
  });
  const [upload, setUpload] = useState<Stats>(empty);
  const [raw, setRaw] = useState<Record<string, unknown>>({});

  const buildTime = useMemo(() => "11/14/2024, 3:19:45 PM (lab clone)", []);

  async function measureLatencyMs(samples = 8) {
    const times: number[] = [];
    for (let i = 0; i < samples; i++) {
      const t0 = performance.now();
      try {
        await fetch("/api/ping", { method: "HEAD", cache: "no-store" });
      } catch {
        /* ignore */
      }
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    return {
      samples: times,
      stats: {
        p25: fmt(percentile(times, 25)),
        p50: fmt(percentile(times, 50)),
        p75: fmt(percentile(times, 75)),
        avg: fmt(times.reduce((a, b) => a + b, 0) / times.length),
        worst: fmt(Math.max(...times)),
        best: fmt(Math.min(...times)),
        pct: "100",
        mb: "-",
      } satisfies Stats,
    };
  }

  async function measureDownload() {
    const sizesMb = [1, 2, 4];
    const rates: number[] = [];
    const lats: number[] = [];
    let totalMb = 0;
    for (const mb of sizesMb) {
      const t0 = performance.now();
      const res = await fetch(`/api/download?mb=${mb}`, { cache: "no-store" });
      const headerAt = performance.now();
      lats.push(headerAt - t0);
      await res.arrayBuffer();
      const t1 = performance.now();
      const secs = (t1 - t0) / 1000;
      rates.push((mb * 8) / Math.max(secs, 0.001));
      totalMb += mb;
    }
    rates.sort((a, b) => a - b);
    lats.sort((a, b) => a - b);
    const rateStats: Stats = {
      p25: fmt(percentile(rates, 25)),
      p50: fmt(percentile(rates, 50)),
      p75: fmt(percentile(rates, 75)),
      avg: fmt(rates.reduce((a, b) => a + b, 0) / rates.length),
      worst: fmt(Math.min(...rates)),
      best: fmt(Math.max(...rates)),
      pct: "100",
      mb: String(totalMb),
    };
    const latStats: Stats = {
      p25: fmt(percentile(lats, 25)),
      p50: fmt(percentile(lats, 50)),
      p75: fmt(percentile(lats, 75)),
      avg: fmt(lats.reduce((a, b) => a + b, 0) / lats.length),
      worst: fmt(Math.max(...lats)),
      best: fmt(Math.min(...lats)),
      pct: "100",
      mb: "-",
    };
    return { rateStats, latStats, rates, lats, totalMb };
  }

  async function measureUpload() {
    const mb = 2;
    const body = new Uint8Array(mb * 1024 * 1024);
    const t0 = performance.now();
    await fetch("/api/upload", { method: "POST", body, cache: "no-store" });
    const secs = (performance.now() - t0) / 1000;
    const mbps = (mb * 8) / Math.max(secs, 0.001);
    return {
      stats: {
        p25: fmt(mbps),
        p50: fmt(mbps),
        p75: fmt(mbps),
        avg: fmt(mbps),
        worst: fmt(mbps),
        best: fmt(mbps),
        pct: "100",
        mb: String(mb),
      } satisfies Stats,
      mbps,
    };
  }

  async function run() {
    setRunning(true);
    try {
      const lat = await measureLatencyMs();
      setLatency(lat.stats);
      const dl = await measureDownload();
      setDownload({ rate: dl.rateStats, latency: dl.latStats });
      const ul = await measureUpload();
      setUpload(ul.stats);
      setRaw({
        latencyMs: lat.samples,
        downloadMbps: dl.rates,
        downloadLatencyMs: dl.lats,
        uploadMbps: ul.mbps,
      });
    } catch (e) {
      setRaw({ error: String(e) });
    } finally {
      setRunning(false);
    }
  }

  function StatRow({
    label,
    stats,
    spanAll,
  }: {
    label: string;
    stats: Stats;
    spanAll?: boolean;
  }) {
    if (spanAll && stats.p25 === "-") {
      return (
        <tr>
          <td className={styles.cellRight}>{label}</td>
          <td className={styles.cellCenter} colSpan={8}>
            -
          </td>
        </tr>
      );
    }
    return (
      <tr>
        <td className={styles.cellRight}>{label}</td>
        <td className={styles.cell}>{stats.p25}</td>
        <td className={styles.cell}>{stats.p50}</td>
        <td className={styles.cell}>{stats.p75}</td>
        <td className={styles.cell}>{stats.avg}</td>
        <td className={styles.cell}>{stats.worst}</td>
        <td className={styles.cell}>{stats.best}</td>
        <td className={styles.cell}>{stats.pct}</td>
        <td className={styles.cell}>{stats.mb}</td>
      </tr>
    );
  }

  return (
    <div className={styles.wrap}>
      <main>
        <h1 className={styles.title}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/globe.svg" alt="" width={24} height={24} className={styles.globe} />
          Speed Test
        </h1>

        <div className={styles.btnRow}>
          <button type="button" className={styles.runBtn} onClick={run} disabled={running}>
            <span>▲</span>
            {running ? "Running…" : "Run Speed Test"}
          </button>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={`${styles.th} ${styles.thWide}`}></th>
                <th className={styles.th}>p25</th>
                <th className={styles.th}>p50</th>
                <th className={styles.th}>p75</th>
                <th className={styles.th}>avg</th>
                <th className={styles.th}>worst</th>
                <th className={styles.th}>best</th>
                <th className={styles.th}>%</th>
                <th className={styles.th}>mb</th>
              </tr>
            </thead>
            <thead>
              <tr>
                <th className={styles.th} colSpan={7}>
                  Latency ↕
                </th>
                <th className={`${styles.th} ${styles.center}`} colSpan={2}>
                  total
                </th>
              </tr>
            </thead>
            <tbody>
              <StatRow label="Latency (ms)" stats={latency} spanAll />
            </tbody>
            <thead>
              <tr>
                <th className={styles.th} colSpan={7}>
                  Download ▼
                </th>
                <th className={`${styles.th} ${styles.center}`} colSpan={2}>
                  total
                </th>
              </tr>
            </thead>
            <tbody>
              <StatRow label="Rate (Mbps)" stats={download.rate} spanAll />
              <StatRow label="Latency (ms)" stats={download.latency} spanAll />
            </tbody>
            <thead>
              <tr>
                <th className={styles.th} colSpan={7}>
                  Upload ▲
                </th>
                <th className={`${styles.th} ${styles.center}`} colSpan={2}>
                  total
                </th>
              </tr>
            </thead>
            <tbody>
              <StatRow label="Rate (Mbps)" stats={upload} spanAll />
            </tbody>
          </table>
        </div>

        <h3 className={styles.notesTitle}>Notes</h3>
        <ul className={styles.notes}>
          <li>Latency is measured from the start of the request until header data is received.</li>
          <li>
            The latency section uses <code>HEAD</code> requests, while the download section uses{" "}
            <code>GET</code> requests. Both measures of latency can be insightful.
          </li>
          <li>
            Upload latency is irrelevant because we <code>POST</code> megabytes of data.
          </li>
        </ul>
      </main>

      <footer className={styles.footer}>
        <details>
          <summary className={styles.rawSummary}>Raw data</summary>
          <pre className={styles.raw}>{JSON.stringify(raw, null, 2)}</pre>
        </details>
        <div className={styles.buildTime}>
          <strong>Build time:</strong> {buildTime}
        </div>
        <p className={styles.labNote}>
          LOCAL R2S LAB UI clone of Wickr speed-test page — bind 127.0.0.1 only. Not the real Amplify
          host.
        </p>
      </footer>
    </div>
  );
}
