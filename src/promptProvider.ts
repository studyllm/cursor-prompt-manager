import * as vscode from 'vscode';
import { PromptManager } from './promptManager';
import { Prompt } from './types';

export class PromptProvider implements vscode.TreeDataProvider<PromptItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<PromptItem | undefined | null | void> = new vscode.EventEmitter<PromptItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<PromptItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private dataChangeListener: vscode.Disposable;

    constructor(private promptManager: PromptManager) {
        // 监听PromptManager的数据变化事件
        this.dataChangeListener = this.promptManager.onDataChanged(() => {
            this.refresh();
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: PromptItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: PromptItem): Promise<PromptItem[]> {
        if (!element) {
            // Root level - show add prompt item and categories
            const items: PromptItem[] = [];
            
            // Add the "Add New Prompt" item at the top
            items.push(new AddPromptItem());
            
            // Add categories
            const categories = await this.promptManager.getCategories();
            items.push(...categories.map(category => new CategoryItem(category)));
            
            return items;
        } else if (element instanceof CategoryItem) {
            // Category level - show prompts in this category
            const prompts = await this.promptManager.getPromptsByCategory(element.category);
            return prompts.map(prompt => new PromptTreeItem(prompt));
        }
        return [];
    }

    // 清理资源
    dispose(): void {
        this.dataChangeListener.dispose();
        this._onDidChangeTreeData.dispose();
    }
}

export class PromptItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
    }
}

export class AddPromptItem extends PromptItem {
    constructor() {
        super('+ Add New Prompt', vscode.TreeItemCollapsibleState.None);
        this.tooltip = 'Create a new prompt';
        this.iconPath = new vscode.ThemeIcon('add');
        this.contextValue = 'addPrompt';
        
        // Add command to create prompt on click
        this.command = {
            command: 'promptManager.createPrompt',
            title: 'Create New Prompt'
        };
    }
}

export class CategoryItem extends PromptItem {
    constructor(public readonly category: string) {
        super(category, vscode.TreeItemCollapsibleState.Expanded);
        this.tooltip = `Category: ${category}`;
        this.iconPath = new vscode.ThemeIcon('folder');
        this.contextValue = 'category';
    }
}

export class PromptTreeItem extends PromptItem {
    constructor(public readonly prompt: Prompt) {
        super(prompt.title, vscode.TreeItemCollapsibleState.None);
        
        // Enhanced tooltip with variable information
        let tooltip = prompt.description || prompt.title;
        if (prompt.variables && prompt.variables.length > 0) {
            tooltip += `\n\n📋 包含 ${prompt.variables.length} 个变量:`;
            prompt.variables.forEach(variable => {
                tooltip += `\n  • ${variable.name} (${variable.type})`;
                if (variable.description) {
                    tooltip += ` - ${variable.description}`;
                }
            });
            tooltip += '\n\n💡 点击时会提示输入变量值';
        }
        this.tooltip = tooltip;
        
        // Enhanced description with variable count
        let description = `${prompt.usageCount} 次使用`;
        if (prompt.variables && prompt.variables.length > 0) {
            description += ` • ${prompt.variables.length} 个变量`;
        }
        this.description = description;
        
        // Enhanced icon based on prompt type and content
        if (prompt.isFavorite) {
            this.iconPath = new vscode.ThemeIcon('star-full');
        } else if (prompt.variables && prompt.variables.length > 0) {
            // 使用特殊图标表示包含变量的提示词
            this.iconPath = new vscode.ThemeIcon('symbol-parameter', new vscode.ThemeColor('charts.orange'));
        } else {
            this.iconPath = new vscode.ThemeIcon('symbol-text');
        }
        
        this.contextValue = 'prompt';
        
        // Add command to insert prompt on click
        this.command = {
            command: 'promptManager.insertSpecificPrompt',
            title: '插入提示词',
            arguments: [prompt]
        };
    }
}
