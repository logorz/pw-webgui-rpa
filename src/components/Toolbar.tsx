import { Play, Square, Save, FolderOpen, Code, Download, Upload, Trash2, Wifi, WifiOff, Undo2, Redo2, Globe } from 'lucide-react';

interface ToolbarProps {
  onRun: () => void;
  onStop: () => void;
  onSave: () => void;
  onOpen: () => void;
  onGenerateCode: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  isExecuting: boolean;
  serverConnected: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onToggleExplorer: () => void;
  showExplorer: boolean;
  onBackToHome: () => void;
}

export default function Toolbar({
  onRun,
  onStop,
  onSave,
  onOpen,
  onGenerateCode,
  onExport,
  onImport,
  onClear,
  onUndo,
  onRedo,
  isExecuting,
  serverConnected,
  canUndo,
  canRedo,
  onToggleExplorer,
  showExplorer,
  onBackToHome,
}: ToolbarProps) {
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
    }
    e.target.value = '';
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${isExecuting ? 'danger' : 'primary'}`}
          onClick={isExecuting ? onStop : onRun}
          title={isExecuting ? '停止执行' : serverConnected ? '运行流程（真实执行）' : '运行流程（模拟执行）'}
        >
          {isExecuting ? <Square size={16} /> : <Play size={16} />}
          <span>{isExecuting ? '停止' : '运行'}</span>
        </button>

        <div className={`server-status ${serverConnected ? 'connected' : 'disconnected'}`} title={serverConnected ? '执行服务已连接' : '执行服务未连接，将使用模拟执行'}>
          {serverConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span>{serverConnected ? '已连接' : '模拟'}</span>
        </div>

        <button className="toolbar-btn" onClick={onSave} title="保存流程">
          <Save size={16} />
          <span>保存</span>
        </button>

        <button className="toolbar-btn" onClick={onOpen} title="打开工程文件">
          <FolderOpen size={16} />
          <span>打开</span>
        </button>
      </div>

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onBackToHome} title="返回主页">
          <span>← 返回</span>
        </button>
        <button className="toolbar-btn" onClick={onUndo} disabled={!canUndo} title="撤销 (Ctrl+Z)">
          <Undo2 size={16} />
          <span>撤销</span>
        </button>

        <button className="toolbar-btn" onClick={onRedo} disabled={!canRedo} title="重做 (Ctrl+Shift+Z)">
          <Redo2 size={16} />
          <span>重做</span>
        </button>
      </div>

      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${showExplorer ? 'primary' : ''}`}
          onClick={onToggleExplorer}
          title="页面探索器：打开网页，检测元素，生成节点"
        >
          <Globe size={16} />
          <span>探索</span>
        </button>

        <button className="toolbar-btn" onClick={onGenerateCode} title="生成 Playwright 代码">
          <Code size={16} />
          <span>生成代码</span>
        </button>

        <button className="toolbar-btn" onClick={onExport} title="导出 JSON">
          <Download size={16} />
          <span>导出</span>
        </button>

        <label className="toolbar-btn" title="导入 JSON">
          <Upload size={16} />
          <span>导入</span>
          <input
            type="file"
            accept=".pwg,.json"
            onChange={handleImport}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      <div className="toolbar-group">
        <button className="toolbar-btn danger" onClick={onClear} title="清空画布">
          <Trash2 size={16} />
          <span>清空</span>
        </button>
      </div>
    </div>
  );
}
