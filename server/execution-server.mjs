import { chromium, firefox, webkit } from 'playwright';
import http from 'http';

const sessions = new Map();
const exploreSessions = new Map();

function generateBestSelector(el) {
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el.getAttribute('data-testid')) return `[data-testid="${el.getAttribute('data-testid')}"]`;
  if (el.getAttribute('data-test-id')) return `[data-test-id="${el.getAttribute('data-test-id')}"]`;
  if (el.getAttribute('name')) {
    const tag = el.tagName.toLowerCase();
    return `${tag}[name="${el.getAttribute('name')}"]`;
  }
  if (el.getAttribute('aria-label')) {
    const tag = el.tagName.toLowerCase();
    return `${tag}[aria-label="${el.getAttribute('aria-label')}"]`;
  }
  if (el.getAttribute('placeholder')) {
    const tag = el.tagName.toLowerCase();
    return `${tag}[placeholder="${el.getAttribute('placeholder')}"]`;
  }
  if (el.getAttribute('role')) {
    const tag = el.tagName.toLowerCase();
    return `${tag}[role="${el.getAttribute('role')}"]`;
  }
  if (el.className && typeof el.className === 'string' && el.className.trim()) {
    const tag = el.tagName.toLowerCase();
    const classes = el.className.trim().split(/\s+/).filter(c => c && !c.match(/^[0-9]/) && !c.match(/^(css-|sc-|styled-|emotion-|makeStyles-)/));
    if (classes.length > 0) return `${tag}.${classes.slice(0, 2).join('.')}`;
  }
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
    if (siblings.length > 1) {
      const idx = siblings.indexOf(el) + 1;
      return `${tag}:nth-of-type(${idx})`;
    }
  }
  return tag;
}

function getXPath(el) {
  if (el.id) return `//*[@id="${el.id}"]`;
  if (el === document.body) return '/html/body';
  const parent = el.parentElement;
  if (!parent) return '';
  const siblings = Array.from(parent.children);
  const sameTagSiblings = siblings.filter(s => s.tagName === el.tagName);
  const idx = sameTagSiblings.indexOf(el) + 1;
  const tag = el.tagName.toLowerCase();
  const parentPath = getXPath(parent);
  if (sameTagSiblings.length > 1) {
    return `${parentPath}/${tag}[${idx}]`;
  }
  return `${parentPath}/${tag}`;
}

async function inspectPageElements(page) {
  return await page.evaluate(() => {
    const results = [];
    const seen = new Set();

    // ── Helper: build element result entry ──
    const addElement = (el, source) => {
      if (seen.has(el)) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      seen.add(el);

      const tag = el.tagName.toLowerCase();
      const text = (el.textContent || '').trim().substring(0, 80);
      const inputType = el.type || null;

      let category = 'other';
      if (tag === 'button' || el.getAttribute('role') === 'button') category = 'button';
      else if (tag === 'a' || el.getAttribute('role') === 'link') category = 'link';
      else if (tag === 'input' || tag === 'textarea' || el.contentEditable === 'true') category = 'input';
      else if (tag === 'select') category = 'select';
      else if (tag === 'summary' || tag === 'details') category = 'toggle';
      else if (el.getAttribute('role') === 'tab') category = 'tab';
      else if (el.getAttribute('role') === 'menuitem') category = 'menu';
      else if (el.getAttribute('role') === 'checkbox') category = 'checkbox';
      else if (el.getAttribute('role') === 'option') category = 'option';
      else if (source === 'framework' || source === 'cursor') category = 'clickable';

      let bestSelector = '';
      if (el.id) bestSelector = `#${CSS.escape(el.id)}`;
      else if (el.getAttribute('data-testid')) bestSelector = `[data-testid="${el.getAttribute('data-testid')}"]`;
      else if (el.getAttribute('data-test-id')) bestSelector = `[data-test-id="${el.getAttribute('data-test-id')}"]`;
      else if (el.getAttribute('name')) bestSelector = `${tag}[name="${el.getAttribute('name')}"]`;
      else if (el.getAttribute('aria-label')) bestSelector = `${tag}[aria-label="${el.getAttribute('aria-label')}"]`;
      else if (el.getAttribute('placeholder')) bestSelector = `${tag}[placeholder="${el.getAttribute('placeholder')}"]`;
      else if (el.getAttribute('role')) bestSelector = `${tag}[role="${el.getAttribute('role')}"]`;
      else if (el.className && typeof el.className === 'string' && el.className.trim()) {
        const classes = el.className.trim().split(/\s+/).filter(c => c && !c.match(/^[0-9]/) && !c.match(/^(css-|sc-|styled-|emotion-|makeStyles-)/));
        if (classes.length > 0) bestSelector = `${tag}.${classes.slice(0, 2).join('.')}`;
      }
      if (!bestSelector) bestSelector = tag;

      let xpath = '';
      try {
        if (el.id) xpath = `//*[@id="${el.id}"]`;
        else {
          const parent = el.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
            const idx = siblings.indexOf(el) + 1;
            xpath = siblings.length > 1 ? `//${tag}[${idx}]` : `//${tag}`;
          }
        }
      } catch {}

      results.push({
        tag,
        text,
        category,
        id: el.id || null,
        className: typeof el.className === 'string' ? el.className.substring(0, 100) : '',
        selector: bestSelector,
        xpath,
        type: inputType,
        placeholder: el.placeholder || null,
        href: el.href || null,
        name: el.name || null,
        value: el.value || null,
        role: el.getAttribute('role') || null,
        dataTestId: el.getAttribute('data-testid') || null,
        ariaLabel: el.getAttribute('aria-label') || null,
        boundingBox: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
        visible: rect.width > 0 && rect.height > 0,
        editable: ['INPUT', 'TEXTAREA'].includes(el.tagName) || el.contentEditable === 'true',
        checked: el.checked || false,
        disabled: el.disabled || false,
      });
    };

    // ── Strategy 1: Standard selectors + framework class patterns ──
    const selectors = [
      // Standard interactive HTML elements
      'button', 'input', 'select', 'textarea',
      'a[href]', '[role="button"]', '[role="link"]', '[role="tab"]',
      '[role="menuitem"]', '[role="option"]', '[role="checkbox"]',
      '[contenteditable]', '[tabindex]:not([tabindex="-1"])',
      'summary', 'details', '[data-testid]', '[data-test-id]',
      // Framework class patterns
      '.ant-dropdown-trigger', '.ant-menu-item', '.ant-btn',
      '.el-dropdown-trigger', '.el-menu-item',
      '[onclick]', '[onmousedown]',
    ];
    document.querySelectorAll(selectors.join(',')).forEach(el => {
      addElement(el, 'selector');
    });

    // ── Strategy 2: Event-tracked elements (from addInitScript) ──
    if (window.__interactiveElements && typeof window.__interactiveElements.forEach === 'function') {
      window.__interactiveElements.forEach(el => {
        if (!document.contains(el)) return;
        addElement(el, 'event');
      });
    }

    // ── Strategy 3: cursor:pointer detection ──
    // Scan for div/span/li/label that look clickable but have no ARIA/role
    document.querySelectorAll('div, span, li, td, th, label').forEach(el => {
      if (seen.has(el)) return;
      const rect = el.getBoundingClientRect();
      // Skip layout containers and invisible elements
      if (rect.width === 0 || rect.height === 0) return;
      if (rect.width > 400 && rect.height > 80) return;
      const text = (el.textContent || '').trim();
      if (!text || text.length > 80) return;
      // Check if CSS indicates interactivity
      try {
        if (getComputedStyle(el).cursor === 'pointer') {
          addElement(el, 'cursor');
        }
      } catch {}
    });

    results.sort((a, b) => a.boundingBox.y - b.boundingBox.y || a.boundingBox.x - b.boundingBox.x);
    return results;
  });
}

function getBrowser(type) {
  switch (type) {
    case 'firefox': return firefox;
    case 'webkit': return webkit;
    default: return chromium;
  }
}

async function executeAction(action, params, sessionId) {
  let session = sessions.get(sessionId);

  switch (action) {
    case 'open': {
      const browserType = params.browserType || 'chromium';
      const launchOpts = { headless: params.headless !== 'false' };
      const browser = await getBrowser(browserType).launch(launchOpts);
      const contextOpts = {};
      if (params.viewport) {
        const [vw, vh] = params.viewport === 'custom' ? ['1280', '720'] : params.viewport.split('x');
        contextOpts.viewport = { width: parseInt(vw), height: parseInt(vh) };
      }
      if (params.locale) contextOpts.locale = params.locale;
      if (params.recordVideo === 'true') contextOpts.recordVideo = { dir: 'test-results/videos' };
      if (params.blockServiceWorkers === 'true') contextOpts.serviceWorkers = 'block';
      const context = await browser.newContext(contextOpts);
      if (params.recordTrace === 'true') {
        await context.tracing.start({ screenshots: true, snapshots: true });
      }
      const page = await context.newPage();
      if (params.url) {
        await page.goto(params.url);
      }
      sessions.set(sessionId, { browser, context, page, recordTrace: params.recordTrace === 'true' });
      return { success: true };
    }

    case 'goto': {
      if (!session?.page) throw new Error('No active page. Open browser first.');
      await session.page.goto(params.url, { waitUntil: params.waitUntil || 'load' });
      return { success: true };
    }

    case 'click': {
      if (!session?.page) throw new Error('No active page.');
      if (!params.selector) throw new Error('No selector specified.');
      await session.page.locator(params.selector).click({ timeout: params.timeout || 5000 });
      return { success: true };
    }

    case 'fill': {
      if (!session?.page) throw new Error('No active page.');
      if (!params.selector || !params.value) throw new Error('selector and value are required.');
      await session.page.locator(params.selector).fill(params.value);
      if (params.submit) {
        await session.page.locator(params.selector).press('Enter');
      }
      return { success: true };
    }

    case 'type': {
      if (!session?.page) throw new Error('No active page.');
      if (!params.selector || !params.text) throw new Error('selector and text are required.');
      await session.page.locator(params.selector).type(params.text, { delay: params.delay || 0 });
      return { success: true };
    }

    case 'screenshot': {
      if (!session?.page) throw new Error('No active page.');
      await session.page.screenshot({ path: params.path || 'screenshot.png', fullPage: params.fullPage === true });
      return { success: true };
    }

    case 'waitForSelector': {
      if (!session?.page) throw new Error('No active page.');
      if (!params.selector) throw new Error('No selector specified.');
      await session.page.locator(params.selector).waitFor({ state: params.state || 'visible', timeout: params.timeout || 30000 });
      return { success: true };
    }

    case 'waitForTimeout': {
      if (!session?.page) throw new Error('No active page.');
      await session.page.waitForTimeout(params.timeout || 1000);
      return { success: true };
    }

    case 'close': {
      if (session?.browser) {
        if (session.recordTrace) {
          try { await session.context.tracing.stop({ path: 'trace.zip' }); } catch {}
        }
        await session.browser.close();
        sessions.delete(sessionId);
      }
      return { success: true };
    }

    case 'setVariable': {
      return { success: true, variables: { [params.name || 'variable']: params.value ?? '' } };
    }

    case 'getVariable': {
      return { success: true };
    }

    case 'press': {
      if (!session?.page) throw new Error('No active page.');
      const key = params.key || 'Enter';
      if (params.selector) {
        await session.page.locator(params.selector).press(key);
      } else {
        await session.page.keyboard.press(key);
      }
      return { success: true };
    }

    case 'checkbox': {
      if (!session?.page) throw new Error('No active page.');
      if (!params.selector) throw new Error('No selector specified.');
      const action = params.action === 'uncheck' ? 'uncheck' : 'check';
      await session.page.locator(params.selector)[action]();
      return { success: true };
    }

    case 'selectOption': {
      if (!session?.page) throw new Error('No active page.');
      if (!params.selector || !params.value) throw new Error('selector and value are required.');
      const selectBy = params.selectBy || 'value';
      if (selectBy === 'label') {
        await session.page.locator(params.selector).selectOption({ label: params.value });
      } else if (selectBy === 'index') {
        await session.page.locator(params.selector).selectOption({ index: parseInt(params.value) });
      } else {
        await session.page.locator(params.selector).selectOption(params.value);
      }
      return { success: true };
    }

    case 'upload': {
      if (!session?.page) throw new Error('No active page.');
      if (!params.selector || !params.filePath) throw new Error('selector and filePath are required.');
      await session.page.locator(params.selector).setInputFiles(params.filePath);
      return { success: true };
    }

    case 'hover': {
      if (!session?.page) throw new Error('No active page.');
      if (!params.selector) throw new Error('No selector specified.');
      const hoverOpts = {};
      if (params.modifiers && params.modifiers !== 'none') {
        hoverOpts.modifiers = [params.modifiers];
      }
      await session.page.locator(params.selector).hover(hoverOpts);
      return { success: true };
    }

    case 'waitForUrl': {
      if (!session?.page) throw new Error('No active page.');
      if (!params.urlPattern) throw new Error('No URL pattern specified.');
      const matchType = params.matchType || 'contains';
      const timeout = params.timeout || 30000;
      if (matchType === 'regex') {
        await session.page.waitForURL(new RegExp(params.urlPattern), { timeout });
      } else if (matchType === 'exact') {
        await session.page.waitForURL(params.urlPattern, { timeout });
      } else {
        await session.page.waitForURL(url => url.includes(params.urlPattern), { timeout });
      }
      return { success: true };
    }

    case 'saveAuth': {
      if (!session?.context) throw new Error('No active context.');
      const authPath = params.path || 'auth.json';
      await session.context.storageState({ path: authPath });
      return { success: true };
    }

    case 'loadAuth': {
      if (!session?.context) throw new Error('No active context.');
      return { success: true, message: 'Auth state should be loaded before context creation. Use open node with authPath parameter.' };
    }

    case 'evaluate': {
      if (!session?.page) throw new Error('No active page.');
      if (!params.expression) throw new Error('No expression specified.');
      const result = await session.page.evaluate(params.expression);
      if (params.variableName && result !== undefined) {
        return { success: true, variables: { [params.variableName]: result } };
      }
      return { success: true };
    }

    case 'assertVisible': {
      if (!session?.page) throw new Error('No active page.');
      if (!params.selector) throw new Error('No selector specified.');
      const locator = session.page.locator(params.selector);
      const isVisible = await locator.isVisible({ timeout: params.timeout || 5000 });
      if (!isVisible) throw new Error(`Element "${params.selector}" is not visible`);
      return { success: true };
    }

    case 'assertText': {
      if (!session?.page) throw new Error('No active page.');
      if (!params.selector || !params.expectedText) throw new Error('selector and expectedText are required.');
      const locator = session.page.locator(params.selector);
      const text = await locator.textContent({ timeout: params.timeout || 5000 });
      const matchType = params.matchType || 'contains';
      let passed = false;
      if (matchType === 'exact') {
        passed = text === params.expectedText;
      } else if (matchType === 'regex') {
        passed = new RegExp(params.expectedText).test(text || '');
      } else {
        passed = (text || '').includes(params.expectedText);
      }
      if (!passed) throw new Error(`Text assertion failed. Expected "${params.expectedText}" (${matchType}), got "${text}"`);
      return { success: true };
    }

    case 'assertUrl': {
      if (!session?.page) throw new Error('No active page.');
      if (!params.expectedUrl) throw new Error('expectedUrl is required.');
      const currentUrl = session.page.url();
      const matchType = params.matchType || 'contains';
      let passed = false;
      if (matchType === 'exact') {
        passed = currentUrl === params.expectedUrl;
      } else if (matchType === 'regex') {
        passed = new RegExp(params.expectedUrl).test(currentUrl);
      } else {
        passed = currentUrl.includes(params.expectedUrl);
      }
      if (!passed) throw new Error(`URL assertion failed. Expected "${params.expectedUrl}" (${matchType}), got "${currentUrl}"`);
      return { success: true };
    }

    case 'assertTitle': {
      if (!session?.page) throw new Error('No active page.');
      if (!params.expectedTitle) throw new Error('expectedTitle is required.');
      const title = await session.page.title();
      const matchType = params.matchType || 'contains';
      let passed = false;
      if (matchType === 'exact') {
        passed = title === params.expectedTitle;
      } else if (matchType === 'regex') {
        passed = new RegExp(params.expectedTitle).test(title);
      } else {
        passed = title.includes(params.expectedTitle);
      }
      if (!passed) throw new Error(`Title assertion failed. Expected "${params.expectedTitle}" (${matchType}), got "${title}"`);
      return { success: true };
    }

    case 'assertElementCount': {
      if (!session?.page) throw new Error('No active page.');
      if (!params.selector) throw new Error('selector is required.');
      const count = await session.page.locator(params.selector).count();
      const expected = params.expectedCount || 1;
      const comparison = params.comparison || 'equal';
      let passed = false;
      switch (comparison) {
        case 'equal': passed = count === expected; break;
        case 'greaterThan': passed = count > expected; break;
        case 'lessThan': passed = count < expected; break;
        case 'greaterThanOrEqual': passed = count >= expected; break;
        case 'lessThanOrEqual': passed = count <= expected; break;
      }
      if (!passed) throw new Error(`Element count assertion failed. Expected ${comparison} ${expected}, got ${count}`);
      return { success: true };
    }

    case 'assertAttribute': {
      if (!session?.page) throw new Error('No active page.');
      if (!params.selector) throw new Error('selector is required.');
      const attr = params.attribute === 'custom' ? params.customAttribute : params.attribute;
      const attrValue = await session.page.locator(params.selector).getAttribute(attr || 'value');
      if (params.expectedValue !== undefined) {
        if (attrValue !== params.expectedValue) {
          throw new Error(`Attribute assertion failed. Expected "${params.expectedValue}", got "${attrValue}"`);
        }
      }
      return { success: true };
    }

    case 'handleDialog': {
      if (!session?.page) throw new Error('No active page.');
      const dialogAction = params.action || 'accept';
      session.page.once('dialog', async dialog => {
        if (dialogAction === 'dismiss') {
          await dialog.dismiss();
        } else {
          await dialog.accept(params.promptText || '');
        }
      });
      return { success: true };
    }

    case 'download': {
      if (!session?.page) throw new Error('No active page.');
      if (!params.triggerSelector) throw new Error('triggerSelector is required.');
      const downloadPromise = session.page.waitForEvent('download');
      await session.page.locator(params.triggerSelector).click();
      const download = await downloadPromise;
      const savePath = params.savePath || download.suggestedFilename();
      await download.saveAs(savePath);
      return { success: true, variables: { [params.variableName || 'downloadPath']: savePath } };
    }

    case 'routeMock': {
      if (!session?.page) throw new Error('No active page.');
      if (!params.urlPattern) throw new Error('urlPattern is required.');
      await session.page.route(params.urlPattern, async route => {
        if (params.responseBody) {
          try {
            const json = JSON.parse(params.responseBody);
            await route.fulfill({
              status: params.statusCode || 200,
              contentType: params.contentType || 'application/json',
              body: JSON.stringify(json),
            });
          } catch {
            await route.fulfill({
              status: params.statusCode || 200,
              contentType: params.contentType || 'text/plain',
              body: params.responseBody,
            });
          }
        } else {
          await route.fulfill({ status: params.statusCode || 200, body: '' });
        }
      });
      return { success: true };
    }

    case 'routeAbort': {
      if (!session?.page) throw new Error('No active page.');
      if (!params.urlPattern) throw new Error('urlPattern is required.');
      await session.page.route(params.urlPattern, route => route.abort());
      return { success: true };
    }

    case 'waitForResponse': {
      if (!session?.page) throw new Error('No active page.');
      if (!params.urlPattern) throw new Error('urlPattern is required.');
      const response = await session.page.waitForResponse(params.urlPattern, { timeout: params.timeout || 30000 });
      let body = null;
      try { body = await response.text(); } catch {}
      const result = { status: response.status(), url: response.url() };
      if (params.variableName) {
        return { success: true, variables: { [params.variableName]: body || '' } };
      }
      return { success: true, data: result };
    }

    case 'switchPage': {
      if (!session?.context) throw new Error('No active context.');
      const mode = params.mode || 'new';
      if (mode === 'new') {
        const newPage = await session.context.newPage();
        if (params.url) await newPage.goto(params.url);
        session.page = newPage;
        sessions.set(sessionId, session);
      } else if (mode === 'popup') {
        if (!params.triggerSelector) throw new Error('triggerSelector is required for popup mode.');
        const popupPromise = session.page.waitForEvent('popup');
        await session.page.locator(params.triggerSelector).click();
        const popup = await popupPromise;
        await popup.waitForLoadState();
        session.page = popup;
        sessions.set(sessionId, session);
      } else if (mode === 'tab') {
        if (!params.triggerSelector) throw new Error('triggerSelector is required for tab mode.');
        const pagePromise = session.context.waitForEvent('page');
        await session.page.locator(params.triggerSelector).click();
        const newPage = await pagePromise;
        await newPage.waitForLoadState();
        session.page = newPage;
        sessions.set(sessionId, session);
      } else if (mode === 'index') {
        const pages = session.context.pages();
        const idx = parseInt(params.pageIndex || '0');
        if (idx >= 0 && idx < pages.length) {
          session.page = pages[idx];
          sessions.set(sessionId, session);
        } else {
          throw new Error(`Page index ${idx} out of range. Available: 0-${pages.length - 1}`);
        }
      }
      return { success: true };
    }

    case 'waitForLoadState': {
      if (!session?.page) throw new Error('No active page.');
      const state = params.state || 'load';
      await session.page.waitForLoadState(state);
      return { success: true };
    }

    case 'extract': {
      if (!session?.page) throw new Error('No active page.');
      if (!params.selector) throw new Error('No selector specified.');
      const locator = session.page.locator(params.selector).first();
      let value = '';
      const attr = params.attribute === 'custom' ? params.customAttribute : params.attribute;
      if (attr === 'textContent') {
        value = (await locator.textContent()) || '';
      } else if (attr === 'innerHTML') {
        value = await locator.innerHTML();
      } else if (['href', 'src', 'value'].includes(attr)) {
        value = (await locator.getAttribute(attr)) || '';
      } else {
        value = await locator.evaluate((el, a) => el[a], attr || 'textContent');
      }
      const varName = params.variableName || 'extracted';
      return { success: true, variables: { [varName]: value } };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

async function evaluateCondition(params, sessionId) {
  const session = sessions.get(sessionId);
  if (!session?.page) return false;

  switch (params.condition) {
    case 'selectorExists': {
      if (!params.selector) return false;
      const count = await session.page.locator(params.selector).count();
      return count > 0;
    }
    case 'selectorVisible': {
      if (!params.selector) return false;
      return await session.page.locator(params.selector).isVisible();
    }
    case 'textContains': {
      if (!params.text) return false;
      const text = await session.page.textContent('body');
      return (text || '').includes(params.text);
    }
    case 'urlMatches': {
      if (!params.url) return false;
      return session.page.url().includes(params.url);
    }
    case 'selectorEditable': {
      if (!params.selector) return false;
      return await session.page.locator(params.selector).isEditable();
    }
    case 'selectorChecked': {
      if (!params.selector) return false;
      return await session.page.locator(params.selector).isChecked();
    }
    case 'selectorEnabled': {
      if (!params.selector) return false;
      return await session.page.locator(params.selector).isEnabled();
    }
    case 'variableTruthy': {
      if (!params.variableName) return false;
      return true;
    }
    default:
      return true;
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', sessions: sessions.size }));
    return;
  }

  if (req.url === '/execute' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { action, params, sessionId: sid } = JSON.parse(body);
        const result = await executeAction(action, params, sid || 'default');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
    return;
  }

  if (req.url === '/evaluate-condition' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { params, sessionId: sid } = JSON.parse(body);
        const result = await evaluateCondition(params, sid || 'default');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ result }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ result: false, error: error.message }));
      }
    });
    return;
  }

  if (req.url === '/explore/open' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { url, sessionId } = JSON.parse(body);
        const sid = sessionId || `explore-${Date.now()}`;
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
        const page = await context.newPage();

        // Patch addEventListener to track elements with direct event bindings
        page.addInitScript(() => {
          window.__interactiveElements = new Set();
          const original = EventTarget.prototype.addEventListener;
          EventTarget.prototype.addEventListener = function (type, handler, options) {
            if (this && this.nodeType === 1) {
              window.__interactiveElements.add(this);
            }
            return original.call(this, type, handler, options);
          };
        });

        if (url) await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        page.on('close', () => {
          const session = exploreSessions.get(sid);
          if (session) {
            session.closed = true;
          }
        });
        exploreSessions.set(sid, { browser, context, page, closed: false, url: url || page.url() });
        const screenshot = await page.screenshot({ type: 'png' });
        const elements = await inspectPageElements(page);
        const title = await page.title();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          sessionId: sid,
          screenshot: screenshot.toString('base64'),
          elements,
          count: elements.length,
          url: page.url(),
          title,
        }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
    return;
  }

  if (req.url === '/explore/navigate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { url, sessionId } = JSON.parse(body);
        const session = exploreSessions.get(sessionId);
        if (!session || !session.page) throw new Error('No explore session. Open a page first.');
        await session.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        session.url = session.page.url();
        const screenshot = await session.page.screenshot({ type: 'png' });
        const elements = await inspectPageElements(session.page);
        const title = await session.page.title();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          screenshot: screenshot.toString('base64'),
          elements,
          count: elements.length,
          url: session.page.url(),
          title,
        }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
    return;
  }

  if (req.url === '/explore/refresh' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { sessionId } = JSON.parse(body);
        const session = exploreSessions.get(sessionId);
        if (!session || !session.page) throw new Error('No explore session.');
        const screenshot = await session.page.screenshot({ type: 'png' });
        const elements = await inspectPageElements(session.page);
        const title = await session.page.title();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          screenshot: screenshot.toString('base64'),
          elements,
          count: elements.length,
          url: session.page.url(),
          title,
        }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
    return;
  }

  if (req.url === '/explore/action' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { sessionId, action, selector, value } = JSON.parse(body);
        const session = exploreSessions.get(sessionId);
        if (!session || !session.page) throw new Error('No explore session.');
        const page = session.page;
        switch (action) {
          case 'click':
            await page.locator(selector).click({ timeout: 5000 });
            break;
          case 'fill':
            await page.locator(selector).fill(value || '');
            break;
          case 'type':
            await page.locator(selector).type(value || '', { delay: 50 });
            break;
          case 'check':
            await page.locator(selector).check();
            break;
          case 'uncheck':
            await page.locator(selector).uncheck();
            break;
          case 'selectOption':
            await page.locator(selector).selectOption(value || '');
            break;
          case 'hover':
            await page.locator(selector).hover();
            break;
          case 'press':
            await page.locator(selector).press(value || 'Enter');
            break;
          default:
            throw new Error(`Unknown explore action: ${action}`);
        }
        await page.waitForTimeout(500);
        const screenshot = await page.screenshot({ type: 'png' });
        const elements = await inspectPageElements(page);
        const title = await page.title();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          screenshot: screenshot.toString('base64'),
          elements,
          count: elements.length,
          url: page.url(),
          title,
        }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
    return;
  }

  if (req.url === '/explore/close' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { sessionId } = JSON.parse(body);
        const session = exploreSessions.get(sessionId);
        if (session?.browser) {
          try { await session.browser.close(); } catch {}
          exploreSessions.delete(sessionId);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
    return;
  }

  if (req.url === '/explore/close-all' && req.method === 'POST') {
    for (const [id, session] of exploreSessions) {
      try { await session.browser.close(); } catch {}
      exploreSessions.delete(id);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (req.url === '/cleanup' && req.method === 'POST') {
    for (const [id, session] of sessions) {
      try { await session.browser.close(); } catch {}
    }
    sessions.clear();
    for (const [id, session] of exploreSessions) {
      try { await session.browser.close(); } catch {}
    }
    exploreSessions.clear();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const PORT = 3210;
server.listen(PORT, () => {
  console.log(`Playwright execution server running on http://localhost:${PORT}`);
});
