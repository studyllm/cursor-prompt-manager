import * as vscode from 'vscode';
import { PromptManager } from './promptManager';
import { Prompt } from './types';

export class PromptProvider implements vscode.TreeDataProvider<PromptItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<PromptItem | undefined | null | void> = new vscode.EventEmitter<PromptItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<PromptItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private promptManager: PromptManager) {}

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
        this.tooltip = prompt.description || prompt.title;
        this.description = `${prompt.usageCount} uses`;
        this.iconPath = prompt.isFavorite 
            ? new vscode.ThemeIcon('star-full') 
            : new vscode.ThemeIcon('symbol-text');
        this.contextValue = 'prompt';
        
        // Add command to insert prompt on click
        this.command = {
            command: 'promptManager.insertSpecificPrompt',
            title: 'Insert Prompt',
            arguments: [prompt]
        };
    }
}
