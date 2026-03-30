import { useState } from 'react';

export default function AddressOutput({ result }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(result.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const networkLabel = {
    mainnet: 'Bitcoin Mainnet',
    testnet: 'Testnet',
    signet:  'Signet',
    regtest: 'Regtest',
  }[result.steps.find(s => s.id === 'address')?.network] || 'Bitcoin';

  return (
    <div className="address-output">
      <div className="address-header">
        <div className="address-title-row">
          <span className="address-check">✓</span>
          <h2>P2TR Address Generated</h2>
          <span className="network-badge">{networkLabel}</span>
        </div>
        <p className="address-meta">
          {result.hasScripts
            ? `Key-path + ${result.steps.find(s => s.id === 'tapleaf_hashes')?.leaves?.length ?? 0} script path(s)`
            : 'Key-path only (no scripts)'}
          {' · '}
          Witness version 1 · bech32m
        </p>
      </div>

      <div className="address-box">
        <code className="address-value">{result.address}</code>
        <button className="btn-copy" onClick={copy}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      <div className="address-keys">
        <div className="key-row">
          <span className="key-row-label">Internal key (P)</span>
          <code className="key-row-value">{result.internalKey}</code>
        </div>
        {result.merkleRoot && (
          <div className="key-row">
            <span className="key-row-label">Merkle root</span>
            <code className="key-row-value">{result.merkleRoot}</code>
          </div>
        )}
        <div className="key-row">
          <span className="key-row-label">Tweak hash (t)</span>
          <code className="key-row-value">{result.tweakHash}</code>
        </div>
        <div className="key-row">
          <span className="key-row-label">Tweaked key (Q)</span>
          <code className="key-row-value">{result.tweakedKey}</code>
        </div>
        <div className="key-row">
          <span className="key-row-label">Parity</span>
          <code className="key-row-value parity">
            {result.parity === 0 ? '0 (even / 0x02)' : '1 (odd / 0x03)'}
          </code>
        </div>
      </div>

      <div className="spending-info">
        <h3>Spending Paths</h3>
        <div className="spending-paths">
          <div className="path-box key-path">
            <span className="path-icon">🔑</span>
            <div>
              <strong>Key Path</strong>
              <p>Sign with the tweaked internal key Q using a Schnorr signature.</p>
            </div>
          </div>
          {result.hasScripts && result.steps
            .find(s => s.id === 'tapleaf_hashes')
            ?.leaves?.map((leaf, i) => (
              <div key={i} className="path-box script-path">
                <span className="path-icon">📜</span>
                <div>
                  <strong>{leaf.label}</strong>
                  <p>Script path spend via leaf #{i + 1}. Requires control block with merkle proof.</p>
                  <code className="leaf-hash">TapLeaf: {leaf.hash.slice(0, 16)}…</code>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
