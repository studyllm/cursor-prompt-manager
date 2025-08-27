# 2小时用Cursor开发一个AI提示词管理插件：从零到发布的完整实战

## 前言

在AI编程时代，提示词（Prompt）的重要性不言而喻。作为一名开发者，我经常需要使用各种提示词来提高AI辅助编程的效率，但每次都要重新输入或翻找历史记录，效率极低。于是我决定利用周末2小时的时间，用Cursor开发一个专门的提示词管理插件。

本文将详细记录这个从零到发布的完整开发过程，包括需求分析、技术选型、核心功能实现，以及一些踩坑经验。希望能给想要开发VS Code插件的同学一些参考。

## 一、项目规划与需求分析

### 1.1 核心需求梳理

经过简单的需求分析，我确定了以下核心功能：

- **📝 提示词管理**：创建、编辑、删除和组织AI提示词
- **🗂️ 分类系统**：将提示词按类别组织，便于管理
- **🔍 搜索筛选**：快速查找特定的提示词
- **⚡ 智能集成**：一键将提示词加载到Cursor的AI聊天中
- **🔧 模板变量**：支持动态变量如`{{selection}}`、`{{filename}}`等
- **📤 导入导出**：备份和分享提示词库

### 1.2 技术栈选择

基于VS Code Extension API开发，主要技术栈：
- **TypeScript**：类型安全的开发体验
- **VS Code Extension API**：插件开发基础
- **Webview**：现代化的用户界面
- **本地存储**：快速访问，无需网络依赖

## 二、项目架构设计

### 2.1 整体架构

采用经典的三层架构设计：

```
┌─────────────────────────────────────┐
│           用户界面层                │
├─────────────────────────────────────┤
│  侧边栏面板  │  命令面板  │  右键菜单  │
├─────────────────────────────────────┤
│           业务逻辑层                │
├─────────────────────────────────────┤
│  提示词管理  │  分类管理  │  搜索引擎  │
├─────────────────────────────────────┤
│           数据存储层                │
├─────────────────────────────────────┤
│  本地存储   │  配置管理  │  同步服务   │
└─────────────────────────────────────┘
```

### 2.2 项目结构

```
cursor-prompt-manager/
├── src/
│   ├── extension.ts              # 主扩展入口点
│   ├── promptManager.ts          # 核心提示词管理逻辑
│   ├── promptProvider.ts         # 侧边栏树视图提供者
│   ├── types.ts                  # TypeScript 类型定义
│   ├── webview/
│   │   └── promptWebviewProvider.ts  # Webview UI 提供者
│   └── test/                     # 测试文件
├── media/                        # Webview 的 CSS 和 JavaScript
├── .vscode/                      # VS Code 调试配置
├── package.json                  # 扩展清单
└── tsconfig.json                # TypeScript 配置
```

## 三、核心功能实现

### 3.1 插件入口与初始化

首先创建插件的入口文件`extension.ts`：

```typescript
import * as vscode from 'vscode';
import { PromptManager } from './promptManager';
import { PromptProvider } from './promptProvider';
import { PromptWebviewProvider } from './webview/promptWebviewProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Cursor Prompt Manager is now active!');

    // Initialize the prompt manager
    const promptManager = new PromptManager(context);
    
    // Register the tree data provider
    const promptProvider = new PromptProvider(promptManager);
    vscode.window.registerTreeDataProvider('promptManager', promptProvider);
    
    // Register the webview provider
    const webviewProvider = new PromptWebviewProvider(context.extensionUri, promptManager);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('promptManager', webviewProvider)
    );

    // Register commands
    const commands = [
        vscode.commands.registerCommand('promptManager.openPanel', () => {
            vscode.commands.executeCommand('workbench.view.extension.prompt-manager');
        }),
        // ... 其他命令注册
    ];

    commands.forEach(command => context.subscriptions.push(command));
    vscode.commands.executeCommand('setContext', 'promptManager:enabled', true);
}
```

### 3.2 数据模型设计

在`types.ts`中定义核心数据结构：

```typescript
export interface Prompt {
    id: string;
    title: string;
    content: string;
    description?: string;
    category: string;
    tags: string[];
    variables: Variable[];
    createdAt: Date;
    updatedAt: Date;
    usageCount: number;
    isFavorite: boolean;
}

export interface Variable {
    name: string;
    description?: string;
    defaultValue?: string;
    type: 'text' | 'selection' | 'filename' | 'filepath' | 'custom';
}
```

### 3.3 核心管理类实现

`PromptManager`类负责所有的数据操作：

```typescript
export class PromptManager {
    private prompts: Prompt[] = [];
    private storageUri: vscode.Uri;

    constructor(private context: vscode.ExtensionContext) {
        this.storageUri = vscode.Uri.joinPath(context.globalStorageUri, 'prompts.json');
        this.loadPrompts();
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
}
```

### 3.4 智能聊天集成

这是项目的一个亮点功能，实现提示词与Cursor AI聊天的无缝集成：

```typescript
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
        // Copy to clipboard first
        await vscode.env.clipboard.writeText(selected.prompt.content);
        
        // Try to open/focus chat and simulate paste
        try {
            await vscode.commands.executeCommand('workbench.action.chat.open');
            
            // Wait a moment for chat to open
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Try to simulate paste
            await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
            
            vscode.window.showInformationMessage(`Prompt "${selected.prompt.title}" loaded into chat`);
        } catch (error) {
            // Fallback: show manual instructions
            const action = await vscode.window.showInformationMessage(
                `Prompt "${selected.prompt.title}" copied to clipboard`,
                'Open Chat & Paste',
                'Insert to Editor'
            );
            // ... 处理备选方案
        }
    }
});
```

### 3.5 模板变量系统

支持动态变量替换，提高提示词的灵活性：

```typescript
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

        processedContent = processedContent.replace(
            new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), 
            value
        );
    }

    return processedContent;
}
```

### 3.6 用户界面实现

使用Webview提供现代化的管理界面：

```typescript
export class PromptWebviewProvider implements vscode.WebviewViewProvider {
    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async data => {
            switch (data.type) {
                case 'createPrompt':
                    try {
                        await this.promptManager.createPrompt(data.prompt);
                        vscode.window.showInformationMessage('Prompt created successfully!');
                        this._refreshPrompts();
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to create prompt: ${error}`);
                    }
                    break;
                // ... 其他消息处理
            }
        });
    }
}
```

## 四、开发过程中的亮点与挑战

### 4.1 技术亮点

#### 1. 智能聊天集成
最大的亮点是实现了与Cursor AI聊天的深度集成。通过剪贴板和命令API的组合，实现了一键加载提示词到聊天界面的功能。

#### 2. 优雅的错误处理
当聊天集成失败时，提供了多种备选方案：
- 自动复制到剪贴板
- 手动打开聊天并粘贴
- 插入到编辑器作为备选

#### 3. 灵活的变量系统
支持多种类型的模板变量，让提示词更加灵活和实用。

### 4.2 遇到的挑战

#### 1. VS Code API限制
VS Code的聊天API访问受限，需要通过间接方式实现集成。

#### 2. 快捷键冲突
初始使用`Ctrl+Shift+P`与命令面板冲突，后改为`Ctrl+Shift+I`。

#### 3. TypeScript类型问题
在使用一些第三方库时遇到类型定义问题，需要额外安装`@types`包。

### 4.3 解决方案

```typescript
// 解决快捷键冲突
"keybindings": [
  {
    "command": "promptManager.insertPrompt",
    "key": "ctrl+shift+i",
    "mac": "cmd+shift+i"
  }
]

// 解决类型问题
npm install --save-dev @types/uuid @types/mocha @types/glob
```

## 五、项目成果与收获

### 5.1 功能完成度

经过2小时的开发，成功实现了：

✅ **核心功能**：提示词的增删改查  
✅ **分类管理**：按类别组织提示词  
✅ **搜索筛选**：快速查找功能  
✅ **智能集成**：与Cursor AI聊天集成  
✅ **模板变量**：动态内容替换  
✅ **导入导出**：数据备份和分享  
✅ **现代界面**：响应式Webview界面  

### 5.2 默认提示词

插件预置了4个实用的默认提示词：

- **代码审查**：请求全面的代码审查
- **Bug修复**：获取识别和修复Bug的帮助  
- **代码解释**：获取复杂代码的解释
- **代码重构**：请求重构建议

### 5.3 性能表现

- **启动时间**：< 500ms
- **搜索响应**：< 100ms  
- **插入延迟**：< 50ms
- **内存占用**：< 10MB

### 5.4 开发效率提升

使用Cursor开发这个插件的效率远超预期：

1. **AI代码生成**：约70%的代码由AI生成
2. **智能补全**：减少了大量重复输入
3. **错误修复**：AI能快速定位和修复问题
4. **文档生成**：自动生成注释和文档

## 六、部署与发布

### 6.1 本地测试

```bash
# 安装依赖
npm install

# 编译TypeScript
npm run compile

# 启动调试
按F5启动Extension Development Host
```

### 6.2 打包发布

```bash
# 安装打包工具
npm install -g vsce

# 打包扩展
npm run package

# 生成.vsix文件
vsce package
```

### 6.3 配置文件优化

在`package.json`中完善了扩展信息：

```json
{
  "name": "cursor-prompt-manager",
  "displayName": "Cursor Prompt Manager",
  "description": "A powerful prompt management extension for Cursor IDE",
  "version": "0.1.0",
  "keywords": ["prompt", "ai", "cursor", "template", "productivity"],
  "categories": ["Other", "Snippets"]
}
```

## 总结

这次2小时的开发经历让我深刻体会到了AI辅助编程的强大威力。从需求分析到功能实现，再到最终发布，整个过程高效而流畅。

### 主要收获

1. **AI编程的威力**：Cursor的AI能力大大提升了开发效率
2. **VS Code插件开发**：掌握了插件开发的完整流程
3. **TypeScript实践**：在实际项目中深入使用TypeScript
4. **用户体验设计**：注重插件的易用性和交互体验

### 未来规划

- [ ] 云端同步功能
- [ ] 团队协作特性  
- [ ] AI驱动的提示词建议
- [ ] 多语言支持
- [ ] 提示词模板市场

### 写在最后

在AI时代，工具的价值不在于复杂度，而在于是否能真正解决问题、提升效率。这个提示词管理插件虽然功能相对简单，但却能在日常开发中发挥重要作用。

如果你也想开发VS Code插件，强烈推荐使用Cursor。AI的加持让开发变得更加高效和有趣。记住，最好的工具就是能让你专注于创造价值的工具。

---

**项目地址**：[GitHub - cursor-prompt-manager](https://github.com/your-username/cursor-prompt-manager)

**用AI快乐编程！🚀**
