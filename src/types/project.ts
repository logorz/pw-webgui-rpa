import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from './nodes';

// ─── Core Project File Type ──────────────────────────────────────────────────

/**
 * The top-level structure for a Playwright CLI GUI project file (.pwg).
 * Designed for serialization/deserialization, compatible with @xyflow/react
 * Node/Edge types, and the existing FlowNodeData type from nodes.ts.
 */
export interface ProjectFile {
  /** Format identifier — always 'playwright-cli-gui' */
  format: 'playwright-cli-gui';
  /** Semver version string, e.g. "1.0" */
  version: string;
  /** ISO 8601 timestamp of creation */
  createdAt: string;
  /** ISO 8601 timestamp of last update */
  updatedAt: string;
  /** Human-readable project name */
  name: string;
  /** Optional project description */
  description?: string;
  /** All flow nodes in the diagram */
  nodes: Node<FlowNodeData>[];
  /** All edges (connections) between nodes */
  edges: Edge[];
  /** Current viewport state for the React Flow canvas */
  viewport?: { x: number; y: number; zoom: number };
  /** Global variables available within the project */
  variables?: Record<string, string>;
}

// ─── App Page ────────────────────────────────────────────────────────────────

/** The currently active page/screen in the application */
export type AppPage = 'home' | 'editor';

// ─── Recent File (for IndexedDB storage) ─────────────────────────────────────

/**
 * Represents a recently opened project file, stored in IndexedDB for
 * the "Recent Files" quick-access list on the home screen.
 *
 * Note: filePath is optional because the File System Access API cannot
 * always serialize the full path across sessions.
 */
export interface RecentFile {
  /** Display name of the project */
  name: string;
  /** Absolute file path if available (File System API limitation) */
  filePath?: string;
  /** ISO 8601 timestamp of when the file was last opened */
  lastOpened: string;
  /** Number of nodes in the project at the time of last open */
  nodeCount: number;
  /** File size in bytes (optional) */
  fileSize?: number;
}

// ─── Project File Metadata ───────────────────────────────────────────────────

/** Lightweight metadata extracted from a ProjectFile for display purposes */
export interface ProjectFileMeta {
  /** Project name */
  name: string;
  /** Total number of nodes */
  nodeCount: number;
  /** Total number of edges */
  edgeCount: number;
  /** ISO 8601 timestamp of last modification */
  lastModified: string;
  /** File size in bytes (optional) */
  fileSize?: number;
}

// ─── Format Validation Result ────────────────────────────────────────────────

/**
 * Return type for {@link validateProjectFile}.
 * Contains the validation outcome as well as any partially-parsed data
 * so callers can show a "salvageable" preview to the user.
 */
export interface FormatValidationResult {
  /** Whether the data passed all format checks */
  valid: boolean;
  /** Detected version string, if parsable */
  version?: string;
  /** Detected format string, if parsable */
  format?: string;
  /** Human-readable error description when valid is false */
  error?: string;
  /** Partially-parsed data that may still be usable */
  data?: Partial<ProjectFile>;
}

// ─── Validation Helpers ──────────────────────────────────────────────────────

/** Known supported project file versions */
const SUPPORTED_VERSIONS = new Set<string>(['1.0']);

/**
 * Check whether an unknown value is a non-null object.
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate raw deserialized data as a {@link ProjectFile}.
 *
 * Checks:
 * - `format` is exactly `'playwright-cli-gui'`
 * - `version` is a non-empty string
 * - `nodes` is an array
 * - `edges` is an array
 *
 * Returns both a pass/fail verdict and any recoverable partial data.
 */
export function validateProjectFile(data: unknown): FormatValidationResult {
  if (!isObject(data)) {
    return {
      valid: false,
      error: 'Expected a non-null object',
    };
  }

  const errors: string[] = [];
  const partial: Partial<ProjectFile> = {};

  // --- format ---
  if (data.format !== 'playwright-cli-gui') {
    errors.push(
      `Invalid format: expected 'playwright-cli-gui', got '${String(data.format)}'`,
    );
  } else {
    partial.format = 'playwright-cli-gui';
  }

  // --- version ---
  if (typeof data.version !== 'string' || data.version.length === 0) {
    errors.push('Missing or empty version string');
  } else {
    partial.version = data.version;
  }

  // --- nodes ---
  if (!Array.isArray(data.nodes)) {
    errors.push('nodes must be an array');
  } else {
    partial.nodes = data.nodes;
  }

  // --- edges ---
  if (!Array.isArray(data.edges)) {
    errors.push('edges must be an array');
  } else {
    partial.edges = data.edges;
  }

  // Optional fields — grab whatever we can for recovery
  if (typeof data.createdAt === 'string') {
    partial.createdAt = data.createdAt;
  }
  if (typeof data.updatedAt === 'string') {
    partial.updatedAt = data.updatedAt;
  }
  if (typeof data.name === 'string') {
    partial.name = data.name;
  }
  if (typeof data.description === 'string') {
    partial.description = data.description;
  }
  if (isObject(data.viewport)) {
    const vp = data.viewport as Record<string, unknown>;
    if (
      typeof vp.x === 'number' &&
      typeof vp.y === 'number' &&
      typeof vp.zoom === 'number'
    ) {
      partial.viewport = { x: vp.x, y: vp.y, zoom: vp.zoom };
    }
  }
  if (isObject(data.variables)) {
    partial.variables = data.variables as Record<string, string>;
  }

  if (errors.length > 0) {
    return {
      valid: false,
      version: partial.version,
      format: partial.format,
      error: errors.join('; '),
      data: partial,
    };
  }

  return {
    valid: true,
    version: partial.version,
    format: partial.format,
    data: partial,
  };
}

// ─── Migration ───────────────────────────────────────────────────────────────

/**
 * Attempt to migrate raw data into a fully-formed {@link ProjectFile}.
 *
 * Currently supports:
 * - Version "1.0" (the initial format — no migration steps needed)
 *
 * If the data is structurally valid but missing optional fields, sensible
 * defaults are supplied. Returns `null` when the data cannot be salvaged.
 */
export function migrateProjectFile(data: unknown): ProjectFile | null {
  const validation = validateProjectFile(data);

  if (!validation.valid || !validation.data) {
    return null;
  }

  const p = validation.data;

  // --- version-based migration ---
  const version = p.version ?? '1.0';

  if (!SUPPORTED_VERSIONS.has(version)) {
    // Future: handle up-migration here
    console.warn(
      `[project] Unsupported project version "${version}". ` +
        `Supported: ${[...SUPPORTED_VERSIONS].join(', ')}`,
    );
    return null;
  }

  // For 1.0 all required fields already validated, just fill defaults
  const now = new Date().toISOString();

  const project: ProjectFile = {
    format: 'playwright-cli-gui',
    version,
    createdAt: p.createdAt ?? now,
    updatedAt: p.updatedAt ?? now,
    name: p.name ?? 'Untitled Project',
    description: p.description,
    nodes: p.nodes ?? [],
    edges: p.edges ?? [],
    viewport: p.viewport ?? { x: 0, y: 0, zoom: 1 },
    variables: p.variables ?? {},
  };

  return project;
}

// ─── Summary ─────────────────────────────────────────────────────────────────

/**
 * Extract a lightweight summary ({@link ProjectFileMeta}) from a fully
 * validated {@link ProjectFile}.
 */
export function getProjectSummary(project: ProjectFile): ProjectFileMeta {
  return {
    name: project.name,
    nodeCount: project.nodes.length,
    edgeCount: project.edges.length,
    lastModified: project.updatedAt,
  };
}
