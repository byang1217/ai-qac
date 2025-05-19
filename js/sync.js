// Data synchronization with Pantry API
const syncUtils = {
    // Generate random JSON name for storage
    generateJsonName: () => {
        const randomDigits = Math.floor(100000 + Math.random() * 900000); // 6-digit random number
        return `ai-qac-${randomDigits}`;
    },
    
    // Get the stored JSON name or generate a new one
    getJsonName: () => {
        const settings = storage.get('system_settings') || {};
        let jsonName = settings.json_name;
        if (!jsonName) {
            jsonName = syncUtils.generateJsonName();
            settings.json_name = jsonName;
            storage.set('system_settings', settings);
        }
        return jsonName;
    },
    
    // Get Pantry API key
    getPantryKey: () => {
        const settings = storage.get('system_settings') || {};
        return settings.pantryKey;
    },
    
    // Build the Pantry API URL
    getPantryUrl: () => {
        const key = syncUtils.getPantryKey();
        const jsonName = syncUtils.getJsonName();
        return `https://getpantry.cloud/apiv1/pantry/${key}/basket/${jsonName}`;
    },
    
    // Filter sensitive data that should not be synced
    filterSensitiveData: (data) => {
        // Create a copy of the data
        const filteredData = {...data};
        
        // Handle system_settings separately to remove sensitive data
        if (filteredData.system_settings) {
            const settings = {...filteredData.system_settings};
            delete settings.apiKey;
            delete settings.pantryKey;
            delete settings.settings_password; // 现在密码在system_settings里
            filteredData.system_settings = settings;
        }
        
        return filteredData;
    },
    
    // Collect all localStorage data for sync
    collectSyncData: () => {
        const data = {};
        
        // Collect all localStorage items
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            try {
                const value = JSON.parse(localStorage.getItem(key));
                data[key] = value;
            } catch (e) {
                // Skip non-JSON items
                logger.log(`Skipping non-JSON item: ${key}`);
            }
        }
        
        return syncUtils.filterSensitiveData(data);
    }
};

// Sync data to Pantry
async function syncData() {
    try {
        toggleLoading(true, '正在同步数据...');
        logger.log('开始同步数据到云端');
        
        const data = syncUtils.collectSyncData();
        const url = syncUtils.getPantryUrl();
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`同步失败: ${response.status}`);
        }
        
        const result = await response.text();
        logger.log(`同步结果: ${result}`);
        alert('数据同步成功！');
    } catch (error) {
        logger.log(`同步错误: ${error.message}`);
        alert(`同步失败: ${error.message}`);
    } finally {
        toggleLoading(false);
    }
}

// Restore data from Pantry
async function restoreData() {
    try {
        if (!confirm('此操作将覆盖本地数据，确定要从云端恢复数据吗？')) {
            return;
        }
        
        // Ask for custom JSON name
        const useCustomName = confirm('是否使用自定义JSON名称恢复数据？');
        let customJsonName = null;
        let url = syncUtils.getPantryUrl();
        
        if (useCustomName) {
            customJsonName = prompt('请输入要恢复的JSON名称:', '');
            if (!customJsonName || customJsonName.trim() === '') {
                alert('JSON名称无效，将使用当前名称');
            } else {
                // Build URL with custom name
                const key = syncUtils.getPantryKey();
                url = `https://getpantry.cloud/apiv1/pantry/${key}/basket/${customJsonName.trim()}`;
            }
        }
        
        toggleLoading(true, '正在从云端恢复数据...');
        logger.log('开始从云端恢复数据');
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`恢复失败: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Backup sensitive data from current settings
        const currentSettings = storage.get('system_settings') || {};
        const apiKey = currentSettings.apiKey;
        const pantryKey = currentSettings.pantryKey;
        const password = currentSettings.settings_password;
        
        // Clear localStorage
        storage.clear();
        
        // Restore data
        Object.keys(data).forEach(key => {
            storage.set(key, data[key]);
        });
        
        // Restore sensitive data
        const restoredSettings = storage.get('system_settings') || {};
        if (password) restoredSettings.settings_password = password;
        if (apiKey) restoredSettings.apiKey = apiKey;
        if (pantryKey) restoredSettings.pantryKey = pantryKey;
        
        // Save the custom JSON name if restore was successful and custom name was provided
        if (customJsonName && customJsonName.trim() !== '') {
            restoredSettings.json_name = customJsonName.trim();
            logger.log(`JSON名称已更新为: ${customJsonName.trim()}`);
        }
        
        storage.set('system_settings', restoredSettings);
        
        // Update JSON name display in settings
        document.getElementById('jsonName').textContent = restoredSettings.json_name || '';
        
        logger.log('数据恢复成功');
        alert('数据恢复成功！');
        
        // Refresh UI
        init();
    } catch (error) {
        logger.log(`恢复错误: ${error.message}`);
        alert(`恢复失败: ${error.message}`);
    } finally {
        toggleLoading(false);
    }
}
