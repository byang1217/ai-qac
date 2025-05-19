let debug_storage_force_clean = 0; // 调试配置：强制清理任务数量（0为关闭）
let localStorage_size = 4 * 1024 * 1024; // localStorage大小配置，默认4MB
let storage_checking = false;

// localStorage操作封装
const storage = {
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            logger.log(`Storage set: ${key}`);
            if (!storage_checking) {
                storage_checking = true;
                checkStorageSpace();
                storage_checking = false;
            }
        } catch (e) {
            logger.log(`Storage error: ${e.message}`);
            alert('存储失败，可能是存储空间不足。');
        }
    },
    get: (key) => {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : null;
        } catch (e) {
            logger.log(`Storage get error: ${e.message}`);
            return null;
        }
    },
    remove: (key) => {
        localStorage.removeItem(key);
        logger.log(`Storage removed: ${key}`);
    },
    clear: () => {
        localStorage.clear();
        logger.log('Storage cleared');
    }
};

// 获取存储使用情况
function getStorageUsage() {
    let used = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        used += (key.length + value.length) * 2;
    }
    return {
        used,
        total: localStorage_size,
        remaining: (localStorage_size - used) / localStorage_size * 100
    };
}

// 检查存储空间
function checkStorageSpace() {
    const usage = getStorageUsage();
    logger.log(`存储使用: ${(usage.used/1024/1024).toFixed(2)}MB / ${(usage.total/1024/1024).toFixed(2)}MB, 剩余 ${usage.remaining.toFixed(2)}%`);
    
    if ((debug_storage_force_clean > 0) || (usage.remaining < 20)) {
        document.getElementById('storageWarning').classList.remove('hidden');
        cleanupOldData();
    } else {
        document.getElementById('storageWarning').classList.add('hidden');
    }
}

// 清理旧数据
function cleanupOldData() {
    const tasks = Object.keys(localStorage)
        .filter(k => Date.parse(k))
        .map(k => ({ date: new Date(k), key: k }))
        .sort((a, b) => a.date - b.date);

    if (tasks.length < debug_storage_force_clean + 1) {
        return;
    }
    let cleaned = 0;
    let simplifiedCount = 0;
	let loopCount = 0;
    const beforeUsage = getStorageUsage();
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    for (const task of tasks) {
        const currentUsage = getStorageUsage();
		if ((loopCount >= debug_storage_force_clean) && (currentUsage.remaining > 50))
			break;
        loopCount ++;
        
        const data = storage.get(task.key);
        if (!data) continue;
        
        if (task.date < oneYearAgo) {
            if (data.submitted) {
                storage.set('completed_count', (storage.get('completed_count') || 0) + 1);
                console.log("clean: ", task.key, data);
            } else {
                console.log("del: ", task.key, data);
            }
            storage.remove(task.key);
            cleaned++;
        }
        // 已完成任务简化或删除
        else if (data.submitted) {
            if (!data.simplified) {
                storage.set(task.key, {
                    submitted: true,
                    correctCount: data.correctCount,
                    totalQuestions: data.totalQuestions,
                    simplified: true
                });
                simplifiedCount++;
                console.log("simplify: ", task.key, data);
            } else {
                storage.set('completed_count', (storage.get('completed_count') || 0) + 1);
                storage.remove(task.key);
                cleaned++;
                console.log("clean: ", task.key, data);
            }
        } else {
            storage.remove(task.key);
            cleaned++;
            console.log("del: ", task.key, data);
        }
    }
    
    const afterUsage = getStorageUsage();
    logger.log(`清理完成: 删除 ${cleaned} 个，简化 ${simplifiedCount} 个，剩余 ${afterUsage.remaining.toFixed(2)}%`);
    
    // 提醒用户清理结果
    if (cleaned > 0 || simplifiedCount > 0) {
        const message = `存储空间清理完成：\n删除了 ${cleaned} 个旧任务\n简化了 ${simplifiedCount} 个已完成任务\n存储空间从 ${beforeUsage.remaining.toFixed(1)}% 提升到 ${afterUsage.remaining.toFixed(1)}%\n\n请检查你的任务数据是否正常，如有问题请及时反馈。`;
        alert(message);
    }
    
    if (afterUsage.remaining < 50) {
        document.getElementById('storageWarning').classList.remove('hidden');
    } else {
        document.getElementById('storageWarning').classList.add('hidden');
    }
    
    updateStats();
}

function formatDateKey(date) {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD 格式
}
