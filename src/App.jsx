import { useState, useCallback } from 'react';
import KeyInput from './components/KeyInput';
import ScriptBuilder from './components/ScriptBuilder';
import ComputationSteps from './components/ComputationSteps';
import AddressOutput from './components/AddressOutput';
import NetworkSelector from './components/NetworkSelector';
import TreeVisualizer from './components/TreeVisualizer';
import {
  generateP2TR,
  generateRandomXOnlyKey,
  validateXOnlyPubKey,
} from './crypto/taproot';
import './App.css';

export default function App() {
  const [internalKey, setInternalKey] = useState('');
  const [leaves, setLeaves] = useState([]);
  const [network, setNetwork] = useState('mainnet');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = useCallback(() => {
    setError(null);
    setResult(null);

    if (!internalKey) {
      setError('Enter an internal public key (32 bytes x-only, hex).');
      return;
    }
    if (!validateXOnlyPubKey(internalKey)) {
      setError('Invalid x-only public key. Must be 64 hex characters representing a valid secp256k1 point.');
      return;
    }

    setIsGenerating(true);
    setTimeout(() => {
      try {
        const res = generateP2TR(internalKey, leaves, network);
        setResult(res);
      } catch (e) {
        setError(e.message);
      } finally {
        setIsGenerating(false);
      }
    }, 10);
  }, [internalKey, leaves, network]);

  const handleRandomKey = useCallback(() => {
    try {
      const { xOnlyPublicKey } = generateRandomXOnlyKey();
      setInternalKey(xOnlyPublicKey);
      setResult(null);
      setError(null);
    } catch (e) {
      setError('Failed to generate random key: ' + e.message);
    }
  }, []);

  const treeStep = result?.steps?.find(s => s.id === 'merkle_tree' || s.id === 'merkle_root');

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo-row">
            <div className="logo-icon">₿</div>
            <div>
              <h1 className="header-title">P2TR Address Generator</h1>
              <p className="header-subtitle">
                Pay-to-Taproot · BIP 341 · Tapscript Tree Construction &amp; Key Tweaking
              </p>
            </div>
          </div>
          <NetworkSelector value={network} onChange={v => { setNetwork(v); setResult(null); }} />
        </div>
      </header>

      <main className="main">
        {/* ── Left: Configuration ─────────────────────────────────── */}
        <div className="config-panel">
          <section className="card">
            <h2 className="card-title">
              <span className="step-badge">1</span>
              Internal Public Key
            </h2>
            <p className="card-desc">
              The x-only Schnorr public key P (32 bytes, 64 hex chars).
              Key-path spends are authorised by signing with the tweaked version of this key.
            </p>
            <KeyInput
              value={internalKey}
              onChange={v => { setInternalKey(v); setResult(null); setError(null); }}
              onGenerate={handleRandomKey}
            />
          </section>

          <section className="card">
            <h2 className="card-title">
              <span className="step-badge">2</span>
              Tapscript Tree <span className="optional-tag">optional</span>
            </h2>
            <p className="card-desc">
              Add script spending paths. Each leaf becomes a node in the tapscript
              merkle tree. Leave empty for a key-path-only P2TR output.
            </p>
            <ScriptBuilder leaves={leaves} onChange={v => { setLeaves(v); setResult(null); }} />
          </section>

          <button
            className="btn-generate"
            onClick={handleGenerate}
            disabled={isGenerating || !internalKey}
          >
            {isGenerating ? (
              <span className="generating">
                <span className="spinner" /> Computing…
              </span>
            ) : (
              'Generate P2TR Address →'
            )}
          </button>

          {error && (
            <div className="error-box">
              <span>⚠</span> {error}
            </div>
          )}
        </div>

        {/* ── Right: Results ──────────────────────────────────────── */}
        <div className="results-panel">
          {result ? (
            <>
              <AddressOutput result={result} />
              {result.hasScripts && treeStep?.tree && (
                <TreeVisualizer tree={treeStep.tree} />
              )}
              <ComputationSteps steps={result.steps} />
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">₿</div>
              <h3>BIP 341 Step-by-Step</h3>
              <p>
                Configure an internal key and click{' '}
                <strong>Generate P2TR Address</strong> to see the full taproot
                computation — from key tweaking to bech32m encoding.
              </p>
              <ul className="feature-list">
                <li>✓ TapLeaf hash computation</li>
                <li>✓ Merkle tree construction</li>
                <li>✓ Schnorr key tweaking (t = tagged_hash("TapTweak", P || root))</li>
                <li>✓ Q = P + t·G on secp256k1</li>
                <li>✓ bech32m address encoding</li>
              </ul>
            </div>
          )}
        </div>
      </main>

      <footer className="footer">
        <p>
          Implements <a href="https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki" target="_blank" rel="noreferrer">BIP 341</a> (Taproot),{' '}
          <a href="https://github.com/bitcoin/bips/blob/master/bip-0342.mediawiki" target="_blank" rel="noreferrer">BIP 342</a> (Tapscript), and{' '}
          <a href="https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki" target="_blank" rel="noreferrer">BIP 340</a> (Schnorr).
          Powered by <a href="https://github.com/bitcoinjs/bitcoinjs-lib" target="_blank" rel="noreferrer">bitcoinjs-lib</a> and <a href="https://github.com/paulmillr/noble-curves" target="_blank" rel="noreferrer">@noble/curves</a>.
        </p>
      </footer>
    </div>
  );
}
