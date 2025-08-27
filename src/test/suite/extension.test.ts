import * as assert from 'assert';
import * as vscode from 'vscode';
import { PromptManager } from '../../promptManager';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('your-publisher-name.cursor-prompt-manager'));
    });

    test('Should activate extension', async () => {
        const extension = vscode.extensions.getExtension('your-publisher-name.cursor-prompt-manager');
        if (extension) {
            await extension.activate();
            assert.ok(extension.isActive);
        }
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        const expectedCommands = [
            'promptManager.openPanel',
            'promptManager.insertPrompt',
            'promptManager.createPrompt',
            'promptManager.importPrompts',
            'promptManager.exportPrompts'
        ];

        expectedCommands.forEach(command => {
            assert.ok(commands.includes(command), `Command ${command} should be registered`);
        });
    });
});

suite('PromptManager Test Suite', () => {
    let promptManager: PromptManager;
    let context: vscode.ExtensionContext;

    suiteSetup(async () => {
        // Mock extension context
        context = {
            globalStorageUri: vscode.Uri.file('/tmp/test-storage'),
            subscriptions: [],
            workspaceState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => []
            },
            globalState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => [],
                setKeysForSync: () => {}
            }
        } as any;

        promptManager = new PromptManager(context);
    });

    test('Should create prompt manager instance', () => {
        assert.ok(promptManager);
    });

    test('Should create new prompt', async () => {
        const promptInput = {
            title: 'Test Prompt',
            content: 'This is a test prompt',
            category: 'Test',
            description: 'Test description',
            tags: ['test'],
            variables: []
        };

        const prompt = await promptManager.createPrompt(promptInput);
        assert.ok(prompt);
        assert.strictEqual(prompt.title, promptInput.title);
        assert.strictEqual(prompt.content, promptInput.content);
        assert.strictEqual(prompt.category, promptInput.category);
    });

    test('Should get all prompts', async () => {
        const prompts = await promptManager.getAllPrompts();
        assert.ok(Array.isArray(prompts));
        assert.ok(prompts.length >= 1); // At least the test prompt we created
    });

    test('Should search prompts', async () => {
        const results = await promptManager.searchPrompts('test');
        assert.ok(Array.isArray(results));
        assert.ok(results.length >= 1);
        assert.ok(results.some(p => p.title.toLowerCase().includes('test')));
    });

    test('Should get categories', async () => {
        const categories = await promptManager.getCategories();
        assert.ok(Array.isArray(categories));
        assert.ok(categories.includes('Test'));
    });
});
