import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { PromptManager } from './promptManager';
import { PromptProvider } from './promptProvider';

// Helper function for dialog-based editing
async function editPromptWithDialog(prompt: any, promptManager: any, promptProvider: any) {
    const title = await vscode.window.showInputBox({
        prompt: 'Edit prompt title',
        value: prompt.title,
        placeHolder: 'My Prompt'
    });

    if (title === undefined) return;

    const content = await vscode.window.showInputBox({
        prompt: 'Edit prompt content',
        value: prompt.content,
        placeHolder: 'Your prompt content here...'
    });

    if (content === undefined) return;

    const category = await vscode.window.showInputBox({
        prompt: 'Edit category',
        value: prompt.category,
        placeHolder: 'General'
    });

    if (category === undefined) return;

    const description = await vscode.window.showInputBox({
        prompt: 'Edit description (optional)',
        value: prompt.description || '',
        placeHolder: 'Description of your prompt'
    });

    if (description === undefined) return;

    try {
        await promptManager.updatePrompt({
            ...prompt,
            title: title || prompt.title,
            content: content || prompt.content,
            category: category || prompt.category,
            description: description
        });

        promptProvider.refresh();
        vscode.window.showInformationMessage(`Prompt "${title || prompt.title}" updated successfully!`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to update prompt: ${error}`);
    }
}

// Helper function for editor-based editing with better save handling
async function editPromptWithEditor(prompt: any, promptManager: any, promptProvider: any) {
    const isNewPrompt = prompt.content === 'Enter your prompt content here...';
    const instructionText = isNewPrompt 
        ? '# Complete your new prompt below, then close the editor when done'
        : '# Edit the prompt content, then close the editor when done';
    
    const tempContent = `${instructionText}
# Changes are auto-saved as you type

Title: ${prompt.title}
Category: ${prompt.category}
Description: ${prompt.description || ''}

--- PROMPT CONTENT (edit below this line) ---
${prompt.content}`;

    const document = await vscode.workspace.openTextDocument({
        content: tempContent,
        language: 'markdown'
    });

    const editor = await vscode.window.showTextDocument(document);

    // Show instructions to user
    const message = isNewPrompt 
        ? 'Complete your new prompt content. Changes are auto-saved as you type.'
        : 'Edit the prompt content. Changes are auto-saved as you type.';
    
    vscode.window.showInformationMessage(message, 'Got it');

    // Listen for document changes and save
    const disposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
        if (event.document === document) {
            // Auto-save after a delay when user stops typing
            setTimeout(async () => {
                try {
                    const content = document.getText();
                    const lines = content.split('\n');
                    
                    let title = prompt.title;
                    let category = prompt.category;
                    let description = prompt.description || '';
                    let promptContent = '';
                    let inContentSection = false;
                    
                    for (const line of lines) {
                        if (line.startsWith('#')) continue;
                        
                        if (line.startsWith('Title: ')) {
                            title = line.substring(7).trim();
                        } else if (line.startsWith('Category: ')) {
                            category = line.substring(10).trim();
                        } else if (line.startsWith('Description: ')) {
                            description = line.substring(13).trim();
                        } else if (line.includes('--- PROMPT CONTENT')) {
                            inContentSection = true;
                            continue;
                        } else if (inContentSection) {
                            promptContent += (promptContent ? '\n' : '') + line;
                        }
                    }

                    await promptManager.updatePrompt({
                        ...prompt,
                        title: title || prompt.title,
                        content: promptContent.trim() || prompt.content,
                        category: category || prompt.category,
                        description: description
                    });

                    promptProvider.refresh();
                    
                } catch (error) {
                    console.error('Failed to auto-update prompt:', error);
                }
            }, 2000); // Auto-save after 2 seconds of no changes
        }
    });

    // Clean up when editor is closed
    const closeDisposable = vscode.workspace.onDidCloseTextDocument((closedDoc) => {
        if (closedDoc === document) {
            disposable.dispose();
            closeDisposable.dispose();
            const successMessage = isNewPrompt 
                ? `New prompt "${prompt.title}" created successfully!`
                : `Prompt "${prompt.title}" updated successfully!`;
            vscode.window.showInformationMessage(successMessage);
        }
    });
}

// Helper function for enhanced WebView-based editing
async function editPromptWithWebView(prompt: any, promptManager: any, promptProvider: any) {
    const isNewPrompt = prompt.id === null;
    
    const panel = vscode.window.createWebviewPanel(
        'promptEditor',
        `${isNewPrompt ? '新建提示词' : `编辑提示词: ${prompt.title}`}`,
        vscode.ViewColumn.Two,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: []
        }
    );

    // Get existing categories for autocomplete
    const allPrompts = await promptManager.getAllPrompts();
    const existingCategories = [...new Set(allPrompts.map((p: any) => p.category))].filter((cat): cat is string => typeof cat === 'string');

    // HTML content for the enhanced WebView
    const webviewContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${isNewPrompt ? '新建' : '编辑'}提示词</title>
        <style>
            :root {
                --border-radius: 6px;
                --spacing-xs: 4px;
                --spacing-sm: 8px;
                --spacing-md: 16px;
                --spacing-lg: 24px;
                --spacing-xl: 32px;
            }

            * {
                box-sizing: border-box;
            }

            body {
                font-family: var(--vscode-font-family);
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
                margin: 0;
                padding: var(--spacing-lg);
                line-height: 1.6;
            }

            .header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: var(--spacing-xl);
                padding-bottom: var(--spacing-md);
                border-bottom: 1px solid var(--vscode-panel-border);
            }

            .header h1 {
                margin: 0;
                font-size: 1.5em;
                font-weight: 600;
                color: var(--vscode-foreground);
            }

            .status-bar {
                display: flex;
                align-items: center;
                gap: var(--spacing-md);
                font-size: 0.9em;
            }

            .auto-save-indicator {
                padding: var(--spacing-xs) var(--spacing-sm);
                background-color: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                border-radius: var(--border-radius);
                font-size: 12px;
                opacity: 0;
                transition: opacity 0.3s ease;
            }

            .auto-save-indicator.show {
                opacity: 1;
            }

            .word-count {
                color: var(--vscode-descriptionForeground);
                font-size: 12px;
            }

            .form-container {
                max-width: 800px;
                margin: 0 auto;
            }

            .form-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: var(--spacing-md);
                margin-bottom: var(--spacing-lg);
            }

            .form-group {
                margin-bottom: var(--spacing-lg);
            }

            .form-group.full-width {
                grid-column: 1 / -1;
            }

            label {
                display: block;
                margin-bottom: var(--spacing-xs);
                font-weight: 600;
                color: var(--vscode-input-foreground);
                font-size: 0.9em;
            }

            .label-with-hint {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .hint {
                font-size: 0.8em;
                color: var(--vscode-descriptionForeground);
                font-weight: normal;
            }

            input, textarea, select {
                width: 100%;
                padding: var(--spacing-sm) var(--spacing-md);
                border: 1px solid var(--vscode-input-border);
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border-radius: var(--border-radius);
                font-family: inherit;
                font-size: 14px;
                transition: border-color 0.2s ease, box-shadow 0.2s ease;
            }

            input:focus, textarea:focus, select:focus {
                outline: none;
                border-color: var(--vscode-focusBorder);
                box-shadow: 0 0 0 2px var(--vscode-focusBorder);
            }

            textarea {
                min-height: 300px;
                resize: vertical;
                font-family: var(--vscode-editor-font-family);
                line-height: 1.5;
            }

            .category-input-container {
                position: relative;
            }

            .toolbar {
                display: flex;
                gap: var(--spacing-sm);
                margin-bottom: var(--spacing-md);
            }

            .toolbar-button {
                padding: var(--spacing-xs) var(--spacing-sm);
                border: 1px solid var(--vscode-button-border);
                background-color: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
                border-radius: var(--border-radius);
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s ease;
                position: relative;
                overflow: hidden;
            }

            .toolbar-button:hover {
                background-color: var(--vscode-button-secondaryHoverBackground);
                transform: translateY(-1px);
            }
            
            .toolbar-button:active {
                transform: translateY(0);
                background-color: var(--vscode-button-background);
            }
            
            .toolbar-button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none;
            }
            
            .toolbar-button.inserting {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
            }

            .button-group {
                margin-top: var(--spacing-xl);
                display: flex;
                gap: var(--spacing-md);
                justify-content: flex-end;
            }

            button {
                padding: var(--spacing-sm) var(--spacing-lg);
                border: none;
                border-radius: var(--border-radius);
                cursor: pointer;
                font-size: 14px;
                font-family: inherit;
                font-weight: 500;
                transition: all 0.2s ease;
                min-width: 80px;
            }

            .primary {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
            }

            .primary:hover {
                background-color: var(--vscode-button-hoverBackground);
                transform: translateY(-1px);
            }

            .primary:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }

            .secondary {
                background-color: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
                border: 1px solid var(--vscode-button-border);
            }

            .secondary:hover {
                background-color: var(--vscode-button-secondaryHoverBackground);
            }

            .preview {
                background-color: var(--vscode-textBlockQuote-background);
                border-left: 4px solid var(--vscode-textBlockQuote-border);
                padding: var(--spacing-md);
                margin-top: var(--spacing-md);
                border-radius: 0 var(--border-radius) var(--border-radius) 0;
                white-space: pre-wrap;
                font-family: var(--vscode-editor-font-family);
                max-height: 200px;
                overflow-y: auto;
            }

            .error-message {
                background-color: var(--vscode-inputValidation-errorBackground);
                color: var(--vscode-inputValidation-errorForeground);
                border: 1px solid var(--vscode-inputValidation-errorBorder);
                padding: var(--spacing-sm) var(--spacing-md);
                border-radius: var(--border-radius);
                margin-top: var(--spacing-xs);
                font-size: 0.9em;
                display: none;
            }

            .shortcut-hint {
                position: fixed;
                bottom: var(--spacing-md);
                right: var(--spacing-md);
                background-color: var(--vscode-notifications-background);
                color: var(--vscode-notifications-foreground);
                padding: var(--spacing-sm) var(--spacing-md);
                border-radius: var(--border-radius);
                font-size: 0.8em;
                opacity: 0.7;
                border: 1px solid var(--vscode-notifications-border);
            }

            .variable-help {
                margin-bottom: var(--spacing-md);
                border: 1px solid var(--vscode-panel-border);
                border-radius: var(--border-radius);
                background-color: var(--vscode-editor-background);
            }

            .variable-help-header {
                padding: var(--spacing-sm) var(--spacing-md);
                background-color: var(--vscode-list-hoverBackground);
                border-bottom: 1px solid var(--vscode-panel-border);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 0.9em;
                font-weight: 500;
            }

            .variable-help-header:hover {
                background-color: var(--vscode-list-activeSelectionBackground);
            }

            .variable-help-content {
                padding: var(--spacing-md);
                display: none;
                font-size: 0.85em;
                line-height: 1.5;
            }

            .variable-help-content.expanded {
                display: block;
            }

            .help-section {
                margin-bottom: var(--spacing-md);
            }

            .help-section h4 {
                margin: 0 0 var(--spacing-xs) 0;
                color: var(--vscode-textLink-foreground);
                font-size: 0.9em;
            }

            .help-examples {
                background-color: var(--vscode-textCodeBlock-background);
                padding: var(--spacing-sm);
                border-radius: var(--border-radius);
                margin: var(--spacing-xs) 0;
                font-family: var(--vscode-editor-font-family);
                white-space: pre-wrap;
                border-left: 3px solid var(--vscode-textLink-foreground);
            }

            .variable-list {
                list-style: none;
                padding: 0;
                margin: var(--spacing-xs) 0;
            }

            .variable-list li {
                padding: var(--spacing-xs) 0;
                border-bottom: 1px solid var(--vscode-panel-border);
            }

            .variable-list li:last-child {
                border-bottom: none;
            }

            .variable-name {
                font-family: var(--vscode-editor-font-family);
                color: var(--vscode-textLink-foreground);
                font-weight: 500;
            }

            .variable-desc {
                color: var(--vscode-descriptionForeground);
                margin-left: var(--spacing-md);
            }

            .chevron {
                transition: transform 0.2s ease;
            }

            .chevron.expanded {
                transform: rotate(90deg);
            }

            @media (max-width: 600px) {
                .form-row {
                    grid-template-columns: 1fr;
                }
                
                .header {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: var(--spacing-md);
                }
                
                .button-group {
                    flex-direction: column;
                }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>${isNewPrompt ? '🆕 新建提示词' : '✏️ 编辑提示词'}</h1>
            <div class="status-bar">
                <div class="auto-save-indicator" id="autoSaveIndicator">✅ 已自动保存</div>
                <div class="word-count" id="wordCount">0 字符</div>
            </div>
        </div>

        <div class="form-container">
            <form id="promptForm">
                <div class="form-row">
                    <div class="form-group">
                        <label for="title">标题 *</label>
                        <input type="text" id="title" name="title" value="${prompt.title.replace(/"/g, '&quot;')}" required placeholder="输入提示词标题">
                        <div class="error-message" id="titleError"></div>
                    </div>
                    
                    <div class="form-group">
                        <div class="label-with-hint">
                            <label for="category">分类 *</label>
                            <span class="hint">选择分类或新增</span>
                        </div>
                        <div class="category-input-container">
                            <select id="categorySelect" name="categorySelect" required>
                                <option value="">请选择分类...</option>
                                ${existingCategories.map(cat => 
                                    `<option value="${cat.replace(/"/g, '&quot;')}" ${cat === prompt.category ? 'selected' : ''}>${cat}</option>`
                                ).join('')}
                                <option value="__NEW_CATEGORY__">+ 新增分类</option>
                            </select>
                            <input type="text" id="newCategoryInput" name="newCategoryInput" placeholder="输入新分类名称" style="display: none; margin-top: 8px;">
                            <input type="hidden" id="category" name="category" value="${prompt.category.replace(/"/g, '&quot;')}">
                        </div>
                        <div class="error-message" id="categoryError"></div>
                    </div>
                </div>

                <div class="form-group">
                    <label for="description">描述</label>
                    <input type="text" id="description" name="description" value="${(prompt.description || '').replace(/"/g, '&quot;')}" placeholder="简短描述这个提示词的用途">
                </div>
                
                <div class="form-group full-width">
                    <div class="label-with-hint">
                        <label for="content">提示词内容 *</label>
                        <span class="hint">支持 Markdown 格式</span>
                    </div>
                    
                    <div class="variable-help">
                        <div class="variable-help-header" onclick="toggleVariableHelp()">
                            <span>📖 变量使用说明与示例</span>
                            <span class="chevron" id="helpChevron">▶</span>
                        </div>
                        <div class="variable-help-content" id="variableHelpContent">
                            <div class="help-section">
                                <h4>🔧 系统变量（自动可用）</h4>
                                <ul class="variable-list">
                                    <li><span class="variable-name">{{selection}}</span><span class="variable-desc">当前选中的文本</span></li>
                                    <li><span class="variable-name">{{filename}}</span><span class="variable-desc">当前文件名</span></li>
                                    <li><span class="variable-name">{{filepath}}</span><span class="variable-desc">当前文件路径</span></li>
                                </ul>
                            </div>
                            
                            <div class="help-section">
                                <h4>💡 使用示例</h4>
                                <div class="help-examples"># 代码分析专家

你是一位资深的代码审查专家，请帮我分析以下代码：

## 代码内容
{{selection}}

## 文件信息
- 文件名：{{filename}}
- 文件路径：{{filepath}}

## 分析要求
请从以下角度进行深入分析：
1. 代码质量和规范性
2. 性能优化建议
3. 安全性检查
4. 可维护性评估

请提供具体的改进建议和最佳实践。</div>
                            </div>
                            
                            <div class="help-section">
                                <h4>🎯 自定义变量示例</h4>
                                <div class="help-examples"># {{role}}专业助手

你是一位专业的{{role}}，拥有丰富的实战经验和深厚的理论基础。

## 任务目标
{{task}}

## 分析内容
{{selection}}

## 上下文信息
- 当前文件：{{filename}}
- 文件路径：{{filepath}}

## 输出要求
- 使用语言：{{language}}
- 详细程度：{{detail_level}}
- 目标受众：{{audience}}
- 输出格式：{{output_format}}

## 特殊要求
{{special_requirements}}

请基于以上信息，提供专业、准确、实用的解决方案。</div>
                                <p style="margin-top: var(--spacing-xs); color: var(--vscode-descriptionForeground);">
                                    💡 提示：保存提示词后，可以在变量管理中为 {{role}}、{{task}} 等添加自定义变量定义
                                </p>
                            </div>
                            
                            <div class="help-section">
                                <h4>📝 更多模板示例</h4>
                                <div class="help-examples"># 🔍 代码审查专家模板
你是一位资深的代码审查专家，请对以下代码进行全面审查：

## 待审查代码
{{selection}}

## 文件信息
- 文件名：{{filename}}
- 文件路径：{{filepath}}

## 审查维度
1. **代码质量**：命名规范、代码结构、注释完整性
2. **性能优化**：算法效率、内存使用、执行速度
3. **安全性检查**：潜在漏洞、输入验证、权限控制
4. **可维护性**：代码复用、模块化程度、扩展性
5. **最佳实践**：设计模式、行业标准、团队规范

## 输出要求
- 指出具体问题并提供改进建议
- 给出优化后的代码示例
- 评估风险等级（高/中/低）
- 提供学习资源推荐

---

# 🌐 多语言翻译助手模板  
你是一位专业的{{source_language}}-{{target_language}}翻译专家。

## 翻译内容
{{text_to_translate}}

## 翻译要求
- 原文语言：{{source_language}}
- 目标语言：{{target_language}}
- 应用场景：{{context}}
- 语言风格：{{style}}

## 质量标准
- 准确传达原意，避免遗漏或曲解
- 符合目标语言的表达习惯
- 适应具体使用场景和受众
- 保持专业术语的准确性

请提供高质量的翻译结果。

---

# 🎓 个性化学习助手模板
你是一位经验丰富的{{subject}}教育专家。

## 学习目标
我想深入理解：{{concept}}

## 学习者背景
- 当前水平：{{current_level}}
- 相关经验：{{background}}
- 学习目的：{{learning_goal}}

## 教学要求
- 解释深度：{{depth}}
- 教学风格：{{explanation_style}}
- 举例偏好：{{example_preference}}

## 期望输出
1. 概念的清晰定义和核心要点
2. 通俗易懂的类比解释
3. 实际应用场景和案例
4. 进阶学习路径建议
5. 相关资源推荐

请根据我的背景定制学习内容。</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="toolbar">
                        <button type="button" class="toolbar-button">👤 角色设定</button>
                        <button type="button" class="toolbar-button">📋 任务描述</button>
                        <button type="button" class="toolbar-button">💡 示例</button>
                        <button type="button" class="toolbar-button">⚠️ 约束条件</button>
                        <button type="button" class="toolbar-button">🔧 变量模板</button>
                        <button type="button" class="toolbar-button">👁️ 预览</button>
                    </div>
                    <textarea id="content" name="content" required placeholder="输入你的提示词内容...">${prompt.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                    <div class="preview" id="preview" style="display: none;"></div>
                    <div class="error-message" id="contentError"></div>
                </div>
                
                <div class="button-group">
                    <button type="button" class="secondary" onclick="closeEditor()">取消</button>
                    <button type="button" class="primary" id="saveButton" onclick="savePrompt()">
                        ${isNewPrompt ? '创建提示词' : '保存修改'}
                    </button>
                </div>
            </form>
        </div>

        <div class="shortcut-hint">
            💡 Ctrl+S 快速保存 | Ctrl+Enter 保存并关闭
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            let autoSaveTimeout;
            let hasUnsavedChanges = false;
            let isPreviewMode = false;
            
            const existingCategories = ${JSON.stringify(existingCategories)};

            // Initialize
            document.addEventListener('DOMContentLoaded', () => {
                setupAutoSave();
                setupCategoryDropdown();
                setupKeyboardShortcuts();
                setupValidation();
                setupToolbarButtons();
                updateWordCount();
                
                // Focus on title for new prompts, content for existing
                const focusElement = ${isNewPrompt} ? 
                    document.getElementById('title') : 
                    document.getElementById('content');
                focusElement?.focus();
            });

            // Auto-save functionality
            function setupAutoSave() {
                const inputs = document.querySelectorAll('input, textarea, select');
                inputs.forEach(input => {
                    const eventType = input.tagName.toLowerCase() === 'select' ? 'change' : 'input';
                    input.addEventListener(eventType, () => {
                        hasUnsavedChanges = true;
                        clearTimeout(autoSaveTimeout);
                        autoSaveTimeout = setTimeout(autoSave, 3000);
                        
                        if (input.id === 'content') {
                            updateWordCount();
                            if (isPreviewMode) {
                                updatePreview();
                            }
                        }
                    });
                });
            }

            function autoSave() {
                if (!hasUnsavedChanges || !isFormValid()) return;
                
                const formData = getFormData();
                vscode.postMessage({
                    command: 'autoSave',
                    data: formData
                });
                
                showAutoSaveIndicator();
                hasUnsavedChanges = false;
            }

            function showAutoSaveIndicator() {
                const indicator = document.getElementById('autoSaveIndicator');
                indicator.classList.add('show');
                setTimeout(() => {
                    indicator.classList.remove('show');
                }, 2000);
            }

            function updateWordCount() {
                const content = document.getElementById('content').value;
                const count = content.length;
                document.getElementById('wordCount').textContent = count + ' 字符';
            }

            // Category dropdown handling
            function setupCategoryDropdown() {
                const categorySelect = document.getElementById('categorySelect');
                const newCategoryInput = document.getElementById('newCategoryInput');
                const hiddenCategoryInput = document.getElementById('category');

                categorySelect.addEventListener('change', (e) => {
                    const selectedValue = e.target.value;
                    
                    if (selectedValue === '__NEW_CATEGORY__') {
                        // Show new category input
                        newCategoryInput.style.display = 'block';
                        newCategoryInput.focus();
                        hiddenCategoryInput.value = '';
                    } else {
                        // Hide new category input and set selected category
                        newCategoryInput.style.display = 'none';
                        newCategoryInput.value = '';
                        hiddenCategoryInput.value = selectedValue;
                    }
                    
                    hasUnsavedChanges = true;
                });

                newCategoryInput.addEventListener('input', (e) => {
                    const newCategoryValue = e.target.value.trim();
                    hiddenCategoryInput.value = newCategoryValue;
                    hasUnsavedChanges = true;
                });

                newCategoryInput.addEventListener('blur', () => {
                    const newCategoryValue = newCategoryInput.value.trim();
                    if (newCategoryValue) {
                        // If user entered a new category, keep the input visible
                        hiddenCategoryInput.value = newCategoryValue;
                    } else {
                        // If input is empty, reset to default state
                        categorySelect.value = '';
                        newCategoryInput.style.display = 'none';
                        hiddenCategoryInput.value = '';
                    }
                });
            }

            // Keyboard shortcuts
            function setupKeyboardShortcuts() {
                document.addEventListener('keydown', (e) => {
                    if (e.ctrlKey || e.metaKey) {
                        if (e.key === 's') {
                            e.preventDefault();
                            savePrompt();
                        } else if (e.key === 'Enter') {
                            e.preventDefault();
                            saveAndClose();
                        }
                    }
                });
            }

            // Form validation
            function setupValidation() {
                const title = document.getElementById('title');
                const categorySelect = document.getElementById('categorySelect');
                const newCategoryInput = document.getElementById('newCategoryInput');
                const content = document.getElementById('content');

                title.addEventListener('blur', () => validateField('title'));
                categorySelect.addEventListener('change', () => validateField('category'));
                newCategoryInput.addEventListener('blur', () => validateField('category'));
                content.addEventListener('blur', () => validateField('content'));
            }

            // Toolbar button setup with proper event handling
            function setupToolbarButtons() {
                // Remove inline onclick handlers and add proper event listeners
                const toolbarButtons = document.querySelectorAll('.toolbar-button');
                toolbarButtons.forEach(button => {
                    // Remove any existing onclick handlers
                    button.removeAttribute('onclick');
                    
                    // Add proper event listener with enhanced feedback
                    button.addEventListener('click', function(event) {
                        event.preventDefault();
                        event.stopPropagation();
                        
                        // Prevent double-click by temporarily disabling button
                        if (this.disabled) {
                            return;
                        }
                        
                        const buttonText = this.textContent.trim();
                        
                        // Add visual feedback for template insertion
                        if (!buttonText.includes('预览')) {
                            this.disabled = true;
                            this.classList.add('inserting');
                            
                            // Re-enable after a short delay
                            setTimeout(() => {
                                this.disabled = false;
                                this.classList.remove('inserting');
                            }, 500);
                        }
                        
                        // Route to appropriate function
                        try {
                            if (buttonText.includes('角色设定')) {
                                insertTemplate('role');
                            } else if (buttonText.includes('任务描述')) {
                                insertTemplate('task');
                            } else if (buttonText.includes('示例')) {
                                insertTemplate('example');
                            } else if (buttonText.includes('约束条件')) {
                                insertTemplate('constraint');
                            } else if (buttonText.includes('变量模板')) {
                                insertTemplate('variable');
                            } else if (buttonText.includes('预览')) {
                                togglePreview();
                            }
                        } catch (error) {
                            console.error('Error handling toolbar button click:', error);
                            // Re-enable button on error
                            this.disabled = false;
                            this.classList.remove('inserting');
                        }
                    });
                });
            }

            function validateField(fieldName) {
                let field, value;
                
                if (fieldName === 'category') {
                    // For category, check the hidden input value
                    field = document.getElementById('category');
                    value = field.value.trim();
                } else {
                    field = document.getElementById(fieldName);
                    value = field.value.trim();
                }
                
                const errorElement = document.getElementById(fieldName + 'Error');
                let errorMessage = '';
                
                if (!value) {
                    errorMessage = fieldName === 'title' ? '请输入标题' :
                                  fieldName === 'category' ? '请选择分类' :
                                  fieldName === 'content' ? '请输入内容' : '';
                } else if (fieldName === 'title' && value.length > 100) {
                    errorMessage = '标题不能超过100个字符';
                }

                if (errorMessage) {
                    errorElement.textContent = errorMessage;
                    errorElement.style.display = 'block';
                    
                    // Apply error styling to the appropriate visible field
                    if (fieldName === 'category') {
                        const categorySelect = document.getElementById('categorySelect');
                        const newCategoryInput = document.getElementById('newCategoryInput');
                        if (newCategoryInput.style.display !== 'none') {
                            newCategoryInput.style.borderColor = 'var(--vscode-inputValidation-errorBorder)';
                        } else {
                            categorySelect.style.borderColor = 'var(--vscode-inputValidation-errorBorder)';
                        }
                    } else {
                        field.style.borderColor = 'var(--vscode-inputValidation-errorBorder)';
                    }
                    return false;
                } else {
                    errorElement.style.display = 'none';
                    
                    // Remove error styling from the appropriate visible field
                    if (fieldName === 'category') {
                        const categorySelect = document.getElementById('categorySelect');
                        const newCategoryInput = document.getElementById('newCategoryInput');
                        categorySelect.style.borderColor = 'var(--vscode-input-border)';
                        newCategoryInput.style.borderColor = 'var(--vscode-input-border)';
                    } else {
                        field.style.borderColor = 'var(--vscode-input-border)';
                    }
                    return true;
                }
            }

            function isFormValid() {
                return validateField('title') && 
                       validateField('category') && 
                       validateField('content');
            }

            // Template insertion with debounce protection
            let lastTemplateInsertTime = 0;
            const TEMPLATE_INSERT_DEBOUNCE = 300; // 300ms debounce
            
            function insertTemplate(type) {
                // Debounce protection - prevent rapid clicks
                const now = Date.now();
                if (now - lastTemplateInsertTime < TEMPLATE_INSERT_DEBOUNCE) {
                    console.log('Template insertion debounced');
                    return;
                }
                lastTemplateInsertTime = now;
                
                const content = document.getElementById('content');
                if (!content) {
                    console.error('Content element not found');
                    return;
                }
                
                const templates = {
                    role: '# 角色设定\\n你是一位经验丰富的软件开发专家，具有以下特质：\\n- 拥有10+年的全栈开发经验\\n- 精通多种编程语言和框架\\n- 擅长代码架构设计和性能优化\\n- 注重代码质量、可维护性和最佳实践\\n- 能够用简洁明了的方式解释复杂的技术概念\\n\\n',
                    task: '# 任务描述\\n请帮我完成以下任务：\\n\\n## 主要目标\\n[描述你希望AI完成的核心任务]\\n\\n## 具体要求\\n1. [具体要求1]\\n2. [具体要求2]\\n3. [具体要求3]\\n\\n## 期望输出\\n[描述你期望的输出格式和内容]\\n\\n',
                    example: '# 示例\\n\\n## 输入示例\\n\\\`\\\`\\\`\\n[这里放置输入示例，可以是代码、文本或其他格式]\\n\\\`\\\`\\\`\\n\\n## 期望输出\\n\\\`\\\`\\\`\\n[这里放置期望的输出示例，展示理想的回答格式]\\n\\\`\\\`\\\`\\n\\n## 说明\\n- 输入特点：[解释输入的特点]\\n- 输出要求：[解释输出的要求]\\n- 处理重点：[说明处理的重点]\\n\\n',
                    constraint: '# 约束条件\\n\\n## 输出格式要求\\n- 使用中文回答\\n- 保持专业和准确的语调\\n- 提供具体可操作的建议\\n\\n## 内容要求\\n- 确保信息的准确性和时效性\\n- 避免过于复杂的技术术语\\n- 提供实际可行的解决方案\\n\\n## 处理原则\\n- 优先考虑代码的可读性和维护性\\n- 遵循业界最佳实践和标准\\n- 注意安全性和性能影响\\n\\n',
                    variable: '你是一个{{role}}专家，请帮我{{task}}。\\n\\n## 分析目标\\n{{selection}}\\n\\n## 文件信息\\n- 文件名：{{filename}}\\n- 文件路径：{{filepath}}\\n\\n## 处理要求\\n- 输出语言：{{language}}\\n- 详细程度：{{detail_level}}\\n- 目标受众：{{audience}}\\n\\n请按照以上要求完成任务，并提供具体可操作的建议。'
                };

                const template = templates[type];
                if (!template) {
                    console.error('Template not found:', type);
                    return;
                }

                try {
                    // Store current selection/cursor position
                    const cursorPos = content.selectionStart || 0;
                    const selectionEnd = content.selectionEnd || cursorPos;
                    
                    // Get text before and after cursor/selection
                    const textBefore = content.value.substring(0, cursorPos);
                    const textAfter = content.value.substring(selectionEnd);
                    
                    // Insert template at cursor position (replacing any selected text)
                    const newContent = textBefore + template + textAfter;
                    content.value = newContent;
                    
                    // Set cursor position after the inserted template
                    const newCursorPos = cursorPos + template.length;
                    content.focus();
                    content.setSelectionRange(newCursorPos, newCursorPos);
                    
                    // Trigger change events
                    const event = new Event('input', { bubbles: true });
                    content.dispatchEvent(event);
                    
                    hasUnsavedChanges = true;
                    updateWordCount();
                    
                    console.log('Template inserted:', type, 'at position', cursorPos);
                } catch (error) {
                    console.error('Error inserting template:', error);
                }
            }

            // Toggle variable help section
            function toggleVariableHelp() {
                const content = document.getElementById('variableHelpContent');
                const chevron = document.getElementById('helpChevron');
                
                if (content.classList.contains('expanded')) {
                    content.classList.remove('expanded');
                    chevron.classList.remove('expanded');
                    chevron.textContent = '▶';
                } else {
                    content.classList.add('expanded');
                    chevron.classList.add('expanded');
                    chevron.textContent = '▼';
                }
            }

            // Preview functionality
            function togglePreview() {
                const preview = document.getElementById('preview');
                const content = document.getElementById('content');
                
                isPreviewMode = !isPreviewMode;
                
                if (isPreviewMode) {
                    updatePreview();
                    preview.style.display = 'block';
                    content.style.height = '150px';
                } else {
                    preview.style.display = 'none';
                    content.style.height = '300px';
                }
            }

            function updatePreview() {
                const content = document.getElementById('content').value;
                const preview = document.getElementById('preview');
                preview.textContent = content || '(预览内容为空)';
            }

            function getFormData() {
                return {
                    title: document.getElementById('title').value.trim(),
                    category: document.getElementById('category').value.trim(),
                    description: document.getElementById('description').value.trim(),
                    content: document.getElementById('content').value.trim()
                };
            }

            function savePrompt() {
                if (!isFormValid()) {
                    vscode.postMessage({
                        command: 'showError',
                        message: '请修正表单中的错误后再保存'
                    });
                    return;
                }

                const saveButton = document.getElementById('saveButton');
                saveButton.disabled = true;
                saveButton.textContent = '保存中...';

                const formData = getFormData();
                vscode.postMessage({
                    command: 'save',
                    data: formData
                });
            }

            function saveAndClose() {
                if (isFormValid()) {
                    const formData = getFormData();
                    vscode.postMessage({
                        command: 'saveAndClose',
                        data: formData
                    });
                }
            }

            function closeEditor() {
                if (hasUnsavedChanges) {
                    if (confirm('有未保存的修改，确定要关闭吗？')) {
                        vscode.postMessage({ command: 'close' });
                    }
                } else {
                    vscode.postMessage({ command: 'close' });
                }
            }

            // Handle messages from extension
            window.addEventListener('message', event => {
                const message = event.data;
                const saveButton = document.getElementById('saveButton');
                
                switch (message.command) {
                    case 'saved':
                        hasUnsavedChanges = false;
                        showAutoSaveIndicator();
                        saveButton.disabled = false;
                        saveButton.textContent = '${isNewPrompt ? '创建提示词' : '保存修改'}';
                        break;
                    case 'error':
                        saveButton.disabled = false;
                        saveButton.textContent = '${isNewPrompt ? '创建提示词' : '保存修改'}';
                        break;
                }
            });
        </script>
    </body>
    </html>`;

    panel.webview.html = webviewContent;

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
            case 'save':
            case 'saveAndClose':
            case 'autoSave':
                try {
                    // Validate required fields
                    if (!message.data.title?.trim() || !message.data.content?.trim() || !message.data.category?.trim()) {
                        panel.webview.postMessage({ command: 'error' });
                        vscode.window.showErrorMessage('请填写标题、分类和内容');
                        return;
                    }

                    if (isNewPrompt) {
                        // 新建提示词
                        await promptManager.createPrompt({
                            title: message.data.title.trim(),
                            content: message.data.content.trim(),
                            category: message.data.category.trim(),
                            description: message.data.description?.trim() || '',
                            tags: [],
                            variables: []
                        });
                    } else {
                        // 更新现有提示词
                        await promptManager.updatePrompt({
                            ...prompt,
                            title: message.data.title.trim(),
                            content: message.data.content.trim(),
                            category: message.data.category.trim(),
                            description: message.data.description?.trim() || ''
                        });
                    }

                    promptProvider.refresh();
                    
                    // Send confirmation back to webview
                    panel.webview.postMessage({ command: 'saved' });
                    
                    if (message.command === 'save' || message.command === 'saveAndClose') {
                        const actionText = isNewPrompt ? '创建' : '保存';
                        vscode.window.showInformationMessage(
                            `✅ 提示词 "${message.data.title.trim()}" ${actionText}成功！`
                        );
                        
                        if (message.command === 'saveAndClose') {
                            setTimeout(() => panel.dispose(), 500);
                        }
                    }
                } catch (error) {
                    panel.webview.postMessage({ command: 'error' });
                    vscode.window.showErrorMessage(`保存失败: ${error}`);
                }
                break;
                
            case 'close':
                panel.dispose();
                break;
                
            case 'showError':
                vscode.window.showErrorMessage(message.message);
                break;
        }
    });

    return panel;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Cursor Prompt Manager is now active!');

    // Initialize the prompt manager
    const promptManager = new PromptManager(context);
    
    // Register the tree data provider
    const promptProvider = new PromptProvider(promptManager);
    const treeDataProvider = vscode.window.registerTreeDataProvider('promptManager', promptProvider);
    
    // 确保资源在扩展停用时被清理
    context.subscriptions.push(treeDataProvider);
    context.subscriptions.push({ dispose: () => promptManager.dispose() });
    context.subscriptions.push({ dispose: () => promptProvider.dispose() });
    
    // Debug: Check if prompts are loaded
    setTimeout(async () => {
        const prompts = await promptManager.getAllPrompts();
        console.log('Loaded prompts:', prompts.length);
        const categories = await promptManager.getCategories();
        console.log('Available categories:', categories);
    }, 1000);


    // Register commands
    const commands = [
        vscode.commands.registerCommand('promptManager.openPanel', () => {
            vscode.commands.executeCommand('workbench.view.extension.prompt-manager');
        }),

        vscode.commands.registerCommand('promptManager.selectPrompt', async () => {
            const prompts = await promptManager.getAllPrompts();
            if (prompts.length === 0) {
                vscode.window.showInformationMessage('No prompts available. Create some prompts first!');
                return;
            }

            const items = prompts.map(prompt => ({
                label: prompt.title,
                description: prompt.category,
                detail: prompt.description,
                prompt: prompt
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a prompt to load into chat'
            });

            if (selected) {
                // Show options first without processing variables yet
                const action = await vscode.window.showInformationMessage(
                    `Selected prompt: "${selected.prompt.title}"`,
                    'Paste in Chat',
                    'Insert to Editor'
                );
                
                if (action === 'Paste in Chat') {
                    try {
                        const editor = vscode.window.activeTextEditor;
                        let processedContent = selected.prompt.content;
                        let variableCount = 0;
                        
                        console.log('🔧 Paste in Chat - Starting with prompt:', {
                            title: selected.prompt.title,
                            originalContent: selected.prompt.content,
                            hasEditor: !!editor
                        });
                        
                        if (editor) {
                            console.log('🔧 Paste in Chat - Editor info:', {
                                uri: editor.document.uri.toString(),
                                selection: editor.selection,
                                hasSelection: !editor.selection.isEmpty
                            });
                            
                            // Always process system variables first
                            console.log('🔧 Paste in Chat - About to process system variables...');
                            processedContent = promptManager.processSystemVariables(selected.prompt.content, editor);
                            console.log('🔧 Paste in Chat - After system variables:', JSON.stringify(processedContent));
                            
                            // Count system variables that were processed
                            const systemVariables = ['{{selection}}', '{{filename}}', '{{filepath}}'];
                            for (const sysVar of systemVariables) {
                                if (selected.prompt.content.includes(sysVar)) {
                                    variableCount++;
                                }
                            }
                            console.log('🔧 Paste in Chat - System variable count:', variableCount);
                            
                            // Process custom variables if any exist
                            const hasCustomVariables = selected.prompt.variables && selected.prompt.variables.length > 0;
                            console.log('🔧 Paste in Chat - Has custom variables:', hasCustomVariables);
                            if (hasCustomVariables) {
                                console.log('🔧 Paste in Chat - Processing custom variables:', selected.prompt.variables);
                                processedContent = await promptManager.processVariablesWithWebview(processedContent, selected.prompt.variables, editor);
                                console.log('🔧 Paste in Chat - After custom variables:', JSON.stringify(processedContent));
                                variableCount += selected.prompt.variables.length;
                            }
                        } else {
                            console.log('🔧 Paste in Chat - No active editor, using original content');
                        }
                        
                        console.log('🔧 Paste in Chat - Final processed content:', JSON.stringify(processedContent));
                        console.log('🔧 Paste in Chat - Total variables processed:', variableCount);
                        
                        // Copy processed content to clipboard
                        await vscode.env.clipboard.writeText(processedContent);
                        console.log('🔧 Paste in Chat - Content copied to clipboard successfully');
                        
                        // Try different chat commands in order of preference
                        const chatCommands = [
                            'workbench.action.chat.open',
                            'workbench.panel.chat.view.copilot.focus', 
                            'workbench.action.chat.openInSidebar',
                            'workbench.view.extension.github-copilot-chat',
                            'cursor.openChat',
                            'chat.open'
                        ];
                        
                        let chatOpened = false;
                        for (const command of chatCommands) {
                            try {
                                await vscode.commands.executeCommand(command);
                                console.log(`🔧 Paste in Chat - Successfully opened chat with command: ${command}`);
                                chatOpened = true;
                                break;
                            } catch (cmdError) {
                                console.log(`🔧 Paste in Chat - Command '${command}' not available`);
                            }
                        }
                        
                        const variableInfo = variableCount > 0 ? ` (已处理 ${variableCount} 个变量)` : '';
                        if (chatOpened) {
                            vscode.window.showInformationMessage(`Press Cmd+V to paste in chat${variableInfo}`);
                        } else {
                            vscode.window.showInformationMessage(`Content copied to clipboard! Open chat manually and paste (Cmd+V)${variableInfo}`);
                        }
                        console.log('🔧 Paste in Chat - Completed successfully');
                    } catch (error) {
                        console.error('🚨 Paste in Chat - Error occurred:', error);
                        // Fallback: copy original content
                        await vscode.env.clipboard.writeText(selected.prompt.content);
                        vscode.window.showInformationMessage('Please open chat and paste the prompt (Cmd+V)');
                    }
                } else if (action === 'Insert to Editor') {
                    try {
                        let editor = vscode.window.activeTextEditor;
                        if (!editor) {
                            const document = await vscode.workspace.openTextDocument({
                                content: '',
                                language: 'plaintext'
                            });
                            editor = await vscode.window.showTextDocument(document);
                        }
                        
                        // Count variables that will be processed
                        let variableCount = 0;
                        const systemVariables = ['{{selection}}', '{{filename}}', '{{filepath}}'];
                        for (const sysVar of systemVariables) {
                            if (selected.prompt.content.includes(sysVar)) {
                                variableCount++;
                            }
                        }
                        if (selected.prompt.variables && selected.prompt.variables.length > 0) {
                            variableCount += selected.prompt.variables.length;
                        }
                        
                        // Process variables in real-time with the target editor
                        await promptManager.insertPrompt(selected.prompt, editor);
                        
                        // Show success message with variable info
                        const variableInfo = variableCount > 0 ? ` (已处理 ${variableCount} 个变量)` : '';
                        vscode.window.showInformationMessage(`Prompt "${selected.prompt.title}" inserted into editor${variableInfo}`);
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                        vscode.window.showErrorMessage(`插入提示词失败: ${errorMessage}`);
                    }
                }
            }
        }),

        vscode.commands.registerCommand('promptManager.insertSpecificPrompt', async (prompt) => {
            try {
                // 验证参数
                if (!prompt) {
                    vscode.window.showErrorMessage('No prompt data provided');
                    return;
                }

                if (!prompt.content) {
                    vscode.window.showErrorMessage('Prompt content is empty');
                    return;
                }

                if (!prompt.title) {
                    vscode.window.showErrorMessage('Prompt title is missing');
                    return;
                }

                // 获取当前编辑器，用于处理所有变量
                let editor = vscode.window.activeTextEditor;
                if (!editor) {
                    const document = await vscode.workspace.openTextDocument({
                        content: '',
                        language: 'plaintext'
                    });
                    editor = await vscode.window.showTextDocument(document);
                }

                console.log('🔧 insertSpecificPrompt - Starting with prompt:', {
                    title: prompt.title,
                    originalContent: prompt.content,
                    hasCustomVariables: !!(prompt.variables && prompt.variables.length > 0),
                    hasEditor: !!editor
                });

                // 先处理系统变量（{{filename}}, {{selection}}, {{filepath}}）
                let processedContent = promptManager.processSystemVariables(prompt.content, editor);
                console.log('🔧 insertSpecificPrompt - After system variables:', processedContent);

                // 检查是否包含自定义变量
                const hasCustomVariables = prompt.variables && prompt.variables.length > 0;
                let variableCount = 0;

                // 如果包含自定义变量，再处理自定义变量
                if (hasCustomVariables) {
                    console.log('🔧 insertSpecificPrompt - Processing custom variables:', prompt.variables);
                    processedContent = await promptManager.processVariablesWithWebview(processedContent, prompt.variables, editor);
                    variableCount = prompt.variables.length;
                    console.log('🔧 insertSpecificPrompt - After custom variables:', processedContent);
                } else {
                    console.log('🔧 insertSpecificPrompt - No custom variables to process');
                }

                console.log('🔧 insertSpecificPrompt - Final processed content:', processedContent);

                // Copy processed content to clipboard
                await vscode.env.clipboard.writeText(processedContent);
                
                // 根据是否有变量显示不同的消息
                const totalVariableCount = variableCount + (processedContent !== prompt.content ? 1 : 0); // 系统变量可能也有
                const variableInfo = totalVariableCount > 0 ? ` (已处理 ${totalVariableCount} 个变量)` : '';
                const action = await vscode.window.showInformationMessage(
                    `提示词 "${prompt.title}" 已复制到剪贴板${variableInfo}`,
                    '粘贴到聊天',
                    '插入到编辑器'
                );
                
                if (action === '粘贴到聊天') {
                    // Try different chat commands in order of preference
                    const chatCommands = [
                        'workbench.action.chat.open',
                        'workbench.panel.chat.view.copilot.focus', 
                        'workbench.action.chat.openInSidebar',
                        'workbench.view.extension.github-copilot-chat',
                        'cursor.openChat',
                        'chat.open'
                    ];
                    
                    let chatOpened = false;
                    for (const command of chatCommands) {
                        try {
                            await vscode.commands.executeCommand(command);
                            console.log(`🔧 insertSpecificPrompt - Successfully opened chat with command: ${command}`);
                            chatOpened = true;
                            break;
                        } catch (cmdError) {
                            console.log(`🔧 insertSpecificPrompt - Command '${command}' not available`);
                        }
                    }
                    
                    if (chatOpened) {
                        vscode.window.showInformationMessage('按 Cmd+V 粘贴到聊天窗口');
                    } else {
                        vscode.window.showInformationMessage('请打开聊天窗口并粘贴提示词 (Cmd+V)');
                    }
                } else if (action === '插入到编辑器') {
                    try {
                        let editor = vscode.window.activeTextEditor;
                        if (!editor) {
                            const document = await vscode.workspace.openTextDocument({
                                content: '',
                                language: 'plaintext'
                            });
                            editor = await vscode.window.showTextDocument(document);
                        }
                        
                        // 直接插入处理过的内容，不需要再次处理变量
                        const position = editor.selection.active;
                        await editor.edit(editBuilder => {
                            editBuilder.insert(position, processedContent);
                        });
                        
                        // 更新使用次数
                        prompt.usageCount++;
                        await promptManager.updatePrompt(prompt);
                        
                        vscode.window.showInformationMessage(`提示词 "${prompt.title}" 已插入到编辑器${variableInfo}`);
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                        vscode.window.showErrorMessage(`插入提示词失败: ${errorMessage}`);
                    }
                }
            } catch (error) {
                console.error('Error in insertSpecificPrompt:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`处理提示词失败: ${errorMessage}`);
            }
        }),

        vscode.commands.registerCommand('promptManager.createPrompt', async () => {
            // Create a template for new prompt without saving
            const newPromptTemplate = {
                id: null, // 标识这是新建模式
                title: '',
                content: '',
                category: '',
                description: '',
                tags: [],
                variables: []
            };

            // Directly open WebView editor in create mode
            await editPromptWithWebView(newPromptTemplate, promptManager, promptProvider);
        }),

        vscode.commands.registerCommand('promptManager.editPrompt', async (treeItem) => {
            // Extract prompt from tree item
            const prompt = treeItem?.prompt;
            if (!prompt) {
                vscode.window.showErrorMessage('未选择要编辑的提示词');
                return;
            }

            // Directly open WebView editor
            await editPromptWithWebView(prompt, promptManager, promptProvider);
        }),

        vscode.commands.registerCommand('promptManager.deletePrompt', async (treeItem) => {
            // Extract prompt from tree item
            const prompt = treeItem?.prompt;
            if (!prompt) {
                vscode.window.showErrorMessage('No prompt selected for deletion');
                return;
            }

            const result = await vscode.window.showWarningMessage(
                `Are you sure you want to delete "${prompt.title}"?`,
                'Delete',
                'Cancel'
            );

            if (result === 'Delete') {
                await promptManager.deletePrompt(prompt.id);
                promptProvider.refresh();
                vscode.window.showInformationMessage(`Prompt "${prompt.title}" deleted`);
            }
        }),

        vscode.commands.registerCommand('promptManager.importPrompts', async () => {
            const fileUri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'JSON files': ['json'],
                    'All files': ['*']
                }
            });

            if (fileUri && fileUri[0]) {
                try {
                    await promptManager.importPrompts(fileUri[0].fsPath);
                    promptProvider.refresh();
                    vscode.window.showInformationMessage('Prompts imported successfully!');
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to import prompts: ${error}`);
                }
            }
        }),

        vscode.commands.registerCommand('promptManager.exportPrompts', async () => {
            // 获取安全的默认保存路径
            const getDefaultSavePath = (): vscode.Uri => {
                // 首先尝试使用工作区根目录
                if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                    return vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, 'prompts.json');
                }
                
                // 如果没有工作区，使用用户主目录
                return vscode.Uri.file(path.join(os.homedir(), 'prompts.json'));
            };

            const fileUri = await vscode.window.showSaveDialog({
                filters: {
                    'JSON files': ['json']
                },
                defaultUri: getDefaultSavePath()
            });

            if (fileUri) {
                try {
                    await promptManager.exportPrompts(fileUri.fsPath);
                    vscode.window.showInformationMessage('Prompts exported successfully!');
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to export prompts: ${error}`);
                }
            }
        }),

        vscode.commands.registerCommand('promptManager.refreshPrompts', () => {
            promptProvider.refresh();
        }),

        vscode.commands.registerCommand('promptManager.selectAndDeletePrompt', async () => {
            const prompts = await promptManager.getAllPrompts();
            if (prompts.length === 0) {
                vscode.window.showInformationMessage('No prompts available to delete.');
                return;
            }

            const items = prompts.map(prompt => ({
                label: prompt.title,
                description: prompt.category,
                detail: prompt.description,
                prompt: prompt
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a prompt to delete'
            });

            if (selected) {
                const result = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete "${selected.prompt.title}"?`,
                    'Delete',
                    'Cancel'
                );

                if (result === 'Delete') {
                    await promptManager.deletePrompt(selected.prompt.id);
                    promptProvider.refresh();
                    vscode.window.showInformationMessage(`Prompt "${selected.prompt.title}" deleted`);
                }
            }
        }),

        // 简单的系统变量测试
        vscode.commands.registerCommand('promptManager.testSystemVariables', async () => {
            try {
                const testContent = `你是一名专业的技术文档撰写和维护人员。
你的任务是根据最新的项目源码和 README.md 文件，对文章 {{filename}} 进行更新和同步。

当前选中的代码：
{{selection}}

文件路径：{{filepath}}

这是一个测试提示词，用于验证系统变量是否能够正确替换。`;

                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage('请先打开一个文件');
                    return;
                }

                // 使用空的 variables 数组来测试自动变量识别
                const processedContent = await promptManager.processVariables(testContent, [], editor);
                
                // 复制到剪贴板
                await vscode.env.clipboard.writeText(processedContent);
                
                vscode.window.showInformationMessage('测试完成！处理后的内容已复制到剪贴板。请粘贴查看系统变量是否被正确替换。');
            } catch (error) {
                console.error('测试系统变量时出错:', error);
                vscode.window.showErrorMessage(`测试失败: ${error}`);
            }
        }),

        // 直接测试系统变量替换 - 不通过processVariables
        vscode.commands.registerCommand('promptManager.testSystemVariablesDirect', async () => {
            try {
                const testContent = `📝 系统变量测试
                
🔍 当前选中文本: {{selection}}
📁 文件名: {{filename}} 
📂 文件路径: {{filepath}}

✅ 如果看到这些变量被替换，说明功能正常工作！`;

                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage('请先打开一个文件并选中一些文本');
                    return;
                }

                console.log('🚀 开始测试直接系统变量替换');
                
                // 直接调用 processSystemVariables 方法
                const processedContent = promptManager.processSystemVariables(testContent, editor);
                
                // 复制到剪贴板
                await vscode.env.clipboard.writeText(processedContent);
                
                // 显示结果对比
                vscode.window.showInformationMessage(
                    '直接测试完成！处理后的内容已复制到剪贴板。查看开发者控制台的详细日志。',
                    '粘贴查看结果',
                    '插入到编辑器'
                ).then(action => {
                    if (action === '插入到编辑器') {
                        const position = editor.selection.active;
                        editor.edit(editBuilder => {
                            editBuilder.insert(position, '\n\n' + processedContent);
                        });
                    }
                });
                
            } catch (error) {
                console.error('🚨 直接测试系统变量时出错:', error);
                vscode.window.showErrorMessage(`直接测试失败: ${error}`);
            }
        }),

        // 强制刷新命令
        vscode.commands.registerCommand('promptManager.forceRefresh', async () => {
            try {
                await promptManager.forceSync();
                promptProvider.refresh();
                vscode.window.showInformationMessage('✅ 数据已强制刷新');
                console.log('Manual refresh completed');
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : '未知错误';
                vscode.window.showErrorMessage(`刷新失败: ${errorMessage}`);
                console.error('Manual refresh failed:', error);
            }
        }),

        vscode.commands.registerCommand('promptManager.createTestTemplate', async () => {
            const testPrompt = {
                title: '测试变量模板',
                content: `# {{title}}

## 项目信息
- 项目名称: {{projectName}}
- 开发者: {{developer}}
- 开始日期: {{startDate}}
- 优先级: {{priority}}
- 项目类型: {{projectType}}

## 描述
{{description}}

## 当前选中的代码
\`\`\`
{{selection}}
\`\`\`

## 文件信息
- 文件名: {{filename}}
- 文件路径: {{filepath}}

## 数量信息
预计工作时间: {{estimatedHours}} 小时`,
                description: '用于测试各种变量类型的模板',
                category: '测试',
                tags: ['测试', '变量'],
                variables: [
                    {
                        name: 'title',
                        type: 'text' as const,
                        description: '请输入标题',
                        placeholder: '输入标题...',
                        required: true
                    },
                    {
                        name: 'projectName',
                        type: 'text' as const,
                        description: '项目名称',
                        defaultValue: 'MyProject',
                        required: true
                    },
                    {
                        name: 'developer',
                        type: 'text' as const,
                        description: '开发者姓名',
                        placeholder: '请输入开发者姓名'
                    },
                    {
                        name: 'startDate',
                        type: 'date' as const,
                        description: '项目开始日期',
                        required: true
                    },
                    {
                        name: 'priority',
                        type: 'select' as const,
                        description: '项目优先级',
                        options: ['高', '中', '低'],
                        defaultValue: '中',
                        required: true
                    },
                    {
                        name: 'projectType',
                        type: 'select' as const,
                        description: '项目类型',
                        options: ['Web应用', '移动应用', '桌面应用', '库/框架', '其他'],
                        required: true
                    },
                    {
                        name: 'description',
                        type: 'multiline' as const,
                        description: '项目详细描述',
                        placeholder: '请输入项目的详细描述...',
                        required: true
                    },
                    {
                        name: 'estimatedHours',
                        type: 'number' as const,
                        description: '预计工作时间（小时）',
                        placeholder: '输入数字',
                        defaultValue: '8'
                    }
                ]
            };

            try {
                await promptManager.createPrompt(testPrompt);
                promptProvider.refresh();
                vscode.window.showInformationMessage('测试模板创建成功！');
            } catch (error) {
                vscode.window.showErrorMessage(`创建测试模板失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        })
    ];

    // Add all commands to subscriptions
    commands.forEach(command => context.subscriptions.push(command));

    // Set context for when the extension is enabled
    vscode.commands.executeCommand('setContext', 'promptManager:enabled', true);
}

export function deactivate() {
    console.log('Cursor Prompt Manager is now deactivated');
}
