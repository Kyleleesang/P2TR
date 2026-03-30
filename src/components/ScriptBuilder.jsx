import { useState } from 'react';
import {
  buildP2PKScript,
  buildMultisigScript,
  buildTimelockScript,
  buildCSVScript,
  validateXOnlyPubKey,
  validateScript,
  scriptToAsm,
  toHex,
} from '../crypto/taproot';

const LEAF_VERSION = 0xc0; // BIP 342 Tapscript version

const TEMPLATES = [
  { id: 'p2pk',      label: 'pk(key)',         desc: 'Single-key Tapscript' },
  { id: 'multisig',  label: 'multi(k, keys)',  desc: 'k-of-n multisig' },
  { id: 'timelock',  label: 'after(n) + pk',   desc: 'Absolute CLTV timelock' },
  { id: 'csv',       label: 'older(n) + pk',   desc: 'Relative CSV timelock' },
  { id: 'raw',       label: 'Raw script',      desc: 'Custom hex script' },
];

function ScriptLeafEditor({ index, leaf, onChange, onRemove }) {
  const [template, setTemplate] = useState(leaf.template || 'p2pk');
  const [key1, setKey1] = useState(leaf.key1 || '');
  const [keys, setKeys] = useState(leaf.keys || ['', '']);
  const [k, setK] = useState(leaf.k || 2);
  const [locktime, setLocktime] = useState(leaf.locktime || 144);
  const [rawScript, setRawScript] = useState(leaf.scriptHex || '');
  const [label, setLabel] = useState(leaf.label || `Script ${index + 1}`);

  // Accept overrides so callers can pass the just-updated value before React
  // re-renders — avoids stale-closure bugs where state hasn't flushed yet.
  function buildScript(ov = {}) {
    const _template   = ov.template   ?? template;
    const _key1       = ov.key1       ?? key1;
    const _keys       = ov.keys       ?? keys;
    const _k          = ov.k          ?? k;
    const _locktime   = ov.locktime   ?? locktime;
    const _rawScript  = ov.rawScript  ?? rawScript;
    try {
      let script;
      if (_template === 'p2pk') {
        if (!validateXOnlyPubKey(_key1)) return null;
        script = buildP2PKScript(_key1);
      } else if (_template === 'multisig') {
        const validKeys = _keys.filter(k => validateXOnlyPubKey(k));
        if (validKeys.length < 2) return null;
        script = buildMultisigScript(validKeys, Math.min(_k, validKeys.length));
      } else if (_template === 'timelock') {
        if (!validateXOnlyPubKey(_key1)) return null;
        script = buildTimelockScript(_locktime, _key1);
      } else if (_template === 'csv') {
        if (!validateXOnlyPubKey(_key1)) return null;
        script = buildCSVScript(_locktime, _key1);
      } else if (_template === 'raw') {
        if (!validateScript(_rawScript)) return null;
        return _rawScript;
      }
      return script ? toHex(script) : null;
    } catch {
      return null;
    }
  }

  function update(overrides = {}) {
    const scriptHex = buildScript(overrides);
    onChange(index, {
      label,
      template,
      key1,
      keys,
      k,
      locktime,
      rawScript,
      scriptHex: scriptHex || '',
      version: LEAF_VERSION,
      ...overrides,
    });
  }

  const scriptHex = buildScript();
  const asm = scriptHex ? scriptToAsm(scriptHex) : null;

  return (
    <div className="leaf-editor">
      <div className="leaf-header">
        <input
          className="leaf-label-input"
          value={label}
          onChange={e => { setLabel(e.target.value); update({ label: e.target.value }); }}
          placeholder="Leaf label"
        />
        <button className="btn-remove" onClick={() => onRemove(index)} title="Remove leaf">✕</button>
      </div>

      <div className="template-selector">
        {TEMPLATES.map(t => (
          <button
            key={t.id}
            className={`template-btn ${template === t.id ? 'active' : ''}`}
            onClick={() => { setTemplate(t.id); setTimeout(() => update({ template: t.id }), 0); }}
            title={t.desc}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="leaf-fields">
        {(template === 'p2pk' || template === 'timelock' || template === 'csv') && (
          <div className="field-group">
            <label className="field-label">x-only public key</label>
            <input
              className={`hex-input sm ${key1 && !validateXOnlyPubKey(key1) ? 'invalid' : ''}`}
              value={key1}
              onChange={e => {
                const v = e.target.value.trim().toLowerCase().replace(/[^0-9a-f]/g, '');
                setKey1(v);
                setTimeout(() => update({ key1: v }), 0);
              }}
              placeholder="64 hex chars"
              maxLength={64}
            />
          </div>
        )}

        {(template === 'timelock' || template === 'csv') && (
          <div className="field-group">
            <label className="field-label">
              {template === 'timelock' ? 'Block height / timestamp' : 'Relative sequence (blocks)'}
            </label>
            <input
              className="num-input"
              type="number"
              min={1}
              value={locktime}
              onChange={e => { setLocktime(+e.target.value); update({ locktime: +e.target.value }); }}
            />
          </div>
        )}

        {template === 'multisig' && (
          <>
            <div className="field-group">
              <label className="field-label">Required signatures (k of {keys.length})</label>
              <input
                className="num-input"
                type="number"
                min={1}
                max={keys.length}
                value={k}
                onChange={e => { setK(+e.target.value); update({ k: +e.target.value }); }}
              />
            </div>
            {keys.map((keyVal, ki) => (
              <div key={ki} className="field-group">
                <label className="field-label">Key {ki + 1}</label>
                <div className="input-row">
                  <input
                    className={`hex-input sm ${keyVal && !validateXOnlyPubKey(keyVal) ? 'invalid' : ''}`}
                    value={keyVal}
                    onChange={e => {
                      const v = e.target.value.trim().toLowerCase().replace(/[^0-9a-f]/g, '');
                      const newKeys = [...keys];
                      newKeys[ki] = v;
                      setKeys(newKeys);
                      update({ keys: newKeys });
                    }}
                    placeholder="64 hex chars"
                    maxLength={64}
                  />
                  {keys.length > 2 && (
                    <button
                      className="btn-remove-sm"
                      onClick={() => {
                        const newKeys = keys.filter((_, i) => i !== ki);
                        setKeys(newKeys);
                        update({ keys: newKeys });
                      }}
                    >✕</button>
                  )}
                </div>
              </div>
            ))}
            <button
              className="btn-add-key"
              onClick={() => { const newKeys = [...keys, '']; setKeys(newKeys); update({ keys: newKeys }); }}
            >
              + Add key
            </button>
          </>
        )}

        {template === 'raw' && (
          <div className="field-group">
            <label className="field-label">Script (hex)</label>
            <input
              className={`hex-input ${rawScript && !validateScript(rawScript) ? 'invalid' : ''}`}
              value={rawScript}
              onChange={e => {
                const v = e.target.value.trim().toLowerCase().replace(/[^0-9a-f]/g, '');
                setRawScript(v);
                update({ rawScript: v });
              }}
              placeholder="e.g. 2050929b…ac"
            />
          </div>
        )}
      </div>

      {asm && (
        <div className="script-preview">
          <span className="script-preview-label">Script ASM:</span>
          <code className="script-asm">{asm}</code>
          <span className="script-hex-label">Hex:</span>
          <code className="script-hex">{scriptHex}</code>
        </div>
      )}
      {!asm && (
        <div className="script-incomplete">
          Fill in all required fields to define this script leaf.
        </div>
      )}
    </div>
  );
}

export default function ScriptBuilder({ leaves, onChange }) {
  function addLeaf() {
    onChange([...leaves, {
      label: `Script ${leaves.length + 1}`,
      template: 'p2pk',
      scriptHex: '',
      version: LEAF_VERSION,
    }]);
  }

  function updateLeaf(index, updated) {
    const newLeaves = [...leaves];
    newLeaves[index] = updated;
    onChange(newLeaves);
  }

  function removeLeaf(index) {
    onChange(leaves.filter((_, i) => i !== index));
  }

  const validLeaves = leaves.filter(l => l.scriptHex && l.scriptHex.length > 0);

  return (
    <div className="script-builder">
      {leaves.length === 0 && (
        <div className="no-scripts">
          <p>No script leaves. The output will be <strong>key-path only</strong>.</p>
          <p className="hint">
            Key-path spends: anyone with the internal key can spend using a Schnorr signature.
            The tweaked key commits to "no scripts" via:
            <code> t = tagged_hash("TapTweak", P)</code>
          </p>
        </div>
      )}

      {leaves.map((leaf, i) => (
        <ScriptLeafEditor
          key={i}
          index={i}
          leaf={leaf}
          onChange={updateLeaf}
          onRemove={removeLeaf}
        />
      ))}

      <div className="script-builder-actions">
        <button className="btn-add-leaf" onClick={addLeaf}>
          + Add Script Leaf
        </button>
        {leaves.length > 0 && (
          <span className="leaf-count">
            {validLeaves.length}/{leaves.length} leaves ready
          </span>
        )}
      </div>
    </div>
  );
}
