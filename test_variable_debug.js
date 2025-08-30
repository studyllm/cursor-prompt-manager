// 测试变量替换功能的调试脚本
// 运行方法：在 VS Code 中按 F5 启动扩展开发主机，然后按照下面的步骤测试

/*
测试步骤：

1. 按 F5 启动扩展开发主机（Extension Development Host）
2. 在新窗口中打开测试文件：test_variable_replacement.md
3. 在文件中选中一些文字
4. 打开命令面板 (Cmd+Shift+P)
5. 输入并运行：Prompt Manager: Test System Variables (Direct)
6. 查看开发者控制台的日志输出
7. 检查剪贴板中的内容是否正确替换了变量

期望的日志输出应该包含：
- 🔧 Processing system variables for content: [原始内容]
- 🔧 Editor document URI: [文件URI]
- 🔧 Selected text content: [选中的文本]
- 🔧 Filename: "test_variable_replacement.md"
- 🔧 Filepath: [完整路径]
- 🔧 Final processed content: [替换后的内容]

如果变量没有被替换，可能的问题：
1. editor 对象为 null 或无效
2. 正则表达式匹配问题
3. 编码问题导致特殊字符无法匹配
4. 上下文问题导致方法无法访问正确的editor

调试要点：
- 检查 console.log 输出中是否显示了正确的文件信息
- 确认 selectedText 变量是否包含预期的文本
- 验证 replace 操作是否被执行
*/

console.log('变量替换调试指南已加载');
console.log('请按照文件中的说明进行测试');

// 模拟测试的变量替换逻辑（用于调试）
function simulateVariableReplacement() {
    const testContent = `当前选中文本: {{selection}}
文件名: {{filename}}
文件路径: {{filepath}}`;

    const mockSelectedText = "这是选中的文本";
    const mockFilename = "test_file.md";
    const mockFilepath = "/path/to/test_file.md";

    let result = testContent;
    result = result.replace(/\{\{selection\}\}/g, mockSelectedText);
    result = result.replace(/\{\{filename\}\}/g, mockFilename);
    result = result.replace(/\{\{filepath\}\}/g, mockFilepath);

    console.log('模拟测试结果:');
    console.log('原始:', testContent);
    console.log('替换后:', result);
    
    return result;
}

// 测试正则表达式
function testRegexPatterns() {
    const patterns = [
        /\{\{selection\}\}/g,
        /\{\{filename\}\}/g,
        /\{\{filepath\}\}/g
    ];
    
    const testString = "测试 {{selection}} 和 {{filename}} 以及 {{filepath}}";
    
    console.log('正则表达式测试:');
    patterns.forEach((pattern, index) => {
        const matches = testString.match(pattern);
        console.log(`Pattern ${index + 1}:`, pattern, 'Matches:', matches);
    });
}

// 运行测试
simulateVariableReplacement();
testRegexPatterns(); 