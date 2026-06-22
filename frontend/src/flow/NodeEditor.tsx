// Editor for the selected node. Two relevant shapes:
//   - a CLASS (output) block: edit its class name (label).
//   - any other non-terminal node: it classifies into the CLASS blocks it
//     connects to; edit its name + classification instruction.
// Edges are plain connectors and carry no labels. Polish UI.

import type { Edge, Node } from '@xyflow/react';
import { NODE_KIND_LABELS } from './nodeTypes';

interface Props {
  node: Node;
  nodes: Node[];
  edges: Edge[];
  onChange: (id: string, data: { label?: string; instruction?: string }) => void;
  onClose: () => void;
}

const labelOf = (n: Node) => String((n.data as { label?: string }).label ?? n.type ?? n.id);

export function NodeEditor({ node, nodes, edges, onChange, onClose }: Props) {
  const data = node.data as { label?: string; instruction?: string };
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const isTerminal = node.type === 'employee';
  const isClass = node.type === 'class';

  // The class blocks this node connects to define the classes it classifies into.
  const connectedClasses = edges
    .filter((e) => e.source === node.id)
    .map((e) => byId.get(e.target))
    .filter((n): n is Node => !!n && n.type === 'class');
  const branches = connectedClasses.length > 0;

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Edycja węzła</h3>
        <button className="btn btn-sm btn-ghost" onClick={onClose}>Zamknij</button>
      </div>
      <div className="node-kind-tag">{NODE_KIND_LABELS[node.type ?? ''] ?? node.type}</div>

      <label className="field">
        <span>{isClass ? 'Nazwa klasy' : 'Nazwa'}</span>
        <input
          value={data.label ?? ''}
          placeholder={isClass ? 'np. geodezja' : ''}
          onChange={(e) => onChange(node.id, { label: e.target.value })}
        />
      </label>

      {isClass && (
        <div className="hint small">
          Ten blok reprezentuje jedną klasę. Klasyfikator połączony z tym blokiem
          może wybrać tę klasę; połącz ten blok dalej, aby określić następny krok.
        </div>
      )}

      {!isClass && !isTerminal && (
        <label className="field">
          <span>Warunek klasyfikacji (instrukcja)</span>
          <textarea
            rows={4}
            value={data.instruction ?? ''}
            placeholder="Opisz, jak wybrać spośród klas (np. „Wybierz departament na podstawie tematu dokumentu”)."
            onChange={(e) => onChange(node.id, { instruction: e.target.value })}
          />
        </label>
      )}

      {!isClass && !isTerminal && (
        <div className="classes-box">
          <div className="classes-title">Klasyfikuje do klas (bloki wyjściowe):</div>
          {branches ? (
            <ul className="classes-list">
              {connectedClasses.map((c) => (
                <li key={c.id}>
                  <span className="class-chip">{labelOf(c)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="alert alert-warn">
              Brak połączonych bloków klasy. Dodaj bloki „Klasa (wyjście)” i połącz
              je z tym węzłem — ich nazwy stają się klasami klasyfikacji.
            </div>
          )}
        </div>
      )}

      {isTerminal && (
        <div className="classes-box">
          <div className="classes-title">Węzeł końcowy</div>
          <div className="muted">Ten węzeł kończy przepływ (przypisanie pracownika).</div>
        </div>
      )}

      {!isClass && !isTerminal && (
        <div className="hint small">
          Podpowiedź: instrukcja + powyższe klasy budują prompt wysyłany do modelu
          dla tego węzła.
        </div>
      )}
    </div>
  );
}
