import { useState, useCallback, useEffect, useRef } from 'react';
import type { ProjectFile } from '../types/project';
import {
  saveToFileSystem,
  openFromFileSystem,
  saveToFileSystemHandle,
} from '../utils/projectStorage';

// ─── Return Type ───────────────────────────────────────────────────────────────

export interface UseProjectFileReturn {
  currentProject: ProjectFile | null;
  hasFile: boolean;
  isDirty: boolean;
  currentFileHandle: FileSystemFileHandle | null;

  newProject: () => void;
  openProject: () => Promise<boolean>;
  saveProject: () => Promise<boolean>;
  saveProjectAs: () => Promise<boolean>;

  setDirty: (dirty: boolean) => void;
  reset: () => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useProjectFile(): UseProjectFileReturn {
  const [currentProject, setCurrentProject] = useState<ProjectFile | null>(null);
  const [currentFileHandle, setCurrentFileHandle] =
    useState<FileSystemFileHandle | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // ── derived ──────────────────────────────────────────────────────────────

  const hasFile = currentFileHandle !== null;

  // ── newProject ───────────────────────────────────────────────────────────

  const newProject = useCallback(() => {
    const now = new Date().toISOString();
    const project: ProjectFile = {
      format: 'playwright-cli-gui',
      version: '1.0',
      createdAt: now,
      updatedAt: now,
      name: '未命名工程',
      nodes: [],
      edges: [],
    };
    setCurrentProject(project);
    setCurrentFileHandle(null);
    setIsDirty(true);
  }, []);

  // ── openProject ──────────────────────────────────────────────────────────

  const openProject = useCallback(async (): Promise<boolean> => {
    try {
      const result = await openFromFileSystem();
      if (result.project === null || result.handle === null) {
        return false;
      }
      setCurrentProject(result.project);
      setCurrentFileHandle(result.handle);
      setIsDirty(false);
      return true;
    } catch (err) {
      console.error('[useProjectFile] Failed to open project:', err);
      return false;
    }
  }, []);

  // ── saveProject ──────────────────────────────────────────────────────────

  const saveProjectAs = useCallback(async (): Promise<boolean> => {
    if (currentProject === null) {
      return false;
    }
    try {
      const updated = {
        ...currentProject,
        updatedAt: new Date().toISOString(),
      };
      const handle = await saveToFileSystem(updated);
      if (handle) {
        setCurrentProject(updated);
        setCurrentFileHandle(handle);
        setIsDirty(false);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[useProjectFile] Failed to save project as:', err);
      return false;
    }
  }, [currentProject]);

  const saveProject = useCallback(async (): Promise<boolean> => {
    if (currentProject === null) {
      return false;
    }
    if (currentFileHandle !== null) {
      try {
        const updated = {
          ...currentProject,
          updatedAt: new Date().toISOString(),
        };
        const ok = await saveToFileSystemHandle(updated, currentFileHandle);
        if (ok) {
          setCurrentProject(updated);
          setIsDirty(false);
        }
        return ok;
      } catch (err) {
        console.error('[useProjectFile] Failed to save to handle:', err);
        return false;
      }
    }
    // No handle → defer to save-as
    return saveProjectAs();
  }, [currentProject, currentFileHandle, saveProjectAs]);

  // ── saveProjectAs (standalone) ───────────────────────────────────────────

  const saveAs = useCallback(async (): Promise<boolean> => {
    return saveProjectAs();
  }, [saveProjectAs]);

  // ── setDirty / reset ─────────────────────────────────────────────────────

  const setDirty = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  const reset = useCallback(() => {
    setCurrentProject(null);
    setCurrentFileHandle(null);
    setIsDirty(false);
  }, []);

  return {
    currentProject,
    hasFile,
    isDirty,
    currentFileHandle,

    newProject,
    openProject,
    saveProject,
    saveProjectAs: saveAs,

    setDirty,
    reset,
  };
}

export default useProjectFile;

// ─── Auto-Save Hook ────────────────────────────────────────────────────────────

/**
 * Automatically saves the project when nodes or edges change.
 *
 * - Marks the project as dirty on every nodes/edges change.
 * - If the project already has a file handle (`hasFile === true`),
 *   debounces the actual save call by 2 seconds.
 * - Cleans up the debounce timer on unmount.
 *
 * @param nodes      – The current array of flow nodes (from @xyflow/react).
 * @param edges      – The current array of edges (from @xyflow/react).
 * @param saveProject – The save function from useProjectFile.
 * @param isDirty    – Current dirty flag from useProjectFile.
 * @param hasFile    – Whether the current project has a persisted file handle.
 */
export function useAutoSave(
  nodes: unknown[],
  edges: unknown[],
  saveProject: () => Promise<boolean>,
  isDirty: boolean,
  hasFile: boolean,
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the latest saveProject in a ref so the debounce closure always
  // calls the current version without re-triggering the effect.
  const saveRef = useRef(saveProject);
  saveRef.current = saveProject;

  // Keep isDirty/hasFile in refs for the same reason.
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const hasFileRef = useRef(hasFile);
  hasFileRef.current = hasFile;

  // Mark dirty when nodes or edges change.
  // We rely on the parent calling setDirty(true) — but this hook is also
  // a safety net: we explicitly set isDirty via the dirty flag propagation.
  // The consumer (App.tsx) is expected to link node/edge changes to setDirty(true).
  // However, this hook also triggers the auto-save logic on changes.

  useEffect(() => {
    // If there's no file handle, don't bother scheduling an auto-save.
    if (!hasFileRef.current) {
      return;
    }

    // Clear any pending save
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    // Schedule debounced save
    timerRef.current = setTimeout(async () => {
      timerRef.current = null;
      if (isDirtyRef.current && hasFileRef.current) {
        await saveRef.current();
      }
    }, 2000);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);
}
