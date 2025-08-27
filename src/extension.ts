import * as vscode from 'vscode';
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
                transition: background-color 0.2s ease;
            }

            .toolbar-button:hover {
                background-color: var(--vscode-button-secondaryHoverBackground);
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
                    <div class="toolbar">
                        <button type="button" class="toolbar-button" onclick="insertTemplate('role')">👤 角色设定</button>
                        <button type="button" class="toolbar-button" onclick="insertTemplate('task')">📋 任务描述</button>
                        <button type="button" class="toolbar-button" onclick="insertTemplate('example')">💡 示例</button>
                        <button type="button" class="toolbar-button" onclick="insertTemplate('constraint')">⚠️ 约束条件</button>
                        <button type="button" class="toolbar-button" onclick="togglePreview()">👁️ 预览</button>
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
                } else if (fieldName === 'content' && value.length < 10) {
                    errorMessage = '内容至少需要10个字符';
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

            // Template insertion
            function insertTemplate(type) {
                const content = document.getElementById('content');
                const templates = {
                    role: '# 角色设定\\n你是一个专业的...\\n\\n',
                    task: '# 任务描述\\n请帮我...\\n\\n',
                    example: '# 示例\\n输入：\\n输出：\\n\\n',
                    constraint: '# 约束条件\\n- 请确保...\\n- 注意...\\n\\n'
                };

                const template = templates[type];
                if (template) {
                    const cursorPos = content.selectionStart;
                    const textBefore = content.value.substring(0, cursorPos);
                    const textAfter = content.value.substring(cursorPos);
                    
                    content.value = textBefore + template + textAfter;
                    content.focus();
                    content.setSelectionRange(cursorPos + template.length, cursorPos + template.length);
                    
                    hasUnsavedChanges = true;
                    updateWordCount();
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
    vscode.window.registerTreeDataProvider('promptManager', promptProvider);
    
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
                // Copy to clipboard
                await vscode.env.clipboard.writeText(selected.prompt.content);
                
                // Show options without auto-inserting into active editor
                const action = await vscode.window.showInformationMessage(
                    `Prompt "${selected.prompt.title}" copied to clipboard`,
                    'Paste in Chat',
                    'Insert to Editor'
                );
                
                if (action === 'Paste in Chat') {
                    try {
                        await vscode.commands.executeCommand('workbench.action.chat.open');
                        vscode.window.showInformationMessage('Press Cmd+V to paste in chat');
                    } catch (error) {
                        vscode.window.showInformationMessage('Please open chat and paste the prompt (Cmd+V)');
                    }
                } else if (action === 'Insert to Editor') {
                    let editor = vscode.window.activeTextEditor;
                    if (!editor) {
                        const document = await vscode.workspace.openTextDocument({
                            content: '',
                            language: 'plaintext'
                        });
                        editor = await vscode.window.showTextDocument(document);
                    }
                    await promptManager.insertPrompt(selected.prompt, editor);
                    vscode.window.showInformationMessage(`Prompt "${selected.prompt.title}" inserted into editor`);
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

                // Copy to clipboard
                await vscode.env.clipboard.writeText(prompt.content);
                
                // Show options without auto-inserting into active editor
                const action = await vscode.window.showInformationMessage(
                    `Prompt "${prompt.title}" copied to clipboard`,
                    'Paste in Chat',
                    'Insert to Editor'
                );
                
                if (action === 'Paste in Chat') {
                    try {
                        await vscode.commands.executeCommand('workbench.action.chat.open');
                        vscode.window.showInformationMessage('Press Cmd+V to paste in chat');
                    } catch (error) {
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
                        await promptManager.insertPrompt(prompt, editor);
                        vscode.window.showInformationMessage(`Prompt "${prompt.title}" inserted into editor`);
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                        vscode.window.showErrorMessage(`Failed to insert prompt: ${errorMessage}`);
                    }
                }
            } catch (error) {
                console.error('Error in insertSpecificPrompt:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`Failed to process prompt: ${errorMessage}`);
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
            const fileUri = await vscode.window.showSaveDialog({
                filters: {
                    'JSON files': ['json']
                },
                defaultUri: vscode.Uri.file('prompts.json')
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
