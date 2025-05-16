import os
import json
import time
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 数据文件和备份目录
DATA_DIR = "data"
BACKUP_DIR = "backup"

# 确保目录存在
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(BACKUP_DIR, exist_ok=True)

# 主数据文件路径
DATA_FILE = os.path.join(DATA_DIR, "synced_data.json")

# 用于日志记录
def log_message(message):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {message}")

# 创建当日备份
def backup_data():
    if not os.path.exists(DATA_FILE):
        return
    
    today = datetime.now().strftime("%Y-%m-%d")
    backup_file = os.path.join(BACKUP_DIR, f"backup_{today}.json")
    
    # 如果当天还没有备份，创建备份
    if not os.path.exists(backup_file):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as src:
                data = src.read()
            with open(backup_file, 'w', encoding='utf-8') as dest:
                dest.write(data)
            log_message(f"数据已备份到 {backup_file}")
        except Exception as e:
            log_message(f"备份失败: {str(e)}")
    else:
        log_message(f"今日已有备份 {backup_file}")

# 加载现有数据
def load_data():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError:
            log_message("数据文件损坏，创建新的数据文件")
            return {}
    return {}

# 保存数据
def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# 合并数据（服务器数据和客户端数据）
def merge_data(server_data, client_data):
    merged = server_data.copy()
    
    # 处理客户端数据
    for key, client_value in client_data.items():
        # 跳过密码同步
        if key == 'settings_password':
            continue
            
        # 如果是日期格式的键（任务数据）
        import re
        if re.match(r'^\d{4}-\d{2}-\d{2}'):
            # 检查是否服务器有这个日期的数据
            if key in merged:
                server_value = merged[key]
                # 如果客户端数据更新（有提交时间并且比服务器的新），或者服务器没有提交时间
                if ('submitTime' in client_value and 
                    ('submitTime' not in server_value or 
                     client_value['submitTime'] > server_value['submitTime'])):
                    merged[key] = client_value
            else:
                # 服务器没有这个日期的数据，直接添加
                merged[key] = client_value
        else:
            # 非日期键（如系统设置等）
            merged[key] = client_value
    
    return merged

@app.route('/sync', methods=['POST'])
def sync_data():
    try:
        # 备份现有数据
        backup_data()
        
        # 加载服务器数据
        server_data = load_data()
        
        # 获取客户端数据
        client_payload = request.json
        if not client_payload or 'data' not in client_payload:
            return jsonify({'success': False, 'message': '无效的数据格式'})
        
        client_data = client_payload['data']
        client_timestamp = client_payload.get('timestamp', '')
        
        log_message(f"收到来自设备 {client_payload.get('deviceId', 'unknown')} 的同步请求")
        
        # 合并数据
        merged_data = {}
        
        # 遍历所有键，选择最新的数据
        all_keys = set(list(server_data.keys()) + list(client_data.keys()))
        
        for key in all_keys:
            # 跳过设置密码的同步
            if key == 'settings_password':
                continue
                
            server_value = server_data.get(key)
            client_value = client_data.get(key)
            
            # 如果是日期格式的键（可能是任务数据）
            if key.startswith('20') and len(key) == 10 and key[4] == '-' and key[7] == '-':
                # 如果两边都有数据
                if server_value and client_value:
                    # 检查提交状态和时间戳
                    server_submitted = server_value.get('submitted', False)
                    client_submitted = client_value.get('submitted', False)
                    
                    server_time = server_value.get('submitTime', '')
                    client_time = client_value.get('submitTime', '')
                    
                    # 如果客户端已提交，服务器未提交，使用客户端数据
                    if client_submitted and not server_submitted:
                        merged_data[key] = client_value
                    # 如果服务器已提交，客户端未提交，使用服务器数据
                    elif server_submitted and not client_submitted:
                        merged_data[key] = server_value
                    # 两边都已提交，使用时间戳较新的
                    elif server_submitted and client_submitted:
                        if client_time > server_time:
                            merged_data[key] = client_value
                        else:
                            merged_data[key] = server_value
                    else:
                        # 两边都未提交，合并题目数据
                        merged_data[key] = client_value if client_value.get('questions') else server_value
                elif server_value:
                    merged_data[key] = server_value
                else:
                    merged_data[key] = client_value
            else:
                # 对于非日期键（如系统设置），使用客户端最新的数据
                if client_value is not None:
                    merged_data[key] = client_value
                elif server_value is not None:
                    merged_data[key] = server_value
        
        # 处理特殊的密码字段
        server_password = server_data.get('settings_password')
        
        # 保存合并后的数据
        save_data(merged_data)
        
        log_message("数据同步成功")
        
        # 返回成功与合并后的数据
        response_data = {
            'success': True,
            'data': merged_data
        }
        
        # 如果服务器有密码设置，一并返回
        if server_password:
            response_data['password'] = server_password
            
        return jsonify(response_data)
    
    except Exception as e:
        log_message(f"同步过程中出错: {str(e)}")
        return jsonify({'success': False, 'message': f'服务器错误: {str(e)}'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
