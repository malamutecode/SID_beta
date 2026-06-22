// Classify service: calls the FastAPI backend. Also fetches runtime config.

import type { AppConfig, ClassifyResult } from '../types';
import type { RunFlowResponse } from '../flow/flowTypes';
import type { Edge, Node } from '@xyflow/react';
import { API_BASE_URL } from '../env';

export const classifyService = {
  async classify(text: string, documentName?: string): Promise<ClassifyResult> {
    const res = await fetch(`${API_BASE_URL}/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, document_name: documentName ?? null }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail.detail ?? `classify failed: HTTP ${res.status}`);
    }
    return res.json();
  },

  async getConfig(): Promise<AppConfig> {
    const res = await fetch(`${API_BASE_URL}/config`);
    if (!res.ok) throw new Error(`config failed: HTTP ${res.status}`);
    return res.json();
  },

  // Upload a document file (PDF / .docx / image); the backend extracts plain
  // text via the existing ingestion layer and returns it.
  async extract(file: File): Promise<{ text: string; document_name: string; image_pages: number }> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE_URL}/extract`, { method: 'POST', body: form });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail.detail ?? `extract failed: HTTP ${res.status}`);
    }
    return res.json();
  },

  // Execute the diagram over a document. The backend walks the graph, classifying
  // at each branching node, and returns the full traversal.
  async runFlow(
    nodes: Node[],
    edges: Edge[],
    text: string,
    documentName?: string,
  ): Promise<RunFlowResponse> {
    const res = await fetch(`${API_BASE_URL}/run-flow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        document_name: documentName ?? null,
        nodes: nodes.map((n) => ({ id: n.id, type: n.type, data: n.data })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: typeof e.label === 'string' ? e.label : null,
        })),
      }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail.detail ?? `run-flow failed: HTTP ${res.status}`);
    }
    return res.json();
  },
};
