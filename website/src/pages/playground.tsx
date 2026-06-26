import React, {useRef, useState} from 'react';
import Layout from '@theme/Layout';
import BrowserOnly from '@docusaurus/BrowserOnly';

// Runs coinrayjs live in the browser. Everything is loaded via dynamic import
// inside the handlers so nothing touches the network during SSR/build.
function Playground() {
  const [token, setToken] = useState('');
  const [symbol, setSymbol] = useState('BINA_BTC_USDT');
  const [log, setLog] = useState<string[]>([]);
  const clientRef = useRef<any>(null);
  const subRef = useRef<any>(null);

  const append = (line: string) =>
    setLog((l) => [`${new Date().toLocaleTimeString()}  ${line}`, ...l].slice(0, 200));

  async function getClient() {
    if (!token) throw new Error('Paste a Coinray token first.');
    if (!clientRef.current) {
      const {default: Coinray} = await import('coinrayjs');
      clientRef.current = new Coinray(token);
      append('client created');
    }
    return clientRef.current;
  }

  async function fetchExchanges() {
    try {
      const c = await getClient();
      const exchanges = await c.fetchExchanges((x: any) => x, undefined);
      append(`fetchExchanges → ${exchanges.length} exchanges`);
      append(JSON.stringify(exchanges.slice(0, 3), null, 2));
    } catch (e: any) {
      append(`error: ${e.message}`);
    }
  }

  async function fetchCandles() {
    try {
      const c = await getClient();
      const now = Math.floor(Date.now() / 1000);
      const candles = await c.fetchCandles({
        coinraySymbol: symbol,
        resolution: '60',
        start: now - 24 * 3600,
        end: now,
      });
      append(`fetchCandles(${symbol}) → ${candles.length} candles`);
      append(JSON.stringify(candles.slice(-2), null, 2));
    } catch (e: any) {
      append(`error: ${e.message}`);
    }
  }

  async function subscribeTrades() {
    try {
      const c = await getClient();
      if (subRef.current) {
        c.unsubscribeTrades({coinraySymbol: symbol}, subRef.current);
        subRef.current = null;
        append('unsubscribed trades');
        return;
      }
      const cb = ({trades}: any) =>
        trades.forEach((t: any) => append(`trade ${symbol}  ${t.price} × ${t.quantity}`));
      subRef.current = cb;
      await c.subscribeTrades({coinraySymbol: symbol}, cb);
      append(`subscribed to trades for ${symbol} (click again to stop)`);
    } catch (e: any) {
      append(`error: ${e.message}`);
    }
  }

  const btn: React.CSSProperties = {
    padding: '8px 14px', marginRight: 8, marginBottom: 8, cursor: 'pointer',
  };

  return (
    <div style={{maxWidth: 860, margin: '0 auto', padding: '2rem 1rem'}}>
      <h1>Playground</h1>
      <p>
        Run live coinrayjs calls from your browser. Paste a Coinray token, pick a market, and
        fire calls. Calls go straight from this page to Coinray — nothing is sent anywhere else.
      </p>

      <label style={{display: 'block', marginBottom: 8}}>
        Coinray token
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="eyJ..."
          style={{display: 'block', width: '100%', padding: 8, marginTop: 4}}
        />
      </label>

      <label style={{display: 'block', marginBottom: 16}}>
        Coinray symbol
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          style={{display: 'block', width: 260, padding: 8, marginTop: 4}}
        />
      </label>

      <div>
        <button style={btn} onClick={fetchExchanges}>fetchExchanges()</button>
        <button style={btn} onClick={fetchCandles}>fetchCandles()</button>
        <button style={btn} onClick={subscribeTrades}>toggle subscribeTrades()</button>
        <button style={btn} onClick={() => setLog([])}>clear log</button>
      </div>

      <pre
        style={{
          marginTop: 16, height: 360, overflow: 'auto', padding: 12,
          background: 'var(--ifm-code-background)', borderRadius: 8, fontSize: 13,
        }}
      >
        {log.length ? log.join('\n') : 'Output appears here…'}
      </pre>
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <Layout title="Playground" description="Run live coinrayjs API calls in your browser">
      <BrowserOnly>{() => <Playground />}</BrowserOnly>
    </Layout>
  );
}
