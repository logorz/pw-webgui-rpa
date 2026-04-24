import { useState, useEffect, useRef, useCallback } from 'react';
import type { ProjectFile, RecentFile } from '../types/project';
import {
  getRecentFiles,
  addRecentFile,
  removeRecentFile,
  clearRecentFiles,
  openFromFileInput,
  openFromFileSystem,
  isFileSystemAPISupported,
} from '../utils/projectStorage';

interface HomePageProps {
  onNewProject: () => void;
  onOpenProject: (project: ProjectFile) => void;
  onImportProject: (project: ProjectFile) => void;
}

/**
 * Convert an ISO 8601 timestamp to a human-readable relative time string.
 */
function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;

  if (diffMs < 0) {
    return '刚刚';
  }

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) {
    return '刚刚';
  }
  if (minutes < 60) {
    return `${minutes}分钟前`;
  }
  if (hours < 24) {
    return `${hours}小时前`;
  }
  if (days < 7) {
    return `${days}天前`;
  }

  const date = new Date(isoString);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

export default function HomePage({ onNewProject, onOpenProject, onImportProject }: HomePageProps) {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const openInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Load recent files on mount
  useEffect(() => {
    getRecentFiles().then(setRecentFiles).catch(() => setRecentFiles([]));
  }, []);

  // ─── Helpers ────────────────────────────────────────────────────────

  const refreshRecentFiles = useCallback(() => {
    getRecentFiles().then(setRecentFiles).catch(() => setRecentFiles([]));
  }, []);

  const handleOpenViaFileSystem = useCallback(async () => {
    const { project } = await openFromFileSystem();
    if (!project) return;

    // Add to recent files
    const recentEntry: RecentFile = {
      name: project.name,
      lastOpened: new Date().toISOString(),
      nodeCount: project.nodes.length,
    };
    await addRecentFile(recentEntry);
    refreshRecentFiles();
    onOpenProject(project);
  }, [onOpenProject, refreshRecentFiles]);

  const handleOpenViaInput = useCallback(
    async (file: File) => {
      const project = await openFromFileInput(file);
      if (!project) return;

      const recentEntry: RecentFile = {
        name: project.name,
        lastOpened: new Date().toISOString(),
        nodeCount: project.nodes.length,
      };
      await addRecentFile(recentEntry);
      refreshRecentFiles();
      onOpenProject(project);
    },
    [onOpenProject, refreshRecentFiles],
  );

  const handleImport = useCallback(
    async (file: File) => {
      const project = await openFromFileInput(file);
      if (!project) return;

      onImportProject(project);
    },
    [onImportProject],
  );

  // ─── Event Handlers ─────────────────────────────────────────────────

  const handleNewProject = useCallback(() => {
    onNewProject();
  }, [onNewProject]);

  const handleOpenClick = useCallback(() => {
    if (isFileSystemAPISupported()) {
      handleOpenViaFileSystem();
    } else {
      openInputRef.current?.click();
    }
  }, [handleOpenViaFileSystem]);

  const handleOpenFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      handleOpenViaInput(file);
      // Reset so the same file can be re-selected
      e.target.value = '';
    },
    [handleOpenViaInput],
  );

  const handleImportClick = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleImportFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      handleImport(file);
      e.target.value = '';
    },
    [handleImport],
  );

  const handleOpenRecent = useCallback(
    (file: RecentFile) => {
      // Recent file entries don't carry a serializable handle.
      // The most practical UX is to re-trigger the file picker.
      // We set a suggested name hint via the accept attribute only.
      if (isFileSystemAPISupported()) {
        handleOpenViaFileSystem();
      } else {
        openInputRef.current?.click();
      }
    },
    [handleOpenViaFileSystem],
  );

  const handleDeleteRecent = useCallback(
    async (name: string) => {
      await removeRecentFile(name);
      refreshRecentFiles();
    },
    [refreshRecentFiles],
  );

  const handleClearAll = useCallback(async () => {
    await clearRecentFiles();
    refreshRecentFiles();
  }, [refreshRecentFiles]);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-900 text-slate-200">
      {/* ── Hidden file inputs ─────────────────────────────────────── */}
      <input
        ref={openInputRef}
        type="file"
        accept=".pwg,.json"
        className="hidden"
        onChange={handleOpenFileChange}
      />
      <input
        ref={importInputRef}
        type="file"
        accept=".pwg,.json"
        className="hidden"
        onChange={handleImportFileChange}
      />

      {/* ── Header ────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{
          background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
        }}
      >
        <h1 className="text-xl font-bold tracking-tight text-white">
          Playwright CLI GUI
        </h1>
        <span className="text-xs text-blue-200 font-medium">ver 1.0</span>
      </header>

      {/* ── Action Buttons ────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-6 py-5 border-b border-slate-700/50">
        <button
          onClick={handleNewProject}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors shadow-lg shadow-blue-600/20"
        >
          <span className="text-base" role="img" aria-label="new">
            ✚
          </span>
          新建工程
        </button>

        <button
          onClick={handleOpenClick}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium text-sm transition-colors border border-slate-600"
        >
          <span className="text-base" role="img" aria-label="open">
            📂
          </span>
          打开文件
        </button>

        <button
          onClick={handleImportClick}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium text-sm transition-colors border border-slate-600"
        >
          <span className="text-base" role="img" aria-label="import">
            📥
          </span>
          导入
        </button>

        {recentFiles.length > 0 && (
          <button
            onClick={handleClearAll}
            className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
          >
            清空记录
          </button>
        )}
      </div>

      {/* ── Section Title ─────────────────────────────────────────── */}
      <div className="px-6 pt-5 pb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          最近打开
        </h2>
      </div>

      {/* ── Recent Files Grid / Empty State ───────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {recentFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[240px] text-center">
            <div className="text-5xl mb-4 text-slate-600">📄</div>
            <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
              还没有工程文件，点击上方
              <span className="text-blue-400 font-medium"> "新建工程" </span>
              或
              <span className="text-blue-400 font-medium"> "打开文件" </span>
              开始
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentFiles.map((file) => (
              <div
                key={file.name}
                className="group relative rounded-xl border border-slate-700/60 bg-slate-800/60 p-4 transition-all hover:border-slate-600 hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/40"
              >
                {/* Card header: icon + name */}
                <div className="flex items-start gap-3 mb-3">
                  <span
                    className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-blue-900/40 text-blue-300 text-lg"
                    role="img"
                    aria-label="file"
                  >
                    📄
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-slate-100 truncate">
                      {file.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {file.nodeCount} 个节点
                    </p>
                  </div>
                </div>

                {/* Last opened time */}
                <p className="text-xs text-slate-500 mb-3">
                  {formatRelativeTime(file.lastOpened)}
                </p>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenRecent(file)}
                    className="flex-1 px-3 py-1.5 rounded-md bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-xs font-medium transition-colors"
                  >
                    打开
                  </button>
                  <button
                    onClick={() => handleDeleteRecent(file.name)}
                    className="flex-1 px-3 py-1.5 rounded-md bg-slate-700/50 hover:bg-red-900/40 text-slate-400 hover:text-red-300 text-xs font-medium transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
