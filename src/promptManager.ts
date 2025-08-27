import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Prompt, PromptCreateInput, PromptUpdateInput, PromptLibrary, Variable } from './types';

export class PromptManager {
    private prompts: Prompt[] = [];
    private storageUri: vscode.Uri;

    constructor(private context: vscode.ExtensionContext) {
        this.storageUri = vscode.Uri.joinPath(context.globalStorageUri, 'prompts.json');
        this.loadPrompts();
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
        let content = prompt.content;

        // Process variables
        if (prompt.variables.length > 0) {
            content = await this.processVariables(content, prompt.variables, editor);
        }

        // Insert the content at cursor position
        const position = editor.selection.active;
        await editor.edit(editBuilder => {
            editBuilder.insert(position, content);
        });

        // Update usage count
        prompt.usageCount++;
        await this.savePrompts();
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

    private async processVariables(content: string, variables: Variable[], editor: vscode.TextEditor): Promise<string> {
        let processedContent = content;

        for (const variable of variables) {
            const placeholder = `{{${variable.name}}}`;
            let value = '';

            switch (variable.type) {
                case 'selection':
                    value = editor.document.getText(editor.selection) || variable.defaultValue || '';
                    break;
                case 'filename':
                    value = path.basename(editor.document.fileName) || variable.defaultValue || '';
                    break;
                case 'filepath':
                    value = editor.document.fileName || variable.defaultValue || '';
                    break;
                case 'custom':
                    value = await vscode.window.showInputBox({
                        prompt: `Enter value for ${variable.name}`,
                        placeHolder: variable.description || variable.name,
                        value: variable.defaultValue
                    }) || variable.defaultValue || '';
                    break;
                default:
                    value = variable.defaultValue || '';
            }

            processedContent = processedContent.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
        }

        return processedContent;
    }

    private async loadPrompts(): Promise<void> {
        try {
            // Ensure storage directory exists
            await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);
            
            const data = await vscode.workspace.fs.readFile(this.storageUri);
            const content = Buffer.from(data).toString('utf8');
            const parsed = JSON.parse(content);
            
            this.prompts = parsed.map((prompt: any) => ({
                ...prompt,
                createdAt: new Date(prompt.createdAt),
                updatedAt: new Date(prompt.updatedAt)
            }));
        } catch (error) {
            // File doesn't exist or is corrupted, start with empty array
            this.prompts = [];
            await this.createDefaultPrompts();
        }
    }

    private async savePrompts(): Promise<void> {
        try {
            const content = JSON.stringify(this.prompts, null, 2);
            await vscode.workspace.fs.writeFile(this.storageUri, Buffer.from(content, 'utf8'));
        } catch (error) {
            console.error('Failed to save prompts:', error);
        }
    }

    private async createDefaultPrompts(): Promise<void> {
        const defaultPrompts: PromptCreateInput[] = [
            {
                title: 'Code Review',
                content: 'Please review this code for:\n- Code quality and best practices\n- Potential bugs or issues\n- Performance optimizations\n- Security concerns\n\nCode:\n{{selection}}',
                description: 'Request a comprehensive code review',
                category: 'Code Review',
                tags: ['review', 'quality', 'best-practices'],
                variables: [
                    {
                        name: 'selection',
                        description: 'Selected code to review',
                        type: 'selection'
                    }
                ]
            },
            {
                title: 'Bug Fix',
                content: 'I have a bug in this code. Please help me identify and fix the issue:\n\n{{selection}}\n\nThe expected behavior is: [describe expected behavior]\nThe actual behavior is: [describe actual behavior]',
                description: 'Get help fixing a bug in your code',
                category: 'Debugging',
                tags: ['bug', 'fix', 'debug'],
                variables: [
                    {
                        name: 'selection',
                        description: 'Code with the bug',
                        type: 'selection'
                    }
                ]
            },
            {
                title: 'Explain Code',
                content: 'Please explain what this code does in simple terms:\n\n{{selection}}',
                description: 'Get an explanation of complex code',
                category: 'Documentation',
                tags: ['explain', 'documentation', 'understanding'],
                variables: [
                    {
                        name: 'selection',
                        description: 'Code to explain',
                        type: 'selection'
                    }
                ]
            },
            {
                title: 'Refactor Code',
                content: 'Please refactor this code to improve:\n- Readability\n- Performance\n- Maintainability\n- Following best practices\n\nOriginal code:\n{{selection}}',
                description: 'Request code refactoring suggestions',
                category: 'Refactoring',
                tags: ['refactor', 'improve', 'clean-code'],
                variables: [
                    {
                        name: 'selection',
                        description: 'Code to refactor',
                        type: 'selection'
                    }
                ]
            }
        ];

        for (const promptInput of defaultPrompts) {
            await this.createPrompt(promptInput);
        }
    }
}
