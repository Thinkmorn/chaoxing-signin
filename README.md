# 学习通签到系统

基于 QQ Bot 的超星学习通自动签到系统，支持二维码签到、位置签到、普通签到、多账号并发。

---

## 功能清单

| 功能        | 说明                           | 状态 |
| ----------- | ------------------------------ | ---- |
| 二维码签到  | 拍照发 QQ Bot 自动识别签到     | ✅   |
| 位置签到    | 自动处理位置签到请求           | ✅   |
| 普通签到    | 一键完成普通签到               | ✅   |
| 多账号支持  | 同时为多个超星账号签到         | ✅   |
| 自动监听    | 后台监测签到通知并自动处理     | ✅   |
| QQ Bot 交互 | 通过 QQ 发送二维码图片触发签到 | ✅   |
| 交互式菜单  | 终端交互式签到操作界面         | ✅   |

## 系统架构

```
用户 → (二维码图片) → QQ Bot ← (WebSocket 3001) ← NapCat
                      ↓
             解码提取 enc/activeId
                      ↓
                  Monitor
                      ↓
             检测签到通知 → 自动签到
                      ↓
             超星学习通 API → 签到成功
```

### 项目结构

```
chaoxing-signin/
├── apps/                      # 应用入口
├── packages/
│   ├── chaoxing-core/         # ⭐ 核心签到逻辑
│   ├── napcat-adapter/        # QQ Bot 适配层
│   ├── napcat-common/         # 通用工具
│   ├── napcat-core/           # NapCat 核心模块
│   ├── napcat-onebot/         # OneBot 协议实现
│   └── ...                    # 其他支撑模块
├── start-all.js               # 一键启动
├── start.js                   # 交互式菜单
├── monitor.js                 # 监听模式
├── qqbot.js                   # QQ Bot 模式
├── download-napcat.js         # NapCat 下载脚本
└── env.example.json           # 配置示例
```

## 快速开始

### 环境要求

- **Node.js** >= 18.0.0
- **pnpm** >= 9.0（`npm install -g pnpm`）

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/Thinkmorn/chaoxing-signin.git
cd chaoxing-signin

# 2. 安装依赖
pnpm install

# 3. 下载 NapCat QQ 机器人
node download-napcat.js

# 4. 配置账号
# 编辑 env.json（参考 env.example.json）
```

### 配置说明

创建 `env.json` 文件：

```json
{
  "accounts": [
    {
      "phone": "18812345678",
      "password": "your_password",
      "remark": "备注名"
    }
  ],
  "napcat": {
    "qq": "机器人QQ号",
    "password": "机器人QQ密码",
    "onebotPort": 3001
  }
}
```

### 启动

```bash
# 一键启动（推荐）
node start-all.js

# 或分别启动
node start.js       # 交互式签到菜单
node monitor.js     # 后台监听签到
node qqbot.js       # QQ Bot 服务
```

> **首次运行**需扫码登录 QQ，登录态会被缓存，后续无需重复扫码。

## 使用指南

### 二维码签到

1. 拍下/截图课堂上的二维码
2. 将图片发送给 QQ 机器人
3. 机器人自动解码并完成签到（所有账号）
4. 机器人回复签到结果

### 自动监听签到

启动 `start-all.js` 后，系统自动：

- **普通签到 / 位置签到** → 自动完成
- **二维码签到** → 提示发送图片

### 手动签到

```
签到 enc=xxxxx                  # 所有账号签到
签到 enc=xxxxx --user=0         # 指定第一个账号
签到 enc=xxxxx --user=1         # 指定第二个账号
```

## 技术栈

| 技术                          | 用途                                 |
| ----------------------------- | ------------------------------------ |
| **Node.js ≥ 18**              | 运行时                               |
| **pnpm workspace**            | 单体仓库管理                         |
| **TypeScript**                | 类型安全                             |
| **NapCat Shell**              | QQ 协议实现 (OneBot v11 / WebSocket) |
| **@undecaf/zbar-wasm + jsQR** | 二维码解码                           |
| **jpeg-js + pngjs**           | 图片处理                             |
| **easemob WebIM SDK**         | 超星 IM 消息监听                     |

## FAQ

<details>
<summary><b>启动后提示"未找到 NapCat"？</b></summary>

运行 `node download-napcat.js` 自动下载 NapCat。若自动下载失败，从 [NapCat Releases](https://github.com/NapNeko/NapCatQQ/releases) 下载 `NapCat.Shell.Windows.Node.zip` 解压到 `napcat/` 目录。

</details>

<details>
<summary><b>QQ 登录失败/提示过期？</b></summary>

删除 `napcat/` 目录下的 `.sig` 文件，重新启动并扫码登录。

</details>

<details>
<summary><b>二维码签到提示失败？</b></summary>

确保二维码图片清晰，可尝试重新发送。若多次失败，改用 `签到 enc=xxx` 手动签到。

</details>

<details>
<summary><b>多账号中某个账号签到失败？</b></summary>

检查该账号密码是否正确，以及是否在超星学习通中有有效课程。

</details>

## 命令速查

```bash
pnpm install                  # 安装依赖
node download-napcat.js       # 下载 NapCat
node start-all.js              # 一键启动
node start.js                  # 交互式菜单
node monitor.js               # 监听模式
node qqbot.js                 # QQ Bot
```

## 参考项目

- [NapNeko/NapCatQQ](https://github.com/NapNeko/NapCatQQ) — 基于 NapCat 的 QQ 协议实现，提供 OneBot WebSocket 接口
- [cxOrz/chaoxing-signin](https://github.com/cxOrz/chaoxing-signin) — 超星签到工具，核心签到逻辑参考

## 免责声明

本项目仅作为交流学习使用。通过本项目加深对网络通信、接口编写、交互设计等方面知识的理解。

**严禁用于商业用途。** 任何人或组织使用本项目代码进行的任何违法行为，与本人无关。
