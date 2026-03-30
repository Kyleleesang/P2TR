import { useState } from 'react';
import { validateXOnlyPubKey, xOnlyFromCompressedPubKey } from '../crypto/taproot';

export default function KeyInput({ value, onChange, onGenerate }) {
  const [inputMode, setInputMode] = useState('xonly'); // 'xonly' | 'compressed'
  const [rawInput, setRawInput] = useState(value);

  const isValid = value && validateXOnlyPubKey(value);
  const isEmpty = !value;

  function handleChange(e) {
    const raw = e.target.value.trim().toLowerCase().replace(/[^0-9a-f]/g, '');
    setRawInput(raw);

    if (inputMode === 'xonly') {
      onChange(raw);
    } else if (inputMode === 'compressed' && raw.length === 66) {
      try {
        const xOnly = xOnlyFromCompressedPubKey(raw);
        onChange(xOnly);
      } catch {
        onChange(raw.slice(2)); // fallback: strip prefix
      }
    }
  }

  function handleModeChange(mode) {
    setInputMode(mode);
    setRawInput('');
    onChange('');
  }

  function handleGenerate() {
    setRawInput('');
    onGenerate();
  }

  return (
    <div className="key-input">
      <div className="input-mode-tabs">
        <button
          className={`tab ${inputMode === 'xonly' ? 'active' : ''}`}
          onClick={() => handleModeChange('xonly')}
        >
          x-only (32 bytes)
        </button>
        <button
          className={`tab ${inputMode === 'compressed' ? 'active' : ''}`}
          onClick={() => handleModeChange('compressed')}
        >
          Compressed (33 bytes)
        </button>
      </div>

      <div className="input-row">
        <input
          className={`hex-input ${value && !isValid ? 'invalid' : ''} ${isValid ? 'valid' : ''}`}
          type="text"
          value={inputMode === 'xonly' ? value : rawInput}
          onChange={handleChange}
          placeholder={
            inputMode === 'xonly'
              ? '64 hex chars — e.g. f30144da36…'
              : '66 hex chars — 02 or 03 prefix + 32-byte x-coord'
          }
          spellCheck={false}
          maxLength={inputMode === 'xonly' ? 64 : 66}
        />
        <button className="btn-random" onClick={handleGenerate} title="Generate random key pair">
          Random
        </button>
      </div>

      {value && !isValid && (
        <p className="input-hint error">
          {value.length < 64
            ? `${value.length}/64 hex chars`
            : 'Point not on secp256k1 curve'}
        </p>
      )}
      {isValid && (
        <p className="input-hint success">
          ✓ Valid x-only public key
        </p>
      )}

      {isValid && (
        <div className="key-display">
          <span className="key-label">P =</span>
          <code className="key-value">{value}</code>
        </div>
      )}
    </div>
  );
}
