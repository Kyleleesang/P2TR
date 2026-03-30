/**
 * P2TR (Pay-to-Taproot) address generator — BIP 341 implementation
 *
 * Uses bitcoinjs-lib for script utilities and tagged hashing,
 * and tiny-secp256k1 (WASM) for secp256k1 point arithmetic.
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as tinysecp from 'tiny-secp256k1';
import { crypto as bcrypto, opcodes as OPS, script as bscript } from 'bitcoinjs-lib';
import { bech32m } from 'bech32';

// ─── Utilities ────────────────────────────────────────────────────────────────

export function toHex(bytes) {
  return Buffer.from(bytes).toString('hex');
}

export function fromHex(hex) {
  return Buffer.from(hex, 'hex');
}

/** Derive x-only pubkey from a compressed public key (33 bytes) */
export function xOnlyFromCompressedPubKey(pubKeyHex) {
  const buf = fromHex(pubKeyHex);
  if (buf.length === 33) return toHex(buf.slice(1));
  if (buf.length === 32) return pubKeyHex;
  throw new Error('Expected 32 or 33 byte public key');
}

/** Generate a fresh random secp256k1 key pair, returning x-only public key */
export function generateRandomXOnlyKey() {
  // Use Web Crypto API to generate entropy
  let privKey;
  do {
    privKey = new Uint8Array(32);
    crypto.getRandomValues(privKey);
  } while (!tinysecp.isPrivate(privKey)); // retry on the astronomically rare invalid case

  const fullPubKey = tinysecp.pointFromScalar(privKey, true); // compressed 33 bytes
  const xOnly = fullPubKey.slice(1); // drop prefix byte → 32-byte x-coord

  return {
    privateKey: toHex(privKey),
    publicKey: toHex(fullPubKey),
    xOnlyPublicKey: toHex(xOnly),
  };
}

// ─── Script Builders ──────────────────────────────────────────────────────────

/**
 * <xonly_pubkey> OP_CHECKSIG  (BIP 342 Tapscript single-key)
 */
export function buildP2PKScript(xOnlyPubKeyHex) {
  return bscript.compile([fromHex(xOnlyPubKeyHex), OPS.OP_CHECKSIG]);
}

/**
 * k-of-n multisig using OP_CHECKSIG / OP_CHECKSIGADD (BIP 342)
 */
export function buildMultisigScript(xOnlyPubKeys, k) {
  const chunks = [];
  xOnlyPubKeys.forEach((key, i) => {
    chunks.push(fromHex(key));
    chunks.push(i === 0 ? OPS.OP_CHECKSIG : OPS.OP_CHECKSIGADD);
  });
  chunks.push(bscript.number.encode(k));
  chunks.push(OPS.OP_NUMEQUAL);
  return bscript.compile(chunks);
}

/**
 * Absolute CLTV timelock: OP_CHECKLOCKTIMEVERIFY
 */
export function buildTimelockScript(locktime, xOnlyPubKeyHex) {
  return bscript.compile([
    bscript.number.encode(locktime),
    OPS.OP_CHECKLOCKTIMEVERIFY,
    OPS.OP_DROP,
    fromHex(xOnlyPubKeyHex),
    OPS.OP_CHECKSIG,
  ]);
}

/**
 * Relative CSV timelock: OP_CHECKSEQUENCEVERIFY
 */
export function buildCSVScript(sequence, xOnlyPubKeyHex) {
  return bscript.compile([
    bscript.number.encode(sequence),
    OPS.OP_CHECKSEQUENCEVERIFY,
    OPS.OP_DROP,
    fromHex(xOnlyPubKeyHex),
    OPS.OP_CHECKSIG,
  ]);
}

// ─── Tagged Hashing (BIP 340/341) ─────────────────────────────────────────────

const LEAF_VERSION_TAPSCRIPT = 0xc0;

/**
 * TapLeaf hash — tagged_hash("TapLeaf", version || compact_size(script) || script)
 */
export function computeTapLeafHash(scriptHex, version = LEAF_VERSION_TAPSCRIPT) {
  const script = fromHex(scriptHex);
  const hash = bcrypto.taggedHash(
    'TapLeaf',
    Buffer.concat([Buffer.from([version]), encodeVarInt(script.length), script]),
  );
  return toHex(hash);
}

/**
 * TapBranch hash — tagged_hash("TapBranch", lex_sort(left, right))
 */
export function computeTapBranchHash(leftHex, rightHex) {
  const left = fromHex(leftHex);
  const right = fromHex(rightHex);
  const [a, b] = Buffer.compare(left, right) <= 0 ? [left, right] : [right, left];
  return toHex(bcrypto.taggedHash('TapBranch', Buffer.concat([a, b])));
}

function encodeVarInt(n) {
  if (n < 0xfd) return Buffer.from([n]);
  if (n <= 0xffff) {
    const b = Buffer.alloc(3);
    b[0] = 0xfd;
    b.writeUInt16LE(n, 1);
    return b;
  }
  const b = Buffer.alloc(5);
  b[0] = 0xfe;
  b.writeUInt32LE(n, 1);
  return b;
}

// ─── Merkle Tree ──────────────────────────────────────────────────────────────

/**
 * Recursively build and hash a tapscript tree from an array of leaf objects.
 * Returns the root hash node with the full tree structure attached.
 *
 * @param {Array<{output: Buffer, version: number}>} leaves
 */
function buildHashNode(taptree) {
  if (isTapLeaf(taptree)) {
    const scriptHex = toHex(taptree.output);
    const hash = computeTapLeafHash(scriptHex, taptree.version ?? LEAF_VERSION_TAPSCRIPT);
    return { type: 'leaf', hash, scriptHex };
  }
  // Branch: recurse on children, then sort by hash and combine
  const leftNode  = buildHashNode(taptree[0]);
  const rightNode = buildHashNode(taptree[1]);
  // Lex sort: smaller hash goes first
  const [a, b] =
    Buffer.compare(fromHex(leftNode.hash), fromHex(rightNode.hash)) <= 0
      ? [leftNode, rightNode]
      : [rightNode, leftNode];
  const hash = computeTapBranchHash(a.hash, b.hash);
  return { type: 'branch', hash, left: a, right: b };
}

function isTapLeaf(obj) {
  return obj && 'output' in obj && !Array.isArray(obj);
}

/**
 * Arrange leaves into a balanced Huffman-style binary tree.
 * (Pairs leaves left-to-right, nesting the remainder.)
 */
function arrangeTaptree(leaves) {
  if (leaves.length === 0) return null;
  if (leaves.length === 1) return leaves[0];
  if (leaves.length === 2) return [leaves[0], leaves[1]];
  const half = Math.ceil(leaves.length / 2);
  return [arrangeTaptree(leaves.slice(0, half)), arrangeTaptree(leaves.slice(half))];
}

// ─── Key Tweaking (BIP 341) ───────────────────────────────────────────────────

/**
 * Compute the tweaked output key Q from internal key P.
 *
 *   t  = tagged_hash("TapTweak", P || merkle_root)   // or just P if no scripts
 *   Q  = lift_x(P) + t·G
 *
 * Returns { tweakedKey (hex), parity (0 or 1), tweakHash (hex) }
 */
export function tweakInternalKey(internalKeyHex, merkleRootHex = null) {
  const internalKey = fromHex(internalKeyHex);

  const tweakInput = merkleRootHex
    ? Buffer.concat([internalKey, fromHex(merkleRootHex)])
    : internalKey;

  const tweakHash = bcrypto.taggedHash('TapTweak', tweakInput);

  const result = tinysecp.xOnlyPointAddTweak(internalKey, tweakHash);
  if (!result) throw new Error('Invalid key tweak — check that the internal key is a valid secp256k1 x-only point.');

  return {
    tweakedKey: toHex(result.xOnlyPubkey),
    parity: result.parity,      // 0 = even, 1 = odd
    tweakHash: toHex(tweakHash),
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

/** Returns true if the hex string is a valid 32-byte x-only secp256k1 public key */
export function validateXOnlyPubKey(hex) {
  if (typeof hex !== 'string' || !/^[0-9a-fA-F]{64}$/.test(hex)) return false;
  try {
    return tinysecp.isXOnlyPoint(fromHex(hex));
  } catch {
    return false;
  }
}

/** Returns true if the hex string is a syntactically valid Bitcoin script */
export function validateScript(hex) {
  if (typeof hex !== 'string' || !/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) return false;
  try {
    bscript.decompile(fromHex(hex));
    return true;
  } catch {
    return false;
  }
}

/** Returns the ASM representation of a script hex string */
export function scriptToAsm(scriptHex) {
  try {
    return bscript.toASM(fromHex(scriptHex));
  } catch {
    return scriptHex;
  }
}

// ─── Main: Generate P2TR Address ─────────────────────────────────────────────

/**
 * Generate a P2TR address with a full BIP 341 computation trace.
 *
 * @param {string} internalKeyHex   32-byte x-only internal public key (hex)
 * @param {Array}  leaves           [{scriptHex, version?, label?}, …]
 * @param {'mainnet'|'testnet'|'signet'|'regtest'} network
 * @returns {{ address, internalKey, merkleRoot, tweakedKey, tweakHash, parity, steps, hasScripts }}
 */
export function generateP2TR(internalKeyHex, leaves = [], network = 'mainnet') {
  // Normalise: filter out leaves that have no script
  const validLeaves = leaves.filter(l => l.scriptHex && l.scriptHex.length > 0);

  const steps = [];

  // ── Step 1: Internal Key ─────────────────────────────────────────────────
  steps.push({
    id: 'internal_key',
    title: 'Internal Public Key (P)',
    description:
      'The x-only 32-byte Schnorr public key P serves as the taproot internal key. ' +
      'Key-path spends are authorised by a Schnorr signature made with the tweaked key Q.',
    formula: 'P  (32-byte x-only secp256k1 point)',
    values: { internalKey: internalKeyHex },
  });

  // ── Step 2: TapLeaf Hashes ───────────────────────────────────────────────
  const leafHashes = [];
  if (validLeaves.length > 0) {
    const leafSteps = validLeaves.map((leaf, i) => {
      const hash = computeTapLeafHash(leaf.scriptHex, leaf.version ?? LEAF_VERSION_TAPSCRIPT);
      leafHashes.push({ ...leaf, hash, index: i });
      return {
        index: i,
        label: leaf.label || `Script ${i + 1}`,
        scriptHex: leaf.scriptHex,
        scriptAsm: scriptToAsm(leaf.scriptHex),
        version: (leaf.version ?? LEAF_VERSION_TAPSCRIPT).toString(16).padStart(2, '0'),
        hash,
      };
    });

    steps.push({
      id: 'tapleaf_hashes',
      title: 'TapLeaf Hashes',
      description:
        'Each tapscript leaf is hashed using the "TapLeaf" tagged hash. ' +
        'The version byte (0xc0) identifies BIP 342 Tapscript spending rules.',
      formula: 'hash_leaf = tagged_hash("TapLeaf",  version || compact_size(script) || script)',
      leaves: leafSteps,
    });
  }

  // ── Step 3: Tapscript Merkle Tree ────────────────────────────────────────
  let merkleRoot = null;
  let treeData   = null;

  if (validLeaves.length > 0) {
    const tapLeaves = validLeaves.map(l => ({
      output:  fromHex(l.scriptHex),
      version: l.version ?? LEAF_VERSION_TAPSCRIPT,
    }));

    const taptree  = arrangeTaptree(tapLeaves);
    const hashTree = buildHashNode(taptree);
    merkleRoot     = hashTree.hash;
    treeData       = enrichTree(hashTree, leafHashes);

    const stepId = validLeaves.length === 1 ? 'merkle_root' : 'merkle_tree';
    steps.push({
      id: stepId,
      title: validLeaves.length === 1 ? 'Merkle Root (single leaf)' : 'Tapscript Merkle Tree',
      description:
        validLeaves.length === 1
          ? 'With a single leaf the merkle root equals the TapLeaf hash directly.'
          : 'Leaf hashes are paired and hashed up the tree. ' +
            'Each pair is sorted lexicographically before hashing to produce a canonical tree.',
      formula:
        validLeaves.length === 1
          ? 'merkle_root = hash_leaf'
          : 'hash_branch(a,b) = tagged_hash("TapBranch", lex_sort(a, b))',
      merkleRoot,
      tree: treeData,
    });
  }

  // ── Step 4: TapTweak Hash ────────────────────────────────────────────────
  const internalKeyBuf = fromHex(internalKeyHex);
  const tweakInput = merkleRoot
    ? Buffer.concat([internalKeyBuf, fromHex(merkleRoot)])
    : internalKeyBuf;

  const tweakHashBytes = bcrypto.taggedHash('TapTweak', tweakInput);
  const tweakHash      = toHex(tweakHashBytes);

  steps.push({
    id: 'tweak_hash',
    title: 'TapTweak Hash (t)',
    description: merkleRoot
      ? 'The tweak scalar t binds the internal key to the tapscript tree. ' +
        'It commits to both P and the merkle root, so any change to the scripts invalidates the address.'
      : 'Key-path only: t is derived from P alone, committing to "no scripts". ' +
        'This prevents anyone from claiming an alternate script path that was never intended.',
    formula: merkleRoot
      ? 't = tagged_hash("TapTweak",  P  ||  merkle_root)'
      : 't = tagged_hash("TapTweak",  P)',
    tweakInput: merkleRoot ? `${internalKeyHex}\n${merkleRoot}` : internalKeyHex,
    tweakHash,
  });

  // ── Step 5: Tweaked Output Key ───────────────────────────────────────────
  const { tweakedKey, parity } = tweakInternalKey(internalKeyHex, merkleRoot);

  steps.push({
    id: 'tweaked_key',
    title: 'Tweaked Output Key (Q)',
    description:
      'Q is derived by adding t·G to P on the secp256k1 curve. ' +
      'Spending via the key path requires a Schnorr signature from Q. ' +
      'BIP 341 requires Q to have an even y-coordinate; if odd, P is negated first.',
    formula: 'Q = P + t·G    (x-only, parity normalised to even)',
    internalKey: internalKeyHex,
    tweakHash,
    tweakedKey,
    parity: parity === 0 ? 'even (0x02)' : 'odd (0x03)',
    parityBit: parity,
  });

  // ── Step 6: bech32m Address ──────────────────────────────────────────────
  const net = getNetwork(network);
  const tweakedKeyBytes = fromHex(tweakedKey);
  const words  = bech32m.toWords(tweakedKeyBytes);
  const address = bech32m.encode(net.bech32, [0x01, ...words]);

  steps.push({
    id: 'address',
    title: 'P2TR Address (bech32m)',
    description:
      `The tweaked key Q is encoded as a native SegWit version-1 output using bech32m (BIP 350) on ${network}. ` +
      'The human-readable part (HRP) distinguishes the network.',
    formula: 'address = bech32m(hrp, [witness_version=1, ...to_5bit(Q)])',
    hrp: net.bech32,
    witnessVersion: 1,
    tweakedKey,
    address,
    network,
  });

  return {
    address,
    internalKey: internalKeyHex,
    merkleRoot:  merkleRoot ?? null,
    tweakedKey,
    tweakHash,
    parity,
    steps,
    hasScripts: validLeaves.length > 0,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNetwork(network) {
  switch (network) {
    case 'testnet': return bitcoin.networks.testnet;
    case 'regtest': return bitcoin.networks.regtest;
    case 'signet':  return { ...bitcoin.networks.testnet, bech32: 'tb' };
    default:        return bitcoin.networks.bitcoin;
  }
}

/** Annotate leaf nodes in the tree with their labels */
function enrichTree(node, leafHashes) {
  if (node.type === 'leaf') {
    const match = leafHashes.find(l => l.hash === node.hash);
    return { ...node, label: match?.label || 'Leaf' };
  }
  return {
    ...node,
    left:  node.left  ? enrichTree(node.left,  leafHashes) : null,
    right: node.right ? enrichTree(node.right, leafHashes) : null,
  };
}
