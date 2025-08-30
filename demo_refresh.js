#!/usr/bin/env node

/**
 * 演示脚本：模拟外部修改prompts.json文件
 * 用于测试扩展的实时刷新功能
 */

const fs = require('fs');
const path = require('path');

const PROMPTS_FILE = path.join(__dirname, 'prompts.json');

// 读取现有的提示词数据
function loadPrompts() {
    try {
        if (fs.existsSync(PROMPTS_FILE)) {
            const data = fs.readFileSync(PROMPTS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('读取prompts.json失败:', error.message);
    }
    return { prompts: [], categories: [], nextId: 1 };
}

// 保存提示词数据
function savePrompts(data) {
    try {
        fs.writeFileSync(PROMPTS_FILE, JSON.stringify(data, null, 2), 'utf8');
        console.log('✅ 已保存到 prompts.json');
    } catch (error) {
        console.error('❌ 保存失败:', error.message);
    }
}

// 添加测试提示词
function addTestPrompt() {
    const data = loadPrompts();
    
    const newPrompt = {
        id: data.nextId++,
        title: `测试提示词 ${Date.now()}`,
        content: `这是一个由演示脚本创建的测试提示词。\n\n创建时间: ${new Date().toLocaleString()}\n\n请对以下{{language}}代码进行分析：\n\n\`\`\`{{language}}\n{{code}}\n\`\`\``,
        category: "测试",
        usageCount: 0,
        variables: [
            {
                name: "language",
                type: "select",
                description: "编程语言",
                options: ["JavaScript", "TypeScript", "Python", "Java"],
                required: true
            },
            {
                name: "code",
                type: "multiline", 
                description: "需要分析的代码",
                required: true
            }
        ]
    };
    
    data.prompts.push(newPrompt);
    
    // 确保类别存在
    if (!data.categories.includes("测试")) {
        data.categories.push("测试");
    }
    
    savePrompts(data);
    console.log(`🆕 添加了新提示词: "${newPrompt.title}"`);
}

// 修改现有提示词
function modifyPrompt() {
    const data = loadPrompts();
    
    if (data.prompts.length === 0) {
        console.log('📝 没有可修改的提示词，先添加一个...');
        addTestPrompt();
        return;
    }
    
    // 修改第一个提示词
    const prompt = data.prompts[0];
    prompt.title = `${prompt.title} (已修改)`;
    prompt.content = `${prompt.content}\n\n--- 修改时间: ${new Date().toLocaleString()} ---`;
    
    savePrompts(data);
    console.log(`✏️ 修改了提示词: "${prompt.title}"`);
}

// 删除测试提示词
function deleteTestPrompts() {
    const data = loadPrompts();
    const originalCount = data.prompts.length;
    
    data.prompts = data.prompts.filter(prompt => !prompt.title.includes('测试提示词'));
    
    const deletedCount = originalCount - data.prompts.length;
    
    savePrompts(data);
    console.log(`🗑️ 删除了 ${deletedCount} 个测试提示词`);
}

// 主函数
function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';
    
    console.log('🔄 Cursor 提示词管理器 - 实时刷新演示脚本');
    console.log('=' .repeat(50));
    
    switch (command) {
        case 'add':
            addTestPrompt();
            break;
        case 'modify':
            modifyPrompt();
            break;
        case 'delete':
            deleteTestPrompts();
            break;
        case 'demo':
            console.log('🎬 开始演示...');
            console.log('1. 添加测试提示词...');
            addTestPrompt();
            setTimeout(() => {
                console.log('2. 修改提示词...');
                modifyPrompt();
                setTimeout(() => {
                    console.log('3. 演示完成！');
                    console.log('💡 请检查VS Code中的提示词管理器面板是否实时更新');
                }, 2000);
            }, 2000);
            break;
        default:
            console.log('使用方法:');
            console.log('  node demo_refresh.js add     - 添加测试提示词');
            console.log('  node demo_refresh.js modify  - 修改现有提示词');
            console.log('  node demo_refresh.js delete  - 删除测试提示词');
            console.log('  node demo_refresh.js demo    - 运行完整演示');
            console.log('');
            console.log('💡 在运行脚本时，请保持VS Code的提示词管理器面板打开，');
            console.log('   观察界面是否实时刷新。');
    }
}

main(); 