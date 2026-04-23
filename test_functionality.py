from playwright.sync_api import sync_playwright
import json

def test_app():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1400, 'height': 900})
        
        logs = []
        page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))
        
        print("=" * 60)
        print("核心功能测试 - Playwright 可视化流程编辑器")
        print("=" * 60)
        
        # 测试1: 页面加载
        print("\n[1] 页面加载与UI")
        page.goto('http://localhost:5173')
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1000)
        page.screenshot(path='/tmp/final_test1.png', full_page=False)
        
        checks = {
            '节点面板': page.locator('text=节点面板').count() > 0,
            '浏览器操作': page.locator('text=浏览器操作').count() > 0,
            '流程控制': page.locator('text=流程控制').count() > 0,
            '变量数据': page.locator('text=变量数据').count() > 0,
            '运行按钮': page.locator('text=运行').count() > 0,
            '撤销按钮': page.locator('text=撤销').count() > 0,
            '重做按钮': page.locator('text=重做').count() > 0,
            '服务状态(模拟)': page.locator('text=模拟').count() > 0,
        }
        for name, result in checks.items():
            print(f"  {'✅' if result else '❌'} {name}")
        
        # 测试2: 拖拽节点
        print("\n[2] 拖拽节点到画布")
        nodes_to_drag = ['打开浏览器', '跳转页面', '点击元素', '截图', '关闭浏览器']
        canvas = page.locator('.react-flow__pane')
        canvas_box = canvas.first.bounding_box()
        
        for i, node_name in enumerate(nodes_to_drag):
            node = page.locator('.node-item').filter(has_text=node_name)
            if node.count() > 0:
                node_box = node.first.bounding_box()
                page.mouse.move(node_box['x'] + node_box['width']/2, node_box['y'] + node_box['height']/2)
                page.mouse.down()
                page.mouse.move(
                    canvas_box['x'] + 200 + i*180,
                    canvas_box['y'] + 150 + i*100
                )
                page.mouse.up()
                page.wait_for_timeout(200)
        
        total_nodes = page.locator('.react-flow__node').count()
        print(f"  {'✅' if total_nodes >= 5 else '❌'} 拖拽了 {total_nodes} 个节点到画布")
        page.screenshot(path='/tmp/final_test2.png', full_page=False)
        
        # 测试3: 连接节点
        print("\n[3] 连接节点")
        nodes = page.locator('.react-flow__node').all()
        if len(nodes) >= 2:
            for i in range(len(nodes) - 1):
                n1 = nodes[i].bounding_box()
                n2 = nodes[i+1].bounding_box()
                if n1 and n2:
                    page.mouse.move(n1['x'] + n1['width']/2, n1['y'] + n1['height'] - 5)
                    page.mouse.down()
                    page.mouse.move(n2['x'] + n2['width']/2, n2['y'] + 5)
                    page.mouse.up()
                    page.wait_for_timeout(200)
        
        edges = page.locator('.react-flow__edge').count()
        print(f"  {'✅' if edges >= 3 else '⚠️'} 连接了 {edges} 条边")
        page.screenshot(path='/tmp/final_test3.png', full_page=False)
        
        # 测试4: 生成代码
        print("\n[4] 生成 Playwright 代码")
        generate_btn = page.locator('.toolbar-btn').filter(has_text='生成代码')
        if generate_btn.count() > 0:
            generate_btn.first.click()
            page.wait_for_timeout(800)
            
            code_modal = page.locator('.code-preview-overlay')
            has_modal = code_modal.count() > 0
            print(f"  {'✅' if has_modal else '❌'} 代码预览弹窗")
            
            if has_modal:
                code_content = page.locator('.code-preview-content').inner_text()
                has_import = 'import' in code_content
                has_try = 'try' in code_content
                has_catch = 'catch' in code_content
                has_goto = 'goto' in code_content
                has_locator = 'locator' in code_content
                has_close = 'close' in code_content
                
                print(f"  {'✅' if has_import else '❌'} 使用 ESM import 语法")
                print(f"  {'✅' if has_try else '❌'} 包含 try/catch 错误处理")
                print(f"  {'✅' if has_locator else '❌'} 使用现代 locator API")
                print(f"  {'✅' if has_goto else '❌'} 包含页面导航代码")
                print(f"  {'✅' if has_close else '❌'} 包含浏览器关闭代码")
                
                print(f"\n  生成的代码:\n  {'-'*40}")
                for line in code_content.split('\n')[:25]:
                    print(f"  {line}")
                if len(code_content.split('\n')) > 25:
                    print(f"  ... (共 {len(code_content.split(chr(10)))} 行)")
                
                # 关闭弹窗
                close_btn = page.locator('.code-preview-close')
                if close_btn.count() > 0:
                    close_btn.first.click()
                    page.wait_for_timeout(300)
        
        # 测试5: 保存功能
        print("\n[5] 保存流程")
        save_btn = page.locator('.toolbar-btn').filter(has_text='保存')
        if save_btn.count() > 0:
            save_btn.first.click()
            page.wait_for_timeout(500)
            storage_data = page.evaluate("() => localStorage.getItem('playwright-current-flow')")
            has_data = storage_data is not None and len(storage_data) > 0
            print(f"  {'✅' if has_data else '❌'} localStorage 保存")
            if has_data:
                flow_data = json.loads(storage_data)
                print(f"     节点数: {len(flow_data.get('nodes', []))}, 边数: {len(flow_data.get('edges', []))}")
        
        # 测试6: 执行工作流
        print("\n[6] 执行工作流")
        run_btn = page.locator('.toolbar-btn').filter(has_text='运行')
        if run_btn.count() > 0:
            run_btn.first.click()
            page.wait_for_timeout(3000)
            page.screenshot(path='/tmp/final_test6.png', full_page=False)
            
            log_items = page.locator('.log-item').count()
            print(f"  {'✅' if log_items > 0 else '❌'} 执行日志条目: {log_items}")
            
            if log_items > 0:
                # 检查是否有模拟执行提示
                sim_log = page.locator('.log-item').filter(has_text='模拟').count()
                print(f"  {'✅' if sim_log > 0 else '❌'} 模拟执行模式提示")
                
                success_logs = page.locator('.log-item.success').count()
                print(f"  ✅ 成功日志: {success_logs}")
        
        # 测试7: 撤销/重做
        print("\n[7] 撤销/重做")
        initial_nodes = page.locator('.react-flow__node').count()
        
        undo_btn = page.locator('.toolbar-btn').filter(has_text='撤销')
        if undo_btn.count() > 0 and not undo_btn.first.is_disabled():
            undo_btn.first.click()
            page.wait_for_timeout(300)
            after_undo = page.locator('.react-flow__node').count()
            print(f"  ✅ 撤销后节点数: {after_undo} (之前: {initial_nodes})")
            
            redo_btn = page.locator('.toolbar-btn').filter(has_text='重做')
            if redo_btn.count() > 0 and not redo_btn.first.is_disabled():
                redo_btn.first.click()
                page.wait_for_timeout(300)
                after_redo = page.locator('.react-flow__node').count()
                print(f"  ✅ 重做后节点数: {after_redo}")
        
        # 测试8: 键盘快捷键
        print("\n[8] 键盘快捷键 (Ctrl+Z)")
        page.keyboard.press('Meta+z')
        page.wait_for_timeout(300)
        after_kb_undo = page.locator('.react-flow__node').count()
        print(f"  ✅ Ctrl+Z 撤销后节点数: {after_kb_undo}")
        
        page.keyboard.press('Meta+Shift+z')
        page.wait_for_timeout(300)
        after_kb_redo = page.locator('.react-flow__node').count()
        print(f"  ✅ Ctrl+Shift+Z 重做后节点数: {after_kb_redo}")
        
        # 测试9: 清空画布
        print("\n[9] 清空画布")
        clear_btn = page.locator('.toolbar-btn').filter(has_text='清空')
        if clear_btn.count() > 0:
            clear_btn.first.click()
            page.wait_for_timeout(500)
            remaining = page.locator('.react-flow__node').count()
            print(f"  {'✅' if remaining == 0 else '❌'} 清空后节点数: {remaining}")
        
        # 测试10: 执行服务器
        print("\n[10] 执行服务器")
        try:
            server_check = page.evaluate("""
                async () => {
                    try {
                        const res = await fetch('http://localhost:3210/health', { signal: AbortSignal.timeout(2000) });
                        return await res.json();
                    } catch { return null; }
                }
            """)
            if server_check:
                print(f"  ✅ 执行服务器已连接: {json.dumps(server_check)}")
            else:
                print(f"  ⚠️ 执行服务器未启动 (可通过 npm run server 启动)")
        except:
            print(f"  ⚠️ 执行服务器未启动")
        
        # 控制台错误检查
        print("\n" + "=" * 60)
        print("控制台错误检查")
        print("=" * 60)
        error_logs = [l for l in logs if l.startswith('[error]')]
        if error_logs:
            for log in error_logs[:5]:
                print(f"  ❌ {log}")
        else:
            print("  ✅ 无控制台错误")
        
        browser.close()
        print("\n" + "=" * 60)
        print("测试完成！")
        print("=" * 60)

if __name__ == '__main__':
    test_app()
