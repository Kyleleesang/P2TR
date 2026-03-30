import { useState } from 'react';

function HashChip({ label, value, mono = true }) {
  if (!value && value !== 0) return null;
  return (
    <div className="hash-chip">
      <span className="hash-chip-label">{label}</span>
      <code className={mono ? 'hash-chip-value' : 'hash-chip-value plain'}>{value}</code>
    </div>
  );
}

function StepInternalKey({ step }) {
  return (
    <div className="step-body">
      <HashChip label="P" value={step.values?.internalKey} />
    </div>
  );
}

function StepTapLeafHashes({ step }) {
  return (
    <div className="step-body">
      {step.leaves?.map((leaf, i) => (
        <div key={i} className="leaf-hash-row">
          <div className="leaf-hash-header">
            <span className="leaf-badge">Leaf {i + 1}</span>
            <strong>{leaf.label}</strong>
            <span className="leaf-version">version=0x{leaf.version}</span>
          </div>
          <HashChip label="Script hex" value={leaf.scriptHex} />
          <HashChip label="hash_leaf" value={leaf.hash} />
        </div>
      ))}
    </div>
  );
}

function StepMerkleTree({ step }) {
  return (
    <div className="step-body">
      <HashChip label="Merkle root" value={step.merkleRoot} />
      <p className="step-note">
        Branch pairs are sorted lexicographically before hashing to ensure a canonical tree structure.
      </p>
    </div>
  );
}

function StepTweakHash({ step }) {
  return (
    <div className="step-body">
      <div className="computation-block">
        <div className="computation-line">
          <span className="comp-op">input</span>
          <code className="comp-value">{step.tweakInput}</code>
        </div>
        <div className="computation-line">
          <span className="comp-op">t =</span>
          <code className="comp-value">{step.tweakHash}</code>
        </div>
      </div>
      <p className="step-note">
        The tweak scalar t must be less than the secp256k1 curve order n.
        If it is not, the key is invalid and should be discarded.
      </p>
    </div>
  );
}

function StepTweakedKey({ step }) {
  return (
    <div className="step-body">
      <div className="computation-block">
        <div className="computation-line">
          <span className="comp-op">P</span>
          <code className="comp-value">{step.internalKey}</code>
        </div>
        <div className="computation-line">
          <span className="comp-op">t</span>
          <code className="comp-value">{step.tweakHash}</code>
        </div>
        <div className="computation-divider" />
        <div className="computation-line result">
          <span className="comp-op">Q =</span>
          <code className="comp-value">{step.tweakedKey}</code>
        </div>
        <div className="computation-line">
          <span className="comp-op">parity</span>
          <code className="comp-value plain">{step.parity}</code>
        </div>
      </div>
      <p className="step-note">
        If the resulting point Q has an odd y-coordinate (parity=1), the internal key P
        is negated before tweaking to ensure the output key always has an even y-coordinate —
        a BIP 341 requirement for deterministic key serialisation.
      </p>
    </div>
  );
}

function StepAddress({ step }) {
  return (
    <div className="step-body">
      <div className="computation-block">
        <div className="computation-line">
          <span className="comp-op">HRP</span>
          <code className="comp-value plain">{step.hrp}</code>
        </div>
        <div className="computation-line">
          <span className="comp-op">witness ver.</span>
          <code className="comp-value plain">{step.witnessVersion}</code>
        </div>
        <div className="computation-line">
          <span className="comp-op">program (Q)</span>
          <code className="comp-value">{step.tweakedKey}</code>
        </div>
        <div className="computation-divider" />
        <div className="computation-line result">
          <span className="comp-op">address</span>
          <code className="comp-value address">{step.address}</code>
        </div>
      </div>
      <p className="step-note">
        bech32m (BIP 350) encodes the program as 5-bit groups with a BCH checksum.
        The witness version byte (0x01) distinguishes P2TR from P2WPKH/P2WSH (version 0).
      </p>
    </div>
  );
}

const STEP_RENDERERS = {
  internal_key:    StepInternalKey,
  tapleaf_hashes:  StepTapLeafHashes,
  merkle_root:     StepMerkleTree,
  merkle_tree:     StepMerkleTree,
  tweak_hash:      StepTweakHash,
  tweaked_key:     StepTweakedKey,
  address:         StepAddress,
};

const STEP_ICONS = {
  internal_key:    '🔑',
  tapleaf_hashes:  '🍃',
  merkle_root:     '🌳',
  merkle_tree:     '🌳',
  tweak_hash:      '#',
  tweaked_key:     '⟩',
  address:         '₿',
};

export default function ComputationSteps({ steps }) {
  const [expanded, setExpanded] = useState(
    Object.fromEntries(steps.map(s => [s.id, true]))
  );

  function toggle(id) {
    setExpanded(e => ({ ...e, [id]: !e[id] }));
  }

  return (
    <div className="computation-steps">
      <h2 className="section-title">BIP 341 Computation Trace</h2>
      <div className="steps-list">
        {steps.map((step, i) => {
          const Renderer = STEP_RENDERERS[step.id];
          const isOpen = expanded[step.id];
          return (
            <div key={step.id} className={`step-card ${isOpen ? 'open' : ''}`}>
              <button className="step-header" onClick={() => toggle(step.id)}>
                <span className="step-num-sm">{i + 1}</span>
                <span className="step-icon">{STEP_ICONS[step.id] || '·'}</span>
                <div className="step-title-block">
                  <span className="step-title">{step.title}</span>
                  <code className="step-formula">{step.formula}</code>
                </div>
                <span className="step-chevron">{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div className="step-content">
                  <p className="step-description">{step.description}</p>
                  {Renderer && <Renderer step={step} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
