# 🔍 Select Prompt 变量替换调试指南

## 🎯 **问题描述**

用户报告：使用 `TEST_VARIABLE_FIXES.md` 中的测试指令可以正常获取系统变量内容，但使用正常的 Select Prompt 粘贴完成后，变量内容没有被替换。

## 🔧 **已实施的修复**

### 1️⃣ **修复了 insertPrompt 方法中的潜在问题**
- ✅ 添加了对 `prompt.variables` 的空值检查
- ✅ 增强了调试日志输出
- ✅ 添加了错误处理机制

### 2️⃣ **调试增强**
- ✅ 添加了详细的执行日志
- ✅ 包含了编辑器状态信息
- ✅ 跟踪变量处理的每个步骤

---

## 🧪 **调试测试步骤**

### **第一步：创建测试提示词**

创建一个包含系统变量的测试提示词：

```markdown
# 系统变量测试

## 文件信息
- 文件名：{{filename}}
- 文件路径：{{filepath}}

## 选中内容
{{selection}}

## 测试说明
如果上面的变量被正确替换，说明功能正常。
```

### **第二步：执行对比测试**

1. **直接测试命令（已知正常工作）**：
   - 执行 `Cmd+Shift+P` → `测试系统变量（直接）`
   - 输入测试内容：`文件：{{filename}}，选中：{{selection}}`
   - 检查结果是否正确

2. **Select Prompt 测试（问题路径）**：
   - 执行 `Cmd+Shift+P` → `Prompt Manager: Select Prompt`
   - 选择上述测试提示词
   - 点击 `Insert to Editor`
   - 检查插入的内容

### **第三步：查看调试日志**

1. 打开 VS Code 开发者工具：
   - `Help` → `Toggle Developer Tools`
   - 切换到 `Console` 标签

2. 查找特定的日志标记：
   - 🔧 开头：正常流程日志
   - 🚨 开头：错误信息
   - ⚠️ 开头：警告信息

3. 关键日志检查点：
   ```
   🔧 insertPrompt - Starting with prompt: {...}
   🔧 insertPrompt - Original content: "..."
   🔧 insertPrompt - About to process system variables...
   🔧 Processing system variables for content: ...
   🔧 insertPrompt - After system variables: "..."
   🔧 insertPrompt - Edit operation success: true/false
   ```

---

## 🔍 **问题诊断清单**

### ✅ **流程检查**
- [ ] Select Prompt 命令是否正确调用了 `insertPrompt`
- [ ] `insertPrompt` 是否正确调用了 `processSystemVariables`
- [ ] `processSystemVariables` 是否实际执行了变量替换
- [ ] 最终内容是否成功插入到编辑器

### ✅ **数据检查**
- [ ] 提示词内容是否包含正确的变量语法 `{{variable}}`
- [ ] `prompt.variables` 字段是否存在且为数组
- [ ] 编辑器状态是否正常（文件已打开、有选中内容等）

### ✅ **错误检查**
- [ ] 是否有任何 JavaScript 错误被抛出
- [ ] 是否有异步操作失败
- [ ] 是否有权限或文件访问问题

---

## 🐛 **常见问题及解决方案**

### **问题1：变量语法错误**
- **症状**：变量没有被替换
- **检查**：确认使用 `{{variableName}}` 而不是 `{variableName}` 或其他格式

### **问题2：编辑器状态问题**
- **症状**：文件名或路径为空
- **解决**：确保文件已保存，或检查未保存文件的处理逻辑

### **问题3：异步操作问题**
- **症状**：部分变量被替换，部分没有
- **检查**：查看是否有异步操作被中断

### **问题4：权限问题**
- **症状**：插入操作失败
- **检查**：确认编辑器是否为只读状态

---

## 🚀 **快速诊断命令**

使用以下命令进行快速诊断：

### **命令1：直接对比测试**
```
1. 执行 "测试系统变量（直接）"
2. 输入：文件{{filename}}选中{{selection}}
3. 记录结果 A
4. 执行 "Select Prompt" → 选择测试提示词 → "Insert to Editor"  
5. 记录结果 B
6. 对比 A 和 B 的差异
```

### **命令2：日志分析**
```
1. 清空开发者控制台
2. 执行 Select Prompt 操作
3. 检查控制台输出
4. 查找错误或异常日志
```

---

## 📊 **测试报告模板**

### **测试环境**
- VS Code 版本：
- 插件版本：
- 操作系统：

### **测试结果**
- [ ] 直接测试命令：正常/异常
- [ ] Select Prompt → Paste in Chat：正常/异常  
- [ ] Select Prompt → Insert to Editor：正常/异常

### **日志摘要**
```
// 粘贴关键的控制台日志
```

### **问题描述**
```
// 详细描述观察到的问题
```

---

## 💡 **下一步行动**

根据测试结果：

1. **如果日志显示变量处理正常，但插入失败**：
   - 检查编辑器权限和状态
   - 验证插入位置是否正确

2. **如果变量处理过程中有错误**：
   - 检查 `processSystemVariables` 方法
   - 验证编辑器文档状态

3. **如果没有调用 `insertPrompt`**：
   - 检查 Select Prompt 命令的实现
   - 验证用户操作流程

4. **如果问题持续存在**：
   - 提供详细的日志输出
   - 创建最小化复现案例

---

*调试指南版本: 1.0*  
*最后更新: 2024-01-XX* 