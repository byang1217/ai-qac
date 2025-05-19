function showView(viewName) {
    logger.log(`切换视图: ${viewName}`);
    
    if (viewName === 'settings') {
        showSettingsWithPasswordCheck();
        return;
    }
    
    document.querySelectorAll('.main-container > div').forEach(el => el.classList.add('hidden'));
    document.getElementById(viewName+'View').classList.remove('hidden');
    
    if(viewName === 'tasks') refreshTaskList();
}

// 更新顶部任务完成个数
function updateStats() {
    logger.log('更新统计数据');
    const savedCompletedCount = storage.get('completed_count') || 0;
    
    const currentCompletedCount = Object.keys(localStorage)
        .filter(k => k.match(/^\d{4}-\d{2}-\d{2}$/))
        .map(k => storage.get(k))
        .filter(data => data && data.submitted)
        .length;
    
    const totalCompleted = savedCompletedCount + currentCompletedCount;
    document.getElementById('completedCount').textContent = totalCompleted;
}

// 显示/隐藏加载指示器
function toggleLoading(show, message = '正在加载题目...') {
    const loader = document.getElementById('loadingIndicator');
    const loadingText = document.querySelector('.loading-text');
    
    if (show) {
        loadingText.textContent = message;
        loader.classList.remove('hidden');
    } else {
        loader.classList.add('hidden');
    }
}

function hideTask() {
    logger.log('关闭任务详情');
    showView('calendar');
    generateCalendar();
}

function init() {
    logger.log('初始化应用');
    
    const settings = storage.get('system_settings') || {};
    debugMode = settings.debugMode || false;
    
    if (debugMode) {
        document.getElementById('logPanel').classList.remove('hidden');
    }
    
    loadSettings();
    setupWeekdayLabels();
    generateCalendar();
    updateStats();
    showView('calendar');
    checkStorageSpace();
}

// 初始化应用
window.onload = init;
