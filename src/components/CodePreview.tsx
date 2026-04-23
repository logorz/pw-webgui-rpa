import { useState } from 'react';
import { X, Copy, Check, Play } from 'lucide-react';

interface CodePreviewProps {
  code: string;
  onClose: () => void;
  onRunCode?: (code: string) => void;
}

export default function CodePreview({ code, onClose, onRunCode }: CodePreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `playwright-flow-${Date.now()}.js`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="code-preview-overlay" onClick={onClose}>
      <div className="code-preview-panel" onClick={(e) => e.stopPropagation()}>
        <div className="code-preview-header">
          <h3>生成的 Playwright 代码</h3>
          <div className="code-preview-actions">
            <button className="code-preview-btn" onClick={handleDownload} title="下载为 .js 文件">
              <Copy size={16} />
              <span>下载</span>
            </button>
            <button className="code-preview-btn" onClick={handleCopy}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied ? '已复制' : '复制'}</span>
            </button>
            <button className="code-preview-close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="code-preview-content">
          <pre>
            <code>{code}</code>
          </pre>
        </div>
        <div className="code-preview-footer">
          <div className="code-preview-hint">
            复制代码后在终端运行: <code>node script.js</code> (需先安装 Playwright: <code>npm install playwright</code>)
          </div>
        </div>
      </div>
    </div>
  );
}
