#!/usr/bin/env node

/**
 * 多窗口同步功能全面测试脚本
 * 模拟多个窗口的操作，验证数据同步是否正常
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// 获取存储路径
const getStoragePath = () => {
    const homeDir = os.homedir();
    const storageDir = path.join(homeDir, '.vscode', 'cursor-prompt-manager');
    const storagePath = path.join(storageDir, 'prompts.json');
    return { storageDir, storagePath };
};

// 读取数据
const loadData = (storagePath) => {
    try {
        if (fs.existsSync(storagePath)) {
            const content = fs.readFileSync(storagePath, 'utf8');
            return JSON.parse(content);
        }
    } catch (error) {
        console.error('读取数据失败:', error.message);
    }
    return [];
};

// 保存数据
const saveData = (storagePath, data) => {
    try {
        fs.writeFileSync(storagePath, JSON.stringify(data, null, 2), 'utf8');
        const stats = fs.statSync(storagePath);
        return { success: true, modTime: stats.mtime };
    } catch (error) {
        console.error('保存数据失败:', error.message);
        return { success: false, error: error.message };
    }
};

// 创建测试提示词
const createTestPrompt = (windowId, index = 1) => {
    const timestamp = new Date().toISOString();
    return {
        id: `window-${windowId}-test-${Date.now()}-${index}`,
        title: `窗口 ${windowId} 测试提示词 #${index}`,
        content: `这是从窗口 ${windowId} 创建的第 ${index} 个测试提示词。\n\n创建时间: ${timestamp}\n\n用于验证多窗口同步功能。`,
        category: `窗口 ${windowId} 测试`,
        description: `由窗口 ${windowId} 创建的测试提示词`,
        tags: ["测试", `窗口${windowId}`, "同步"],
        variables: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        usageCount: 0,
        isFavorite: false
    };
};

// 模拟窗口操作
const simulateWindowOperation = async (windowId, operation, delay = 1000) => {
    const { storagePath } = getStoragePath();
    
    console.log(`\n🖼️  窗口 ${windowId}: 执行 ${operation} 操作`);
    
    // 等待一段时间模拟用户操作
    await new Promise(resolve => setTimeout(resolve, delay));
    
    const currentData = loadData(storagePath);
    let newData = [...currentData];
    
    switch (operation) {
        case 'create':
            const newPrompt = createTestPrompt(windowId);
            newData.push(newPrompt);
            console.log(`   📝 创建提示词: ${newPrompt.title}`);
            break;
            
        case 'modify':
            if (currentData.length > 0) {
                const randomIndex = Math.floor(Math.random() * currentData.length);
                newData[randomIndex] = {
                    ...currentData[randomIndex],
                    content: `${currentData[randomIndex].content}\n\n[窗口 ${windowId} 在 ${new Date().toLocaleString()} 修改]`,
                    updatedAt: new Date().toISOString()
                };
                console.log(`   ✏️  修改提示词: ${newData[randomIndex].title}`);
            } else {
                console.log(`   ⚠️  没有可修改的提示词，改为创建新提示词`);
                const newPrompt = createTestPrompt(windowId);
                newData.push(newPrompt);
            }
            break;
            
        case 'delete':
            if (currentData.length > 0) {
                const randomIndex = Math.floor(Math.random() * currentData.length);
                const deletedPrompt = newData.splice(randomIndex, 1)[0];
                console.log(`   🗑️  删除提示词: ${deletedPrompt.title}`);
            } else {
                console.log(`   ⚠️  没有可删除的提示词`);
                return { success: false, message: '没有可删除的提示词' };
            }
            break;
            
        default:
            console.log(`   ❓ 未知操作: ${operation}`);
            return { success: false, message: '未知操作' };
    }
    
    const result = saveData(storagePath, newData);
    if (result.success) {
        console.log(`   ✅ 操作成功，数据已保存 (修改时间: ${result.modTime.toLocaleString()})`);
        console.log(`   📊 当前提示词总数: ${newData.length}`);
        return { success: true, data: newData, modTime: result.modTime };
    } else {
        console.log(`   ❌ 操作失败: ${result.error}`);
        return { success: false, error: result.error };
    }
};

// 验证数据一致性
const verifyDataConsistency = () => {
    const { storagePath } = getStoragePath();
    console.log('\n🔍 验证数据一致性...');
    
    const data = loadData(storagePath);
    console.log(`📊 当前提示词总数: ${data.length}`);
    
    if (data.length > 0) {
        console.log('\n📝 现有提示词列表:');
        data.forEach((prompt, index) => {
            console.log(`   ${index + 1}. ${prompt.title}`);
            console.log(`      ID: ${prompt.id}`);
            console.log(`      分类: ${prompt.category}`);
            console.log(`      创建时间: ${new Date(prompt.createdAt).toLocaleString()}`);
            console.log(`      更新时间: ${new Date(prompt.updatedAt).toLocaleString()}`);
            console.log('');
        });
    }
    
    return data;
};

// 测试文件监听响应时间
const testFileWatcherResponse = async () => {
    const { storagePath } = getStoragePath();
    console.log('\n⏱️  测试文件监听器响应时间...');
    
    console.log('提示: 如果您的VS Code扩展正在运行，请观察提示词管理器面板的变化');
    console.log('      扩展应该会自动检测到文件变化并刷新数据');
    
    // 每2秒进行一次修改，总共进行5次
    for (let i = 1; i <= 5; i++) {
        console.log(`\n🔄 第 ${i} 次修改测试...`);
        const result = await simulateWindowOperation(`监听测试`, 'create', 500);
        
        if (result.success) {
            console.log(`   ⏰ 等待2秒，观察扩展是否检测到变化...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
};

// 主测试流程
const runFullTest = async () => {
    console.log('🚀 开始多窗口同步全面测试');
    console.log('='.repeat(60));
    
    // 1. 初始状态检查
    console.log('\n1️⃣  初始状态检查');
    const initialData = verifyDataConsistency();
    
    // 2. 模拟多个窗口的并发操作
    console.log('\n2️⃣  模拟多窗口并发操作');
    
    // 模拟窗口A创建提示词
    await simulateWindowOperation('A', 'create', 1000);
    
    // 模拟窗口B创建提示词
    await simulateWindowOperation('B', 'create', 1500);
    
    // 模拟窗口A修改提示词
    await simulateWindowOperation('A', 'modify', 1000);
    
    // 模拟窗口C创建提示词
    await simulateWindowOperation('C', 'create', 1200);
    
    // 模拟窗口B删除提示词
    await simulateWindowOperation('B', 'delete', 800);
    
    // 3. 验证最终数据状态
    console.log('\n3️⃣  验证最终数据状态');
    const finalData = verifyDataConsistency();
    
    // 4. 测试文件监听器响应
    console.log('\n4️⃣  测试文件监听器响应');
    await testFileWatcherResponse();
    
    // 5. 生成测试报告
    console.log('\n📋 测试报告');
    console.log('='.repeat(40));
    console.log(`初始提示词数量: ${initialData.length}`);
    console.log(`最终提示词数量: ${finalData.length}`);
    console.log(`新增提示词数量: ${finalData.length - initialData.length}`);
    console.log('');
    console.log('✅ 测试完成！');
    console.log('');
    console.log('👀 请检查以下内容：');
    console.log('1. 打开多个VS Code窗口');
    console.log('2. 在每个窗口中打开提示词管理器面板');
    console.log('3. 验证所有窗口显示相同的提示词数据');
    console.log('4. 尝试手动刷新: "Prompt Manager: Force Refresh"');
    console.log('');
    console.log('🔧 如果同步仍有问题，请检查：');
    console.log('- VS Code开发者控制台的错误信息');
    console.log('- 扩展是否正确加载');
    console.log('- 文件权限是否正确');
};

// 清理测试数据
const cleanup = () => {
    const { storagePath } = getStoragePath();
    console.log('🧹 清理所有测试数据...');
    
    const data = loadData(storagePath);
    const cleanedData = data.filter(prompt => 
        !prompt.title.includes('测试提示词') && 
        !prompt.title.includes('同步测试') &&
        !prompt.category.includes('测试') &&
        !prompt.id.includes('test-') &&
        !prompt.id.includes('window-')
    );
    
    const result = saveData(storagePath, cleanedData);
    if (result.success) {
        console.log(`✅ 清理完成！`);
        console.log(`   删除数量: ${data.length - cleanedData.length}`);
        console.log(`   剩余数量: ${cleanedData.length}`);
    } else {
        console.log(`❌ 清理失败: ${result.error}`);
    }
};

// 显示当前状态
const showStatus = () => {
    console.log('📊 当前同步状态');
    console.log('='.repeat(30));
    verifyDataConsistency();
    
    const { storagePath } = getStoragePath();
    try {
        const stats = fs.statSync(storagePath);
        console.log(`🕒 最后修改时间: ${stats.mtime.toLocaleString()}`);
        console.log(`📏 文件大小: ${stats.size} 字节`);
    } catch (error) {
        console.log(`❌ 无法读取文件状态: ${error.message}`);
    }
};

// 命令行参数处理
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
    case 'full':
        runFullTest();
        break;
    case 'status':
        showStatus();
        break;
    case 'create':
        const windowId = args[1] || 'TEST';
        simulateWindowOperation(windowId, 'create').then(() => {
            console.log('创建操作完成');
        });
        break;
    case 'modify':
        const modifyWindowId = args[1] || 'TEST';
        simulateWindowOperation(modifyWindowId, 'modify').then(() => {
            console.log('修改操作完成');
        });
        break;
    case 'delete':
        const deleteWindowId = args[1] || 'TEST';
        simulateWindowOperation(deleteWindowId, 'delete').then(() => {
            console.log('删除操作完成');
        });
        break;
    case 'clean':
        cleanup();
        break;
    case 'watch':
        console.log('🔍 监控文件变化...');
        console.log('按 Ctrl+C 停止监控');
        fs.watchFile(getStoragePath().storagePath, (curr, prev) => {
            console.log(`\n📁 文件发生变化!`);
            console.log(`   修改时间: ${curr.mtime.toLocaleString()}`);
            console.log(`   文件大小: ${curr.size} 字节`);
            showStatus();
        });
        break;
    default:
        console.log('🔧 多窗口同步测试工具');
        console.log('='.repeat(40));
        console.log('用法: node test_multi_window_sync.js [命令]');
        console.log('');
        console.log('命令列表:');
        console.log('  full             - 运行完整测试流程');
        console.log('  status           - 显示当前状态');
        console.log('  create [窗口ID]  - 模拟窗口创建提示词');
        console.log('  modify [窗口ID]  - 模拟窗口修改提示词');
        console.log('  delete [窗口ID]  - 模拟窗口删除提示词');
        console.log('  watch            - 监控文件变化');
        console.log('  clean            - 清理测试数据');
        console.log('');
        console.log('示例:');
        console.log('  node test_multi_window_sync.js full');
        console.log('  node test_multi_window_sync.js create WindowA');
        console.log('  node test_multi_window_sync.js status');
} 