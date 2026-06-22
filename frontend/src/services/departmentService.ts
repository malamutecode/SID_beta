// Department service: async CRUD over an in-memory list seeded from data/seed.
// All methods are async so swapping in a real HTTP/DB backend later only touches
// this file, not the UI.

import type { Department } from '../types';
import { SEED_DEPARTMENTS } from '../data/seed';

let departments: Department[] = structuredClone(SEED_DEPARTMENTS);

const delay = () => new Promise((r) => setTimeout(r, 50));
const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

export const departmentService = {
  async list(): Promise<Department[]> {
    await delay();
    return structuredClone(departments);
  },

  async create(input: Omit<Department, 'id'>): Promise<Department> {
    await delay();
    const dep: Department = { ...structuredClone(input), id: newId('dep') };
    departments.push(dep);
    return structuredClone(dep);
  },

  async update(id: string, input: Omit<Department, 'id'>): Promise<Department> {
    await delay();
    const idx = departments.findIndex((d) => d.id === id);
    if (idx === -1) throw new Error(`department not found: ${id}`);
    departments[idx] = { ...structuredClone(input), id };
    return structuredClone(departments[idx]);
  },

  async remove(id: string): Promise<void> {
    await delay();
    departments = departments.filter((d) => d.id !== id);
  },
};
