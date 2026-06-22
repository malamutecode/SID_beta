// Centralised environment access. DEMO_ENV is surfaced to the frontend via Vite
// env vars (VITE_DEMO_ENV); the backend also reports it via /config, which takes
// precedence once loaded.

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export const DEMO_ENV: boolean =
  String(import.meta.env.VITE_DEMO_ENV ?? 'false').toLowerCase() === 'true';
