import { useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import './App.css';

import { FlowEditor } from './flow/FlowEditor';
import { DepartmentsPage } from './registries/DepartmentsPage';
import { EmployeesPage } from './registries/EmployeesPage';
import { classifyService } from './services/classifyService';
import { DEMO_ENV } from './env';
import type { AppConfig } from './types';

type Tab = 'flow' | 'departments' | 'employees';

function App() {
  const [tab, setTab] = useState<Tab>('flow');
  const [config, setConfig] = useState<AppConfig | null>(null);

  // Backend /config is the source of truth for the demo flag; fall back to the
  // frontend's own VITE_DEMO_ENV if the backend is unreachable.
  useEffect(() => {
    classifyService
      .getConfig()
      .then(setConfig)
      .catch(() => setConfig({ demo_env: DEMO_ENV, departments: ['geodezja', 'drogi'] }));
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          sid_beta · Routing dokumentów
          {config?.demo_env && <span className="badge badge-demo">DEMO</span>}
        </div>
        <nav className="tabs">
          <button className={tab === 'flow' ? 'tab active' : 'tab'} onClick={() => setTab('flow')}>Edytor przepływu</button>
          <button className={tab === 'departments' ? 'tab active' : 'tab'} onClick={() => setTab('departments')}>Departamenty</button>
          <button className={tab === 'employees' ? 'tab active' : 'tab'} onClick={() => setTab('employees')}>Pracownicy</button>
        </nav>
      </header>

      <main className="app-main">
        {tab === 'flow' && (
          <ReactFlowProvider>
            <FlowEditor config={config} />
          </ReactFlowProvider>
        )}
        {tab === 'departments' && <DepartmentsPage />}
        {tab === 'employees' && <EmployeesPage />}
      </main>
    </div>
  );
}

export default App;
