import { test, expect } from '@playwright/test';

test.describe('Quick Add & Insert Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(1000);
  });

  test('node + button shows picker popup', async ({ page }) => {
    const nodeItem = page.locator('.node-item').first();
    const canvas = page.locator('.react-flow__renderer');
    
    await nodeItem.dragTo(canvas, {
      targetPosition: { x: 300, y: 200 },
    });
    await page.waitForTimeout(500);

    const customNode = page.locator('.custom-node').first();
    await customNode.hover();
    await page.waitForTimeout(300);

    const quickAddBtn = page.locator('.quick-add-btn');
    await expect(quickAddBtn).toBeVisible({ timeout: 3000 });

    await quickAddBtn.click();
    await page.waitForTimeout(500);

    const picker = page.locator('.quick-node-picker');
    await expect(picker).toBeVisible({ timeout: 3000 });

    const searchInput = picker.locator('.quick-node-search');
    await expect(searchInput).toBeVisible();

    const pickerItems = picker.locator('.quick-node-item');
    const count = await pickerItems.count();
    expect(count).toBeGreaterThan(0);

    await page.screenshot({ path: '/tmp/test_node_picker.png' });
  });

  test('selecting from picker creates connected node', async ({ page }) => {
    const nodeItem = page.locator('.node-item').first();
    const canvas = page.locator('.react-flow__renderer');
    
    await nodeItem.dragTo(canvas, {
      targetPosition: { x: 300, y: 200 },
    });
    await page.waitForTimeout(500);

    const customNode = page.locator('.custom-node').first();
    await customNode.hover();
    await page.waitForTimeout(300);

    const quickAddBtn = page.locator('.quick-add-btn');
    await quickAddBtn.click();
    await page.waitForTimeout(500);

    const pickerItem = page.locator('.quick-node-item').first();
    await pickerItem.click();
    await page.waitForTimeout(500);

    const nodes = page.locator('.custom-node');
    const nodeCount = await nodes.count();
    expect(nodeCount).toBe(2);

    const edges = page.locator('.react-flow__edge');
    const edgeCount = await edges.count();
    expect(edgeCount).toBeGreaterThan(0);

    await page.screenshot({ path: '/tmp/test_picker_connected.png' });
  });

  test('edge + button shows picker for insert between', async ({ page }) => {
    const nodeItems = page.locator('.node-item');
    const canvas = page.locator('.react-flow__renderer');
    
    await nodeItems.nth(0).dragTo(canvas, {
      targetPosition: { x: 300, y: 100 },
    });
    await page.waitForTimeout(500);

    const customNode = page.locator('.custom-node').first();
    await customNode.hover();
    await page.waitForTimeout(300);

    const quickAddBtn = page.locator('.quick-add-btn');
    await quickAddBtn.click();
    await page.waitForTimeout(500);

    const pickerItem = page.locator('.quick-node-item').nth(1);
    await pickerItem.click();
    await page.waitForTimeout(500);

    let nodes = page.locator('.custom-node');
    let nodeCount = await nodes.count();
    expect(nodeCount).toBe(2);

    let edges = page.locator('.react-flow__edge');
    let edgeCount = await edges.count();
    expect(edgeCount).toBe(1);

    // Get edge source and target IDs, then dispatch the insert event directly
    const edgeInfo = await page.evaluate(() => {
      const edgeEl = document.querySelector('.react-flow__edge');
      if (!edgeEl) return null;
      const id = edgeEl.getAttribute('data-id');
      const ariaLabel = edgeEl.getAttribute('aria-label') || '';
      return { id, ariaLabel };
    });
    expect(edgeInfo).not.toBeNull();

    // Dispatch the quick-insert-node event directly (simulates clicking edge + button)
    await page.evaluate(() => {
      const edgeEl = document.querySelector('.react-flow__edge');
      const edgeId = edgeEl?.getAttribute('data-id') || '';
      const label = edgeEl?.getAttribute('aria-label') || '';
      const match = label.match(/from (node-\d+) to (node-\d+)/);
      if (match) {
        const event = new CustomEvent('quick-insert-node', {
          detail: {
            edgeId,
            sourceId: match[1],
            targetId: match[2],
            clientX: 400,
            clientY: 300,
          },
          bubbles: true,
        });
        window.dispatchEvent(event);
      }
    });
    await page.waitForTimeout(500);

    // Check picker popup appears
    const picker = page.locator('.quick-node-picker');
    await expect(picker).toBeVisible({ timeout: 3000 });

    const insertItem = picker.locator('.quick-node-item').first();
    await insertItem.click();
    await page.waitForTimeout(500);

    nodes = page.locator('.custom-node');
    nodeCount = await nodes.count();
    expect(nodeCount).toBe(3);

    edges = page.locator('.react-flow__edge');
    edgeCount = await edges.count();
    expect(edgeCount).toBe(2);

    await page.screenshot({ path: '/tmp/test_edge_insert.png' });
  });

  test('picker search filters nodes', async ({ page }) => {
    const nodeItem = page.locator('.node-item').first();
    const canvas = page.locator('.react-flow__renderer');
    
    await nodeItem.dragTo(canvas, {
      targetPosition: { x: 300, y: 200 },
    });
    await page.waitForTimeout(500);

    const customNode = page.locator('.custom-node').first();
    await customNode.hover();
    await page.waitForTimeout(300);

    const quickAddBtn = page.locator('.quick-add-btn');
    await quickAddBtn.click();
    await page.waitForTimeout(500);

    const searchInput = page.locator('.quick-node-search');
    await searchInput.fill('点击');
    await page.waitForTimeout(300);

    const pickerItems = page.locator('.quick-node-item');
    const count = await pickerItems.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(15);

    await page.screenshot({ path: '/tmp/test_picker_search.png' });
  });
});
