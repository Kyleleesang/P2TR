const NETWORKS = [
  { id: 'mainnet', label: 'Mainnet', hrp: 'bc1p' },
  { id: 'testnet', label: 'Testnet', hrp: 'tb1p' },
  { id: 'signet',  label: 'Signet',  hrp: 'tb1p' },
  { id: 'regtest', label: 'Regtest', hrp: 'bcrt1p' },
];

export default function NetworkSelector({ value, onChange }) {
  return (
    <div className="network-selector">
      {NETWORKS.map(n => (
        <button
          key={n.id}
          className={`network-btn ${value === n.id ? 'active' : ''}`}
          onClick={() => onChange(n.id)}
          title={`${n.id} · prefix: ${n.hrp}`}
        >
          {n.label}
        </button>
      ))}
    </div>
  );
}
