/**
 * 调试 Select Prompt 变量处理问题
 * 
 * 这个脚本帮助诊断为什么 Select Prompt -> Insert to Editor 路径中变量没有被替换
 */

const testPrompts = [
    {
        id: "test-system-vars",
        title: "系统变量测试",
        content: `# 系统变量测试

## 文件信息
- 文件名：{{filename}}
- 文件路径：{{filepath}}

## 选中内容
{{selection}}

## 测试结果
如果上面的变量被正确替换，说明功能正常。`,
        category: "测试",
        variables: [], // 空的变量数组
        description: "测试系统变量替换功能",
        tags: ["test"],
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        isFavorite: false
    }
];

// 模拟的测试场景
const testScenarios = [
    {
        name: "有选中文本的文件",
        fileInfo: {
            filename: "test.js",
            filepath: "/path/to/test.js",
            selection: "console.log('Hello World');"
        }
    },
    {
        name: "没有选中文本的文件", 
        fileInfo: {
            filename: "empty.ts",
            filepath: "/path/to/empty.ts",
            selection: ""
        }
    },
    {
        name: "未保存的新文件",
        fileInfo: {
            filename: "未保存文件-new",
            filepath: "untitled:new",
            selection: "// 新文件内容"
        }
    }
];

// 调试检查点
const debugChecks = [
    "1. Select Prompt 命令是否正确调用了 insertPrompt？",
    "2. insertPrompt 是否正确调用了 processSystemVariables？", 
    "3. processSystemVariables 是否正确处理了变量？",
    "4. 最终内容是否正确插入到编辑器？",
    "5. 是否有任何异常或错误被忽略？"
];

// 预期 vs 实际结果对比
function compareResults(expected, actual) {
    console.log("=== 结果对比 ===");
    console.log("预期结果：");
    console.log(expected);
    console.log("\n实际结果：");
    console.log(actual);
    console.log("\n差异分析：");
    
    if (expected === actual) {
        console.log("✅ 结果完全匹配");
    } else {
        console.log("❌ 结果不匹配");
        
        // 检查系统变量
        const systemVars = ['{{filename}}', '{{filepath}}', '{{selection}}'];
        systemVars.forEach(varName => {
            if (expected.includes(varName) && actual.includes(varName)) {
                console.log(`❌ ${varName} 没有被替换`);
            } else if (!expected.includes(varName) && !actual.includes(varName)) {
                console.log(`✅ ${varName} 被正确替换`);
            }
        });
    }
}

// 测试步骤
const testSteps = [
    "1. 创建包含系统变量的测试提示词",
    "2. 打开文件并选中一些文本",
    "3. 执行 Select Prompt 命令",
    "4. 选择测试提示词",
    "5. 点击 'Insert to Editor'",
    "6. 检查插入的内容是否正确替换了变量",
    "7. 对比和直接测试命令的结果差异"
];

console.log("🔍 Select Prompt 变量处理调试指南");
console.log("=====================================");

console.log("\n📋 测试提示词：");
console.log(JSON.stringify(testPrompts[0], null, 2));

console.log("\n🧪 测试场景：");
testScenarios.forEach((scenario, index) => {
    console.log(`${index + 1}. ${scenario.name}:`);
    console.log(`   - 文件名: ${scenario.fileInfo.filename}`);
    console.log(`   - 路径: ${scenario.fileInfo.filepath}`);
    console.log(`   - 选中: "${scenario.fileInfo.selection}"`);
});

console.log("\n🔧 调试检查点：");
debugChecks.forEach((check, index) => {
    console.log(`${index + 1}. ${check}`);
});

console.log("\n📝 测试步骤：");
testSteps.forEach(step => {
    console.log(step);
});

console.log("\n💡 调试提示：");
console.log("1. 查看VS Code开发者控制台中以 '🔧' 开头的日志");
console.log("2. 对比 insertPrompt 和 testSystemVariablesDirect 的日志输出");
console.log("3. 检查是否有异常被捕获但没有显示");
console.log("4. 验证 prompt.variables 字段是否存在且为数组");

module.exports = {
    testPrompts,
    testScenarios,
    debugChecks,
    compareResults,
    testSteps
}; 