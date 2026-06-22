// Flow node/edge data shapes and the run-flow API contract.

import type { Node } from '@xyflow/react';

// Structured data carried by every diagram node. Classes are NOT stored here:
// in strict mode a node "classifies into" exactly its outgoing edge labels.
export interface FlowNodeData {
  label: string;
  instruction?: string; // condition: how this node decides among its branches
  [key: string]: unknown;
}

export type FlowNode = Node<FlowNodeData>;

// --- /run-flow response ------------------------------------------------------

export interface RunFlowStep {
  node_id: string;
  node_label: string;
  classes: string[];
  chosen_class: string;
  confidence: number;
  reason: string;
  next_node_id: string | null;
}

export interface RunFlowResponse {
  steps: RunFlowStep[];
  final_node_id: string | null;
  final_node_label: string | null;
  path_node_ids: string[];
  path_edge_ids: string[];
  assigned_employee_id?: string | null;
}
