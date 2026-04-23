export type NodeCategory = 'browser' | 'control' | 'variable';

export interface NodeParameter {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'textarea';
  required?: boolean;
  defaultValue?: string | number | boolean;
  options?: { label: string; value: string }[];
  description?: string;
}

export interface NodeTypeDefinition {
  type: string;
  label: string;
  category: NodeCategory;
  description: string;
  icon: string;
  color: string;
  parameters: NodeParameter[];
  inputs: number;
  outputs: number;
}

export interface FlowNodeData {
  label: string;
  type: string;
  parameters: Record<string, string | number | boolean>;
  description?: string;
  icon?: string;
  color?: string;
  isExecuting?: boolean;
}

export interface FlowEdgeData {
  label?: string;
}

export const NODE_DEFINITIONS: NodeTypeDefinition[] = [
  // 浏览器基础操作
  {
    type: 'open',
    label: '打开浏览器',
    category: 'browser',
    description: '启动浏览器并打开指定页面',
    icon: 'Globe',
    color: '#3b82f6',
    parameters: [
      { name: 'url', label: 'URL', type: 'string', required: true, defaultValue: 'https://example.com' },
      { name: 'browserType', label: '浏览器类型', type: 'select', defaultValue: 'chromium', options: [{ label: 'Chromium', value: 'chromium' }, { label: 'Firefox', value: 'firefox' }, { label: 'WebKit', value: 'webkit' }] },
      { name: 'headless', label: '无头模式', type: 'boolean', defaultValue: false },
    ],
    inputs: 0,
    outputs: 1,
  },
  {
    type: 'goto',
    label: '跳转页面',
    category: 'browser',
    description: '导航到指定URL',
    icon: 'Navigation',
    color: '#3b82f6',
    parameters: [
      { name: 'url', label: 'URL', type: 'string', required: true },
      { name: 'waitUntil', label: '等待条件', type: 'select', defaultValue: 'load', options: [{ label: 'load', value: 'load' }, { label: 'domcontentloaded', value: 'domcontentloaded' }, { label: 'networkidle', value: 'networkidle' }] },
    ],
    inputs: 1,
    outputs: 1,
  },
  {
    type: 'click',
    label: '点击元素',
    category: 'browser',
    description: '点击页面上的元素',
    icon: 'MousePointer',
    color: '#3b82f6',
    parameters: [
      { name: 'selector', label: '选择器', type: 'string', required: true, description: 'CSS选择器或XPath' },
      { name: 'timeout', label: '超时时间(ms)', type: 'number', defaultValue: 5000 },
    ],
    inputs: 1,
    outputs: 1,
  },
  {
    type: 'fill',
    label: '填充输入',
    category: 'browser',
    description: '在输入框中填充文本',
    icon: 'Type',
    color: '#3b82f6',
    parameters: [
      { name: 'selector', label: '选择器', type: 'string', required: true },
      { name: 'value', label: '输入值', type: 'string', required: true },
      { name: 'submit', label: '提交表单', type: 'boolean', defaultValue: false },
    ],
    inputs: 1,
    outputs: 1,
  },
  {
    type: 'type',
    label: '输入文本',
    category: 'browser',
    description: '模拟键盘输入文本',
    icon: 'Keyboard',
    color: '#3b82f6',
    parameters: [
      { name: 'selector', label: '选择器', type: 'string', required: true },
      { name: 'text', label: '文本内容', type: 'string', required: true },
      { name: 'delay', label: '按键延迟(ms)', type: 'number', defaultValue: 0 },
    ],
    inputs: 1,
    outputs: 1,
  },
  {
    type: 'screenshot',
    label: '截图',
    category: 'browser',
    description: '截取页面或元素截图',
    icon: 'Camera',
    color: '#3b82f6',
    parameters: [
      { name: 'path', label: '保存路径', type: 'string', defaultValue: 'screenshot.png' },
      { name: 'fullPage', label: '全页面截图', type: 'boolean', defaultValue: false },
    ],
    inputs: 1,
    outputs: 1,
  },
  {
    type: 'waitForSelector',
    label: '等待元素',
    category: 'browser',
    description: '等待元素出现在页面上',
    icon: 'Clock',
    color: '#3b82f6',
    parameters: [
      { name: 'selector', label: '选择器', type: 'string', required: true },
      { name: 'timeout', label: '超时时间(ms)', type: 'number', defaultValue: 30000 },
      { name: 'state', label: '元素状态', type: 'select', defaultValue: 'visible', options: [{ label: 'visible', value: 'visible' }, { label: 'hidden', value: 'hidden' }, { label: 'attached', value: 'attached' }, { label: 'detached', value: 'detached' }] },
    ],
    inputs: 1,
    outputs: 1,
  },
  {
    type: 'waitForTimeout',
    label: '固定等待',
    category: 'browser',
    description: '等待指定时间',
    icon: 'Timer',
    color: '#3b82f6',
    parameters: [
      { name: 'timeout', label: '等待时间(ms)', type: 'number', required: true, defaultValue: 1000 },
    ],
    inputs: 1,
    outputs: 1,
  },
  {
    type: 'close',
    label: '关闭浏览器',
    category: 'browser',
    description: '关闭浏览器实例',
    icon: 'X',
    color: '#3b82f6',
    parameters: [],
    inputs: 1,
    outputs: 0,
  },

  // 流程控制
  {
    type: 'if',
    label: '条件判断',
    category: 'control',
    description: '根据条件执行不同分支',
    icon: 'GitBranch',
    color: '#f59e0b',
    parameters: [
      { name: 'condition', label: '条件类型', type: 'select', required: true, defaultValue: 'selectorExists', options: [{ label: '元素存在', value: 'selectorExists' }, { label: '元素可见', value: 'selectorVisible' }, { label: '文本包含', value: 'textContains' }, { label: 'URL匹配', value: 'urlMatches' }] },
      { name: 'selector', label: '选择器', type: 'string', description: '用于元素相关条件' },
      { name: 'text', label: '文本内容', type: 'string', description: '用于文本包含条件' },
      { name: 'url', label: 'URL模式', type: 'string', description: '用于URL匹配条件' },
    ],
    inputs: 1,
    outputs: 2,
  },
  {
    type: 'while',
    label: '循环执行',
    category: 'control',
    description: '当条件满足时循环执行',
    icon: 'Repeat',
    color: '#f59e0b',
    parameters: [
      { name: 'condition', label: '条件类型', type: 'select', required: true, defaultValue: 'selectorExists', options: [{ label: '元素存在', value: 'selectorExists' }, { label: '元素可见', value: 'selectorVisible' }, { label: '文本包含', value: 'textContains' }] },
      { name: 'selector', label: '选择器', type: 'string' },
      { name: 'text', label: '文本内容', type: 'string' },
      { name: 'maxIterations', label: '最大循环次数', type: 'number', defaultValue: 10 },
    ],
    inputs: 1,
    outputs: 1,
  },
  {
    type: 'foreach',
    label: '遍历元素',
    category: 'control',
    description: '遍历页面上的元素列表',
    icon: 'List',
    color: '#f59e0b',
    parameters: [
      { name: 'selector', label: '元素选择器', type: 'string', required: true, description: '选择多个元素的CSS选择器' },
      { name: 'variableName', label: '循环变量名', type: 'string', defaultValue: 'item' },
    ],
    inputs: 1,
    outputs: 1,
  },

  // 变量与数据
  {
    type: 'setVariable',
    label: '设置变量',
    category: 'variable',
    description: '设置一个变量值',
    icon: 'Variable',
    color: '#10b981',
    parameters: [
      { name: 'name', label: '变量名', type: 'string', required: true },
      { name: 'value', label: '变量值', type: 'string', required: true },
    ],
    inputs: 1,
    outputs: 1,
  },
  {
    type: 'getVariable',
    label: '读取变量',
    category: 'variable',
    description: '读取变量的值',
    icon: 'Eye',
    color: '#10b981',
    parameters: [
      { name: 'name', label: '变量名', type: 'string', required: true },
    ],
    inputs: 1,
    outputs: 1,
  },
  {
    type: 'extract',
    label: '提取数据',
    category: 'variable',
    description: '从页面元素中提取数据',
    icon: 'Database',
    color: '#10b981',
    parameters: [
      { name: 'selector', label: '选择器', type: 'string', required: true },
      { name: 'attribute', label: '属性', type: 'select', defaultValue: 'textContent', options: [{ label: '文本内容', value: 'textContent' }, { label: 'innerHTML', value: 'innerHTML' }, { label: 'href', value: 'href' }, { label: 'src', value: 'src' }, { label: 'value', value: 'value' }, { label: '自定义属性', value: 'custom' }] },
      { name: 'customAttribute', label: '自定义属性名', type: 'string', description: '当属性选择"自定义属性"时使用' },
      { name: 'variableName', label: '保存到变量', type: 'string', description: '将提取的数据保存到指定变量' },
    ],
    inputs: 1,
    outputs: 1,
  },
];

export function getNodeDefinition(type: string): NodeTypeDefinition | undefined {
  return NODE_DEFINITIONS.find((n) => n.type === type);
}

export function getNodesByCategory(category: NodeCategory): NodeTypeDefinition[] {
  return NODE_DEFINITIONS.filter((n) => n.category === category);
}
