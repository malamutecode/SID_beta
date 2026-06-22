// Employee service: async CRUD over an in-memory list seeded from data/seed.
// Same pattern as departmentService — isolated so a real backend can replace it.

import type { Employee } from '../types';
import { SEED_EMPLOYEES } from '../data/seed';

let employees: Employee[] = structuredClone(SEED_EMPLOYEES);

const delay = () => new Promise((r) => setTimeout(r, 50));
const newId = () => `emp-${Math.random().toString(36).slice(2, 9)}`;

export const employeeService = {
  async list(): Promise<Employee[]> {
    await delay();
    return structuredClone(employees);
  },

  async create(input: Omit<Employee, 'id'>): Promise<Employee> {
    await delay();
    const emp: Employee = { ...structuredClone(input), id: newId() };
    employees.push(emp);
    return structuredClone(emp);
  },

  async update(id: string, input: Omit<Employee, 'id'>): Promise<Employee> {
    await delay();
    const idx = employees.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error(`employee not found: ${id}`);
    employees[idx] = { ...structuredClone(input), id };
    return structuredClone(employees[idx]);
  },

  async remove(id: string): Promise<void> {
    await delay();
    employees = employees.filter((e) => e.id !== id);
  },

  // Candidate lookup used by the demo wiring: active employees in a given
  // department (by name) and optionally a team.
  async candidates(departmentId: string, team?: string): Promise<Employee[]> {
    await delay();
    return structuredClone(
      employees.filter(
        (e) =>
          e.active &&
          e.departmentId === departmentId &&
          (team ? e.team === team : true),
      ),
    );
  },

  async getById(id: string): Promise<Employee | undefined> {
    await delay();
    const found = employees.find((e) => e.id === id);
    return found ? structuredClone(found) : undefined;
  },
};
