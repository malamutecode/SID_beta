// Seed mock data for the registries. In a real deployment these would come from
// a backend/DB; here they back the in-memory services. Edit freely.

import type { Department, Employee } from '../types';

export const SEED_DEPARTMENTS: Department[] = [
  {
    id: 'dep-geodezja',
    name: 'geodezja',
    teams: [
      { id: 'team-geo-1', name: 'team 1' },
      { id: 'team-geo-2', name: 'team 2' },
    ],
  },
  {
    id: 'dep-drogi',
    name: 'drogi',
    teams: [
      { id: 'team-drogi-1', name: 'team 1' },
      { id: 'team-drogi-2', name: 'team 2' },
    ],
  },
];

export const SEED_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1',
    fullName: 'Anna Kowalska',
    departmentId: 'dep-geodezja',
    team: 'team 1',
    skills: ['pomiary', 'mapy'],
    active: true,
  },
  {
    id: 'emp-2',
    fullName: 'Piotr Nowak',
    departmentId: 'dep-geodezja',
    team: 'team 2',
    skills: ['ewidencja gruntów', 'GIS'],
    active: true,
  },
  {
    id: 'emp-3',
    fullName: 'Maria Wiśniewska',
    departmentId: 'dep-drogi',
    team: 'team 1',
    skills: ['zezwolenia', 'pas drogowy'],
    active: true,
  },
  {
    id: 'emp-4',
    fullName: 'Tomasz Lewandowski',
    departmentId: 'dep-drogi',
    team: 'team 2',
    skills: ['projekty drogowe', 'nadzór'],
    active: true,
  },
  {
    id: 'emp-5',
    fullName: 'Katarzyna Zielińska',
    departmentId: 'dep-drogi',
    team: 'team 1',
    skills: ['podatki lokalne', 'opłaty'],
    active: false,
  },
];
