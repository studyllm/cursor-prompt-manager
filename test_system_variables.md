# 测试系统变量

## 文件信息
- 当前文件名: {{filename}}
- 完整路径: {{filepath}}

## 选中的内容
```
{{selection}}
```

## 测试说明
这个提示词用于测试系统变量是否能正确替换：
1. {{filename}} 应该显示当前文件名
2. {{filepath}} 应该显示完整文件路径
3. {{selection}} 应该显示选中的代码内容

请在VS Code中：
1. 打开任意代码文件
2. 选中一段代码
3. 运行 "Prompt Manager: Select Prompt" 命令
4. 选择这个测试提示词
5. 点击 "Insert to Editor"
6. 检查变量是否被正确替换 