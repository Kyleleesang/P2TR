# P2TR Address Generator — Demo Walkthrough

A step-by-step guide to testing every feature of the app with exact dummy data and expected results.

---

## Quick-start

```
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Scenario 1 — Key-path only (no scripts)

The simplest P2TR output: a single internal key, no tapscript tree. The tweak commits to the key alone.

**Internal Key (paste into the x-only field):**
```
d6889cb081036e0faefa3a35157ad71086b123b2b144b649798b494c300a961d
```

**Steps:**
1. Make sure the **x-only (32 bytes)** tab is selected.
2. Paste the key above. The field turns green and shows `✓ Valid x-only public key`.
3. Leave the **Tapscript Tree** section empty (no leaves).
4. Network: **Mainnet**.
5. Click **Generate P2TR Address →**.

**Expected mainnet address:**
```
bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr
```

**What to verify in the results panel:**
- Address starts with `bc1p` (native SegWit v1, bech32m).
- Computation steps expand: Internal Key → TapTweak Hash → Tweaked Key → Address.
- TapTweak formula shows `t = tagged_hash("TapTweak", P)` (no merkle root term).
- No tree visualizer is shown (key-path only).

**Switch networks** (address prefix changes, key stays the same):

| Network  | Expected prefix |
|----------|----------------|
| Mainnet  | `bc1p…`        |
| Testnet  | `tb1p…`        |
| Signet   | `tb1p…`        |
| Regtest  | `bcrt1p…`      |

---

## Scenario 2 — Single script leaf (pk template)

A P2TR output with one `<key> OP_CHECKSIG` spending path in the tapscript tree.

**Internal Key:**
```
79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798
```

**Steps:**
1. Paste the internal key above; confirm green validation.
2. In the **Tapscript Tree** section, click **+ Add Script Leaf**.
3. The leaf defaults to the `pk(key)` template — keep it selected.
4. In the **x-only public key** field for the leaf, paste the same key (or any valid key):
   ```
   c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5
   ```
5. Rename the leaf label to `Spending Key` (optional, cosmetic).
6. Confirm the **Script ASM** preview shows: `<key> OP_CHECKSIG`.
7. Click **Generate P2TR Address →**.

**What to verify:**
- Result shows `1/1 leaves ready` before generating.
- Computation steps include: Internal Key → **TapLeaf Hashes** → **Merkle Root (single leaf)** → TapTweak Hash → Tweaked Key → Address.
- TapTweak formula now shows `t = tagged_hash("TapTweak", P || merkle_root)`.
- The merkle root equals the single TapLeaf hash directly (no branch hashing needed).
- A **tree visualizer** appears showing one leaf node.

---

## Scenario 3 — Absolute timelock (CLTV)

A script leaf that requires a block height to pass before the key can spend.

**Internal Key:**
```
d6889cb081036e0faefa3a35157ad71086b123b2b144b649798b494c300a961d
```

**Steps:**
1. Paste the internal key.
2. Click **+ Add Script Leaf**.
3. Select the **`after(n) + pk`** template.
4. **x-only public key** for the leaf:
   ```
   79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798
   ```
5. **Block height / timestamp**: `840000` (Bitcoin halving block).
6. Confirm the **Script ASM** preview shows:
   ```
   OP_840000 OP_CHECKLOCKTIMEVERIFY OP_DROP <key> OP_CHECKSIG
   ```
7. Click **Generate P2TR Address →**.

**What to verify:**
- TapLeaf hash is computed from the CLTV script (version `0xc0`).
- The address is different from Scenario 2 even with the same internal key — the script changes the tweak.

---

## Scenario 4 — Relative timelock (CSV)

**Internal Key:**
```
d6889cb081036e0faefa3a35157ad71086b123b2b144b649798b494c300a961d
```

**Steps:**
1. Paste the internal key.
2. Click **+ Add Script Leaf**.
3. Select the **`older(n) + pk`** template.
4. **x-only public key** for the leaf:
   ```
   79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798
   ```
5. **Relative sequence (blocks)**: `144` (≈ 1 day).
6. Script ASM preview should show:
   ```
   OP_144 OP_CHECKSEQUENCEVERIFY OP_DROP <key> OP_CHECKSIG
   ```
7. Click **Generate P2TR Address →**.

---

## Scenario 5 — Two script leaves (merkle tree with branch)

Two spending paths create a real binary merkle tree. The tree visualizer shows left/right children.

**Internal Key:**
```
79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798
```

**Leaf 1 — "Hot Key"** (pk template):
- Key: `c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5`
- Label: `Hot Key`

**Leaf 2 — "Cold Key"** (pk template):
- Key: `d6889cb081036e0faefa3a35157ad71086b123b2b144b649798b494c300a961d`
- Label: `Cold Key`

**Steps:**
1. Paste the internal key.
2. Add leaf 1 (`Hot Key`), fill in its key.
3. Add leaf 2 (`Cold Key`), fill in its key.
4. Confirm the status shows `2/2 leaves ready`.
5. Click **Generate P2TR Address →**.

**What to verify:**
- Computation steps include a **Tapscript Merkle Tree** step (not "single leaf").
- The step shows `hash_branch(a,b) = tagged_hash("TapBranch", lex_sort(a, b))`.
- The tree visualizer renders a root node branching into two leaf nodes labelled `Hot Key` and `Cold Key`.
- The leaves are lexicographically sorted by their TapLeaf hashes — the order in the tree may differ from the input order.

---

## Scenario 6 — 2-of-3 multisig leaf

**Internal Key:**
```
d6889cb081036e0faefa3a35157ad71086b123b2b144b649798b494c300a961d
```

**Steps:**
1. Paste the internal key.
2. Click **+ Add Script Leaf**.
3. Select the **`multi(k, keys)`** template.
4. Set **Required signatures** to `2`.
5. **Key 1:**
   ```
   79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798
   ```
6. **Key 2:**
   ```
   c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5
   ```
7. Click **+ Add key** and enter **Key 3:**
   ```
   f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9
   ```
8. Confirm the Script ASM preview shows BIP 342 `OP_CHECKSIG` / `OP_CHECKSIGADD` pattern.
9. Click **Generate P2TR Address →**.

**What to verify:**
- The script uses `OP_CHECKSIG`, `OP_CHECKSIGADD`, `OP_NUMEQUAL` (BIP 342 style, not legacy `OP_CHECKMULTISIG`).
- Removing a key back to 2 total still works and the `k` input auto-caps at the number of keys.

---

## Scenario 7 — Raw script

Use a custom hex-encoded script. This tests the raw input path and hex validation.

**Internal Key:**
```
79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798
```

**Steps:**
1. Paste the internal key.
2. Click **+ Add Script Leaf**.
3. Select the **`Raw script`** template.
4. **Script (hex):** `51` (this is `OP_TRUE` — anyone-can-spend).
5. The Script ASM preview shows `OP_1`.
6. Click **Generate P2TR Address →**.

**Invalid script test:** Enter `zz` — the field strips non-hex characters. Enter `ff` (single byte, valid opcode) — address generates. Enter an odd-length hex like `abc` — the `validateScript` guard catches it and the leaf shows "Fill in all required fields".

---

## Scenario 8 — Compressed key input mode

The app can accept a 33-byte compressed public key and derive the x-only form automatically.

**Steps:**
1. Click the **Compressed (33 bytes)** tab in the Internal Public Key section.
2. Paste:
   ```
   0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798
   ```
   (This is the compressed form of the generator point G — prefix `02` + x-coordinate.)
3. The app strips the `02` prefix and sets the x-only key to:
   ```
   79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798
   ```
4. Click **Generate P2TR Address →** — result is identical to using the x-only tab directly.

Repeat with an odd-y compressed key (prefix `03`):
```
03c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5
```

---

## Scenario 9 — Random key generation

**Steps:**
1. Click the **Random** button next to the internal key input.
2. A cryptographically random 32-byte x-only key is generated using `window.crypto.getRandomValues`.
3. The field populates and turns green.
4. Click **Generate P2TR Address →** — a valid address is produced.
5. Click **Random** again — a different key appears and the previous result clears.

---

## Scenario 10 — Validation error states

| Input | Expected error |
|-------|---------------|
| Empty internal key field → click Generate | `Enter an internal public key (32 bytes x-only, hex).` |
| `0000000000000000000000000000000000000000000000000000000000000000` (all zeros, not on curve) | `Invalid x-only public key. Must be 64 hex characters representing a valid secp256k1 point.` |
| `ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff` (exceeds curve order) | Same invalid key error |
| 63-char hex (one char short) | Field shows `63/64 hex chars` below input in red; Generate button stays disabled |
| Script leaf with only 62 hex chars in the x-only field | Leaf shows "Fill in all required fields"; `0/1 leaves ready` |

---

## Reference test vectors

These key/address pairs can be used to cross-check the app output against BIP 341.

| Internal Key (x-only) | Network | Address |
|---|---|---|
| `d6889cb081036e0faefa3a35157ad71086b123b2b144b649798b494c300a961d` | Mainnet | `bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr` |

Source: [BIP 341 wallet test vectors](https://github.com/bitcoin/bips/blob/master/bip-0341/wallet-test-vectors.json)

---

## Feature checklist

- [ ] x-only key input with live hex validation
- [ ] Compressed 33-byte key input with auto-strip of prefix byte
- [ ] Random key generation (Web Crypto API)
- [ ] Key-path only address (no scripts)
- [ ] Single script leaf (merkle root = leaf hash)
- [ ] Multi-leaf tapscript tree with branch hashing and tree visualizer
- [ ] `pk(key)` template → `<key> OP_CHECKSIG`
- [ ] `multi(k,n)` template → BIP 342 `OP_CHECKSIGADD / OP_NUMEQUAL`
- [ ] `after(n)` CLTV template → `OP_CHECKLOCKTIMEVERIFY`
- [ ] `older(n)` CSV template → `OP_CHECKSEQUENCEVERIFY`
- [ ] Raw hex script input
- [ ] Network switching (mainnet / testnet / signet / regtest)
- [ ] Step-by-step computation trace: TapLeaf → Merkle → TapTweak → Q → bech32m
- [ ] Validation errors and disabled Generate button when key is empty/invalid
