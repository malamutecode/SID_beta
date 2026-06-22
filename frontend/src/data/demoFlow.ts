// Preloaded mock diagram auto-loaded into the React Flow editor when DEMO_ENV is
// on. The diagram is *executable* and uses OUTPUT (class) blocks:
//
//   Dokument -> [Klasyfikuj do departamentu]
//                 -> (klasa) geodezja -> [Warunek zespołu]
//                                          -> (klasa) zespół 1 -> [Warunek osoby] -> (klasa) osoba -> Pracownik
//                                          -> (klasa) zespół 2 -> [Warunek osoby] -> (klasa) osoba -> Pracownik
//                 -> (klasa) drogi     -> [Warunek zespołu]
//                                          -> (klasa) zespół 1 -> [Warunek osoby] -> (klasa) osoba -> Pracownik
//                                          -> (klasa) zespół 2 -> [Warunek osoby] -> (klasa) osoba -> Pracownik
//
// A classifier-type node classifies into the `class` nodes it connects to; the
// chosen class node flows onward to the next stage. Edges are plain connectors.

import type { Edge, Node } from '@xyflow/react';

export interface FlowSnapshot {
  nodes: Node[];
  edges: Edge[];
}

// Helpers keep the (large) graph readable.
const cls = (id: string, label: string, x: number, y: number): Node => ({
  id,
  type: 'class',
  position: { x, y },
  data: { label },
});
const edge = (source: string, target: string): Edge => ({
  id: `e-${source}-${target}`,
  source,
  target,
});

const COL = { doc: 0, dep: 240, depCls: 470, team: 700, teamCls: 940, person: 1180, emp: 1420 };

export const DEMO_FLOW: FlowSnapshot = {
  nodes: [
    { id: 'doc', type: 'document', position: { x: COL.doc, y: 360 }, data: { label: 'Dokument' } },
    {
      id: 'classify',
      type: 'classifier',
      position: { x: COL.dep, y: 360 },
      data: {
        label: 'Zaklasyfikuj dokument do departamentu',
        instruction:
          'Określ właściwy departament na podstawie tematu dokumentu: geodezja (ewidencja gruntów, pomiary, mapy) albo drogi (pas drogowy, organizacja ruchu, roboty drogowe).',
      },
    },

    // Department class blocks
    cls('dep-geo', 'geodezja', COL.depCls, 180),
    cls('dep-drogi', 'drogi', COL.depCls, 560),

    // Team-condition classifiers (one per department)
    {
      id: 'team-geo',
      type: 'teamCondition',
      position: { x: COL.team, y: 180 },
      data: {
        label: 'Warunek przypisania do zespołu',
        instruction:
          'Wybierz zespół w departamencie geodezji: zespół 1 (wypisy, ewidencja) lub zespół 2 (pomiary terenowe, GIS).',
      },
    },
    {
      id: 'team-drogi',
      type: 'teamCondition',
      position: { x: COL.team, y: 560 },
      data: {
        label: 'Warunek przypisania do zespołu',
        instruction:
          'Wybierz zespół w departamencie dróg: zespół 1 (zezwolenia, pas drogowy) lub zespół 2 (projekty, nadzór).',
      },
    },

    // Team class blocks (distinct per department + team)
    cls('team-geo-1', 'zespół 1', COL.teamCls, 100),
    cls('team-geo-2', 'zespół 2', COL.teamCls, 260),
    cls('team-drogi-1', 'zespół 1', COL.teamCls, 480),
    cls('team-drogi-2', 'zespół 2', COL.teamCls, 640),

    // Person-condition steps (one per team). These resolve the final person and
    // flow straight to the employee terminal (no further branching needed).
    person('person-geo-1', COL.person, 100),
    person('person-geo-2', COL.person, 260),
    person('person-drogi-1', COL.person, 480),
    person('person-drogi-2', COL.person, 640),

    emp('emp-geo-1', COL.emp, 100),
    emp('emp-geo-2', COL.emp, 260),
    emp('emp-drogi-1', COL.emp, 480),
    emp('emp-drogi-2', COL.emp, 640),
  ],
  edges: [
    edge('doc', 'classify'),

    // classify -> department classes
    edge('classify', 'dep-geo'),
    edge('classify', 'dep-drogi'),

    // department class -> team condition
    edge('dep-geo', 'team-geo'),
    edge('dep-drogi', 'team-drogi'),

    // team condition -> team classes
    edge('team-geo', 'team-geo-1'),
    edge('team-geo', 'team-geo-2'),
    edge('team-drogi', 'team-drogi-1'),
    edge('team-drogi', 'team-drogi-2'),

    // team class -> person condition
    edge('team-geo-1', 'person-geo-1'),
    edge('team-geo-2', 'person-geo-2'),
    edge('team-drogi-1', 'person-drogi-1'),
    edge('team-drogi-2', 'person-drogi-2'),

    // person condition -> employee terminal (plain pass-through, no branching)
    edge('person-geo-1', 'emp-geo-1'),
    edge('person-geo-2', 'emp-geo-2'),
    edge('person-drogi-1', 'emp-drogi-1'),
    edge('person-drogi-2', 'emp-drogi-2'),
  ],
};

function person(id: string, x: number, y: number): Node {
  return {
    id,
    type: 'personCondition',
    position: { x, y },
    data: {
      label: 'Warunek przypisania do osoby',
      instruction: 'Przypisz dokument do konkretnego pracownika w wybranym zespole.',
    },
  };
}

function emp(id: string, x: number, y: number): Node {
  return { id, type: 'employee', position: { x, y }, data: { label: 'Pracownik' } };
}
