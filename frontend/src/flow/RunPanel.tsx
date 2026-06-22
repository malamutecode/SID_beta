// Run panel: pick/enter a document, execute the diagram via /run-flow, show each
// classification step and highlight the traversed path. In demo mode the final
// employee comes from the deterministic doc->employee map. Polish UI.

import { useEffect, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { classifyService } from '../services/classifyService';
import { employeeService } from '../services/employeeService';
import { DOC_TO_EMPLOYEE, SAMPLE_DOCUMENTS } from '../data/demo';
import type { AppConfig, Employee } from '../types';
import type { RunFlowResponse } from './flowTypes';
import { DropZone } from './DropZone';

interface Props {
  config: AppConfig | null;
  nodes: Node[];
  edges: Edge[];
  onPath: (path: { nodes: string[]; edges: string[] }) => void;
}

export function RunPanel({ config, nodes, edges, onPath }: Props) {
  const demo = config?.demo_env ?? false;
  const [selectedDoc, setSelectedDoc] = useState<string>(SAMPLE_DOCUMENTS[0].name);
  // Non-demo: text extracted from a dropped file + its name.
  const [fileText, setFileText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<RunFlowResponse | null>(null);
  const [assigned, setAssigned] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear any highlight when the diagram structure changes underneath us.
  useEffect(() => {
    onPath({ nodes: [], edges: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, edges.length]);

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setAssigned(null);
    onPath({ nodes: [], edges: [] });
    try {
      const doc = demo ? SAMPLE_DOCUMENTS.find((d) => d.name === selectedDoc) : null;
      const text = demo ? (doc?.text ?? '') : fileText;
      const name = demo ? selectedDoc : (fileName ?? undefined);
      if (!text.trim()) throw new Error('Najpierw wczytaj dokument (przeciągnij plik).');
      if (nodes.length === 0) throw new Error('Diagram jest pusty — dodaj węzły.');

      const res = await classifyService.runFlow(nodes, edges, text, name);
      setResult(res);
      onPath({ nodes: res.path_node_ids, edges: res.path_edge_ids });

      if (demo) {
        const empId = DOC_TO_EMPLOYEE[selectedDoc];
        if (empId) setAssigned((await employeeService.getById(empId)) ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Uruchom klasyfikację</h3>
        {demo && <span className="badge badge-demo">TRYB DEMO</span>}
      </div>

      {demo ? (
        <label className="field">
          <span>Przykładowy dokument</span>
          <select value={selectedDoc} onChange={(e) => setSelectedDoc(e.target.value)}>
            {SAMPLE_DOCUMENTS.map((d) => (
              <option key={d.name} value={d.name}>{d.name}</option>
            ))}
          </select>
        </label>
      ) : (
        <div className="field">
          <span>Dokument</span>
          <DropZone
            fileName={fileName}
            onExtracted={(text, name) => {
              setFileText(text);
              setFileName(name);
              setError(null);
            }}
            onError={(msg) => setError(msg || null)}
          />
        </div>
      )}

      <button className="btn" onClick={run} disabled={loading}>
        {loading ? 'Klasyfikowanie…' : 'Uruchom przepływ'}
      </button>

      {error && <div className="alert alert-error">{error}</div>}

      {result && (
        <div className="result">
          <div className="steps-title">Ścieżka klasyfikacji</div>
          <ol className="steps">
            {result.steps.map((s, i) => (
              <li key={i}>
                <div className="step-node">{s.node_label}</div>
                <div className="step-choice">
                  → <b>{s.chosen_class}</b>{' '}
                  <span className="muted">({(s.confidence * 100).toFixed(0)}%)</span>
                </div>
                <div className="step-classes">spośród: {s.classes.join(', ')}</div>
                <div className="step-reason">{s.reason}</div>
              </li>
            ))}
            {result.steps.length === 0 && (
              <li className="muted">Brak kroków klasyfikacji (sprawdź etykiety krawędzi).</li>
            )}
          </ol>

          <div className="result-row final-row">
            <span>Węzeł końcowy</span>
            <b className="dept">{result.final_node_label ?? '—'}</b>
          </div>

          {demo && assigned && (
            <div className="assignment">
              <div className="assignment-title">Przypisano do (deterministycznie)</div>
              <div className="assignment-emp">{assigned.fullName}</div>
              <div className="assignment-meta">{assigned.team}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
