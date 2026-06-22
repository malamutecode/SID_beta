// The visual flow-diagram editor (React Flow). Supports add/connect/label/rename/
// delete, pan/zoom, JSON export/import, a node-editor panel (name + classification
// instruction), and running the diagram against a document via /run-flow with the
// traversed path highlighted. Polish UI.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { NODE_KINDS, NODE_KIND_LABELS, nodeTypes } from './nodeTypes';
import { DEMO_FLOW } from '../data/demoFlow';
import { NodeEditor } from './NodeEditor';
import { RunPanel } from './RunPanel';
import type { AppConfig } from '../types';

interface Props {
  config: AppConfig | null;
}

let idCounter = 1000;
const nextId = () => `n-${idCounter++}`;

type PanelMode = 'run' | 'node';

export function FlowEditor({ config }: Props) {
  const demo = config?.demo_env ?? false;
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>('run');
  const [activePath, setActivePath] = useState<{ nodes: string[]; edges: string[] }>({ nodes: [], edges: [] });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // In demo mode, auto-load the preloaded diagram once config is known.
  useEffect(() => {
    if (demo && nodes.length === 0) {
      setNodes(structuredClone(DEMO_FLOW.nodes));
      setEdges(structuredClone(DEMO_FLOW.edges));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  // Edges are plain connectors — no labels. Classes live on Klasa (output) blocks.
  const onConnect = useCallback(
    (conn: Connection) => {
      setEdges((eds) => addEdge({ ...conn }, eds));
    },
    [setEdges],
  );

  const addNode = (type: string) => {
    const node: Node = {
      id: nextId(),
      type,
      position: { x: 120 + Math.random() * 220, y: 120 + Math.random() * 220 },
      data: { label: NODE_KIND_LABELS[type] },
    };
    setNodes((nds) => [...nds, node]);
  };

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    setSelectedId(node.id);
    setPanelMode('node');
  }, []);

  const updateNodeData = useCallback(
    (id: string, patch: { label?: string; instruction?: string }) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
      );
    },
    [setNodes],
  );

  const exportJson = () => {
    const snapshot = { nodes, edges };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'przeplyw-routingu.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const snapshot = JSON.parse(String(reader.result)) as { nodes: Node[]; edges: Edge[] };
        setNodes(snapshot.nodes ?? []);
        setEdges(snapshot.edges ?? []);
        setActivePath({ nodes: [], edges: [] });
      } catch {
        alert('Nieprawidłowy plik JSON przepływu');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const loadDemo = () => {
    setNodes(structuredClone(DEMO_FLOW.nodes));
    setEdges(structuredClone(DEMO_FLOW.edges));
    setActivePath({ nodes: [], edges: [] });
  };

  const clearAll = () => {
    setNodes([]);
    setEdges([]);
    setActivePath({ nodes: [], edges: [] });
    setSelectedId(null);
  };

  // Highlight the traversed path: mark nodes with data.__active and colour edges.
  const displayedNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: { ...n.data, __active: activePath.nodes.includes(n.id) },
      })),
    [nodes, activePath.nodes],
  );
  const displayedEdges = useMemo(
    () =>
      edges.map((e) =>
        activePath.edges.includes(e.id)
          ? { ...e, animated: true, style: { stroke: '#16a34a', strokeWidth: 2.5 } }
          : e,
      ),
    [edges, activePath.edges],
  );

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <div className="toolbar">
          <span className="toolbar-label">Dodaj węzeł:</span>
          {NODE_KINDS.map((k) => (
            <button key={k} onClick={() => addNode(k)} className="btn btn-sm">
              + {NODE_KIND_LABELS[k]}
            </button>
          ))}
          <span className="toolbar-sep" />
          <button onClick={exportJson} className="btn btn-sm">Eksport JSON</button>
          <button onClick={() => fileInputRef.current?.click()} className="btn btn-sm">Import JSON</button>
          <button onClick={loadDemo} className="btn btn-sm">Wczytaj demo</button>
          <button onClick={clearAll} className="btn btn-sm btn-danger">Wyczyść</button>
          <input ref={fileInputRef} type="file" accept="application/json" onChange={importJson} style={{ display: 'none' }} />
          <span className="toolbar-hint">
            Kliknij węzeł, aby go edytować · klasy definiują bloki „Klasa (wyjście)” · przeciągnij uchwyty, aby połączyć · Del usuwa
          </span>
        </div>
        <ReactFlow
          nodes={displayedNodes}
          edges={displayedEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={['Backspace', 'Delete']}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      <div style={{ width: 360, borderLeft: '1px solid #e5e7eb', overflow: 'auto', background: '#fff' }}>
        <div className="panel-tabs">
          <button className={panelMode === 'run' ? 'ptab active' : 'ptab'} onClick={() => setPanelMode('run')}>
            Uruchom
          </button>
          <button
            className={panelMode === 'node' ? 'ptab active' : 'ptab'}
            onClick={() => setPanelMode('node')}
            disabled={!selectedNode}
          >
            Węzeł
          </button>
        </div>
        {panelMode === 'node' && selectedNode ? (
          <NodeEditor
            node={selectedNode}
            nodes={nodes}
            edges={edges}
            onChange={updateNodeData}
            onClose={() => setPanelMode('run')}
          />
        ) : (
          <RunPanel
            config={config}
            nodes={nodes}
            edges={edges}
            onPath={(p) => setActivePath(p)}
          />
        )}
      </div>
    </div>
  );
}
