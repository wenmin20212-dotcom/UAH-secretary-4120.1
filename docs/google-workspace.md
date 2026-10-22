# Google Drive / Docs 操作

## 已实现

- `connector:google_workspace` 接入现有 M7 接口规划、操作白名单、脱模装配目录。
- 支持 read/create/edit/upload；通过 `agent_connector_install` 按实际需求启用，不从文档内容推导授权。
- 独立的 `agent_google_connect/status/list/read/create/append/upload/disconnect` 工具；不存在分享、删除、任意 API 或任意 HTTP 地址工具。
- 系统浏览器 OAuth、127.0.0.1 随机端口回调、PKCE S256、随机 state、超时及重复回调防护、同实例授权锁。
- Windows 使用既有 DPAPI vault；凭据绑定产品和实例，刷新后不得扩大 scope，不向模型返回令牌。
- 默认 drive.file：仅访问本应用创建或经 Google 文件选择机制开放的文件；列出的是可访问文件，不是全盘搜索。可另请求 read_all，只增加 drive.readonly；编辑仍受 drive.file 范围限制。
- 原生 Google 文档创建、包含 tabs 的读取、带 requiredRevisionId 的追加；并发冲突拒绝。
- 上传最多 10 MiB 的实例 workspace 相对路径文件，不跟随符号链接、不接收外部绝对路径。默认保持原格式；对 .doc/.docx 显式设置 convertToGoogleDoc:true，使用原始 Word 媒体类型和 Google Docs 目标元数据导入，不修改原文件。复杂排版的转换效果需用户检查。
- 网络写入不自动重试，失败可能结果不确定。工具断开仅清除本实例的文档令牌，不执行应用级远程撤销，避免连带撤销同一 Google 应用下的 Gmail 等授权。用户可在 Google 账号中自行撤销应用。

## 首次连接

1. 为此连接器配置 Google Desktop OAuth 客户端，在对应 Google Cloud 项目启用 Drive API、Docs API，配置受众与测试用户。可以复用已配置的 Desktop 客户端；文档 token 与 Gmail token 分开保存。若希望 Google 账号侧也可独立撤销，建议使用不同 Google Cloud 项目。
2. 用户本人把下载的 Desktop OAuth JSON 保存到实例资料目录的 `data/connectors/google-workspace/oauth-client.json`。不要发到聊天、提交 Git 或包含在更新包。
3. 在孵化师说“连接 Google 文档”；Agent 先安装所需操作，再调用 `agent_google_connect`。系统浏览器中由用户登录和同意。
4. `setup_required` 表示缺少配置，不能报告已授权。成功后用 status 检查结果。

目前没有 Google Picker UI。已有文档不能仅通过粘贴 URL 获得 drive.file 权限；读取已有任意文档需本人授权 read_all。修改现有未向此应用开放的文档会收到 Google 403，不扩大为全盘写入权限。删除/分享与 Picker UI 属于后续功能。

## 两类文件边界

通用程序：本目录两个 google 模块、连接器目录和 MCP/装配集成代码。

职业与实例数据：M7 需求、安装操作选择、OAuth 客户端配置、加密令牌、实例身份以及 workspace 文件。均保存在对应实例资料目录；不同 Agent 不继承母机令牌。

此次不等于完成全系统的两类文件迁移；旧升级器仍需按之前清单改造。本增量只能作为干净构建的输入，不能直接覆盖运行实例或整目录上传 GitHub。


## 验证

运行 npm run test:google。测试使用模拟 Google 响应，不表示已完成真实账号授权或云端上传。Google 文档转换可能改变 Word 的复杂排版，上传后需要核对。
