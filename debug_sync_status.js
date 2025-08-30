#!/usr/bin/env node

/**
 * 实时同步状态调试工具
 * 监控文件变化和扩展日志，帮助诊断多窗口同步问题
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
        console.error('❌ 读取数据失败:', error.message);
    }
    return [];
};

// 格式化文件状态
const getFileStatus = (storagePath) => {
    try {
        if (fs.existsSync(storagePath)) {
            const stats = fs.statSync(storagePath);
            const data = loadData(storagePath);
            return {
                exists: true,
                size: stats.size,
                mtime: stats.mtime,
                count: data.length,
                data: data
            };
        }
    } catch (error) {
        return { exists: false, error: error.message };
    }
    return { exists: false };
};

// 显示详细状态
const displayStatus = (status, isInitial = false) => {
    const timestamp = new Date().toLocaleString();
    
    if (isInitial) {
        console.log('\n🔍 开始监控多窗口同步状态');
        console.log('='.repeat(50));
        console.log(`📅 开始时间: ${timestamp}`);
        console.log(`📁 监控路径: ${getStoragePath().storagePath}`);
        console.log('');
    }
    
    console.log(`⏰ ${timestamp}`);
    
    if (status.exists) {
        console.log(`✅ 文件存在 | 大小: ${status.size}B | 提示词数: ${status.count}`);
        console.log(`📝 最后修改: ${status.mtime.toLocaleString()}`);
        
        if (status.data && status.data.length > 0) {
            console.log(`\n📋 提示词列表:`);
            status.data.forEach((prompt, index) => {
                const createdTime = new Date(prompt.createdAt).toLocaleString();
                const updatedTime = new Date(prompt.updatedAt).toLocaleString();
                console.log(`   ${index + 1}. ${prompt.title}`);
                console.log(`      类别: ${prompt.category} | ID: ${prompt.id.substring(0, 20)}...`);
                console.log(`      创建: ${createdTime} | 更新: ${updatedTime}`);
            });
        }
    } else {
        console.log(`❌ 文件不存在${status.error ? ` (${status.error})` : ''}`);
    }
    
    console.log('-'.repeat(50));
};

// 比较两个状态
const compareStatus = (oldStatus, newStatus) => {
    const changes = [];
    
    if (!oldStatus.exists && newStatus.exists) {
        changes.push('🆕 文件被创建');
    }
    
    if (oldStatus.exists && !newStatus.exists) {
        changes.push('🗑️  文件被删除');
    }
    
    if (oldStatus.exists && newStatus.exists) {
        if (oldStatus.size !== newStatus.size) {
            changes.push(`📏 文件大小变化: ${oldStatus.size}B → ${newStatus.size}B`);
        }
        
        if (oldStatus.count !== newStatus.count) {
            changes.push(`🔢 提示词数量变化: ${oldStatus.count} → ${newStatus.count}`);
        }
        
        if (oldStatus.mtime.getTime() !== newStatus.mtime.getTime()) {
            changes.push(`🕒 修改时间变化: ${oldStatus.mtime.toLocaleString()} → ${newStatus.mtime.toLocaleString()}`);
        }
    }
    
    return changes;
};

// 监控文件变化
const monitorChanges = () => {
    const { storagePath } = getStoragePath();
    let lastStatus = getFileStatus(storagePath);
    
    displayStatus(lastStatus, true);
    
    console.log('👁️  开始实时监控...');
    console.log('💡 在另一个终端运行以下命令测试同步：');
    console.log('   node test_multi_window_sync.js create WindowA');
    console.log('   node test_multi_window_sync.js modify WindowB');
    console.log('   node test_multi_window_sync.js delete WindowC');
    console.log('\n🔄 按 Ctrl+C 停止监控\n');
    
    // 使用 fs.watchFile 进行文件监控
    let watcherActive = true;
    
    const checkChanges = () => {
        if (!watcherActive) return;
        
        const currentStatus = getFileStatus(storagePath);
        const changes = compareStatus(lastStatus, currentStatus);
        
        if (changes.length > 0) {
            console.log('\n🚨 检测到变化:');
            changes.forEach(change => console.log(`   ${change}`));
            displayStatus(currentStatus);
            lastStatus = currentStatus;
        }
    };
    
    // 使用轮询方式监控文件变化（更可靠）
    const pollInterval = setInterval(checkChanges, 1000);
    
    // 同时使用 fs.watchFile 作为备用
    fs.watchFile(storagePath, { interval: 500 }, () => {
        setTimeout(checkChanges, 100); // 延迟100ms确保文件写入完成
    });
    
    // 处理退出信号
    process.on('SIGINT', () => {
        console.log('\n\n⏹️  停止监控...');
        watcherActive = false;
        clearInterval(pollInterval);
        fs.unwatchFile(storagePath);
        
        const finalStatus = getFileStatus(storagePath);
        console.log('\n📊 最终状态:');
        displayStatus(finalStatus);
        
        process.exit(0);
    });
};

// 显示帮助信息
const showHelp = () => {
    console.log('🔧 多窗口同步状态调试工具');
    console.log('='.repeat(40));
    console.log('用法: node debug_sync_status.js [命令]');
    console.log('');
    console.log('命令列表:');
    console.log('  monitor          - 实时监控文件变化');
    console.log('  status           - 显示当前状态');
    console.log('  check-path       - 检查存储路径配置');
    console.log('  vscode-log       - 显示VS Code日志检查指南');
    console.log('');
    console.log('示例:');
    console.log('  node debug_sync_status.js monitor');
    console.log('  node debug_sync_status.js status');
};

// 检查路径配置
const checkPathConfiguration = () => {
    const { storageDir, storagePath } = getStoragePath();
    
    console.log('🔍 存储路径配置检查');
    console.log('='.repeat(35));
    console.log(`📁 存储目录: ${storageDir}`);
    console.log(`📄 存储文件: ${storagePath}`);
    console.log('');
    
    // 检查目录权限
    try {
        fs.accessSync(storageDir, fs.constants.R_OK | fs.constants.W_OK);
        console.log('✅ 目录权限: 可读写');
    } catch (error) {
        console.log('❌ 目录权限: 无法访问');
        console.log(`   错误: ${error.message}`);
    }
    
    // 检查文件权限
    if (fs.existsSync(storagePath)) {
        try {
            fs.accessSync(storagePath, fs.constants.R_OK | fs.constants.W_OK);
            console.log('✅ 文件权限: 可读写');
        } catch (error) {
            console.log('❌ 文件权限: 无法访问');
            console.log(`   错误: ${error.message}`);
        }
    } else {
        console.log('⚠️  文件权限: 文件不存在');
    }
    
    // 检查相对路径计算
    const relativePath = path.relative(process.cwd(), storagePath);
    console.log(`🔗 相对路径: ${relativePath}`);
    console.log(`🏠 用户目录: ${os.homedir()}`);
    console.log(`💻 当前工作目录: ${process.cwd()}`);
    
    const status = getFileStatus(storagePath);
    console.log('\n📊 当前状态:');
    displayStatus(status);
};

// VS Code日志检查指南
const showVSCodeLogGuide = () => {
    console.log('🔍 VS Code 扩展日志检查指南');
    console.log('='.repeat(40));
    console.log('');
    console.log('1. 启动扩展调试模式:');
    console.log('   - 在VS Code中打开此项目');
    console.log('   - 按 F5 启动扩展开发主机');
    console.log('');
    console.log('2. 查看扩展控制台日志:');
    console.log('   - 在扩展开发窗口按 F12 打开开发者工具');
    console.log('   - 切换到 Console 选项卡');
    console.log('   - 查找以下关键日志:');
    console.log('     ✅ "Cursor Prompt Manager is now active!"');
    console.log('     ✅ "File watcher setup with RelativePattern for: ..."');
    console.log('     ✅ "Loaded prompts: X"');
    console.log('');
    console.log('3. 测试文件监听器:');
    console.log('   - 运行: node test_multi_window_sync.js create TestWindow');
    console.log('   - 在控制台查找:');
    console.log('     ✅ "File change detected: ..."');
    console.log('     ✅ "Prompts reloaded from file..."');
    console.log('');
    console.log('4. 检查TreeView刷新:');
    console.log('   - 打开提示词管理器面板');
    console.log('   - 观察是否显示新创建的测试提示词');
    console.log('   - 尝试手动刷新: "Prompt Manager: Force Refresh"');
    console.log('');
    console.log('5. 常见问题排查:');
    console.log('   - 如果没有看到文件监听日志 → RelativePattern可能不支持绝对路径');
    console.log('   - 如果看到权限错误 → 检查文件权限');
    console.log('   - 如果TreeView没有刷新 → 检查事件触发机制');
    console.log('');
};

// 命令行参数处理
const args = process.argv.slice(2);
const command = args[0] || 'help';

switch (command) {
    case 'monitor':
        monitorChanges();
        break;
    case 'status':
        const { storagePath } = getStoragePath();
        const status = getFileStatus(storagePath);
        displayStatus(status, true);
        break;
    case 'check-path':
        checkPathConfiguration();
        break;
    case 'vscode-log':
        showVSCodeLogGuide();
        break;
    case 'help':
    default:
        showHelp();
        break;
} 