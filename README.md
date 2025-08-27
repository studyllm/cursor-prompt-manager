# Cursor 提示词管理器

一个强大的 Cursor IDE 提示词管理扩展，帮助开发者组织、管理和快速插入 AI 提示词，提高编程效率。

## 功能特性

- **📝 提示词管理**：创建、编辑、删除和组织您的 AI 提示词
- **🗂️ 分类系统**：将提示词按类别组织，便于管理
- **🔍 搜索和筛选**：通过搜索和分类筛选快速查找提示词
- **⚡ 智能聊天集成**：一键自动将提示词加载到 Cursor 的 AI 聊天中
- **🔧 模板变量**：支持动态变量，如 `{{selection}}`、`{{filename}}` 等
- **📤 导入/导出**：备份和分享您的提示词库
- **📊 使用统计**：跟踪每个提示词的使用频率
- **🎨 现代化界面**：简洁、响应式的界面，适配 VS Code 主题
- **🗑️ 高级删除**：多种删除提示词的方式，带确认对话框

## 安装

### 从源码安装（开发版）

1. 克隆或下载此仓库
2. 在 VS Code 中打开项目
3. 运行 `npm install` 安装依赖
4. 按 `F5` 在新的扩展开发主机窗口中启动扩展

### 从市场安装（即将推出）

扩展发布后将在 VS Code 市场中提供。

## 快速开始

1. **打开提示词管理器**：点击活动栏中的提示词管理器图标或使用 `Ctrl+Alt+P`（Mac 上为 `Cmd+Alt+P`）

2. **创建您的第一个提示词**：
   - 点击提示词管理器面板中的"+"按钮
   - 输入标题、类别和内容
   - 使用 `{{selection}}` 等变量创建动态内容

3. **在 AI 聊天中使用提示词**：
   - 使用 `Ctrl+Shift+I`（Mac 上为 `Cmd+Shift+I`）打开快速选择器
   - 直接点击提示词管理器面板中的提示词加载到聊天中
   - 提示词会自动复制到剪贴板并加载到 Cursor 的 AI 聊天中
   - 如果聊天集成失败，可选择插入到编辑器中

## 默认提示词

扩展预置了几个实用的默认提示词：

- **代码审查**：请求全面的代码审查
- **Bug 修复**：获取识别和修复 Bug 的帮助
- **代码解释**：获取复杂代码的解释
- **代码重构**：请求重构建议

## 模板变量

在提示词中使用这些变量创建动态内容：

- `{{selection}}` - 当前选中的文本
- `{{filename}}` - 当前文件名
- `{{filepath}}` - 完整文件路径
- 自定义变量在使用时会提示输入

## 命令

- `Prompt Manager: Open Panel` - 打开提示词管理面板
- `Prompt Manager: Insert Prompt` - 快速选择器，将提示词加载到聊天或编辑器中
- `Prompt Manager: Create New Prompt` - 创建新提示词
- `Prompt Manager: Import Prompts` - 从 JSON 文件导入提示词
- `Prompt Manager: Export Prompts` - 将提示词导出到 JSON 文件
- `Prompt Manager: Delete Prompt...` - 选择并确认删除提示词

## 快捷键

- `Ctrl+Alt+P`（`Cmd+Alt+P`）- 打开提示词管理器面板
- `Ctrl+Shift+I`（`Cmd+Shift+I`）- 快速选择器，将提示词加载到聊天中
- 在编辑器中右键 → "Insert Prompt" - 上下文菜单访问

## 配置

通过 `文件 > 首选项 > 设置` 访问设置，搜索"Prompt Manager"：

- `promptManager.autoSave` - 修改时自动保存提示词
- `promptManager.showPreview` - 插入前显示提示词预览
- `promptManager.enableSync` - 启用云端同步（未来功能）
- `promptManager.defaultCategory` - 新提示词的默认类别

## 开发

### 项目结构

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

### 构建

```bash
# 安装依赖
npm install

# 编译 TypeScript
npm run compile

# 开发时监听变化
npm run watch

# 打包分发
npm run package
```

### 测试

```bash
# 运行测试
npm test

# 运行代码检查
npm run lint
```

## 贡献

1. Fork 仓库
2. 创建功能分支
3. 进行修改
4. 如适用，添加测试
5. 提交 Pull Request

## 许可证

本项目采用 MIT 许可证 - 详见 LICENSE 文件。

## 最新更新

### v0.1.0 功能
- ✅ **智能聊天集成**：提示词自动加载到 Cursor 的 AI 聊天中
- ✅ **改进的快捷键**：更改为 `Ctrl+Shift+I` 以避免冲突
- ✅ **增强删除功能**：多种删除方法，带确认对话框
- ✅ **剪贴板集成**：手动粘贴场景的自动复制
- ✅ **优雅降级**：聊天集成失败时的优雅处理

## 路线图

- [ ] 云端同步
- [ ] 团队协作功能
- [ ] AI 驱动的提示词建议
- [ ] 多语言支持
- [ ] 高级变量系统
- [ ] 提示词模板市场
- [ ] 增强的聊天集成，更好的 API 支持

## 支持

如果您遇到任何问题或有功能请求，请在 GitHub 仓库中创建 issue。

---

**用 AI 快乐编程！🚀**
