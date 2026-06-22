// Departments registry: list + add/edit/delete, including teams[].

import { useEffect, useState } from 'react';
import { departmentService } from '../services/departmentService';
import type { Department, Team } from '../types';

interface FormState {
  name: string;
  teams: string; // comma-separated team names in the form
}

const empty: FormState = { name: '', teams: '' };

function toTeams(csv: string): Team[] {
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name, i) => ({ id: `team-${Date.now()}-${i}`, name }));
}

export function DepartmentsPage() {
  const [items, setItems] = useState<Department[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(empty);

  const load = () => departmentService.list().then(setItems);
  useEffect(() => { load(); }, []);

  const startCreate = () => { setEditingId('new'); setForm(empty); };
  const startEdit = (d: Department) => {
    setEditingId(d.id);
    setForm({ name: d.name, teams: d.teams.map((t) => t.name).join(', ') });
  };
  const cancel = () => { setEditingId(null); setForm(empty); };

  const save = async () => {
    if (!form.name.trim()) return;
    const payload = { name: form.name.trim(), teams: toTeams(form.teams) };
    if (editingId === 'new') await departmentService.create(payload);
    else if (editingId) await departmentService.update(editingId, payload);
    cancel();
    load();
  };

  const remove = async (id: string) => {
    if (confirm('Usunąć ten departament?')) {
      await departmentService.remove(id);
      load();
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h2>Departamenty</h2>
        <button className="btn" onClick={startCreate}>+ Dodaj departament</button>
      </div>

      {editingId && (
        <div className="card form-card">
          <h3>{editingId === 'new' ? 'Nowy departament' : 'Edytuj departament'}</h3>
          <label className="field">
            <span>Nazwa</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="field">
            <span>Zespoły (oddzielone przecinkami)</span>
            <input value={form.teams} onChange={(e) => setForm({ ...form, teams: e.target.value })} placeholder="zespół 1, zespół 2" />
          </label>
          <div className="form-actions">
            <button className="btn" onClick={save}>Zapisz</button>
            <button className="btn btn-ghost" onClick={cancel}>Anuluj</button>
          </div>
        </div>
      )}

      <table className="table">
        <thead>
          <tr><th>Nazwa</th><th>Zespoły</th><th></th></tr>
        </thead>
        <tbody>
          {items.map((d) => (
            <tr key={d.id}>
              <td>{d.name}</td>
              <td>{d.teams.map((t) => t.name).join(', ') || <span className="muted">—</span>}</td>
              <td className="row-actions">
                <button className="btn btn-sm" onClick={() => startEdit(d)}>Edytuj</button>
                <button className="btn btn-sm btn-danger" onClick={() => remove(d.id)}>Usuń</button>
              </td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={3} className="muted">Brak departamentów.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
