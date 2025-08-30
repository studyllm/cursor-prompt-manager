# 多窗口提示词数据同步问题排查和解决方案

## 问题分析

通过深入代码分析，发现了以下导致多窗口数据不同步的关键问题：

### 1. 数据存储路径不一致
**问题**：原实现使用 `context.globalStorageUri`，在不同VS Code窗口中可能指向不同路径
```typescript
// 有问题的实现
this.storageUri = vscode.Uri.joinPath(context.globalStorageUri, 'prompts.json');
```

**解决方案**：使用固定的用户目录路径
```typescript
// 改进的实现
private getGlobalStoragePath(): vscode.Uri {
    const os = require('os');
    const path = require('path');
    const homeDir = os.homedir();
    const storageDir = path.join(homeDir, '.vscode', 'cursor-prompt-manager');
    const storagePath = path.join(storageDir, 'prompts.json');
    return vscode.Uri.file(storagePath);
}
```

### 2. 文件监听机制不完善
**问题**：
- 使用相对路径监听可能失效
- 缺少文件修改时间检查，导致重复加载
- 没有防止并发同步的机制

**解决方案**：
- 使用绝对路径监听
- 添加文件修改时间检查
- 实现同步锁机制

### 3. 缺少主动同步机制
**问题**：完全依赖文件监听，但文件监听可能失效
**解决方案**：添加定期检查和手动刷新机制

## 实施的改进措施

### 1. 统一存储路径
- ✅ 所有窗口使用相同的绝对路径：`~/.vscode/cursor-prompt-manager/prompts.json`
- ✅ 确保目录自动创建

### 2. 改进文件监听
- ✅ 使用绝对路径监听文件变化
- ✅ 添加文件修改时间检查，避免重复加载
- ✅ 实现同步锁（`syncInProgress`）防止并发冲突

### 3. 多层同步机制
- ✅ **主要机制**：文件系统监听器
- ✅ **备用机制**：定期检查（每10秒）
- ✅ **手动机制**：强制刷新命令

### 4. 增强错误处理
- ✅ 详细的日志记录
- ✅ 优雅的错误处理
- ✅ 防止内存泄漏

## 新增功能

### 强制刷新命令
```typescript
vscode.commands.registerCommand('promptManager.forceRefresh', async () => {
    await promptManager.forceSync();
    promptProvider.refresh();
});
```

### 智能同步检查
```typescript
private async checkAndReloadPrompts(): Promise<void> {
    const stat = await vscode.workspace.fs.stat(this.storageUri);
    const fileModTime = stat.mtime;
    
    if (fileModTime > this.lastFileModificationTime) {
        await this.reloadPrompts();
        this.lastFileModificationTime = fileModTime;
    }
}
```

## 测试验证

### 测试场景

#### 1. 基础同步测试
1. 打开两个VS Code窗口
2. 在窗口A中创建新提示词
3. 检查窗口B是否自动更新

#### 2. 外部修改测试
1. 使用演示脚本修改prompts.json：
   ```bash
   node demo_refresh.js add
   ```
2. 检查所有窗口是否同步更新

#### 3. 手动刷新测试
1. 运行命令：`Prompt Manager: Force Refresh`
2. 验证数据是否正确同步

#### 4. 并发修改测试
1. 在多个窗口同时修改不同提示词
2. 验证数据一致性

### 验证步骤

1. **启动测试**
   ```bash
   # 按F5启动扩展开发主机
   # 打开多个VS Code窗口
   ```

2. **检查存储路径**
   ```bash
   ls -la ~/.vscode/cursor-prompt-manager/
   ```

3. **查看控制台日志**
   - 检查文件监听器是否正确设置
   - 确认数据加载和保存日志

4. **使用演示脚本**
   ```bash
   node demo_refresh.js demo  # 运行完整演示
   ```

## 问题排查指南

### 如果同步仍然不工作

#### 1. 检查文件路径
```javascript
// 在开发者控制台中运行
console.log('Storage path:', promptManager.storageUri.fsPath);
```

#### 2. 检查文件权限
```bash
ls -la ~/.vscode/cursor-prompt-manager/
```

#### 3. 检查文件监听器
- 查看控制台是否有 "File watcher setup for" 日志
- 确认没有权限错误

#### 4. 手动触发同步
- 使用命令面板：`Prompt Manager: Force Refresh`
- 检查是否有错误消息

#### 5. 清理并重置
```bash
# 备份数据
cp ~/.vscode/cursor-prompt-manager/prompts.json ~/prompts_backup.json

# 删除存储目录
rm -rf ~/.vscode/cursor-prompt-manager/

# 重启VS Code，数据会重新初始化
```

## 性能考虑

### 优化措施
- ✅ 使用文件修改时间避免不必要的重新加载
- ✅ 同步锁防止重复操作
- ✅ 静默处理定期检查的错误

### 监控指标
- 文件读写频率
- 事件触发次数
- 内存使用情况

## 后续改进建议

1. **增量同步**：只同步变更的部分，而不是整个文件
2. **冲突解决**：处理多窗口同时修改同一提示词的情况
3. **版本控制**：为数据添加版本号，便于冲突检测
4. **云端同步**：支持跨设备同步（未来功能）

## 总结

通过以上改进，多窗口同步问题应该得到显著改善：

- ✅ **统一存储**：所有窗口使用相同路径
- ✅ **多层保障**：文件监听 + 定期检查 + 手动刷新
- ✅ **防止冲突**：同步锁和时间戳检查
- ✅ **完善日志**：便于问题排查

如果仍有同步问题，请查看控制台日志并按照排查指南进行调试。 