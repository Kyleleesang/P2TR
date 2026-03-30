/**
 * Sanity-check: validate core P2TR logic against BIP 341.
 * Run: node test-taproot.mjs
 */

import { Buffer } from 'buffer';
global.Buffer = Buffer;

import * as tinysecp from 'tiny-secp256k1';
import {
  computeTapLeafHash,
  computeTapBranchHash,
  tweakInternalKey,
  generateP2TR,
  validateXOnlyPubKey,
  buildP2PKScript,
  toHex,
} from './src/crypto/taproot.js';

const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET  = '\x1b[0m';

let failures = 0;
function ok(label, cond) {
  console.log(`${cond ? GREEN + '✓' : RED + '✗'}  ${label}${RESET}`);
  if (!cond) failures++;
}

// ── Known valid keys ─────────────────────────────────────────────────────────
// x-coord of G (the secp256k1 generator point)  = scalar 1
const KEY_G = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
// scalar 2 → 2G
const priv2 = Buffer.alloc(32); priv2[31] = 2;
const KEY_2G = toHex(tinysecp.pointFromScalar(priv2, true).slice(1));

// ── Test 1: validateXOnlyPubKey ───────────────────────────────────────────────
ok('validateXOnlyPubKey accepts G.x',     validateXOnlyPubKey(KEY_G));
ok('validateXOnlyPubKey accepts 2G.x',    validateXOnlyPubKey(KEY_2G));
ok('validateXOnlyPubKey rejects short',   !validateXOnlyPubKey('deadbeef'));
ok('validateXOnlyPubKey rejects all-0',   !validateXOnlyPubKey('0'.repeat(64)));
ok('validateXOnlyPubKey rejects non-hex', !validateXOnlyPubKey('zz' + 'aa'.repeat(31)));

// ── Test 2: key-path only tweak ───────────────────────────────────────────────
const kp = tweakInternalKey(KEY_G, null);
console.log('\nKey-path tweak (P=G):');
console.log('  t =', kp.tweakHash);
console.log('  Q =', kp.tweakedKey);
ok('tweakedKey is 64 hex', kp.tweakedKey.length === 64);
ok('parity is 0 or 1',     kp.parity === 0 || kp.parity === 1);
ok('Q ≠ P (tweak changed the key)', kp.tweakedKey !== KEY_G);

// Re-derive tweak manually to double-check
import { crypto as bcrypto } from 'bitcoinjs-lib';
const expectedTweak = toHex(bcrypto.taggedHash('TapTweak', Buffer.from(KEY_G, 'hex')));
ok('tweakHash matches manual derivation', kp.tweakHash === expectedTweak);

// ── Test 3: TapLeaf hash ──────────────────────────────────────────────────────
const script1    = buildP2PKScript(KEY_G);
const script1Hex = toHex(script1);
const leafHash1  = computeTapLeafHash(script1Hex, 0xc0);
console.log('\nTapLeaf hash (G key):', leafHash1);
ok('TapLeaf hash is 64 hex', leafHash1.length === 64);

// ── Test 4: TapBranch commutativity ──────────────────────────────────────────
const script2    = buildP2PKScript(KEY_2G);
const leafHash2  = computeTapLeafHash(toHex(script2), 0xc0);
const branch_ab  = computeTapBranchHash(leafHash1, leafHash2);
const branch_ba  = computeTapBranchHash(leafHash2, leafHash1);
console.log('\nTapBranch (a,b):', branch_ab);
ok('TapBranch hash is 64 hex', branch_ab.length === 64);
ok('TapBranch(a,b) == TapBranch(b,a)', branch_ab === branch_ba);

// ── Test 5: key-path address ──────────────────────────────────────────────────
const kpResult = generateP2TR(KEY_G, [], 'mainnet');
console.log('\nKey-path P2TR address:', kpResult.address);
ok('Address starts with bc1p',    kpResult.address.startsWith('bc1p'));
ok('Address is 62 chars',         kpResult.address.length === 62);
ok('steps.length === 4',          kpResult.steps.length === 4);
ok('merkleRoot is null',          kpResult.merkleRoot === null);
ok('hasScripts is false',         kpResult.hasScripts === false);

// ── Test 6: 2-leaf script-tree address ───────────────────────────────────────
const twoLeaf = generateP2TR(
  KEY_G,
  [
    { scriptHex: script1Hex, label: 'Key G path', version: 0xc0 },
    { scriptHex: toHex(script2), label: '2G key path', version: 0xc0 },
  ],
  'mainnet',
);
console.log('\n2-leaf P2TR address:', twoLeaf.address);
ok('2-leaf address starts with bc1p',       twoLeaf.address.startsWith('bc1p'));
ok('2-leaf address ≠ key-path',             twoLeaf.address !== kpResult.address);
ok('merkleRoot is 64-hex string',           twoLeaf.merkleRoot?.length === 64);
ok('steps.length === 6',                    twoLeaf.steps.length === 6);
ok('hasScripts is true',                    twoLeaf.hasScripts === true);
ok('merkleRoot equals computed branch',     twoLeaf.merkleRoot === branch_ab || twoLeaf.merkleRoot === branch_ba);

// ── Test 7: testnet & signet prefixes ────────────────────────────────────────
ok('Testnet starts tb1p',  generateP2TR(KEY_G, [], 'testnet').address.startsWith('tb1p'));
ok('Signet starts tb1p',   generateP2TR(KEY_G, [], 'signet').address.startsWith('tb1p'));
ok('Regtest starts bcrt1p',generateP2TR(KEY_G, [], 'regtest').address.startsWith('bcrt1p'));

// ── Test 8: determinism ───────────────────────────────────────────────────────
ok('Deterministic', generateP2TR(KEY_G, [], 'mainnet').address === kpResult.address);

// ── Test 9: 4-leaf tree ───────────────────────────────────────────────────────
const keys4 = [1, 2, 3, 4].map(n => {
  const p = Buffer.alloc(32); p[31] = n;
  return toHex(tinysecp.pointFromScalar(p, true).slice(1));
});
const scripts4 = keys4.map(k => ({ scriptHex: toHex(buildP2PKScript(k)), version: 0xc0 }));
const fourLeaf = generateP2TR(KEY_G, scripts4, 'mainnet');
console.log('\n4-leaf P2TR address:', fourLeaf.address);
ok('4-leaf address starts with bc1p', fourLeaf.address.startsWith('bc1p'));
ok('4-leaf has 6 steps',              fourLeaf.steps.length === 6);

console.log(`\n${YELLOW}${failures === 0 ? '✓ All tests passed!' : `✗ ${failures} test(s) failed`}${RESET}`);
if (failures > 0) process.exit(1);
