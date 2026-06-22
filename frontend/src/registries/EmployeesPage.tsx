// Employees registry: list + add/edit/delete. Each employee belongs to a
// department/team and has skills[] and an active flag.

import { useEffect, useState } from 'react';
import { employeeService } from '../services/employeeService';
import { departmentService } from '../services/departmentService';
import type { Department, Employee } from '../types';

interface FormState {
  fullName: string;
  departmentId: string;
  team: string;
  skills: string; // comma-separated in the form
  active: boolean;
}

const empty: FormState = { fullName: '', departmentId: '', team: '', skills: '', active: true };

export function EmployeesPage() {
  const [items, setItems] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(empty);

  const load = async () => {
    setItems(await employeeService.list());
    setDepartments(await departmentService.list());
  };
  useEffect(() => { load(); }, []);

  const deptName = (id: string) => departments.find((d) => d.id === id)?.name ?? '—';
  const teamsFor = (id: string) => departments.find((d) => d.id === id)?.teams ?? [];

  const startCreate = () => {
    const firstDept = departments[0];
    setEditingId('new');
    setForm({ ...empty, departmentId: firstDept?.id ?? '', team: firstDept?.teams[0]?.name ?? '' });
  };
  const startEdit = (e: Employee) => {
    setEditingId(e.id);
    setForm({
      fullName: e.fullName,
      departmentId: e.departmentId,
      team: e.team,
      skills: e.skills.join(', '),
      active: e.active,
    });
  };
  const cancel = () => { setEditingId(null); setForm(empty); };

  const save = async () => {
    if (!form.fullName.trim() || !form.departmentId) return;
    const payload = {
      fullName: form.fullName.trim(),
      departmentId: form.departmentId,
      team: form.team,
      skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
      active: form.active,
    };
    if (editingId === 'new') await employeeService.create(payload);
    else if (editingId) await employeeService.update(editingId, payload);
    cancel();
    load();
  };

  const remove = async (id: string) => {
    if (confirm('Usunąć tego pracownika?')) {
      await employeeService.remove(id);
      load();
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h2>Pracownicy</h2>
        <button className="btn" onClick={startCreate} disabled={departments.length === 0}>+ Dodaj pracownika</button>
      </div>

      {editingId && (
        <div className="card form-card">
          <h3>{editingId === 'new' ? 'Nowy pracownik' : 'Edytuj pracownika'}</h3>
          <label className="field">
            <span>Imię i nazwisko</span>
            <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </label>
          <label className="field">
            <span>Departament</span>
            <select
              value={form.departmentId}
              onChange={(e) => {
                const teams = teamsFor(e.target.value);
                setForm({ ...form, departmentId: e.target.value, team: teams[0]?.name ?? '' });
              }}
            >
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Zespół</span>
            <select value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })}>
              {teamsFor(form.departmentId).map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Umiejętności (oddzielone przecinkami)</span>
            <input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="GIS, pomiary" />
          </label>
          <label className="field-check">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            <span>Aktywny</span>
          </label>
          <div className="form-actions">
            <button className="btn" onClick={save}>Zapisz</button>
            <button className="btn btn-ghost" onClick={cancel}>Anuluj</button>
          </div>
        </div>
      )}

      <table className="table">
        <thead>
          <tr><th>Imię i nazwisko</th><th>Departament</th><th>Zespół</th><th>Umiejętności</th><th>Aktywny</th><th></th></tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.id}>
              <td>{e.fullName}</td>
              <td>{deptName(e.departmentId)}</td>
              <td>{e.team}</td>
              <td>{e.skills.join(', ') || <span className="muted">—</span>}</td>
              <td>{e.active ? '✓' : <span className="muted">nie</span>}</td>
              <td className="row-actions">
                <button className="btn btn-sm" onClick={() => startEdit(e)}>Edytuj</button>
                <button className="btn btn-sm btn-danger" onClick={() => remove(e.id)}>Usuń</button>
              </td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={6} className="muted">Brak pracowników.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
