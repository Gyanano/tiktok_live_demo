# TikTok直播监听工具

这是一个基于Python和Flask的TikTok直播监听工具，可以实时获取TikTok直播间的评论、礼物、点赞、关注和分享等互动信息。

## 功能特点

- 实时监听TikTok直播间互动
- 支持评论、礼物、点赞、关注、分享等多种互动类型
- 美观的Web界面，实时显示互动信息
- 支持数据统计和导出
- 支持HTTP和SOCKS代理设置
- 提供模拟数据模式，用于测试和演示

## 安装依赖

```bash
pip install -r requirements.txt
```

## 使用方法

1. 安装依赖包
2. 运行应用程序

```bash
python app.py
```

3. 在浏览器中访问 `http://localhost:5000`
4. 输入TikTok直播间URL或ID，点击"开始监听"

## 代理设置

由于网络限制，可能需要设置代理才能正常访问TikTok。本工具支持两种代理设置：

- HTTP代理：用于Web请求，格式如 `http://127.0.0.1:7890`
- SOCKS代理：用于WebSocket连接，格式如 `socks5://127.0.0.1:7889`

## 模拟数据模式

如果无法连接到TikTok或仅需测试功能，可以勾选"使用模拟数据"选项，系统将生成随机的模拟互动数据。

## 技术栈

- 后端：Python、Flask、Flask-SocketIO、TikTokLive
- 前端：HTML、CSS、JavaScript、Bootstrap 5

## 注意事项

- 本工具仅用于学习和研究目的
- 使用本工具时请遵守相关法律法规和TikTok的服务条款
- 由于TikTok API可能变更，本工具可能需要不定期更新 