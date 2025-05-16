from flask import Flask, request, jsonify
import json
import os
import shutil
from datetime import datetime
import logging

app = Flask(__name__)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    filename='sync_server.log'
)
logger = logging.getLogger('sync_server')

# 数据目录
DATA_DIR = 'data'
BACKUP_DIR = 'backups'

# 确保数据和备份目录存在
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(BACKUP_DIR, exist_ok=True)

# 同步密码，实际使用中应该从配置文件或环境变量中获取
SYNC_PASSWORD = "your_secure_password"

def backup_data():
    """备份当前数据"""
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = f"{BACKUP_DIR}/backup_{timestamp}.json"
        
        # 如果主数据文件存在，进行备份
        if os.path.exists(f"{DATA_DIR}/app_data.json"):
            shutil.copy2(f"{DATA_DIR}/app_data.json", backup_file)
            logger.info(f"数据已备份到 {backup_file}")
            return True
        else:
            logger.info("没有数据需要备份")
            return False
    except Exception as e:
        logger.error(f"备份失败: {str(e)}")
        return False

def read_data():
    """读取当前数据"""
    try:
        if os.path.exists(f"{DATA_DIR}/app_data.json"):
            with open(f"{DATA_DIR}/app_data.json", 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    except Exception as e:
        logger.error(f"读取数据失败: {str(e)}")
        return {}

def save_data(data):
    """保存数据"""
    try:
        with open(f"{DATA_DIR}/app_data.json", 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info("数据保存成功")
        return True
    except Exception as e:
        logger.error(f"保存数据失败: {str(e)}")
        return False

def merge_data(server_data, client_data, client_time):
    """合并服务器和客户端数据"""
    # 如果服务器没有数据，直接使用客户端数据
    if not server_data:
        logger.info("服务器没有数据，使用客户端数据")
        return client_data, True
    
    # 记录是否有更新
    has_updates = False
    merged_data = server_data.copy()
    
    # 遍历客户端数据
    for key, client_value in client_data.items():
        # 如果是日期格式的key (任务数据)
        if key.startswith('20') and len(key) == 10 and key[4] == '-' and key[7] == '-':
            # 如果服务器没有这个日期的数据，或者客户端数据更新
            if key not in server_data or (
                client_value.get('submitTime', '') > server_data[key].get('submitTime', '')
            ):
                merged_data[key] = client_value
                has_updates = True
                logger.info(f"更新任务数据: {key}")
        # 如果是系统设置
        elif key == 'system_settings':
            # 合并设置，但保留服务器上的同步密码
            if 'system_settings' not in server_data:
                server_data['system_settings'] = {}
            
            merged_settings = server_data['system_settings'].copy()
            for setting_key, setting_value in client_value.items():
                # 不覆盖同步密码
                if setting_key != 'syncPassword':
                    merged_settings[setting_key] = setting_value
                    
            merged_data['system_settings'] = merged_settings
            has_updates = True
            logger.info("更新系统设置")
    
    return merged_data, has_updates

@app.route('/sync', methods=['POST'])
def sync():
    """处理同步请求"""
    # 验证密码
    client_password = request.headers.get('X-Sync-Password', '')
    if client_password != SYNC_PASSWORD:
        logger.warning("同步密码验证失败")
        return jsonify({"success": False, "message": "密码验证失败"})
    
    try:
        # 解析请求数据
        request_data = request.json
        if not request_data:
            return jsonify({"success": False, "message": "无效的请求数据"})
        
        client_data = request_data.get('data', {})
        client_time = request_data.get('clientTime', '')
        action = request_data.get('action', '')
        
        if action != 'sync':
            return jsonify({"success": False, "message": "不支持的操作"})
        
        # 备份当前数据
        backup_data()
        
        # 读取服务器数据
        server_data = read_data()
        
        # 合并数据
        merged_data, has_updates = merge_data(server_data, client_data, client_time)
        
        # 保存合并后的数据
        if has_updates:
            save_data(merged_data)
        
        # 返回结果
        if has_updates:
            return jsonify({
                "success": True,
                "message": "同步成功",
                "data": merged_data,
                "serverTime": datetime.now().isoformat()
            })
        else:
            return jsonify({
                "success": True,
                "message": "同步成功，无更新",
                "serverTime": datetime.now().isoformat()
            })
            
    except Exception as e:
        logger.error(f"同步处理错误: {str(e)}")
        return jsonify({"success": False, "message": f"服务器错误: {str(e)}"})

@app.route('/')
def index():
    return "AI出题打卡同步服务器正在运行"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
