import type { ProjectFile, RecentFile } from '../types/project';
import { migrateProjectFile } from '../types/project';

// ─── Constants ────────────────────────────────────────────────────────────────

const DB_NAME = 'playwright-cli-gui';
const DB_VERSION = 1;
const STORE_NAME = 'recent-files';
const MAX_RECENT_FILES = 20;

// ─── Part 1: File System API ─────────────────────────────────────────────────

/**
 * Save a project to the filesystem using the File System Access API.
 * Opens a save dialog for the user to pick a location.
 *
 * @param project - The project to save.
 * @returns The file handle on success, null on cancellation or error.
 */
export async function saveToFileSystem(project: ProjectFile): Promise<FileSystemFileHandle | null> {
  try {
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: getProjectFileName(project),
      types: [
        {
          description: 'Playwright GUI Project',
          accept: { 'application/json': ['.pwg'] as string[] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(project, null, 2));
    await writable.close();
    return handle as FileSystemFileHandle;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      // user cancelled — not an error
      return null;
    }
    console.error('Failed to save project file:', err);
    return null;
  }
}

/**
 * @param project - The project to save.
 * @param handle  - An existing FileSystemFileHandle obtained from save/open.
 * @returns true on success, false if the handle is no longer valid.
 */
export async function saveToFileSystemHandle(
  project: ProjectFile,
  handle: FileSystemFileHandle,
): Promise<boolean> {
  try {
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(project, null, 2));
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Open a .pwg project file using the File System Access API.
 *
 * @returns An object with the parsed ProjectFile (or null) and the handle (or null).
 */
export async function openFromFileSystem(): Promise<{
  project: ProjectFile | null;
  handle: FileSystemFileHandle | null;
}> {
  try {
    const [handle] = await (window as any).showOpenFilePicker({
      types: [
        {
          description: 'Playwright GUI Project',
          accept: { 'application/json': ['.pwg'] as string[] },
        },
      ],
      multiple: false,
    });

    const file = await handle.getFile();
    const text = await file.text();
    const raw = JSON.parse(text);

    // Try ProjectFile format first
    const project = migrateProjectFile(raw);
    if (project) return { project, handle: handle as FileSystemFileHandle };

    // Fallback: FlowData format (exported via 导出)
    if (raw && Array.isArray(raw.nodes) && Array.isArray(raw.edges)) {
      const now = new Date().toISOString();
      const converted: ProjectFile = {
        format: 'playwright-cli-gui',
        version: raw.version || '1.0',
        createdAt: raw.createdAt || now,
        updatedAt: now,
        name: raw.name || 'Imported Project',
        nodes: raw.nodes,
        edges: raw.edges,
      };
      return { project: converted, handle: handle as FileSystemFileHandle };
    }

    console.error('[openFromFileSystem] Unrecognized file format');
    return { project: null, handle: null };
  } catch (err) {
    // User cancelled (AbortError) — return nulls gracefully
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { project: null, handle: null };
    }

    // JSON parse failure or other errors
    return { project: null, handle: null };
  }
}

// ─── Part 2: Fallback Operations ──────────────────────────────────────────────

/**
 * Download a project file via a Blob + anchor tag (fallback for browsers
 * that do not support the File System Access API).
 *
 * @param project - The project to download.
 */
export function downloadProjectFile(project: ProjectFile): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = getProjectFileName(project);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
}

/**
 * Read a ProjectFile from a File object (e.g., from an <input type="file">).
 *
 * @param file - The file to read.
 * @returns The parsed project, or null on failure.
 */
export async function openFromFileInput(file: File): Promise<ProjectFile | null> {
  try {
    const text = await file.text();
    const raw = JSON.parse(text);

    // Try ProjectFile format (saved via Ctrl+S / save button)
    const project = migrateProjectFile(raw);
    if (project) return project;

    // Fallback: FlowData format (exported via 导出 / downloadFlowFile)
    if (raw && Array.isArray(raw.nodes) && Array.isArray(raw.edges)) {
      const now = new Date().toISOString();
      return {
        format: 'playwright-cli-gui',
        version: raw.version || '1.0',
        createdAt: raw.createdAt || now,
        updatedAt: now,
        name: raw.name || 'Imported Project',
        nodes: raw.nodes,
        edges: raw.edges,
      };
    }

    console.error('[openFromFileInput] Unrecognized file format');
    return null;
  } catch (err) {
    console.error('[openFromFileInput] Failed to parse file:', err);
    return null;
  }
}

/**
 * Alias for {@link openFromFileInput}. Intended as a standalone import function.
 *
 * @param file - The file to import.
 * @returns The parsed project, or null on failure.
 */
export async function importFromFile(file: File): Promise<ProjectFile | null> {
  return openFromFileInput(file);
}

// ─── Part 3: IndexedDB Recent Files ─────────────────────────────────────────

// ... existing IndexedDB code continues ...
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
    };

    request.onsuccess = (event: Event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event: Event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

export async function getRecentFiles(): Promise<RecentFile[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const files: RecentFile[] = request.result ?? [];
        files.sort(
          (a, b) =>
            new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime(),
        );
        resolve(files);
      };

      request.onerror = () => {
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch {
    return [];
  }
}

export async function addRecentFile(file: RecentFile): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      store.put(file);

      const countRequest = store.count();
      countRequest.onsuccess = () => {
        if (countRequest.result > MAX_RECENT_FILES) {
          const excess = countRequest.result - MAX_RECENT_FILES;

          const index = store.index('lastOpened');
          if (index) {
            const allRequest = store.getAll();
            allRequest.onsuccess = () => {
              const all = allRequest.result as RecentFile[];
              all.sort(
                (a, b) =>
                  new Date(a.lastOpened).getTime() -
                  new Date(b.lastOpened).getTime(),
              );
              for (let i = 0; i < excess; i++) {
                store.delete(all[i].name);
              }
            };
          }
        }
      };

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  } catch {
    // Silently fail — IndexedDB errors should not crash the app
  }
}

export async function removeRecentFile(name: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete(name);

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  } catch {
    // Silently fail
  }
}

export async function clearRecentFiles(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  } catch {
    // Silently fail
  }
}

// ─── Part 4: Utility Functions ────────────────────────────────────────────────

export function isFileSystemAPISupported(): boolean {
  return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
}

export function getProjectFileName(project: ProjectFile): string {
  return `${project.name}.pwg`;
}

export function getProjectFileExtension(): string {
  return '.pwg';
}
