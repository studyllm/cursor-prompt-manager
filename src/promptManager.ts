import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Prompt, PromptCreateInput, PromptUpdateInput, PromptLibrary, Variable, Category } from './types';
import { VariableInputWebview } from './webview/variableInputWebview';

export class PromptManager {
    private prompts: Prompt[] = [];
    private categories: Category[] = [];
    private storageUri: vscode.Uri;
    private variableInputWebview: VariableInputWebview;
    private fileWatcher?: vscode.FileSystemWatcher;
    private _onDataChanged = new vscode.EventEmitter<void>();
    public readonly onDataChanged = this._onDataChanged.event;
    private lastFileModificationTime: number = 0;
    private syncInProgress: boolean = false;

    constructor(private context: vscode.ExtensionContext) {
        // 使用固定的全局存储路径确保所有窗口使用相同路径
        this.storageUri = this.getGlobalStoragePath();
        this.variableInputWebview = new VariableInputWebview(context);
        this.setupFileWatcher();
        this.loadPrompts();
        
        // 定期检查文件变化（备用机制）
        this.setupPeriodicSync();
    }

    // 获取统一的全局存储路径
    private getGlobalStoragePath(): vscode.Uri {
        const os = require('os');
        const path = require('path');
        
        // 使用操作系统的用户目录确保所有窗口使用相同路径
        const homeDir = os.homedir();
        const storageDir = path.join(homeDir, '.vscode', 'cursor-prompt-manager');
        const storagePath = path.join(storageDir, 'prompts.json');
        
        return vscode.Uri.file(storagePath);
    }

    async getAllPrompts(): Promise<Prompt[]> {
        return this.prompts;
    }

    async getPromptsByCategory(category: string): Promise<Prompt[]> {
        return this.prompts.filter(prompt => prompt.category === category);
    }

    async getPromptById(id: string): Promise<Prompt | undefined> {
        return this.prompts.find(prompt => prompt.id === id);
    }

    async createPrompt(input: PromptCreateInput): Promise<Prompt> {
        const prompt: Prompt = {
            id: uuidv4(),
            title: input.title,
            content: input.content,
            description: input.description || '',
            category: input.category,
            tags: input.tags || [],
            variables: input.variables || [],
            createdAt: new Date(),
            updatedAt: new Date(),
            usageCount: 0,
            isFavorite: false
        };

        this.prompts.push(prompt);
        await this.savePrompts();
        return prompt;
    }

    async updatePrompt(input: PromptUpdateInput): Promise<Prompt | undefined> {
        const index = this.prompts.findIndex(prompt => prompt.id === input.id);
        if (index === -1) {
            return undefined;
        }

        const existingPrompt = this.prompts[index];
        const updatedPrompt: Prompt = {
            ...existingPrompt,
            ...input,
            updatedAt: new Date()
        };

        this.prompts[index] = updatedPrompt;
        await this.savePrompts();
        return updatedPrompt;
    }

    async deletePrompt(id: string): Promise<boolean> {
        const index = this.prompts.findIndex(prompt => prompt.id === id);
        if (index === -1) {
            return false;
        }

        this.prompts.splice(index, 1);
        await this.savePrompts();
        return true;
    }

    async insertPrompt(prompt: Prompt, editor: vscode.TextEditor): Promise<void> {
        try {
            let content = prompt.content;
            console.log('🔧 insertPrompt - Starting with prompt:', {
                title: prompt.title,
                id: prompt.id,
                hasVariables: !!(prompt.variables && prompt.variables.length > 0),
                variablesCount: prompt.variables ? prompt.variables.length : 0
            });
            console.log('🔧 insertPrompt - Original content:', JSON.stringify(content));
            console.log('🔧 insertPrompt - Editor info:', {
                uri: editor.document.uri.toString(),
                selection: editor.selection,
                hasSelection: !editor.selection.isEmpty
            });

            // Always process system variables first ({{selection}}, {{filename}}, {{filepath}})
            console.log('🔧 insertPrompt - About to process system variables...');
            content = this.processSystemVariables(content, editor);
            console.log('🔧 insertPrompt - After system variables:', JSON.stringify(content));

            // Process custom variables if any exist
            if (prompt.variables && prompt.variables.length > 0) {
                console.log('🔧 insertPrompt - Processing custom variables:', prompt.variables);
                content = await this.processVariablesWithWebview(content, prompt.variables, editor);
                console.log('🔧 insertPrompt - After custom variables:', JSON.stringify(content));
            } else {
                console.log('🔧 insertPrompt - No custom variables to process');
            }

            // Insert the content at cursor position
            console.log('🔧 insertPrompt - About to insert content at position:', editor.selection.active);
            const position = editor.selection.active;
            const success = await editor.edit(editBuilder => {
                editBuilder.insert(position, content);
            });
            
            console.log('🔧 insertPrompt - Edit operation success:', success);
            if (!success) {
                throw new Error('Failed to insert content into editor');
            }

            // Update usage count
            prompt.usageCount++;
            await this.savePrompts();
            console.log('🔧 insertPrompt - Completed successfully');
        } catch (error) {
            console.error('🚨 insertPrompt - Error occurred:', error);
            throw error;
        }
    }

    async searchPrompts(query: string): Promise<Prompt[]> {
        const lowerQuery = query.toLowerCase();
        return this.prompts.filter(prompt => 
            prompt.title.toLowerCase().includes(lowerQuery) ||
            prompt.content.toLowerCase().includes(lowerQuery) ||
            prompt.description?.toLowerCase().includes(lowerQuery) ||
            prompt.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    }

    async getCategories(): Promise<string[]> {
        const categories = new Set(this.prompts.map(prompt => prompt.category));
        return Array.from(categories).sort();
    }

    async importPrompts(filePath: string): Promise<void> {
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const data: PromptLibrary = JSON.parse(fileContent);
            
            // Validate and import prompts
            if (data.prompts && Array.isArray(data.prompts)) {
                for (const promptData of data.prompts) {
                    // Generate new ID to avoid conflicts
                    const prompt: Prompt = {
                        ...promptData,
                        id: uuidv4(),
                        createdAt: new Date(promptData.createdAt),
                        updatedAt: new Date(promptData.updatedAt)
                    };
                    this.prompts.push(prompt);
                }
                await this.savePrompts();
            }
        } catch (error) {
            throw new Error(`Failed to import prompts: ${error}`);
        }
    }

    async exportPrompts(filePath: string): Promise<void> {
        try {
            const library: PromptLibrary = {
                prompts: this.prompts,
                categories: [], // Will be implemented later
                version: '1.0.0',
                exportedAt: new Date()
            };

            fs.writeFileSync(filePath, JSON.stringify(library, null, 2));
        } catch (error) {
            throw new Error(`Failed to export prompts: ${error}`);
        }
    }

    /**
     * 获取文件信息的辅助方法
     */
    private getFileInfo(editor: vscode.TextEditor): { filename: string; filepath: string } {
        const uri = editor.document.uri;
        let filename = '';
        let filepath = '';
        
        if (uri.scheme === 'file') {
            // 普通文件
            filepath = uri.fsPath;
            filename = path.basename(filepath);
        } else if (uri.scheme === 'untitled') {
            // 未保存的新文件
            filename = `未保存文件-${uri.path || 'new'}`;
            filepath = `untitled:${uri.path || 'new'}`;
        } else {
            // 其他协议（如git, vscode-userdata等）
            filename = path.basename(uri.path) || 'Unknown';
            filepath = uri.toString();
        }
        
        return { filename, filepath };
    }

    /**
     * 自动检测和处理内容中的系统变量
     */
    processSystemVariables(content: string, editor: vscode.TextEditor): string {
        let processedContent = content;
        console.log('🔧 Processing system variables for content:', content);
        console.log('🔧 Editor document URI:', editor.document.uri.toString());
        console.log('🔧 Editor selection:', editor.selection);

        // 处理 {{selection}} 变量
        const selectedText = editor.document.getText(editor.selection);
        console.log('🔧 Selected text length:', selectedText.length);
        console.log('🔧 Selected text content:', JSON.stringify(selectedText));
        
        // 检查原内容中是否包含 {{selection}}
        const hasSelectionVar = content.includes('{{selection}}');
        console.log('🔧 Content has {{selection}} variable:', hasSelectionVar);
        
        // 改进的选择处理逻辑
        if (hasSelectionVar && !selectedText) {
            console.warn('⚠️ 模板包含 {{selection}} 但没有选中文本');
            vscode.window.showWarningMessage('提示：模板包含 {{selection}} 变量，但当前没有选中任何文本。建议先选中一些文本后再使用。');
        }
        
        processedContent = processedContent.replace(/\{\{selection\}\}/g, selectedText || '');
        console.log('🔧 After selection replacement:', JSON.stringify(processedContent));

        // 处理 {{filename}} 和 {{filepath}} 变量 - 使用改进的文件信息获取方法
        const { filename, filepath } = this.getFileInfo(editor);
        console.log('🔧 Filename:', JSON.stringify(filename));
        console.log('🔧 Filepath:', JSON.stringify(filepath));
        
        // 检查原内容中是否包含文件相关变量
        const hasFilenameVar = content.includes('{{filename}}');
        const hasFilepathVar = content.includes('{{filepath}}');
        console.log('🔧 Content has {{filename}} variable:', hasFilenameVar);
        console.log('🔧 Content has {{filepath}} variable:', hasFilepathVar);
        
        processedContent = processedContent.replace(/\{\{filename\}\}/g, filename);
        console.log('🔧 After filename replacement:', JSON.stringify(processedContent));

        processedContent = processedContent.replace(/\{\{filepath\}\}/g, filepath);
        console.log('🔧 After filepath replacement:', JSON.stringify(processedContent));

        console.log('🔧 Final processed content:', JSON.stringify(processedContent));
        return processedContent;
    }

    async processVariables(content: string, variables: Variable[], editor: vscode.TextEditor): Promise<string> {
        try {
            // 首先自动检测和处理系统变量
            let processedContent = this.processSystemVariables(content, editor);
            
            // 然后处理用户定义的变量
            for (const variable of variables) {
                const placeholder = `{{${variable.name}}}`;
                let value = '';

                try {
                    switch (variable.type) {
                        case 'selection':
                        case 'filename':
                        case 'filepath':
                            // 系统变量已经在 processSystemVariables 中处理了，跳过
                            continue;
                        case 'text':
                            const textInput = await vscode.window.showInputBox({
                                prompt: variable.description || `请输入 ${variable.name}`,
                                placeHolder: variable.placeholder || variable.name,
                                value: variable.defaultValue || '',
                                validateInput: variable.required ? (input) => {
                                    return input.trim() === '' ? '此字段为必填项' : null;
                                } : undefined
                            });
                            
                            // 处理用户取消的情况
                            if (textInput === undefined && variable.required) {
                                vscode.window.showWarningMessage(`变量 "${variable.name}" 是必填项，但用户取消了输入。使用默认值。`);
                                value = variable.defaultValue || '';
                            } else {
                                value = textInput || variable.defaultValue || '';
                            }
                            break;
                case 'multiline':
                    // 对于多行文本，使用输入框但提示用户可以输入多行
                    const multilineInput = await vscode.window.showInputBox({
                        prompt: `${variable.description || `请输入 ${variable.name}`} (支持多行文本)`,
                        placeHolder: variable.placeholder || variable.name,
                        value: variable.defaultValue || '',
                        validateInput: variable.required ? (input) => {
                            return input.trim() === '' ? '此字段为必填项' : null;
                        } : undefined
                    });
                    
                    if (multilineInput === undefined && variable.required) {
                        vscode.window.showWarningMessage(`变量 "${variable.name}" 是必填项，但用户取消了输入。使用默认值。`);
                        value = variable.defaultValue || '';
                    } else {
                        value = multilineInput || variable.defaultValue || '';
                    }
                    break;
                case 'select':
                    if (variable.options && variable.options.length > 0) {
                        const selected = await vscode.window.showQuickPick(variable.options, {
                            placeHolder: variable.description || `请选择 ${variable.name}`,
                            canPickMany: false
                        });
                        
                        if (selected === undefined && variable.required) {
                            vscode.window.showWarningMessage(`变量 "${variable.name}" 是必填项，但用户取消了选择。使用默认值。`);
                            value = variable.defaultValue || '';
                        } else {
                            value = selected || variable.defaultValue || '';
                        }
                    } else {
                        value = variable.defaultValue || '';
                    }
                    break;
                case 'number':
                    const numberInput = await vscode.window.showInputBox({
                        prompt: variable.description || `请输入 ${variable.name} (数字)`,
                        placeHolder: variable.placeholder || '请输入数字',
                        value: variable.defaultValue || '',
                        validateInput: (input) => {
                            if (variable.required && input.trim() === '') {
                                return '此字段为必填项';
                            }
                            if (input.trim() !== '' && isNaN(Number(input))) {
                                return '请输入有效的数字';
                            }
                            return null;
                        }
                    });
                    
                    if (numberInput === undefined && variable.required) {
                        vscode.window.showWarningMessage(`变量 "${variable.name}" 是必填项，但用户取消了输入。使用默认值。`);
                        value = variable.defaultValue || '';
                    } else {
                        value = numberInput || variable.defaultValue || '';
                    }
                    break;
                case 'date':
                    // 对于日期类型，使用输入框并验证日期格式
                    const dateInput = await vscode.window.showInputBox({
                        prompt: `${variable.description || `请输入 ${variable.name}`} (格式: YYYY-MM-DD)`,
                        placeHolder: variable.placeholder || 'YYYY-MM-DD',
                        value: variable.defaultValue || new Date().toISOString().split('T')[0],
                        validateInput: (input) => {
                            if (variable.required && input.trim() === '') {
                                return '此字段为必填项';
                            }
                            if (input.trim() !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(input)) {
                                return '请输入正确的日期格式 (YYYY-MM-DD)';
                            }
                            return null;
                        }
                    });
                    
                    if (dateInput === undefined && variable.required) {
                        vscode.window.showWarningMessage(`变量 "${variable.name}" 是必填项，但用户取消了输入。使用默认值。`);
                        value = variable.defaultValue || new Date().toISOString().split('T')[0];
                    } else {
                        value = dateInput || variable.defaultValue || '';
                    }
                    break;
                case 'custom':
                    const customInput = await vscode.window.showInputBox({
                        prompt: `Enter value for ${variable.name}`,
                        placeHolder: variable.description || variable.name,
                        value: variable.defaultValue
                    });
                    
                    if (customInput === undefined && variable.required) {
                        vscode.window.showWarningMessage(`变量 "${variable.name}" 是必填项，但用户取消了输入。使用默认值。`);
                        value = variable.defaultValue || '';
                    } else {
                        value = customInput || variable.defaultValue || '';
                    }
                    break;
                                        default:
                            value = variable.defaultValue || '';
                    }
                } catch (error) {
                    console.error(`Error processing variable "${variable.name}":`, error);
                    vscode.window.showErrorMessage(`处理变量 "${variable.name}" 时发生错误: ${error}`);
                    value = variable.defaultValue || '';
                }

                processedContent = processedContent.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
            }

            return processedContent;
        } catch (error) {
            console.error('Error in processVariables:', error);
            vscode.window.showErrorMessage(`变量处理过程中发生错误: ${error}`);
            return content; // 返回原始内容作为fallback
        }
    }

    async processVariablesWithWebview(content: string, variables: Variable[], editor: vscode.TextEditor): Promise<string> {
        // 首先自动处理系统变量
        let processedContent = this.processSystemVariables(content, editor);
        
        // 如果没有用户定义的变量，直接返回处理过的内容
        if (variables.length === 0) {
            return processedContent;
        }

        // 过滤出需要用户输入的变量（非系统变量）
        const userInputVariables = variables.filter(v => 
            !['selection', 'filename', 'filepath'].includes(v.type)
        );

        // 跳过系统变量的处理（已经在processSystemVariables中处理了）
        // 这里只保留用户定义变量的处理逻辑

        // 如果有需要用户输入的变量，显示webview
        if (userInputVariables.length > 0) {
            const userValues = await this.variableInputWebview.showVariableInput(userInputVariables);
            
            // 如果用户取消了输入，返回空字符串
            if (Object.keys(userValues).length === 0) {
                return '';
            }

            // 应用用户输入的值
            for (const variable of userInputVariables) {
                const placeholder = `{{${variable.name}}}`;
                const value = userValues[variable.name] || variable.defaultValue || '';
                processedContent = processedContent.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
            }
        }

        return processedContent;
    }

    private async loadPrompts(): Promise<void> {
        try {
            // 确保存储目录存在
            await this.ensureStorageDirectory();
            
            const data = await vscode.workspace.fs.readFile(this.storageUri);
            const content = Buffer.from(data).toString('utf8');
            const parsed = JSON.parse(content);
            
            this.prompts = parsed.map((prompt: any) => ({
                ...prompt,
                createdAt: new Date(prompt.createdAt),
                updatedAt: new Date(prompt.updatedAt)
            }));
            
            // 更新分类和文件修改时间
            this.updateCategories();
            const stat = await vscode.workspace.fs.stat(this.storageUri);
            this.lastFileModificationTime = stat.mtime;
            
            console.log('Loaded prompts from:', this.storageUri.fsPath, 'Total:', this.prompts.length);
        } catch (error) {
            // File doesn't exist or is corrupted, start with empty array
            console.log('No existing prompts file found, creating defaults');
            this.prompts = [];
            this.categories = [];
            await this.createDefaultPrompts();
        }
    }

    private async savePrompts(): Promise<void> {
        if (this.syncInProgress) {
            return; // 避免重复同步
        }
        
        try {
            this.syncInProgress = true;
            
            // 确保目录存在
            await this.ensureStorageDirectory();
            
            const content = JSON.stringify(this.prompts, null, 2);
            await vscode.workspace.fs.writeFile(this.storageUri, Buffer.from(content, 'utf8'));
            
            // 更新文件修改时间
            this.lastFileModificationTime = Date.now();
            
            // 通知数据已更改（延迟一点避免重复触发）
            setTimeout(() => {
                this._onDataChanged.fire();
                this.syncInProgress = false;
            }, 100);
            
            console.log('Prompts saved to:', this.storageUri.fsPath);
        } catch (error) {
            console.error('Failed to save prompts:', error);
            this.syncInProgress = false;
        }
    }

    private async ensureStorageDirectory(): Promise<void> {
        try {
            const dirUri = vscode.Uri.file(require('path').dirname(this.storageUri.fsPath));
            await vscode.workspace.fs.createDirectory(dirUri);
        } catch (error) {
            // 目录可能已存在，忽略错误
        }
    }

    private async createDefaultPrompts(): Promise<void> {
        // 只创建默认分类，不创建任何默认提示词内容
        const defaultCategories: string[] = [
            'Code Review',
            'Debugging', 
            'Documentation',
            'Refactoring',
            'General'
        ];

        // 确保默认分类存在于分类列表中
        for (let i = 0; i < defaultCategories.length; i++) {
            const categoryName = defaultCategories[i];
            if (!this.categories.find(cat => cat.name === categoryName)) {
                this.categories.push({
                    id: uuidv4(),
                    name: categoryName,
                    description: `${categoryName} related prompts`,
                    order: i
                });
            }
        }

        // 保存更新后的分类（不创建任何默认提示词）
        await this.savePrompts();
    }

    private setupFileWatcher(): void {
        try {
            // 使用 RelativePattern 监听工作区外的文件
            const storageDir = require('path').dirname(this.storageUri.fsPath);
            const fileName = require('path').basename(this.storageUri.fsPath);
            
            // 创建 RelativePattern 以正确监听工作区外的文件
            const relativePattern = new vscode.RelativePattern(storageDir, fileName);
            this.fileWatcher = vscode.workspace.createFileSystemWatcher(relativePattern);

            // 监听文件变化事件
            this.fileWatcher.onDidChange(async () => {
                console.log('✅ VS Code File change detected:', this.storageUri.fsPath);
                if (!this.syncInProgress) {
                    await this.checkAndReloadPrompts();
                }
            });

            // 监听文件删除事件
            this.fileWatcher.onDidDelete(() => {
                console.log('✅ VS Code File delete detected:', this.storageUri.fsPath);
                if (!this.syncInProgress) {
                    this.prompts = [];
                    this.categories = [];
                    this.lastFileModificationTime = 0;
                    this._onDataChanged.fire();
                    console.log('Prompts file was deleted, cleared data');
                }
            });

            // 监听文件创建事件
            this.fileWatcher.onDidCreate(async () => {
                console.log('✅ VS Code File create detected:', this.storageUri.fsPath);
                if (!this.syncInProgress) {
                    await this.checkAndReloadPrompts();
                }
            });
            
            console.log('✅ File watcher setup with RelativePattern for:', this.storageUri.fsPath);
            console.log('  - Directory:', storageDir);
            console.log('  - File name:', fileName);

            // 设置Node.js原生文件监听作为备用机制
            this.setupNativeFileWatcher();
            
        } catch (error) {
            console.error('❌ Failed to setup VS Code file watcher:', error);
            console.log('⚠️  Falling back to periodic sync only');
            
            // 如果VS Code监听器失败，尝试设置原生监听器
            this.setupNativeFileWatcher();
        }
    }

    // Node.js原生文件监听器（备用机制）
    private setupNativeFileWatcher(): void {
        try {
            const fs = require('fs');
            
            // 使用 fs.watchFile 作为备用监听器
            fs.watchFile(this.storageUri.fsPath, { interval: 1000 }, async (curr: fs.Stats, prev: fs.Stats) => {
                if (curr.mtime.getTime() > prev.mtime.getTime()) {
                    console.log('✅ Node.js File change detected:', this.storageUri.fsPath);
                    console.log(`   Previous mtime: ${prev.mtime.toISOString()}`);
                    console.log(`   Current mtime: ${curr.mtime.toISOString()}`);
                    
                    if (!this.syncInProgress) {
                        await this.checkAndReloadPrompts();
                    }
                }
            });
            
            console.log('✅ Native file watcher (backup) setup for:', this.storageUri.fsPath);
        } catch (error) {
            console.error('❌ Failed to setup native file watcher:', error);
        }
    }

    // 检查文件是否有更新并重新加载
    private async checkAndReloadPrompts(): Promise<void> {
        try {
            const stat = await vscode.workspace.fs.stat(this.storageUri);
            const fileModTime = stat.mtime;
            
            // 只有当文件确实有更新时才重新加载
            if (fileModTime > this.lastFileModificationTime) {
                await this.reloadPrompts();
                this.lastFileModificationTime = fileModTime;
            }
        } catch (error) {
            console.error('Failed to check file modification time:', error);
        }
    }

    private async reloadPrompts(): Promise<void> {
        if (this.syncInProgress) {
            return;
        }
        
        try {
            this.syncInProgress = true;
            
            const data = await vscode.workspace.fs.readFile(this.storageUri);
            const content = Buffer.from(data).toString('utf8');
            const parsed = JSON.parse(content);
            
            this.prompts = parsed.map((prompt: any) => ({
                ...prompt,
                createdAt: new Date(prompt.createdAt),
                updatedAt: new Date(prompt.updatedAt)
            }));

            // 更新categories
            this.updateCategories();

            // 通知数据已更改
            this._onDataChanged.fire();
            
            console.log('Prompts reloaded from file due to external change. Total prompts:', this.prompts.length);
        } catch (error) {
            console.error('Failed to reload prompts:', error);
        } finally {
            this.syncInProgress = false;
        }
    }

    // 更新分类列表
    private updateCategories(): void {
        const categorySet = new Set<string>();
        this.prompts.forEach(prompt => {
            if (prompt.category) {
                categorySet.add(prompt.category);
            }
        });
        // 将字符串转换为Category对象
        this.categories = Array.from(categorySet).map((name, index) => ({
            id: `cat-${index}`,
            name,
            order: index
        }));
    }

    // 设置定期同步机制（备用）
    private setupPeriodicSync(): void {
        setInterval(async () => {
            try {
                // 每10秒检查一次文件是否有更新
                await this.checkAndReloadPrompts();
            } catch (error) {
                // 静默处理错误，避免干扰用户
            }
        }, 10000);
    }

    // 强制同步方法（公开接口）
    public async forceSync(): Promise<void> {
        try {
            await this.checkAndReloadPrompts();
            console.log('Force sync completed');
        } catch (error) {
            console.error('Force sync failed:', error);
        }
    }

    // 清理资源
    dispose(): void {
        // 清理VS Code文件监听器
        this.fileWatcher?.dispose();
        
        // 清理Node.js原生文件监听器
        try {
            const fs = require('fs');
            fs.unwatchFile(this.storageUri.fsPath);
            console.log('✅ Native file watcher disposed');
        } catch (error) {
            console.error('❌ Failed to dispose native file watcher:', error);
        }
        
        // 清理事件发射器
        this._onDataChanged.dispose();
        console.log('✅ PromptManager disposed');
    }
}
