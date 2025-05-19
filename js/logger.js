// 调试日志功能
let debugMode = false;
const logger = {
    log: function(message) {
        console.log(message);
        if (!debugMode) return;
        const logPanel = document.getElementById('logPanel');
        if (logPanel) {
            const timestamp = new Date().toLocaleTimeString();
            const formattedMessage = typeof message === 'object' ? 
                JSON.stringify(message, null, 2) : message;
            
            logPanel.innerHTML += `[${timestamp}] ${formattedMessage}\n`;
            logPanel.scrollTop = logPanel.scrollHeight;
        }
    }
};
