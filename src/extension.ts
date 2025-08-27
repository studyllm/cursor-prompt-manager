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

// Helper function for WebView-based editing
async function editPromptWithWebView(prompt: any, promptManager: any, promptProvider: any) {
    const panel = vscode.window.createWebviewPanel(
        'promptEditor',
        `Edit Prompt: ${prompt.title}`,
        vscode.ViewColumn.Two,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    // HTML content for the WebView
    const webviewContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Edit Prompt</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
                padding: 20px;
                margin: 0;
            }
            .form-group {
                margin-bottom: 20px;
            }
            label {
                display: block;
                margin-bottom: 5px;
                font-weight: 600;
                color: var(--vscode-input-foreground);
            }
            input, textarea {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid var(--vscode-input-border);
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border-radius: 3px;
                font-family: inherit;
                font-size: 14px;
                box-sizing: border-box;
            }
            textarea {
                min-height: 200px;
                resize: vertical;
                font-family: var(--vscode-editor-font-family);
            }
            .button-group {
                margin-top: 30px;
                display: flex;
                gap: 10px;
            }
            button {
                padding: 8px 16px;
                border: none;
                border-radius: 3px;
                cursor: pointer;
                font-size: 14px;
                font-family: inherit;
            }
            .primary {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
            }
            .primary:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
            .secondary {
                background-color: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
            }
            .secondary:hover {
                background-color: var(--vscode-button-secondaryHoverBackground);
            }
            .auto-save-indicator {
                position: fixed;
                top: 10px;
                right: 10px;
                padding: 5px 10px;
                background-color: var(--vscode-notifications-background);
                color: var(--vscode-notifications-foreground);
                border-radius: 3px;
                font-size: 12px;
                opacity: 0;
                transition: opacity 0.3s;
            }
            .auto-save-indicator.show {
                opacity: 1;
            }
        </style>
    </head>
    <body>
        <div class="auto-save-indicator" id="autoSaveIndicator">已自动保存</div>
        
        <form id="promptForm">
            <div class="form-group">
                <label for="title">标题</label>
                <input type="text" id="title" name="title" value="${prompt.title.replace(/"/g, '&quot;')}" required>
            </div>
            
            <div class="form-group">
                <label for="category">分类</label>
                <input type="text" id="category" name="category" value="${prompt.category.replace(/"/g, '&quot;')}" required>
            </div>
            
            <div class="form-group">
                <label for="description">描述</label>
                <input type="text" id="description" name="description" value="${(prompt.description || '').replace(/"/g, '&quot;')}">
            </div>
            
            <div class="form-group">
                <label for="content">提示词内容</label>
                <textarea id="content" name="content" required>${prompt.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
            </div>
            
            <div class="button-group">
                <button type="button" class="primary" onclick="savePrompt()">保存</button>
                <button type="button" class="secondary" onclick="closeEditor()">取消</button>
            </div>
        </form>

        <script>
            const vscode = acquireVsCodeApi();
            let autoSaveTimeout;
            let hasUnsavedChanges = false;

            // Auto-save functionality
            function setupAutoSave() {
                const inputs = document.querySelectorAll('input, textarea');
                inputs.forEach(input => {
                    input.addEventListener('input', () => {
                        hasUnsavedChanges = true;
                        clearTimeout(autoSaveTimeout);
                        autoSaveTimeout = setTimeout(autoSave, 2000);
                    });
                });
            }

            function autoSave() {
                if (!hasUnsavedChanges) return;
                
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

            function getFormData() {
                return {
                    title: document.getElementById('title').value.trim(),
                    category: document.getElementById('category').value.trim(),
                    description: document.getElementById('description').value.trim(),
                    content: document.getElementById('content').value.trim()
                };
            }

            function savePrompt() {
                const formData = getFormData();
                
                if (!formData.title || !formData.content || !formData.category) {
                    vscode.postMessage({
                        command: 'showError',
                        message: '请填写标题、分类和内容'
                    });
                    return;
                }

                vscode.postMessage({
                    command: 'save',
                    data: formData
                });
            }

            function closeEditor() {
                vscode.postMessage({
                    command: 'close'
                });
            }

            // Handle messages from extension
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'saved':
                        hasUnsavedChanges = false;
                        showAutoSaveIndicator();
                        break;
                }
            });

            // Initialize auto-save
            setupAutoSave();
        </script>
    </body>
    </html>`;

    panel.webview.html = webviewContent;

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
            case 'save':
            case 'autoSave':
                try {
                    await promptManager.updatePrompt({
                        ...prompt,
                        title: message.data.title || prompt.title,
                        content: message.data.content || prompt.content,
                        category: message.data.category || prompt.category,
                        description: message.data.description || prompt.description
                    });

                    promptProvider.refresh();
                    
                    // Send confirmation back to webview
                    panel.webview.postMessage({ command: 'saved' });
                    
                    if (message.command === 'save') {
                        vscode.window.showInformationMessage(`提示词 "${message.data.title}" 已保存`);
                        panel.dispose();
                    }
                } catch (error) {
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

// Helper function for improved dialog-based editing with better UX
async function editPromptWithImprovedDialog(prompt: any, promptManager: any, promptProvider: any) {
    // Step 1: Edit title
    const title = await vscode.window.showInputBox({
        prompt: '编辑提示词标题',
        value: prompt.title,
        placeHolder: '输入提示词标题',
        validateInput: (value) => {
            if (!value?.trim()) {
                return '标题不能为空';
            }
            return null;
        }
    });

    if (title === undefined) return;

    // Step 2: Edit category
    const allPrompts = await promptManager.getAllPrompts();
    const existingCategories = [...new Set(allPrompts.map((p: any) => p.category))].filter((cat): cat is string => typeof cat === 'string');
    
    const categoryItems: vscode.QuickPickItem[] = existingCategories.map((cat) => ({
        label: cat,
        description: '现有分类'
    }));
    categoryItems.push({
        label: '$(add) 创建新分类',
        description: '输入新的分类名称'
    });

    const categorySelection = await vscode.window.showQuickPick(categoryItems, {
        placeHolder: '选择或创建分类',
        matchOnDescription: true
    });

    if (!categorySelection) return;

    let category;
    if (categorySelection.label === '$(add) 创建新分类') {
        category = await vscode.window.showInputBox({
            prompt: '输入新分类名称',
            value: prompt.category,
            placeHolder: '输入分类名称',
            validateInput: (value) => {
                if (!value?.trim()) {
                    return '分类不能为空';
                }
                return null;
            }
        });
        if (category === undefined) return;
    } else {
        category = categorySelection.label;
    }

    // Step 3: Edit description
    const description = await vscode.window.showInputBox({
        prompt: '编辑描述（可选）',
        value: prompt.description || '',
        placeHolder: '输入提示词描述'
    });

    if (description === undefined) return;

    // Step 4: Edit content in a larger input box
    const content = await vscode.window.showInputBox({
        prompt: '编辑提示词内容',
        value: prompt.content,
        placeHolder: '输入提示词内容',
        validateInput: (value) => {
            if (!value?.trim()) {
                return '内容不能为空';
            }
            return null;
        }
    });

    if (content === undefined) return;

    // Save the updated prompt
    try {
        await promptManager.updatePrompt({
            ...prompt,
            title: title.trim(),
            content: content.trim(),
            category: category.trim(),
            description: description.trim()
        });

        promptProvider.refresh();
        vscode.window.showInformationMessage(`提示词 "${title.trim()}" 已更新`);
    } catch (error) {
        vscode.window.showErrorMessage(`更新失败: ${error}`);
    }
}

// Helper function for improved editor with better save state management
async function editPromptWithImprovedEditor(prompt: any, promptManager: any, promptProvider: any) {
    const isNewPrompt = prompt.content === 'Enter your prompt content here...';
    const instructionText = isNewPrompt 
        ? '# 在下方完成新提示词内容，编辑完成后按 Ctrl+S 保存并关闭'
        : '# 编辑提示词内容，编辑完成后按 Ctrl+S 保存并关闭';
    
    const tempContent = `${instructionText}
# 修改后会自动保存，按 Ctrl+S 完成编辑

标题: ${prompt.title}
分类: ${prompt.category}
描述: ${prompt.description || ''}

--- 提示词内容（在此行下方编辑）---
${prompt.content}`;

    const document = await vscode.workspace.openTextDocument({
        content: tempContent,
        language: 'markdown'
    });

    const editor = await vscode.window.showTextDocument(document);
    
    let isAutoSaving = false;
    let hasUnsavedChanges = false;
    let saveTimeout: NodeJS.Timeout;

    // Show usage instructions
    const message = isNewPrompt 
        ? '新建提示词：编辑内容后按 Ctrl+S 保存并关闭编辑器' 
        : '编辑提示词：修改内容后按 Ctrl+S 保存并关闭编辑器';
    
    vscode.window.showInformationMessage(message, '知道了');

    // Function to parse and save content
    const saveContent = async (markAsClean = false) => {
        if (isAutoSaving) return;
        isAutoSaving = true;

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
                
                if (line.startsWith('标题: ')) {
                    title = line.substring(3).trim();
                } else if (line.startsWith('分类: ')) {
                    category = line.substring(3).trim();
                } else if (line.startsWith('描述: ')) {
                    description = line.substring(3).trim();
                } else if (line.includes('--- 提示词内容')) {
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
            hasUnsavedChanges = false;

            // Mark document as saved if requested
            if (markAsClean) {
                // This will prevent the save dialog
                await vscode.workspace.save(document.uri);
            }
            
        } catch (error) {
            console.error('Failed to save prompt:', error);
            vscode.window.showErrorMessage(`保存失败: ${error}`);
        } finally {
            isAutoSaving = false;
        }
    };

    // Listen for document changes
    const changeDisposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
        if (event.document === document) {
            hasUnsavedChanges = true;
            
            // Clear existing timeout and set new one
            if (saveTimeout) {
                clearTimeout(saveTimeout);
            }
            
            saveTimeout = setTimeout(() => {
                saveContent(false);
            }, 2000);
        }
    });

    // Listen for save command (Ctrl+S)
    const saveDisposable = vscode.workspace.onDidSaveTextDocument(async (savedDoc) => {
        if (savedDoc === document) {
            await saveContent(true);
            vscode.window.showInformationMessage(
                isNewPrompt 
                    ? `新提示词 "${prompt.title}" 创建成功！`
                    : `提示词 "${prompt.title}" 更新成功！`
            );
            
            // Close the editor after a short delay
            setTimeout(() => {
                vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            }, 500);
        }
    });

    // Listen for when the document is closed
    const closeDisposable = vscode.workspace.onDidCloseTextDocument((closedDoc) => {
        if (closedDoc === document) {
            // Clean up event listeners
            changeDisposable.dispose();
            saveDisposable.dispose();
            closeDisposable.dispose();
            
            if (saveTimeout) {
                clearTimeout(saveTimeout);
            }

            // If there are unsaved changes, save them one final time
            if (hasUnsavedChanges) {
                saveContent(false);
            }
        }
    });
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

        vscode.commands.registerCommand('promptManager.insertPrompt', async () => {
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
            }
        }),

        vscode.commands.registerCommand('promptManager.createPrompt', async () => {
            // Ask user for editing preference
            const editMethod = await vscode.window.showQuickPick([
                {
                    label: '$(browser) 可视化编辑器',
                    description: '在专用编辑器中编辑（推荐）',
                    detail: '更好的编辑体验，支持自动保存',
                    method: 'webview'
                },
                {
                    label: '$(comment-discussion) 分步对话框',
                    description: '通过多个对话框逐步编辑',
                    detail: '快速简单的编辑方式',
                    method: 'dialog'
                },
                {
                    label: '$(edit) 文本编辑器',
                    description: '在临时文档中编辑',
                    detail: '类似传统文本编辑器的体验',
                    method: 'editor'
                }
            ], {
                placeHolder: '选择编辑方式'
            });

            if (!editMethod) return;

            const title = await vscode.window.showInputBox({
                prompt: '输入提示词标题',
                placeHolder: '我的提示词'
            });

            if (!title) return;

            // Create a basic prompt first
            const newPrompt = await promptManager.createPrompt({
                title,
                content: 'Enter your prompt content here...',
                category: 'General',
                description: '',
                tags: [],
                variables: []
            });

            promptProvider.refresh();

            // Edit based on user preference
            switch (editMethod.method) {
                case 'webview':
                    await editPromptWithWebView(newPrompt, promptManager, promptProvider);
                    break;
                case 'dialog':
                    await editPromptWithImprovedDialog(newPrompt, promptManager, promptProvider);
                    break;
                case 'editor':
                    await editPromptWithImprovedEditor(newPrompt, promptManager, promptProvider);
                    break;
            }
        }),

        vscode.commands.registerCommand('promptManager.editPrompt', async (treeItem) => {
            // Extract prompt from tree item
            const prompt = treeItem?.prompt;
            if (!prompt) {
                vscode.window.showErrorMessage('未选择要编辑的提示词');
                return;
            }

            // Ask user for editing preference
            const editMethod = await vscode.window.showQuickPick([
                {
                    label: '$(browser) 可视化编辑器',
                    description: '在专用编辑器中编辑（推荐）',
                    detail: '更好的编辑体验，支持自动保存',
                    method: 'webview'
                },
                {
                    label: '$(comment-discussion) 分步对话框',
                    description: '通过多个对话框逐步编辑',
                    detail: '快速简单的编辑方式',
                    method: 'dialog'
                },
                {
                    label: '$(edit) 文本编辑器',
                    description: '在临时文档中编辑',
                    detail: '类似传统文本编辑器的体验',
                    method: 'editor'
                }
            ], {
                placeHolder: '选择编辑方式'
            });

            if (!editMethod) return;

            // Edit based on user preference
            switch (editMethod.method) {
                case 'webview':
                    await editPromptWithWebView(prompt, promptManager, promptProvider);
                    break;
                case 'dialog':
                    await editPromptWithImprovedDialog(prompt, promptManager, promptProvider);
                    break;
                case 'editor':
                    await editPromptWithImprovedEditor(prompt, promptManager, promptProvider);
                    break;
            }
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
