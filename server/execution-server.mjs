import { chromium, firefox, webkit } from 'playwright';
import http from 'http';

const sessions = new Map();

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
      const browser = await getBrowser(browserType).launch({ headless: params.headless !== false });
      const context = await browser.newContext();
      const page = await context.newPage();
      if (params.url) {
        await page.goto(params.url);
      }
      sessions.set(sessionId, { browser, context, page });
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

  if (req.url === '/cleanup' && req.method === 'POST') {
    for (const [id, session] of sessions) {
      try { await session.browser.close(); } catch {}
    }
    sessions.clear();
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
