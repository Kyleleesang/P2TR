# P2TR Address Generator

A single-page application that generates **Pay-to-Taproot (P2TR)** addresses from arbitrary key and script configurations, with a full BIP 341 computation trace.

## Features

- **Key-path and script-path spending** — configurable from the UI
- **Tapscript tree builder** — add up to N script leaves with four templates:
  - `pk(key)` — single-key Tapscript (BIP 342)
  - `multi(k, keys)` — k-of-n using `OP_CHECKSIG` / `OP_CHECKSIGADD`
  - `after(n) + pk` — absolute CLTV timelock
  - `older(n) + pk` — relative CSV timelock
  - Raw hex script input
- **Step-by-step BIP 341 computation trace:**
  1. Internal public key P
  2. TapLeaf hashes — `tagged_hash("TapLeaf", version || compact_size(script) || script)`
  3. Tapscript merkle tree — lexicographically sorted `tagged_hash("TapBranch", …)` pairs
  4. TapTweak scalar — `t = tagged_hash("TapTweak", P || merkle_root)`
  5. Tweaked output key — `Q = P + t·G`
  6. bech32m address encoding
- **Interactive merkle tree SVG** — click any node to inspect its hash
- **Network selector** — mainnet (`bc1p…`), testnet/signet (`tb1p…`), regtest (`bcrt1p…`)
- **Random key generation** using Web Crypto API

## Tech Stack

| Layer | Library |
|---|---|
| UI framework | React 19 + Vite 8 |
| Curve arithmetic | [tiny-secp256k1](https://github.com/bitcoinjs/tiny-secp256k1) (WASM) |
| Tagged hashing + script utils | [bitcoinjs-lib](https://github.com/bitcoinjs/bitcoinjs-lib) v7 |
| bech32m encoding | [bech32](https://github.com/bitcoinjs/bech32) |
| Node polyfills in browser | vite-plugin-node-polyfills |
| WASM bundling | vite-plugin-wasm |

## BIP References

| BIP | Title |
|---|---|
| BIP 340 | Schnorr Signatures for secp256k1 |
| BIP 341 | Taproot: SegWit version 1 spending rules |
| BIP 342 | Validation of Taproot Scripts |
| BIP 350 | Bech32m format for v1+ witness addresses |

## How P2TR Works

```
Internal key P  (32-byte x-only Schnorr pubkey)
         │
         ├─ Key path:   t = tagged_hash("TapTweak", P)
         │              Q = P + t·G
         │
         └─ Script path: build merkle tree of TapLeaf hashes
                         t = tagged_hash("TapTweak", P || merkle_root)
                         Q = P + t·G

Address = bech32m(hrp, [0x01, ...to_5bit_groups(Q)])
```

### TapLeaf Hash
```
hash_leaf(script) = tagged_hash("TapLeaf", version || compact_size(script) || script)
```
- `version = 0xc0` for BIP 342 Tapscript

### TapBranch Hash
```
hash_branch(a, b) = tagged_hash("TapBranch", lex_sort(a, b))
```
- Children are sorted lexicographically to produce a canonical tree

### Tagged Hash (BIP 340)
```
tagged_hash(tag, data) = SHA256(SHA256(tag) || SHA256(tag) || data)
```
Domain-separates hashes to prevent cross-protocol collisions.

## Getting Started

```bash
npm install
npm run dev           # http://localhost:5173
npm run build         # production build → dist/
node test-taproot.mjs # run crypto test suite (26 tests)
```

## Project Structure

```
src/
  crypto/
    taproot.js           # BIP 341 core: leaf hashing, tree, key tweaking, address
  components/
    KeyInput.jsx         # x-only / compressed key input with validation
    ScriptBuilder.jsx    # tapscript leaf editor (4 templates + raw hex)
    ComputationSteps.jsx # collapsible BIP 341 computation trace
    AddressOutput.jsx    # address + key summary + spending paths
    TreeVisualizer.jsx   # interactive SVG merkle tree
    NetworkSelector.jsx  # mainnet / testnet / signet / regtest
  App.jsx
  index.css
test-taproot.mjs         # crypto correctness test suite
```
