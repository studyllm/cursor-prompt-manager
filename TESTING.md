# 测试变量模板功能

## 如何测试

1. **启动扩展开发模式**
   ```bash
   npm run compile
   code . --extensionDevelopmentHost
   ```

2. **创建测试模板**
   - 按 `Ctrl+Shift+P` (Mac: `Cmd+Shift+P`) 打开命令面板
   - 输入 "Create Test Template" 并执行
   - 系统会自动创建一个包含各种变量类型的测试模板

3. **测试变量功能**
   - 创建测试模板后，使用 `Ctrl+Shift+I` (Mac: `Cmd+Shift+I`) 选择并插入这个测试模板
   - 系统会提示你填写各种类型的变量：
     - **文本输入**: title, projectName, developer
     - **日期选择**: startDate
     - **下拉选择**: priority, projectType
     - **多行文本**: description
     - **数字输入**: estimatedHours
     - **自动填充**: selection (当前选中文本), filename, filepath

## 测试的变量类型

### 1. 文本类型 (text)
- `title`: 必填，带占位符
- `projectName`: 必填，带默认值
- `developer`: 可选，带占位符

### 2. 日期类型 (date)
- `startDate`: 必填日期选择

### 3. 选择类型 (select)
- `priority`: 带默认值的下拉选择
- `projectType`: 必填的下拉选择

### 4. 多行文本 (multiline)
- `description`: 必填的多行文本输入

### 5. 数字类型 (number)
- `estimatedHours`: 数字输入，带默认值

### 6. 自动变量
- `selection`: 当前选中的代码
- `filename`: 当前文件名
- `filepath`: 当前文件路径

## 预期结果

插入的模板应该包含所有填写的变量值，并且自动变量应该正确显示当前编辑器的信息。

## 注意事项

- 必填字段如果未填写，应该阻止模板插入
- 默认值应该正确显示在输入框中
- 日期格式应该符合本地化要求
- 下拉选择应该显示所有可选项 