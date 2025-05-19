function updateApiUrlBasedOnModel(model) {
    const urlField = document.getElementById('apiUrl');
    const currentUrl = urlField.value;
    
    // 如果用户已经手动填写了URL，且不是选择了新的模型，则不修改
    if (currentUrl && model === document.getElementById('apiModel').dataset.lastModel) {
        return;
    }
    
    // 保存当前选择的模型，用于检测是否是用户手动修改
    document.getElementById('apiModel').dataset.lastModel = model;
    
    // 根据模型更新URL
    if (model === 'deepseek-chat') {
        urlField.value = 'https://api.deepseek.com/v1/chat/completions';
    } else if (model.includes('qwen') || model === 'deepseek-v3') {
        urlField.value = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    }
}

// 密码验证功能
function verifyPassword() {
    const settingsPassword = document.getElementById('settingsPassword').value;
    const settings = storage.get('system_settings') || {};
    const storedPassword = settings.settings_password;
    
    // 如果没有设置密码，则设置新密码
    if (!storedPassword) {
        if (settingsPassword.trim() === '') {
            alert('请设置一个访问密码');
            return;
        }
        
        settings.settings_password = settingsPassword;
        storage.set('system_settings', settings);
        document.getElementById('passwordProtection').classList.add('hidden');
        document.getElementById('settingsContent').classList.remove('hidden');
        logger.log('设置了新的访问密码');
        return;
    }
    
    // 验证密码
    if (settingsPassword === storedPassword) {
        document.getElementById('passwordProtection').classList.add('hidden');
        document.getElementById('settingsContent').classList.remove('hidden');
        logger.log('密码验证成功');
    } else {
        alert('密码不正确');
        logger.log('密码验证失败');
    }
}

// 显示设置页面前检查密码
function showSettingsWithPasswordCheck() {
    document.querySelectorAll('.main-container > div').forEach(el => el.classList.add('hidden'));
    document.getElementById('settingsView').classList.remove('hidden');
    
    const settings = storage.get('system_settings') || {};
    const storedPassword = settings.settings_password;
    
    if (storedPassword) {
        // 已设置密码，需要验证
        document.getElementById('passwordProtection').classList.remove('hidden');
        document.getElementById('settingsContent').classList.add('hidden');
        document.getElementById('settingsPassword').value = '';
    } else {
        // 首次使用，设置密码
        document.getElementById('passwordProtection').classList.remove('hidden');
        document.getElementById('settingsContent').classList.add('hidden');
    }
    
    if (debugMode) {
        document.getElementById('logPanel').classList.remove('hidden');
    }
}

function loadSettings() {
    logger.log('加载设置');
    const settings = storage.get('system_settings') || {};
    
    document.getElementById('apiModel').value = settings.apiModel || "qwen-plus";
    document.getElementById('apiUrl').value = settings.apiUrl || '';
    document.getElementById('apiKey').value = settings.apiKey || '';
	document.getElementById('questionCount').value = settings.questionCount || 30;
    document.getElementById('apiPrompt').value = settings.apiPrompt || 
`请为一个六年级的学生出题。题目不要过于简单，也不要过于复杂。
1. 诗词和古文：成语、唐诗宋词、文言文。
2. 现代汉语：字词（形音义）、语法、修辞（比喻、排比等）、标点符号、病句修改。
3. 文学常识：重要作家、名著、国学、历史典故等。
4. 其它：自然科学。
`;
    document.getElementById('pantryKey').value = settings.pantryKey || '0216e91c-67bd-4c08-a089-78999100e3f3';
    document.getElementById('jsonName').textContent = syncUtils.getJsonName();
    document.getElementById('debugMode').checked = settings.debugMode || false;
    
    // 根据选择的模型自动填充URL
    updateApiUrlBasedOnModel(settings.apiModel);
}

function saveSettings() {
    logger.log('保存设置');
    
    const settings = {
        apiModel: document.getElementById('apiModel').value,
        apiUrl: document.getElementById('apiUrl').value,
        apiKey: document.getElementById('apiKey').value,
		questionCount: document.getElementById('questionCount').value,
        apiPrompt: document.getElementById('apiPrompt').value,
        pantryKey: document.getElementById('pantryKey').value,
        debugMode: document.getElementById('debugMode').checked
    };
    
    storage.set('system_settings', settings);
    debugMode = settings.debugMode;
    
    if (debugMode) {
        document.getElementById('logPanel').classList.remove('hidden');
    } else {
        document.getElementById('logPanel').classList.add('hidden');
    }
    
    alert('设置已保存');
}
