/**
 * TreeVisualizer — renders the tapscript merkle tree as an SVG diagram.
 */

import { useState } from 'react';

function truncate(hex, chars = 12) {
  if (!hex) return '';
  return hex.slice(0, chars) + '…';
}

const NODE_W = 160;
const NODE_H = 52;
const H_GAP = 24;
const V_GAP = 60;

function layoutTree(node, depth = 0, xOffset = { val: 0 }) {
  if (!node) return null;

  let left = null, right = null;

  if (node.type === 'branch') {
    left = layoutTree(node.left, depth + 1, xOffset);
    right = layoutTree(node.right, depth + 1, xOffset);
  }

  let x;
  if (node.type === 'leaf') {
    x = xOffset.val;
    xOffset.val += NODE_W + H_GAP;
  } else {
    x = (left.x + right.x) / 2;
  }

  const y = depth * (NODE_H + V_GAP);

  return { ...node, x, y, left, right };
}

function TreeNode({ node, onClick, selected }) {
  const isLeaf = node.type === 'leaf';
  const isSelected = selected === node.hash;

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      style={{ cursor: 'pointer' }}
      onClick={() => onClick(node)}
    >
      <rect
        x={0}
        y={0}
        width={NODE_W}
        height={NODE_H}
        rx={8}
        className={`tree-node-rect ${isLeaf ? 'leaf' : 'branch'} ${isSelected ? 'selected' : ''}`}
      />
      <text x={NODE_W / 2} y={16} className="tree-node-type">
        {isLeaf ? (node.label || 'Leaf') : 'Branch'}
      </text>
      <text x={NODE_W / 2} y={34} className="tree-node-hash">
        {truncate(node.hash, 14)}
      </text>
    </g>
  );
}

function TreeEdges({ node }) {
  if (!node || node.type === 'leaf') return null;
  const px = node.x + NODE_W / 2;
  const py = node.y + NODE_H;

  return (
    <>
      {node.left && (
        <>
          <line
            x1={px} y1={py}
            x2={node.left.x + NODE_W / 2}
            y2={node.left.y}
            className="tree-edge"
          />
          <TreeEdges node={node.left} />
        </>
      )}
      {node.right && (
        <>
          <line
            x1={px} y1={py}
            x2={node.right.x + NODE_W / 2}
            y2={node.right.y}
            className="tree-edge"
          />
          <TreeEdges node={node.right} />
        </>
      )}
    </>
  );
}

function collectNodes(node, acc = []) {
  if (!node) return acc;
  acc.push(node);
  collectNodes(node.left, acc);
  collectNodes(node.right, acc);
  return acc;
}

function treeWidth(node) {
  if (!node) return 0;
  if (node.type === 'leaf') return NODE_W + H_GAP;
  return treeWidth(node.left) + treeWidth(node.right);
}

function treeDepth(node) {
  if (!node) return 0;
  if (node.type === 'leaf') return 1;
  return 1 + Math.max(treeDepth(node.left), treeDepth(node.right));
}

export default function TreeVisualizer({ tree }) {
  const [selected, setSelected] = useState(null);

  if (!tree) return null;

  const laid = layoutTree(tree);
  const nodes = collectNodes(laid);
  const width = treeWidth(laid) + 40;
  const height = treeDepth(laid) * (NODE_H + V_GAP) + 20;

  const selectedNode = selected ? nodes.find(n => n.hash === selected) : null;

  return (
    <div className="tree-visualizer">
      <h2 className="section-title">Tapscript Merkle Tree</h2>
      <p className="tree-desc">
        Click any node to inspect its hash. Branch nodes are labelled with their
        <code> tagged_hash("TapBranch", …)</code> result.
      </p>

      <div className="tree-svg-wrapper">
        <svg
          width={width}
          height={height}
          viewBox={`-20 -10 ${width} ${height}`}
          className="tree-svg"
        >
          <TreeEdges node={laid} />
          {nodes.map((node, i) => (
            <TreeNode
              key={i}
              node={node}
              onClick={n => setSelected(s => s === n.hash ? null : n.hash)}
              selected={selected}
            />
          ))}
        </svg>
      </div>

      {selectedNode && (
        <div className="node-detail">
          <div className="node-detail-header">
            <span className={`node-type-badge ${selectedNode.type}`}>
              {selectedNode.type}
            </span>
            {selectedNode.label && <strong>{selectedNode.label}</strong>}
          </div>
          <div className="hash-chip">
            <span className="hash-chip-label">Hash</span>
            <code className="hash-chip-value">{selectedNode.hash}</code>
          </div>
          {selectedNode.type === 'leaf' && (
            <p className="node-detail-note">
              This leaf was hashed as:
              <code> tagged_hash("TapLeaf", 0xc0 || compact_size(script) || script)</code>
            </p>
          )}
          {selectedNode.type === 'branch' && (
            <p className="node-detail-note">
              Computed as:
              <code> tagged_hash("TapBranch", lex_sort(left_hash, right_hash))</code>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
