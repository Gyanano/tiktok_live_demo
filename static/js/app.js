// 全局变量
let messages = [];
let isConnected = false;
let isCrawling = false;
let lastMessageId = 0;
let pollingInterval = null;
let stats = {
    comment: 0,
    gift: 0,
    like: 0,
    follow: 0,
    share: 0
};

// DOM元素
const form = document.getElementById('crawler-form');
const urlInput = document.getElementById('url-input');
const httpProxyInput = document.getElementById('http-proxy-input');
const socksProxyInput = document.getElementById('socks-proxy-input');
const useMockCheckbox = document.getElementById('use-mock');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const clearBtn = document.getElementById('clear-btn');
const exportBtn = document.getElementById('export-btn');
const refreshBtn = document.getElementById('refresh-btn');
const statusBadge = document.getElementById('status-badge');
const roomInfo = document.getElementById('room-info');
const messageContainer = document.getElementById('message-container');
const errorContainer = document.getElementById('error-container');
const errorMessage = document.getElementById('error-message');
const emptyMessage = document.getElementById('empty-message');

// 统计元素
const commentCount = document.getElementById('comment-count');
const giftCount = document.getElementById('gift-count');
const likeCount = document.getElementById('like-count');
const followCount = document.getElementById('follow-count');
const shareCount = document.getElementById('share-count');

// 过滤选项
const filterComment = document.getElementById('filter-comment');
const filterGift = document.getElementById('filter-gift');
const filterLike = document.getElementById('filter-like');
const filterFollow = document.getElementById('filter-follow');
const filterShare = document.getElementById('filter-share');
const filterSystem = document.getElementById('filter-system');

// 模板
const chatTemplate = document.getElementById('chat-template');
const giftTemplate = document.getElementById('gift-template');
const likeTemplate = document.getElementById('like-template');
const followTemplate = document.getElementById('follow-template');
const shareTemplate = document.getElementById('share-template');
const systemTemplate = document.getElementById('system-template');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    
    // 如果URL参数中包含url，自动填充并启动
    const urlParams = new URLSearchParams(window.location.search);
    const urlFromParams = urlParams.get('url');
    const httpProxyFromParams = urlParams.get('http_proxy');
    const socksProxyFromParams = urlParams.get('socks_proxy');
    const useMockFromParams = urlParams.get('mock');
    
    if (urlFromParams) {
        urlInput.value = urlFromParams;
        
        if (httpProxyFromParams) {
            httpProxyInput.value = httpProxyFromParams;
        }
        
        if (socksProxyFromParams) {
            socksProxyInput.value = socksProxyFromParams;
        }
        
        if (useMockFromParams === '1' || useMockFromParams === 'true') {
            useMockCheckbox.checked = true;
        }
        
        // 自动启动（延迟一秒以确保页面完全加载）
        setTimeout(() => {
            startCrawler();
        }, 1000);
    }
});

// 初始化事件监听器
function initEventListeners() {
    // 表单提交事件
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        startCrawler();
    });
    
    // 停止按钮
    stopBtn.addEventListener('click', () => {
        stopCrawler();
    });
    
    // 清空按钮
    clearBtn.addEventListener('click', () => {
        clearMessages();
    });
    
    // 导出按钮
    exportBtn.addEventListener('click', () => {
        exportMessages();
    });
    
    // 刷新按钮
    refreshBtn.addEventListener('click', () => {
        getHistoryMessages(lastMessageId);
    });
    
    // 过滤选项变更
    filterComment.addEventListener('change', applyFilters);
    filterGift.addEventListener('change', applyFilters);
    filterLike.addEventListener('change', applyFilters);
    filterFollow.addEventListener('change', applyFilters);
    filterShare.addEventListener('change', applyFilters);
    filterSystem.addEventListener('change', applyFilters);
}

// 处理消息
function processMessage(message, shouldScroll = true) {
    // 检查消息是否有效
    if (!message || typeof message !== 'object') {
        console.error('收到无效消息:', message);
        return;
    }
    
    // 更新最后消息ID
    if (message.id > lastMessageId) {
        lastMessageId = message.id;
    }
    
    // 添加消息到UI
    addMessage(message);
    
    // 更新统计
    updateStats(message.type);
    
    // 滚动到底部
    if (shouldScroll) {
        scrollToMessageBottom();
    }
}

// 处理评论消息
function handleCommentMessage(data) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message comment-message';
    messageElement.innerHTML = `
        <div class="message-header">
            <span class="user-name">${data.user.nickname}</span>
            <span class="message-time">${data.timestamp || new Date().toLocaleTimeString()}</span>
        </div>
        <div class="message-content">
            <p>${data.comment}</p>
        </div>
    `;
    return messageElement;
}

// 处理礼物消息
function handleGiftMessage(data) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message gift-message';
    
    let giftText = '';
    if (data.gift.streakable && data.streaking) {
        giftText = `正在连续送出 "${data.gift.name}"`;
    } else if (data.gift.streakable && !data.streaking) {
        giftText = `送出了 ${data.repeat_count}个 "${data.gift.name}"`;
    } else {
        giftText = `送出了 "${data.gift.name}"`;
    }
    
    messageElement.innerHTML = `
        <div class="message-header">
            <span class="user-name">${data.user.nickname}</span>
            <span class="message-time">${data.timestamp || new Date().toLocaleTimeString()}</span>
        </div>
        <div class="message-content">
            <p class="gift-text">${giftText}</p>
        </div>
    `;
    return messageElement;
}

// 处理点赞消息
function handleLikeMessage(data) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message like-message';
    messageElement.innerHTML = `
        <div class="message-header">
            <span class="user-name">${data.user.nickname}</span>
            <span class="message-time">${data.timestamp || new Date().toLocaleTimeString()}</span>
        </div>
        <div class="message-content">
            <p>点了 ${data.likes} 个赞</p>
        </div>
    `;
    return messageElement;
}

// 处理关注消息
function handleFollowMessage(data) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message follow-message';
    messageElement.innerHTML = `
        <div class="message-header">
            <span class="user-name">${data.user.nickname}</span>
            <span class="message-time">${data.timestamp || new Date().toLocaleTimeString()}</span>
        </div>
        <div class="message-content">
            <p>关注了主播</p>
        </div>
    `;
    return messageElement;
}

// 处理分享消息
function handleShareMessage(data) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message share-message';
    messageElement.innerHTML = `
        <div class="message-header">
            <span class="user-name">${data.user.nickname}</span>
            <span class="message-time">${data.timestamp || new Date().toLocaleTimeString()}</span>
        </div>
        <div class="message-content">
            <p>分享了直播间</p>
        </div>
    `;
    return messageElement;
}

// 处理系统消息
function handleSystemMessage(data) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message system-message';
    messageElement.innerHTML = `
        <div class="message-content">
            <p class="system-text">${data.text}</p>
        </div>
    `;
    return messageElement;
}

// 导出消息
function exportMessages() {
    // 创建导出数据
    const exportData = {
        timestamp: new Date().toISOString(),
        room_info: roomInfo.textContent,
        messages: messages
    };
    
    // 转换为JSON
    const jsonData = JSON.stringify(exportData, null, 2);
    
    // 创建Blob
    const blob = new Blob([jsonData], { type: 'application/json' });
    
    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tiktok-live-${new Date().toISOString().replace(/:/g, '-')}.json`;
    
    // 触发下载
    document.body.appendChild(a);
    a.click();
    
    // 清理
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);
}

// 更新UI状态
function updateUI(status) {
    isConnected = status === 'connected';
    
    // 更新状态徽章
    statusBadge.textContent = getStatusText(status);
    statusBadge.className = 'status-badge ' + getStatusClass(status);
    
    // 更新按钮状态
    if (status === 'connected' || status === 'connecting') {
        startBtn.disabled = true;
        stopBtn.disabled = false;
        urlInput.disabled = true;
        httpProxyInput.disabled = true;
        socksProxyInput.disabled = true;
        useMockCheckbox.disabled = true;
    } else {
        startBtn.disabled = false;
        stopBtn.disabled = true;
        urlInput.disabled = false;
        httpProxyInput.disabled = false;
        socksProxyInput.disabled = false;
        useMockCheckbox.disabled = false;
    }
    
    // 显示/隐藏空消息提示
    if (messageContainer.children.length === 0 || messageContainer.children.length === 1 && messageContainer.children[0] === emptyMessage) {
        emptyMessage.classList.remove('d-none');
    } else {
        emptyMessage.classList.add('d-none');
    }
}

// 获取状态文本
function getStatusText(status) {
    switch (status) {
        case 'connected':
            return '已连接';
        case 'connecting':
            return '连接中...';
        case 'disconnected':
            return '未连接';
        default:
            return '未知状态';
    }
}

// 获取状态类名
function getStatusClass(status) {
    switch (status) {
        case 'connected':
            return 'status-connected';
        case 'connecting':
            return 'status-connecting';
        case 'disconnected':
            return 'status-disconnected';
        default:
            return '';
    }
}

// 更新房间信息
function updateRoomInfo(info) {
    if (info.unique_id) {
        roomInfo.textContent = `${info.unique_id} (房间ID: ${info.room_id})`;
    } else {
        roomInfo.textContent = '';
    }
}

// 添加消息到UI
function addMessage(message) {
    // 如果是第一条消息，清空空消息提示
    if (messageContainer.children.length === 0 || (messageContainer.children.length === 1 && messageContainer.children[0] === emptyMessage)) {
        messageContainer.innerHTML = '';
    }
    
    // 创建消息元素
    const messageElement = createMessageElement(message);
    
    // 应用过滤器
    if (shouldShowMessage(message.type)) {
        messageElement.style.display = 'block';
    } else {
        messageElement.style.display = 'none';
    }
    
    // 添加到容器
    messageContainer.appendChild(messageElement);
    
    // 限制显示的消息数量，防止DOM过大
    const maxMessages = 200;
    while (messageContainer.children.length > maxMessages) {
        messageContainer.removeChild(messageContainer.firstChild);
    }
    
    // 滚动到底部
    scrollToMessageBottom();
}

// 创建消息元素
function createMessageElement(message) {
    // 检查消息是否有效
    if (!message || !message.type || !message.data) {
        console.error('无效的消息格式:', message);
        const errorElement = document.createElement('div');
        errorElement.className = 'message system-message';
        errorElement.innerHTML = `<div class="message-content"><p class="system-text">收到格式错误的消息</p></div>`;
        return errorElement;
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.type}-message`;
    messageElement.dataset.type = message.type;
    messageElement.dataset.id = message.id;
    
    // 为消息数据添加时间戳
    if (!message.data.timestamp && message.timestamp) {
        message.data.timestamp = message.timestamp;
    }
    
    // 根据消息类型创建内容
    try {
        switch (message.type) {
            case 'comment':
                return handleCommentMessage(message.data);
            case 'gift':
                return handleGiftMessage(message.data);
            case 'like':
                return handleLikeMessage(message.data);
            case 'follow':
                return handleFollowMessage(message.data);
            case 'share':
                return handleShareMessage(message.data);
            case 'system':
                return handleSystemMessage(message.data);
            default:
                messageElement.innerHTML = `<div class="message-content"><p>未知消息类型: ${message.type}</p></div>`;
                return messageElement;
        }
    } catch (error) {
        console.error('处理消息时出错:', error, message);
        const errorElement = document.createElement('div');
        errorElement.className = 'message system-message';
        errorElement.innerHTML = `<div class="message-content"><p class="system-text">处理消息时出错: ${error.message}</p></div>`;
        return errorElement;
    }
}

// 滚动到底部
function scrollToMessageBottom() {
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

// 更新统计
function updateStats(type) {
    switch (type) {
        case 'comment':
            stats.comment++;
            commentCount.textContent = stats.comment;
            break;
        case 'gift':
            stats.gift++;
            giftCount.textContent = stats.gift;
            break;
        case 'like':
            stats.like++;
            likeCount.textContent = stats.like;
            break;
        case 'follow':
            stats.follow++;
            followCount.textContent = stats.follow;
            break;
        case 'share':
            stats.share++;
            shareCount.textContent = stats.share;
            break;
    }
}

// 重置统计
function resetStats() {
    stats = {
        comment: 0,
        gift: 0,
        like: 0,
        follow: 0,
        share: 0
    };
    
    commentCount.textContent = '0';
    giftCount.textContent = '0';
    likeCount.textContent = '0';
    followCount.textContent = '0';
    shareCount.textContent = '0';
}

// 应用过滤器
function applyFilters() {
    // 获取所有消息元素
    const messageElements = messageContainer.querySelectorAll('.message');
    
    // 应用过滤器
    messageElements.forEach(element => {
        const type = element.dataset.type;
        
        if (shouldShowMessage(type)) {
            element.style.display = 'block';
        } else {
            element.style.display = 'none';
        }
    });
}

// 判断是否应该显示消息
function shouldShowMessage(type) {
    switch (type) {
        case 'comment':
            return filterComment.checked;
        case 'gift':
            return filterGift.checked;
        case 'like':
            return filterLike.checked;
        case 'follow':
            return filterFollow.checked;
        case 'share':
            return filterShare.checked;
        case 'system':
            return filterSystem.checked;
        default:
            return true;
    }
}

// 显示错误
function showError(message) {
    errorMessage.textContent = message;
    errorContainer.classList.remove('d-none');
}

// 隐藏错误
function hideError() {
    errorContainer.classList.add('d-none');
} 