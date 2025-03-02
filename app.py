#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
TikTok直播监听工具 - 主应用程序
整合TikTokLive库和前端界面
"""

import json
import asyncio
import threading
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
from TikTokLive import TikTokLiveClient
from TikTokLive.events import (
    ConnectEvent, CommentEvent, GiftEvent, ShareEvent,
    LikeEvent, FollowEvent, DisconnectEvent
)
from httpx import Proxy

# 初始化Flask应用
app = Flask(__name__)
app.config['SECRET_KEY'] = 'tiktok-live-secret'
socketio = SocketIO(app, cors_allowed_origins="*")

# 全局变量
client = None
client_thread = None
is_connected = False
messages = []
message_id = 0
room_info = {
    "unique_id": "",
    "room_id": "",
    "viewer_count": 0
}


# 路由：主页
@app.route('/')
def index():
    return render_template('index.html')


# API：获取服务器状态
@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({
        "status": "connected" if is_connected else "disconnected",
        "room_info": room_info
    })


# API：获取历史消息
@app.route('/api/messages', methods=['GET'])
def get_messages():
    since_id = request.args.get('since_id', 0, type=int)
    filtered_messages = [msg for msg in messages if msg['id'] > since_id]
    return jsonify(filtered_messages)


# API：开始监听
@app.route('/api/start', methods=['POST'])
def start_crawler():
    global client, client_thread, is_connected

    if is_connected:
        return jsonify({"error": "已经连接到直播间"}), 400

    data = request.json
    unique_id = data.get('url', '')
    http_proxy = data.get('http_proxy', '')
    socks_proxy = data.get('socks_proxy', '')
    use_mock = data.get('use_mock', False)

    if not unique_id and not use_mock:
        return jsonify({"error": "请提供有效的TikTok直播间URL或ID"}), 400

    try:
        if use_mock:
            # 使用模拟数据
            client_thread = threading.Thread(target=start_mock_client)
            client_thread.daemon = True
            client_thread.start()
            return jsonify({"status": "success", "message": "已开始使用模拟数据"})

        # 配置代理
        web_proxy = None
        ws_proxy = None

        if http_proxy:
            web_proxy = Proxy(http_proxy, auth=("", ""))

        if socks_proxy:
            ws_proxy = Proxy(socks_proxy, auth=("", ""))

        # 创建TikTokLive客户端
        client = TikTokLiveClient(
            unique_id=unique_id,
            web_proxy=web_proxy,
            ws_proxy=ws_proxy
        )

        # 注册事件处理函数
        register_event_handlers(client)

        # 启动客户端
        client_thread = threading.Thread(target=start_client)
        client_thread.daemon = True
        client_thread.start()

        return jsonify({"status": "success", "message": "已开始连接到直播间"})

    except Exception as e:
        return jsonify({"error": f"连接失败: {str(e)}"}), 500


# API：停止监听
@app.route('/api/stop', methods=['POST'])
def stop_crawler():
    global client, client_thread, is_connected

    if not is_connected and not client:
        return jsonify({"error": "未连接到直播间"}), 400

    try:
        if client:
            # TikTokLiveClient没有stop方法，使用disconnect方法
            try:
                client.disconnect()
            except:
                # 如果disconnect方法不存在或失败，尝试其他方法
                try:
                    client.close()
                except:
                    pass

            client = None

        # 如果有模拟数据线程在运行，设置标志位使其退出循环
        is_connected = False

        add_system_message("已断开与直播间的连接")
        socketio.emit('disconnect_event', {"status": "disconnected"})

        return jsonify({"status": "success", "message": "已断开连接"})

    except Exception as e:
        return jsonify({"error": f"断开连接失败: {str(e)}"}), 500


# API：清空消息
@app.route('/api/clear', methods=['POST'])
def clear_messages():
    global messages, message_id
    messages = []
    message_id = 0
    return jsonify({"status": "success", "message": "已清空所有消息"})


# WebSocket：连接事件
@socketio.on('connect')
def handle_connect():
    emit('status', {"status": "connected" if is_connected else "disconnected", "room_info": room_info})


# 启动TikTokLive客户端
def start_client():
    try:
        client.run()
    except Exception as e:
        add_system_message(f"连接错误: {str(e)}")
        socketio.emit('error', {"message": str(e)})


# 启动模拟数据客户端
def start_mock_client():
    global is_connected, room_info

    is_connected = True
    room_info = {
        "unique_id": "@mock_user",
        "room_id": "mock_room_123",
        "viewer_count": 1000
    }

    add_system_message("已连接到模拟直播间")
    socketio.emit('connect_event', {
        "status": "connected",
        "room_info": room_info
    })

    # 模拟消息
    mock_messages = [
        {"type": "comment", "user": {"nickname": "用户1"}, "comment": "你好，这是测试消息"},
        {"type": "gift", "user": {"nickname": "用户2"}, "gift": {"name": "玫瑰"}, "repeat_count": 5},
        {"type": "like", "user": {"nickname": "用户3"}, "likes": 10},
        {"type": "follow", "user": {"nickname": "用户4"}},
        {"type": "share", "user": {"nickname": "用户5"}}
    ]

    # 每隔几秒发送一条模拟消息
    import random
    import time

    while is_connected:
        msg = random.choice(mock_messages)
        if msg["type"] == "comment":
            add_comment_message({"user": msg["user"], "comment": msg["comment"]})
        elif msg["type"] == "gift":
            add_gift_message({"user": msg["user"], "gift": msg["gift"], "repeat_count": msg["repeat_count"]})
        elif msg["type"] == "like":
            add_like_message({"user": msg["user"], "likes": msg["likes"]})
        elif msg["type"] == "follow":
            add_follow_message({"user": msg["user"]})
        elif msg["type"] == "share":
            add_share_message({"user": msg["user"]})

        time.sleep(random.uniform(1, 5))


# 注册TikTokLive事件处理函数
def register_event_handlers(client):
    @client.on(ConnectEvent)
    async def on_connect(event: ConnectEvent):
        global is_connected, room_info

        is_connected = True
        room_info = {
            "unique_id": event.unique_id,
            "room_id": client.room_id,
            "viewer_count": 0  # 初始值，可能需要从其他事件更新
        }

        add_system_message(f"已连接到直播间 @{event.unique_id} (房间ID: {client.room_id})")
        socketio.emit('connect_event', {
            "status": "connected",
            "room_info": room_info
        })

    @client.on(CommentEvent)
    async def on_comment(event: CommentEvent):
        add_comment_message({
            "user": {
                "nickname": event.user.nickname,
                "unique_id": event.user.unique_id
            },
            "comment": event.comment
        })

    @client.on(GiftEvent)
    async def on_gift(event: GiftEvent):
        # 处理礼物事件
        gift_data = {
            "user": {
                "nickname": event.user.nickname,
                "unique_id": event.user.unique_id
            },
            "gift": {
                "name": event.gift.name,
                "diamond_count": event.gift.diamond_count,
                "streakable": event.gift.streakable
            },
            "repeat_count": event.repeat_count,
            "streaking": event.streaking
        }
        add_gift_message(gift_data)

    @client.on(LikeEvent)
    async def on_like(event: LikeEvent):
        add_like_message({
            "user": {
                "nickname": event.user.nickname,
                "unique_id": event.user.unique_id
            },
            "likes": event.likes
        })

    @client.on(FollowEvent)
    async def on_follow(event: FollowEvent):
        add_follow_message({
            "user": {
                "nickname": event.user.nickname,
                "unique_id": event.user.unique_id
            }
        })

    @client.on(ShareEvent)
    async def on_share(event: ShareEvent):
        add_share_message({
            "user": {
                "nickname": event.user.nickname,
                "unique_id": event.user.unique_id
            }
        })

    @client.on(DisconnectEvent)
    async def on_disconnect(_):
        global is_connected

        is_connected = False
        add_system_message("已断开与直播间的连接")
        socketio.emit('disconnect_event', {"status": "disconnected"})


# 添加评论消息
def add_comment_message(data):
    message = create_message("comment", data)
    add_message(message)
    socketio.emit('new_message', message)


# 添加礼物消息
def add_gift_message(data):
    message = create_message("gift", data)
    add_message(message)
    socketio.emit('new_message', message)


# 添加点赞消息
def add_like_message(data):
    message = create_message("like", data)
    add_message(message)
    socketio.emit('new_message', message)


# 添加关注消息
def add_follow_message(data):
    message = create_message("follow", data)
    add_message(message)
    socketio.emit('new_message', message)


# 添加分享消息
def add_share_message(data):
    message = create_message("share", data)
    add_message(message)
    socketio.emit('new_message', message)


# 添加系统消息
def add_system_message(text):
    message = create_message("system", {"text": text})
    add_message(message)
    socketio.emit('new_message', message)


# 创建消息对象
def create_message(msg_type, data):
    global message_id
    message_id += 1

    import datetime
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    return {
        "id": message_id,
        "type": msg_type,
        "timestamp": timestamp,
        "data": data
    }


# 添加消息到历史记录
def add_message(message):
    global messages
    messages.append(message)

    # 限制消息历史记录数量，防止内存溢出
    if len(messages) > 1000:
        messages = messages[-1000:]


# 主函数
if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
