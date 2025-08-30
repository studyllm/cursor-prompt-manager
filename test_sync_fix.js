#!/usr/bin/env node

/**
 * 快速同步修复验证脚本
 * 用于测试多窗口数据同步是否正常工作
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// 获取统一的存储路径（与扩展中的实现保持一致）
const getStoragePath = () => {
    const homeDir = os.homedir();
    const storageDir = path.join(homeDir, '.vscode', 'cursor-prompt-manager');
    const storagePath = path.join(storageDir, 'prompts.json');
    return { storageDir, storagePath };
};

// 创建测试数据
const createTestData = () => {
    return [
        {
            id: `test-${Date.now()}`,
            title: `同步测试提示词 ${new Date().toLocaleString()}`,
            content: `这是一个用于测试多窗口同步功能的提示词。\n\n创建时间: ${new Date().toISOString()}\n\n如果您在其他VS Code窗口中看到了这个提示词，说明同步功能正常工作！`,
            category: "同步测试",
            description: "用于验证多窗口数据同步功能",
            tags: ["测试", "同步"],
            variables: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            usageCount: 0,
            isFavorite: false
        }
    ];
};

// 读取现有数据
const loadExistingData = (storagePath) => {
    try {
        if (fs.existsSync(storagePath)) {
            const content = fs.readFileSync(storagePath, 'utf8');
            return JSON.parse(content);
        }
    } catch (error) {
        console.error('读取现有数据失败:', error.message);
    }
    return [];
};

// 保存数据
const saveData = (storagePath, data) => {
    try {
        fs.writeFileSync(storagePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('保存数据失败:', error.message);
        return false;
    }
};

// 确保目录存在
const ensureDirectory = (dirPath) => {
    try {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`✅ 创建存储目录: ${dirPath}`);
        }
        return true;
    } catch (error) {
        console.error('创建目录失败:', error.message);
        return false;
    }
};

// 检查文件状态
const checkFileStatus = (storagePath) => {
    try {
        if (fs.existsSync(storagePath)) {
            const stats = fs.statSync(storagePath);
            console.log(`📄 文件信息:`);
            console.log(`   路径: ${storagePath}`);
            console.log(`   大小: ${stats.size} 字节`);
            console.log(`   修改时间: ${stats.mtime.toLocaleString()}`);
            
            const content = fs.readFileSync(storagePath, 'utf8');
            const data = JSON.parse(content);
            console.log(`   提示词数量: ${data.length}`);
            
            return { exists: true, stats, dataCount: data.length };
        } else {
            console.log(`❌ 文件不存在: ${storagePath}`);
            return { exists: false };
        }
    } catch (error) {
        console.error('检查文件状态失败:', error.message);
        return { exists: false, error: error.message };
    }
};

// 主函数
const main = () => {
    const { storageDir, storagePath } = getStoragePath();
    
    console.log('🔍 多窗口同步修复验证');
    console.log('=' .repeat(50));
    console.log(`📁 存储目录: ${storageDir}`);
    console.log(`📄 存储文件: ${storagePath}`);
    console.log('');
    
    // 检查目录和文件状态
    console.log('1. 检查当前状态...');
    const dirExists = fs.existsSync(storageDir);
    console.log(`   存储目录存在: ${dirExists ? '✅' : '❌'}`);
    
    const fileStatus = checkFileStatus(storagePath);
    console.log('');
    
    // 确保目录存在
    console.log('2. 确保存储目录存在...');
    if (!ensureDirectory(storageDir)) {
        process.exit(1);
    }
    console.log('');
    
    // 读取现有数据
    console.log('3. 读取现有数据...');
    const existingData = loadExistingData(storagePath);
    console.log(`   现有提示词数量: ${existingData.length}`);
    console.log('');
    
    // 添加测试数据
    console.log('4. 添加测试数据...');
    const testData = createTestData();
    const newData = [...existingData, ...testData];
    
    if (saveData(storagePath, newData)) {
        console.log(`✅ 成功添加测试数据！`);
        console.log(`   新增提示词: ${testData[0].title}`);
        console.log(`   总数量: ${newData.length}`);
    } else {
        console.log(`❌ 添加测试数据失败`);
        process.exit(1);
    }
    console.log('');
    
    // 验证保存结果
    console.log('5. 验证保存结果...');
    const finalStatus = checkFileStatus(storagePath);
    console.log('');
    
    // 同步验证指南
    console.log('🧪 同步验证指南');
    console.log('-' .repeat(30));
    console.log('现在请按以下步骤验证多窗口同步：');
    console.log('');
    console.log('1. 确保VS Code的Cursor提示词管理器扩展正在运行');
    console.log('2. 打开提示词管理器面板（多个窗口）');
    console.log('3. 检查是否出现新的测试提示词：');
    console.log(`   "${testData[0].title}"`);
    console.log('4. 如果看到了新提示词，说明同步功能正常');
    console.log('5. 如果没有看到，请尝试：');
    console.log('   - 运行命令 "Prompt Manager: Force Refresh"');
    console.log('   - 重启VS Code');
    console.log('   - 检查控制台错误信息');
    console.log('');
    
    // 清理选项
    console.log('🧹 清理选项');
    console.log('-' .repeat(20));
    console.log('如需清理测试数据，运行：');
    console.log(`node ${path.basename(__filename)} clean`);
};

// 清理函数
const cleanup = () => {
    const { storagePath } = getStoragePath();
    
    console.log('🧹 清理测试数据...');
    
    const existingData = loadExistingData(storagePath);
    const cleanedData = existingData.filter(prompt => 
        !prompt.title.includes('同步测试提示词') && 
        prompt.category !== '同步测试'
    );
    
    if (saveData(storagePath, cleanedData)) {
        console.log(`✅ 清理完成！`);
        console.log(`   删除数量: ${existingData.length - cleanedData.length}`);
        console.log(`   剩余数量: ${cleanedData.length}`);
    } else {
        console.log(`❌ 清理失败`);
    }
};

// 命令行参数处理
const args = process.argv.slice(2);
const command = args[0];

if (command === 'clean') {
    cleanup();
} else {
    main();
} 