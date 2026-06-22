// =============================================================================
// DEMO DATA — all hardcoded demo content lives here so it is easy to find/edit.
//
// When DEMO_ENV is on, the app:
//   1. preloads SAMPLE_DOCUMENTS (4 fixed docs, selectable, no upload needed),
//   2. resolves the FINAL employee assignment deterministically via
//      DOC_TO_EMPLOYEE (by document name), regardless of live LLM output,
//   3. auto-loads DEMO_FLOW into the React Flow editor on startup.
// =============================================================================

export interface SampleDocument {
  name: string;
  // Plain text body sent to the backend /classify endpoint.
  text: string;
}

// 4 fixed sample documents (geodezja / drogi themed).
export const SAMPLE_DOCUMENTS: SampleDocument[] = [
  {
    name: 'Wniosek o wypis z ewidencji gruntów.txt',
    text:
      'Wniosek o wydanie wypisu i wyrysu z ewidencji gruntów i budynków. ' +
      'Dotyczy działki ewidencyjnej nr 123/4, obręb Śródmieście. Prosimy o ' +
      'sporządzenie dokumentacji geodezyjnej oraz aktualnej mapy zasadniczej.',
  },
  {
    name: 'Zgłoszenie pracy geodezyjnej.txt',
    text:
      'Zgłoszenie pracy geodezyjnej do państwowego zasobu geodezyjnego i ' +
      'kartograficznego. Zakres: wznowienie znaków granicznych oraz pomiar ' +
      'sytuacyjno-wysokościowy działki.',
  },
  {
    name: 'Wniosek o zajęcie pasa drogowego.txt',
    text:
      'Wniosek o wydanie zezwolenia na zajęcie pasa drogowego w celu ' +
      'umieszczenia urządzeń infrastruktury technicznej. Lokalizacja: ulica ' +
      'Główna, droga gminna. Termin zajęcia oraz powierzchnia zajęcia w m2.',
  },
  {
    name: 'Projekt organizacji ruchu drogowego.txt',
    text:
      'Projekt czasowej organizacji ruchu drogowego na czas prowadzenia robót ' +
      'w pasie drogowym. Zawiera plan oznakowania, harmonogram robót drogowych ' +
      'oraz nadzór nad realizacją.',
  },
];

// Deterministic doc -> final employee map (by document name). Values are
// employee ids from data/seed.ts. This fixes the demo's end assignment so it is
// always predictable regardless of live classifier output.
export const DOC_TO_EMPLOYEE: Record<string, string> = {
  'Wniosek o wypis z ewidencji gruntów.txt': 'emp-1',
  'Zgłoszenie pracy geodezyjnej.txt': 'emp-2',
  'Wniosek o zajęcie pasa drogowego.txt': 'emp-3',
  'Projekt organizacji ruchu drogowego.txt': 'emp-4',
};
