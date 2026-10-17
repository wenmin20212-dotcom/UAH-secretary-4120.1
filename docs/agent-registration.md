# 通用 Agent 存在登记（第一版）

状态：随孵化师 0.9.5、秘书 0.1.4 交付；需安装升级包后生效。目标只是在本机登记“已知有哪些 Agent”，不包含派工、网络发现、账号授权或接手改进。

## 入口

两种程序都提供“Agent 登记”按钮（选择目录、分析并确认），孵化师“孵化项目”面板另增“已登记的 Agent”和“登记外来 Agent”。输入完整安装目录，点击“分析目录”，核对名称、版本、身份和缺口后“确认登记”。分析本身不写登记记录。修改目录后须重新分析。

模型工具 `incubator_agents`：action 为 inspect、register 或 list；前两项需要 directory。登记使用本孵化师的实例数据目录，写入独立的 `<profile>/data/agent-registry/agent-registry.sqlite`，不将外来 Agent 假装成由自己孵化的项目。只有经过明确的后续接管流程才能编辑其项目。

独立 PowerShell 入口：

```powershell
.\tools\Register-Agent.ps1 -Action inspect -AgentDirectory 'D:\Agents\Secretary' -DataRoot 'D:\MyIncubatorData' -NodePath 'D:\Runtime\node.exe'
.\tools\Register-Agent.ps1 -Action register -AgentDirectory 'D:\Agents\Secretary' -DataRoot 'D:\MyIncubatorData' -NodePath 'D:\Runtime\node.exe'
.\tools\Register-Agent.ps1 -Action list -DataRoot 'D:\MyIncubatorData' -NodePath 'D:\Runtime\node.exe'
```

Node.js 需支持 node:sqlite，建议 24 或更新。PS1 是调用本工具模块，不调用外来目录中的任何脚本。

## 识别和持久化

只读取根目录的 agent.json，以及可选 agent-identity.json。单文件最多 256 KiB，不沿链接或 junction 读取；不递归扫描，不启动 Agent，不读取 data、模型设置、邮箱令牌或聊天。

身份优先级：可选标准身份清单的 agentUid → agent.json.agentUid → 旧包 instanceId → 产品 ID 与当前目录形成的本机临时身份。永久 ID 使用 UUID，不以职业编号或名称去重。不同 UUID 即使同职业同编号也分别登记，不擅自改号；相同身份、不同产品或角色编号则拒绝覆盖。

相同身份再次登记更新名称、版本及最近观察时间，保留首次登记时间和已知位置。迁移后以相同永久 ID 合并位置；目录失效仍保留登记，不代表在线或离线。旧实例 ID 和目录临时身份不能保证迁移/重装后的连续性，必须展示缺口，人工核对，不能凭名称猜测合并。

新创建孵化项目保存 agentUid，准备导出时带入清单，脱模程序已沿用清单到 agent.json；从同一项目发布后保留该 ID。旧项目和旧秘书不静默补造来源或永久 ID。现有身份声明未经签名验证，登记不赋予可信身份或调用权限。

可选身份清单格式（不是安装前提）：

```json
{
  "schema": "uah-agent-identity/v1",
  "agentUid": "550e8400-e29b-41d4-a716-446655440000",
  "productId": "example-agent",
  "sourceIncubatorId": "unknown",
  "repositoryUrl": "https://github.com/example/example-agent"
}
```

清单 productId 必须与 agent.json 一致，agentUid 有冲突则拒绝。缺少来源、角色编号或 GitHub 时显示未知，不从标题猜编号。

## 彼此知道存在

A 登记 B 后，A 的登记表知道 B。B 不会因此自动知道 A；若双方都具备此模块，应分别把对方登记进自己的登记表。当前不向 B 写文件、不启动其服务、不广播或上传资料。后续协调器可以读取同一个登记协议，但连通、能力检查和授权须独立实现。

测试使用合成 Agent 覆盖身份去重、目录迁移、冲突不覆盖、同编号不同身份、旧包缺口、真实 PS1 调用；Edge 无头浏览器覆盖分析后确认、登记可见；MCP 标准输入输出测试验证孵化流程兼容。真实秘书仅做只读识别，未写入其程序和资料。
