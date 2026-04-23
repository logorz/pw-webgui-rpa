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

function resolveVar(value: string | number | boolean | undefined, variables: Set<string>): string {
  const str = String(value || '');
  if (!str.includes('${')) return `'${esc(str)}'`;

  return str.replace(/\$\{(\w+)\}/g, (_, varName) => {
    variables.add(varName);
    return `' + ${varName} + '`;
  });
}

function generateNodeCode(node: Node<FlowNodeData>, indent: string, variables: Set<string>): string {
  const def = getNodeDefinition(node.data.type);
  if (!def) return `${indent}// Unknown node type: ${node.data.type}`;

  const p = node.data.parameters;
  const lines: string[] = [];

  switch (node.data.type) {
    case 'open': {
      const browserType = p.browserType || 'chromium';
      const headless = p.headless !== 'false';
      const viewport = String(p.viewport || '1280x720');
      const [vw, vh] = viewport === 'custom' ? ['1280', '720'] : viewport.split('x');
      const locale = p.locale || 'zh-CN';
      lines.push(`${indent}const browser = await ${browserType}.launch({ headless: ${headless} });`);
      lines.push(`${indent}const context = await browser.newContext({ viewport: { width: ${vw}, height: ${vh} }, locale: '${locale}' });`);
      lines.push(`${indent}const page = await context.newPage();`);
      if (p.url) {
        lines.push(`${indent}await page.goto(${resolveVar(p.url, variables)});`);
      }
      break;
    }

    case 'goto': {
      if (!p.url) {
        lines.push(`${indent}// Error: No URL specified for navigation`);
        break;
      }
      const waitUntil = p.waitUntil || 'load';
      lines.push(`${indent}await page.goto(${resolveVar(p.url, variables)}, { waitUntil: '${waitUntil}' });`);
      break;
    }

    case 'click': {
      if (!p.selector) {
        lines.push(`${indent}// Error: No selector specified for click`);
        break;
      }
      const opts: string[] = [];
      if (p.button && p.button !== 'left') opts.push(`button: '${p.button}'`);
      if (p.clickCount && p.clickCount !== '1') opts.push(`clickCount: ${p.clickCount}`);
      if (p.modifiers && p.modifiers !== 'none') opts.push(`modifiers: ['${p.modifiers}']`);
      if (p.timeout && p.timeout !== 30000) opts.push(`timeout: ${p.timeout}`);
      if (p.force === 'true') opts.push(`force: true`);
      const optStr = opts.length > 0 ? `{ ${opts.join(', ')} }` : '';
      lines.push(`${indent}await page.locator(${resolveVar(p.selector, variables)}).click(${optStr});`);
      break;
    }

    case 'fill': {
      if (!p.selector || !p.value) {
        lines.push(`${indent}// Error: selector and value are required for fill`);
        break;
      }
      const timeout = p.timeout && p.timeout !== 30000 ? `{ timeout: ${p.timeout} }` : '';
      lines.push(`${indent}await page.locator(${resolveVar(p.selector, variables)}).fill(${resolveVar(p.value, variables)}, ${timeout});`);
      if (p.submit === 'true') {
        lines.push(`${indent}await page.locator(${resolveVar(p.selector, variables)}).press('Enter');`);
      }
      break;
    }

    case 'type': {
      if (!p.selector || !p.text) {
        lines.push(`${indent}// Error: selector and text are required for type`);
        break;
      }
      const delay = p.delay ? `, { delay: ${p.delay} }` : '';
      lines.push(`${indent}await page.locator(${resolveVar(p.selector, variables)}).type(${resolveVar(p.text, variables)}${delay});`);
      break;
    }

    case 'press': {
      const key = p.key || 'Enter';
      if (p.selector) {
        lines.push(`${indent}await page.locator(${resolveVar(p.selector, variables)}).press('${esc(key)}');`);
      } else {
        lines.push(`${indent}await page.keyboard.press('${esc(key)}');`);
      }
      break;
    }

    case 'checkbox': {
      if (!p.selector) {
        lines.push(`${indent}// Error: No selector specified for checkbox`);
        break;
      }
      const action = p.action === 'uncheck' ? 'uncheck' : 'check';
      lines.push(`${indent}await page.locator(${resolveVar(p.selector, variables)}).${action}();`);
      break;
    }

    case 'selectOption': {
      if (!p.selector || !p.value) {
        lines.push(`${indent}// Error: selector and value are required for selectOption`);
        break;
      }
      const selectBy = p.selectBy || 'value';
      if (selectBy === 'label') {
        lines.push(`${indent}await page.locator(${resolveVar(p.selector, variables)}).selectOption({ label: ${resolveVar(p.value, variables)} });`);
      } else if (selectBy === 'index') {
        lines.push(`${indent}await page.locator(${resolveVar(p.selector, variables)}).selectOption({ index: ${p.value} });`);
      } else {
        lines.push(`${indent}await page.locator(${resolveVar(p.selector, variables)}).selectOption(${resolveVar(p.value, variables)});`);
      }
      break;
    }

    case 'upload': {
      if (!p.selector || !p.filePath) {
        lines.push(`${indent}// Error: selector and filePath are required for upload`);
        break;
      }
      lines.push(`${indent}await page.locator(${resolveVar(p.selector, variables)}).setInputFiles(${resolveVar(p.filePath, variables)});`);
      break;
    }

    case 'hover': {
      if (!p.selector) {
        lines.push(`${indent}// Error: No selector specified for hover`);
        break;
      }
      const opts: string[] = [];
      if (p.modifiers && p.modifiers !== 'none') opts.push(`modifiers: ['${p.modifiers}']`);
      const optStr = opts.length > 0 ? `{ ${opts.join(', ')} }` : '';
      lines.push(`${indent}await page.locator(${resolveVar(p.selector, variables)}).hover(${optStr});`);
      break;
    }

    case 'screenshot': {
      const path = p.path || 'screenshot.png';
      const fullPage = p.fullPage === 'true';
      if (p.target === 'element' && p.selector) {
        lines.push(`${indent}await page.locator(${resolveVar(p.selector, variables)}).screenshot({ path: ${resolveVar(path, variables)}, fullPage: ${fullPage} });`);
      } else {
        lines.push(`${indent}await page.screenshot({ path: ${resolveVar(path, variables)}, fullPage: ${fullPage} });`);
      }
      break;
    }

    case 'waitForSelector': {
      if (!p.selector) {
        lines.push(`${indent}// Error: No selector specified for waitForSelector`);
        break;
      }
      const state = p.state || 'visible';
      const timeout = p.timeout || 30000;
      lines.push(`${indent}await page.locator(${resolveVar(p.selector, variables)}).waitFor({ state: '${state}', timeout: ${timeout} });`);
      break;
    }

    case 'waitForTimeout': {
      const timeout = p.timeout || 1000;
      lines.push(`${indent}await page.waitForTimeout(${timeout});`);
      break;
    }

    case 'waitForUrl': {
      if (!p.urlPattern) {
        lines.push(`${indent}// Error: No URL pattern specified`);
        break;
      }
      const matchType = p.matchType || 'contains';
      const timeout = p.timeout || 30000;
      if (matchType === 'regex') {
        lines.push(`${indent}await page.waitForURL(/${esc(p.urlPattern)}/, { timeout: ${timeout} });`);
      } else if (matchType === 'exact') {
        lines.push(`${indent}await page.waitForURL(${resolveVar(p.urlPattern, variables)}, { timeout: ${timeout} });`);
      } else {
        lines.push(`${indent}await page.waitForURL(url => url.includes(${resolveVar(p.urlPattern, variables)}), { timeout: ${timeout} });`);
      }
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
      lines.push(`${indent}const ${name} = ${resolveVar(value, variables)};`);
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
        lines.push(`${indent}const ${varName} = await page.locator(${resolveVar(p.selector, variables)}).first().textContent() || '';`);
      } else if (attr === 'innerHTML') {
        lines.push(`${indent}const ${varName} = await page.locator(${resolveVar(p.selector, variables)}).first().innerHTML();`);
      } else if (attr && ['href', 'src', 'value', 'className', 'id'].includes(attr as string)) {
        lines.push(`${indent}const ${varName} = await page.locator(${resolveVar(p.selector, variables)}).first().getAttribute('${esc(attr)}') || '';`);
      } else {
        lines.push(`${indent}const ${varName} = await page.locator(${resolveVar(p.selector, variables)}).first().evaluate(el => el['${esc(attr || 'textContent')}']);`);
      }
      break;
    }

    case 'assertVisible': {
      if (!p.selector) {
        lines.push(`${indent}// Error: No selector specified for assertVisible`);
        break;
      }
      const timeout = p.timeout || 5000;
      lines.push(`${indent}await expect(page.locator(${resolveVar(p.selector, variables)})).toBeVisible({ timeout: ${timeout} });`);
      break;
    }

    case 'assertText': {
      if (!p.selector || !p.expectedText) {
        lines.push(`${indent}// Error: selector and expectedText are required`);
        break;
      }
      const matchType = p.matchType || 'contains';
      const timeout = p.timeout || 5000;
      if (matchType === 'exact') {
        lines.push(`${indent}await expect(page.locator(${resolveVar(p.selector, variables)})).toHaveText(${resolveVar(p.expectedText, variables)}, { timeout: ${timeout} });`);
      } else if (matchType === 'regex') {
        lines.push(`${indent}await expect(page.locator(${resolveVar(p.selector, variables)})).toContainText(/${esc(p.expectedText)}/, { timeout: ${timeout} });`);
      } else {
        lines.push(`${indent}await expect(page.locator(${resolveVar(p.selector, variables)})).toContainText(${resolveVar(p.expectedText, variables)}, { timeout: ${timeout} });`);
      }
      break;
    }

    case 'assertUrl': {
      if (!p.expectedUrl) {
        lines.push(`${indent}// Error: expectedUrl is required`);
        break;
      }
      const matchType = p.matchType || 'contains';
      if (matchType === 'exact') {
        lines.push(`${indent}await expect(page).toHaveURL(${resolveVar(p.expectedUrl, variables)});`);
      } else if (matchType === 'regex') {
        lines.push(`${indent}await expect(page).toHaveURL(/${esc(p.expectedUrl)}/);`);
      } else {
        lines.push(`${indent}await expect(page).toHaveURL(/${esc(p.expectedUrl)}/);`);
      }
      break;
    }

    case 'assertTitle': {
      if (!p.expectedTitle) {
        lines.push(`${indent}// Error: expectedTitle is required`);
        break;
      }
      const matchType = p.matchType || 'contains';
      if (matchType === 'exact') {
        lines.push(`${indent}await expect(page).toHaveTitle(${resolveVar(p.expectedTitle, variables)});`);
      } else {
        lines.push(`${indent}await expect(page).toHaveTitle(/${esc(p.expectedTitle)}/);`);
      }
      break;
    }

    case 'assertElementCount': {
      if (!p.selector) {
        lines.push(`${indent}// Error: selector is required`);
        break;
      }
      const comparison = p.comparison || 'equal';
      const expectedCount = p.expectedCount || 1;
      const opMap: Record<string, string> = {
        equal: '===',
        greaterThan: '>',
        lessThan: '<',
        greaterThanOrEqual: '>=',
        lessThanOrEqual: '<=',
      };
      const op = opMap[comparison] || '===';
      lines.push(`${indent}const _count = await page.locator(${resolveVar(p.selector, variables)}).count();`);
      lines.push(`${indent}if (!(_count ${op} ${expectedCount})) throw new Error(\`Expected count ${op} ${expectedCount}, got \${_count}\`);`);
      break;
    }

    case 'assertAttribute': {
      if (!p.selector) {
        lines.push(`${indent}// Error: selector is required`);
        break;
      }
      const attr = p.attribute === 'custom' ? p.customAttribute : p.attribute;
      if (p.expectedValue) {
        lines.push(`${indent}await expect(page.locator(${resolveVar(p.selector, variables)})).toHaveAttribute('${esc(attr || 'value')}', ${resolveVar(p.expectedValue, variables)});`);
      } else {
        lines.push(`${indent}const _attrValue = await page.locator(${resolveVar(p.selector, variables)}).getAttribute('${esc(attr || 'value')}');`);
        lines.push(`${indent}console.log('Attribute ${esc(attr || 'value')}:', _attrValue);`);
      }
      break;
    }

    case 'saveAuth': {
      const path = p.path || 'auth.json';
      lines.push(`${indent}await context.storageState({ path: ${resolveVar(path, variables)} });`);
      break;
    }

    case 'loadAuth': {
      const path = p.path || 'auth.json';
      lines.push(`${indent}// Load auth state from ${esc(path)}`);
      lines.push(`${indent}// Note: storageState must be set before creating context`);
      break;
    }

    case 'evaluate': {
      if (!p.expression) {
        lines.push(`${indent}// Error: expression is required`);
        break;
      }
      const varName = p.variableName;
      if (varName) {
        variables.add(String(varName));
        lines.push(`${indent}const ${varName} = await page.evaluate(() => { ${p.expression} });`);
      } else {
        lines.push(`${indent}await page.evaluate(() => { ${p.expression} });`);
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

function generateConditionCode(params: Record<string, string | number | boolean>, variables: Set<string>): string {
  switch (params.condition) {
    case 'selectorExists':
      return params.selector
        ? `await page.locator(${resolveVar(params.selector, variables)}).count() > 0`
        : 'false /* no selector */';
    case 'selectorVisible':
      return params.selector
        ? `await page.locator(${resolveVar(params.selector, variables)}).isVisible()`
        : 'false /* no selector */';
    case 'textContains':
      return params.text
        ? `(await page.textContent('body') || '').includes(${resolveVar(params.text, variables)})`
        : 'false /* no text */';
    case 'urlMatches':
      return params.url
        ? `page.url().includes(${resolveVar(params.url, variables)})`
        : 'false /* no url pattern */';
    case 'selectorEditable':
      return params.selector
        ? `await page.locator(${resolveVar(params.selector, variables)}).isEditable()`
        : 'false /* no selector */';
    case 'selectorChecked':
      return params.selector
        ? `await page.locator(${resolveVar(params.selector, variables)}).isChecked()`
        : 'false /* no selector */';
    case 'selectorEnabled':
      return params.selector
        ? `await page.locator(${resolveVar(params.selector, variables)}).isEnabled()`
        : 'false /* no selector */';
    case 'variableTruthy':
      return params.variableName
        ? `Boolean(${params.variableName})`
        : 'false /* no variable name */';
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
    const condition = generateConditionCode(node.data.parameters, variables);
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
    const condition = generateConditionCode(node.data.parameters, variables);
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
    variables.add(varName);
    lines.push(`${indent}const _elements = await page.locator(${resolveVar(selector, variables)}).all();`);
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
  const hasAssertions = nodes.some(n => n.data.type.startsWith('assert'));
  const browserType = nodes.find(n => n.data.type === 'open')?.data.parameters.browserType || 'chromium';

  const lines: string[] = [
    `import { ${browserType}, expect } from '@playwright/test';`,
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
