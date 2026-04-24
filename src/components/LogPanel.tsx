import { useRef, useEffect } from 'react';
import { CheckCircle, XCircle, Loader2, Clock, Terminal, ChevronRight, ChevronLeft } from 'lucide-react';
import type { ExecutionLog } from '../engine/executor';

interface LogPanelProps {
  logs: ExecutionLog[];
  isExecuting: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}

const statusConfig = {
  pending: { icon: Clock, color: '#9ca3af', label: '等待' },
  running: { icon: Loader2, color: '#3b82f6', label: '执行中' },
  success: { icon: CheckCircle, color: '#10b981', label: '成功' },
  error: { icon: XCircle, color: '#ef4444', label: '失败' },
};

export default function LogPanel({ logs, isExecuting, collapsed = false, onToggle }: LogPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, collapsed]);

  const successCount = logs.filter((l) => l.status === 'success').length;
  const errorCount = logs.filter((l) => l.status === 'error').length;

  if (collapsed) {
    return (
      <div className="log-panel log-panel-collapsed">
        <button className="log-panel-toggle" onClick={onToggle} title="展开执行日志">
          <ChevronLeft size={14} />
          <Terminal size={14} />
          <span className="log-panel-toggle-stats">
            {errorCount > 0 && <span className="log-stat error" style={{ padding: '0 4px', fontSize: 10 }}>{errorCount}</span>}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="log-panel">
      <div className="log-panel-header">
        <div className="log-panel-title">
          <Terminal size={16} />
          <span>执行日志</span>
        </div>
        <div className="log-panel-stats">
          {isExecuting && (
            <span className="log-stat running">
              <Loader2 size={12} className="spin" />
              执行中
            </span>
          )}
          <span className="log-stat success">成功: {successCount}</span>
          <span className="log-stat error">失败: {errorCount}</span>
          <button className="log-panel-toggle-btn" onClick={onToggle} title="收起日志面板">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="log-panel-content" ref={scrollRef}>
        {logs.length === 0 ? (
          <div className="log-empty">
            <Terminal size={32} />
            <p>暂无执行日志</p>
            <p>点击运行按钮开始执行流程</p>
          </div>
        ) : (
          <div className="log-list">
            {logs.map((log) => {
              const config = statusConfig[log.status];
              const Icon = config.icon;

              return (
                <div
                  key={log.id}
                  className={`log-item ${log.status}`}
                >
                  <div className="log-item-status" style={{ color: config.color }}>
                    <Icon size={14} className={log.status === 'running' ? 'spin' : ''} />
                  </div>
                  <div className="log-item-content">
                    <div className="log-item-message">{log.message}</div>
                    <div className="log-item-meta">
                      <span>{log.nodeLabel}</span>
                      {log.duration && <span>{log.duration}ms</span>}
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
