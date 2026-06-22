// Custom node types for the routing flow. Each renders a kind tag, the node
// name, and (for classifier nodes) the classification instruction. Nodes on the
// traversed path are highlighted via data.__active set by the run.

import { Handle, Position, type NodeProps } from '@xyflow/react';

interface NodeStyle {
  bg: string;
  border: string;
  kind: string; // Polish, user-facing
}

// Polish kind labels (user-facing). Keys stay English for code stability.
// `class` is the OUTPUT block: it declares one class (its label is the class
// name). A classifier-type node classifies into the class blocks it connects to.
const STYLES: Record<string, NodeStyle> = {
  document: { bg: '#eef2ff', border: '#6366f1', kind: 'Dokument' },
  classifier: { bg: '#ecfeff', border: '#06b6d4', kind: 'Klasyfikator' },
  class: { bg: '#f5f3ff', border: '#8b5cf6', kind: 'Klasa (wyjście)' },
  teamCondition: { bg: '#fefce8', border: '#eab308', kind: 'Warunek zespołu' },
  personCondition: { bg: '#fff7ed', border: '#f97316', kind: 'Warunek osoby' },
  employee: { bg: '#fdf2f8', border: '#ec4899', kind: 'Pracownik' },
};

function BaseNode({ data, type, selected }: NodeProps, withTarget = true, withSource = true) {
  const style = STYLES[type] ?? { bg: '#fff', border: '#999', kind: type };
  const d = data as { label?: string; instruction?: string; __active?: boolean };
  const label = d.label ?? style.kind;
  const active = d.__active;
  return (
    <div
      style={{
        background: style.bg,
        border: `2px solid ${active ? '#16a34a' : style.border}`,
        borderRadius: 8,
        padding: '8px 12px',
        minWidth: 150,
        maxWidth: 220,
        fontSize: 13,
        boxShadow: active
          ? '0 0 0 3px rgba(22,163,74,0.35)'
          : selected
            ? '0 0 0 2px rgba(99,102,241,0.4)'
            : '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      {withTarget && <Handle type="target" position={Position.Left} />}
      <div style={{ fontSize: 10, textTransform: 'uppercase', color: style.border, fontWeight: 700 }}>
        {style.kind}
      </div>
      <div style={{ fontWeight: 500, color: '#1f2937' }}>{label}</div>
      {d.instruction && (
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, fontStyle: 'italic' }}>
          {d.instruction}
        </div>
      )}
      {withSource && <Handle type="source" position={Position.Right} />}
    </div>
  );
}

export const nodeTypes = {
  document: (p: NodeProps) => BaseNode(p, false, true),
  classifier: (p: NodeProps) => BaseNode(p, true, true),
  class: (p: NodeProps) => BaseNode(p, true, true),
  teamCondition: (p: NodeProps) => BaseNode(p, true, true),
  personCondition: (p: NodeProps) => BaseNode(p, true, true),
  employee: (p: NodeProps) => BaseNode(p, true, false),
};

export const NODE_KINDS = Object.keys(STYLES) as (keyof typeof STYLES)[];
export const NODE_KIND_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(STYLES).map(([k, v]) => [k, v.kind]),
);
