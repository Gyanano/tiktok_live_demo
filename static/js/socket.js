/**
 * TikTok直播监听工具 - WebSocket和API通信模块
 */

// WebSocket连接
let socket = null;
const SOCKET_URL = `ws://${window.location.host}`;

// 连接WebSocket
function connectWebSocket() {
    // 如果已经连接，先断开
    if (socket) {
        socket.disconnect();
    }
    
    // 创建新连接
    socket = io(SOCKET_URL);
    
    // 连接事件
    socket.on('connect', () => {
        console.log('WebSocket已连接');
    });
    
    // 断开连接事件
    socket.on('disconnect', () => {
        console.log('WebSocket已断开');
    });
    
    // 状态更新事件
    socket.on('status', (data) => {
        console.log('收到状态更新:', data);
        updateUI(data.status);
        if (data.room_info) {
            updateRoomInfo(data.room_info);
        }
    });
    
    // 连接成功事件
    socket.on('connect_event', (data) => {
        console.log('直播间连接成功:', data);
        updateUI('connected');
        if (data.room_info) {
            updateRoomInfo(data.room_info);
        }
    });
    
    // 断开直播间连接事件
    socket.on('disconnect_event', (data) => {
        console.log('直播间连接断开:', data);
        updateUI('disconnected');
    });
    
    // 新消息事件
    socket.on('new_message', (message) => {
        console.log('收到新消息:', message);
        processMessage(message);
    });
    
    // 错误事件
    socket.on('error', (data) => {
        console.error('WebSocket错误:', data);
        showError(data.message);
    });
}

// 断开WebSocket连接
function disconnectWebSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

// API: 获取服务器状态
async function checkStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        updateUI(data.status);
        if (data.room_info) {
            updateRoomInfo(data.room_info);
        }
        
        return data;
    } catch (error) {
        console.error('获取状态失败:', error);
        showError('无法连接到服务器，请检查网络连接');
        return { status: 'error' };
    }
}

// API: 获取历史消息
async function getHistoryMessages(sinceId = 0) {
    try {
        const response = await fetch(`/api/messages?since_id=${sinceId}`);
        const messages = await response.json();
        
        // 处理每条消息
        messages.forEach(message => {
            processMessage(message, false); // 不滚动到底部
        });
        
        // 如果有消息，滚动到底部
        if (messages.length > 0) {
            scrollToMessageBottom();
        }
        
        return messages;
    } catch (error) {
        console.error('获取历史消息失败:', error);
        return [];
    }
}

// API: 开始监听
async function startCrawler() {
    // 获取表单数据
    const url = urlInput.value.trim();
    const httpProxy = httpProxyInput.value.trim();
    const socksProxy = socksProxyInput.value.trim();
    const useMock = useMockCheckbox.checked;
    
    // 验证输入
    if (!url && !useMock) {
        showError('请输入有效的TikTok直播间URL或ID');
        return false;
    }
    
    // 更新UI状态
    updateUI('connecting');
    hideError();
    
    try {
        // 发送请求
        const response = await fetch('/api/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: url,
                http_proxy: httpProxy,
                socks_proxy: socksProxy,
                use_mock: useMock
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('开始监听成功:', data);
            // 连接WebSocket (如果尚未连接)
            if (!socket) {
                connectWebSocket();
            }
            return true;
        } else {
            showError(data.error || '开始监听失败');
            updateUI('disconnected');
            return false;
        }
    } catch (error) {
        console.error('开始监听请求失败:', error);
        showError('无法连接到服务器，请检查网络连接');
        updateUI('disconnected');
        return false;
    }
}

// API: 停止监听
async function stopCrawler() {
    try {
        // 发送请求
        const response = await fetch('/api/stop', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('停止监听成功:', data);
            updateUI('disconnected');
            return true;
        } else {
            showError(data.error || '停止监听失败');
            return false;
        }
    } catch (error) {
        console.error('停止监听请求失败:', error);
        showError('无法连接到服务器，请检查网络连接');
        return false;
    }
}

// API: 清空消息
async function clearMessages() {
    try {
        // 发送请求
        const response = await fetch('/api/clear', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('清空消息成功:', data);
            
            // 清空消息容器
            messageContainer.innerHTML = '';
            emptyMessage.classList.remove('d-none');
            
            // 重置统计
            resetStats();
            
            return true;
        } else {
            showError(data.error || '清空消息失败');
            return false;
        }
    } catch (error) {
        console.error('清空消息请求失败:', error);
        showError('无法连接到服务器，请检查网络连接');
        return false;
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 连接WebSocket
    connectWebSocket();
    
    // 检查服务器状态
    checkStatus();
}); 