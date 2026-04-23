import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from '../types/nodes';
import { getNodeDefinition } from '../types/nodes';

export interface GeneratedCode {
  code: string;
  language: string;
}

function esc(str: string | number | boolean | undefined): string {
  if (str === undefined || str === '') return '';
  return String(str).replace(/'/g, "\\'");
}

function generateNodeCode(node: Node<FlowNodeData>, indent: string, variables: Set<string>): string {
  const def = getNodeDefinition(node.data.type);
  if (!def) return `${indent}// Unknown node type: ${node.data.type}`;

  const p = node.data.parameters;
  const lines: string[] = [];

  switch (node.data.type) {
    case 'open': {
      const browserType = p.browserType || 'chromium';
      const headless = p.headless !== false;
      lines.push(`${indent}const browser = await chromium.launch({ headless: ${headless} });`);
      lines.push(`${indent}const context = await browser.newContext();`);
      lines.push(`${indent}const page = await context.newPage();`);
      if (p.url) {
        lines.push(`${indent}await page.goto('${esc(p.url)}');`);
      } else {
        lines.push(`${indent}// Warning: No URL specified for browser launch`);
      }
      break;
    }

    case 'goto': {
      if (!p.url) {
        lines.push(`${indent}// Error: No URL specified for navigation`);
        break;
      }
      const waitUntil = p.waitUntil || 'load';
      lines.push(`${indent}await page.goto('${esc(p.url)}', { waitUntil: '${waitUntil}' });`);
      break;
    }

    case 'click': {
      if (!p.selector) {
        lines.push(`${indent}// Error: No selector specified for click`);
        break;
      }
      const timeout = p.timeout ? `, timeout: ${p.timeout}` : '';
      lines.push(`${indent}await page.locator('${esc(p.selector)}').click({${timeout ? ` timeout: ${p.timeout}` : ''} });`);
      break;
    }

    case 'fill': {
      if (!p.selector || !p.value) {
        lines.push(`${indent}// Error: selector and value are required for fill`);
        break;
      }
      lines.push(`${indent}await page.locator('${esc(p.selector)}').fill('${esc(p.value)}');`);
      if (p.submit) {
        lines.push(`${indent}await page.locator('${esc(p.selector)}').press('Enter');`);
      }
      break;
    }

    case 'type': {
      if (!p.selector || !p.text) {
        lines.push(`${indent}// Error: selector and text are required for type`);
        break;
      }
      const delay = p.delay ? `, delay: ${p.delay}` : '';
      lines.push(`${indent}await page.locator('${esc(p.selector)}').type('${esc(p.text)}'${delay});`);
      break;
    }

    case 'screenshot': {
      const path = p.path || 'screenshot.png';
      const fullPage = p.fullPage === true;
      lines.push(`${indent}await page.screenshot({ path: '${esc(path)}', fullPage: ${fullPage} });`);
      break;
    }

    case 'waitForSelector': {
      if (!p.selector) {
        lines.push(`${indent}// Error: No selector specified for waitForSelector`);
        break;
      }
      const state = p.state || 'visible';
      const timeout = p.timeout || 30000;
      lines.push(`${indent}await page.locator('${esc(p.selector)}').waitFor({ state: '${state}', timeout: ${timeout} });`);
      break;
    }

    case 'waitForTimeout': {
      const timeout = p.timeout || 1000;
      lines.push(`${indent}await page.waitForTimeout(${timeout});`);
      break;
    }

    case 'close': {
      lines.push(`${indent}await browser.close();`);
      break;
    }

    case 'setVariable': {
      const name = p.name || 'variable';
      const value = p.value ?? '';
      variables.add(name);
      lines.push(`${indent}const ${name} = '${esc(value)}';`);
      break;
    }

    case 'getVariable': {
      const name = p.name || 'variable';
      lines.push(`${indent}// Read variable: ${name}`);
      break;
    }

    case 'extract': {
      if (!p.selector) {
        lines.push(`${indent}// Error: No selector specified for extract`);
        break;
      }
      const attr = p.attribute === 'custom' ? p.customAttribute : p.attribute;
      const varName = p.variableName || `extracted_${Date.now()}`;
      variables.add(varName);
      if (attr === 'textContent') {
        lines.push(`${indent}const ${varName} = await page.locator('${esc(p.selector)}').first().textContent() || '';`);
      } else if (attr === 'innerHTML') {
        lines.push(`${indent}const ${varName} = await page.locator('${esc(p.selector)}').first().innerHTML();`);
      } else if (attr && ['href', 'src', 'value'].includes(attr as string)) {
        lines.push(`${indent}const ${varName} = await page.locator('${esc(p.selector)}').first().getAttribute('${esc(attr)}') || '';`);
      } else {
        lines.push(`${indent}const ${varName} = await page.locator('${esc(p.selector)}').first().evaluate(el => el['${esc(attr || 'textContent')}']);`);
      }
      break;
    }

    default:
      lines.push(`${indent}// TODO: Implement ${node.data.type}`);
  }

  return lines.join('\n');
}

function buildExecutionTree(nodes: Node<FlowNodeData>[], edges: Edge[]): Map<string, { trueBranch: string[]; falseBranch: string[]; default: string[] }> {
  const childrenMap = new Map<string, { trueBranch: string[]; falseBranch: string[]; default: string[] }>();

  nodes.forEach(node => {
    childrenMap.set(node.id, { trueBranch: [], falseBranch: [], default: [] });
  });

  edges.forEach(edge => {
    const entry = childrenMap.get(edge.source);
    if (!entry) return;
    const sourceNode = nodes.find(n => n.id === edge.source);
    if (sourceNode?.data.type === 'if') {
      if (edge.sourceHandle === 'true' || entry.trueBranch.length === 0) {
        entry.trueBranch.push(edge.target);
      } else {
        entry.falseBranch.push(edge.target);
      }
    } else {
      entry.default.push(edge.target);
    }
  });

  return childrenMap;
}

function findRootNodes(nodes: Node<FlowNodeData>[], edges: Edge[]): Node<FlowNodeData>[] {
  const targetIds = new Set(edges.map(e => e.target));
  return nodes.filter(node => !targetIds.has(node.id));
}

function generateConditionCode(params: Record<string, string | number | boolean>): string {
  switch (params.condition) {
    case 'selectorExists':
      return params.selector
        ? `await page.locator('${esc(params.selector)}').count() > 0`
        : 'false /* no selector */';
    case 'selectorVisible':
      return params.selector
        ? `await page.locator('${esc(params.selector)}').isVisible()`
        : 'false /* no selector */';
    case 'textContains':
      return params.text
        ? `(await page.textContent('body') || '').includes('${esc(params.text)}')`
        : 'false /* no text */';
    case 'urlMatches':
      return params.url
        ? `page.url().includes('${esc(params.url)}')`
        : 'false /* no url pattern */';
    default:
      return 'true';
  }
}

function generateRecursive(
  nodeId: string,
  nodes: Node<FlowNodeData>[],
  childrenMap: Map<string, { trueBranch: string[]; falseBranch: string[]; default: string[] }>,
  visited: Set<string>,
  indent: string,
  variables: Set<string>
): string[] {
  if (visited.has(nodeId)) {
    return [`${indent}// Circular reference detected, skipping node: ${nodeId}`];
  }
  visited.add(nodeId);

  const node = nodes.find(n => n.id === nodeId);
  if (!node) return [];

  const lines: string[] = [];
  lines.push(generateNodeCode(node, indent, variables));

  const children = childrenMap.get(nodeId);
  if (!children) return lines;

  if (node.data.type === 'if') {
    const condition = generateConditionCode(node.data.parameters);
    lines.push(`${indent}if (${condition}) {`);
    children.trueBranch.forEach(childId => {
      lines.push(...generateRecursive(childId, nodes, childrenMap, new Set(visited), indent + '  ', variables));
    });
    if (children.falseBranch.length > 0) {
      lines.push(`${indent}} else {`);
      children.falseBranch.forEach(childId => {
        lines.push(...generateRecursive(childId, nodes, childrenMap, new Set(visited), indent + '  ', variables));
      });
    }
    lines.push(`${indent}}`);
  } else if (node.data.type === 'while') {
    const condition = generateConditionCode(node.data.parameters);
    const maxIterations = node.data.parameters.maxIterations || 10;
    lines.push(`${indent}let _iteration = 0;`);
    lines.push(`${indent}while (${condition} && _iteration < ${maxIterations}) {`);
    lines.push(`${indent}  _iteration++;`);
    children.default.forEach(childId => {
      lines.push(...generateRecursive(childId, nodes, childrenMap, new Set(visited), indent + '  ', variables));
    });
    lines.push(`${indent}}`);
  } else if (node.data.type === 'foreach') {
    const varName = node.data.parameters.variableName || 'item';
    const selector = node.data.parameters.selector || 'div';
    lines.push(`${indent}const _elements = await page.locator('${esc(selector)}').all();`);
    lines.push(`${indent}for (const ${varName} of _elements) {`);
    children.default.forEach(childId => {
      lines.push(...generateRecursive(childId, nodes, childrenMap, new Set(visited), indent + '  ', variables));
    });
    lines.push(`${indent}}`);
  } else {
    children.default.forEach(childId => {
      lines.push(...generateRecursive(childId, nodes, childrenMap, visited, indent, variables));
    });
  }

  return lines;
}

export function generatePlaywrightCode(nodes: Node<FlowNodeData>[], edges: Edge[]): GeneratedCode {
  const rootNodes = findRootNodes(nodes, edges);
  const childrenMap = buildExecutionTree(nodes, edges);
  const variables = new Set<string>();

  const hasOpenBrowser = nodes.some(n => n.data.type === 'open');
  const hasCloseBrowser = nodes.some(n => n.data.type === 'close');

  const lines: string[] = [
    `import { chromium } from 'playwright';`,
    '',
    `(async () => {`,
    `  let browser, context, page;`,
    '',
    `  try {`,
  ];

  if (rootNodes.length === 0 && nodes.length > 0) {
    rootNodes.push(nodes[0]);
  }

  rootNodes.forEach(root => {
    lines.push(...generateRecursive(root.id, nodes, childrenMap, new Set(), '    ', variables));
  });

  if (hasOpenBrowser && !hasCloseBrowser) {
    lines.push('');
    lines.push('    await browser.close();');
  }

  lines.push('  } catch (error) {');
  lines.push('    console.error(\'Playwright execution failed:\', error);');
  lines.push('    if (browser) await browser.close();');
  lines.push('    process.exit(1);');
  lines.push('  }');
  lines.push('})();');

  return {
    code: lines.join('\n'),
    language: 'javascript',
  };
}
