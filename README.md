# Share Note Cloudflare (Worker + D1 + R2)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Cloudflare%20Workers-orange)](https://workers.cloudflare.com/)
[![Database](https://img.shields.io/badge/Database-Cloudflare%20D1-green)](https://developers.cloudflare.com/d1/)
[![Storage](https://img.shields.io/badge/Storage-Cloudflare%20R2-purple)](https://developers.cloudflare.com/r2/)

基于 Cloudflare 边缘计算栈重构的 [Obsidian Share Note](https://github.com/alangrainger/share-note) 服务端。

无需自建 VPS，不依赖 Docker，零运维、高可用、多副本容灾，完全运行在 Cloudflare 的免费额度之内。

---

## 渊源与改造说明 (Upstream & Modifications)

本项目是基于官方后端 [note-sx/server](https://github.com/note-sx/server) 进行的 **Serverless 架构移植与现代化重构**。

### 1. 为什么重构，而不是直接运行原项目？
原版 `note-sx/server` 是针对传统单机 VPS 设计的 Node.js + Docker 架构：
- **单点故障风险**：笔记和附件保存在宿主机磁盘文件系统，SQLite 也为单机文件。一旦 VPS 崩溃、欠费或磁盘故障，数据面临丢失风险。
- **本地编译依赖**：原版依赖了 `@resvg/resvg-js`（Rust/C++ 编写的生成统计图扩展）和 `better-sqlite3`（原生 C 语言 SQLite 驱动），完全无法在 Serverless 边缘运行。
- **运维成本**：需要自行配置反代、SSL 证书续期、Docker 重启策略及数据备份。

### 2. 我们做了哪些改造？
1. **计算层（Node.js -> Cloudflare Workers）**：
   - 保留官方采用的 Hono 框架，彻底移除 `@hono/node-server` 与 Node.js 进程管理代码，改为原生 Workers 边缘事件驱动。
2. **数据层（better-sqlite3 -> Cloudflare D1）**：
   - 将同步的本地 SQLite 调用全面替换为 Cloudflare D1（无服务器分布式 SQLite）。
   - 保留原版的 `users`、`api_keys`、`files` 数据表设计，查询天然异步化。
3. **存储层（本地磁盘 -> Cloudflare R2）**：
   - 将原版写入 `userfiles/notes/`、`userfiles/files/`、`userfiles/css/` 的逻辑改为直接写入 Cloudflare R2 对象存储。
   - 分享笔记高持久、多副本，且享受 **0 出口流量费**。
4. **剔除沉重包袱**：
   - 剔除 `@resvg/resvg-js`、`node-cron`、`dotenv` 等多余或不兼容依赖，项目冷启动时间缩减至 0ms 级。
5. **100% 协议兼容**：
   - **客户端插件零修改**：官方 [Obsidian Share Note](https://github.com/alangrainger/share-note) 插件无需任何二次开发，仅需修改 Server URL 即可无缝使用。
   - 完整保留**端到端加密（E2EE）**解密逻辑（`decrypt.js`）、Obsidian 主题样式捕获（`css`）、MathJax 数学公式渲染和 Lucide 图标。
   - 完整保留 `obsidian://share-note?key=...` 一键配对注册流程。

---

## 架构对比 (Architecture)

```text
【官方原架构 - 传统 VPS】
Obsidian 插件 ---> Nginx 反代 ---> Node.js (Hono) ---> 本地磁盘 (HTML/图片)
                                                  ---> 本地 SQLite (.db)

【本项目架构 - Cloudflare 全托管】
Obsidian 插件 ---> Cloudflare CDN 边缘节点 ---> Cloudflare Worker (Hono)
                                            ├──> Cloudflare R2 (高持久对象存储)
                                            ├──> Cloudflare D1 (分布式 SQLite)
                                            └──> Static Assets (MathJax/JS)
```

---

## 快速上手与部署 (Quickstart)

### 第一步：克隆并安装依赖

```bash
git clone <your-repo-url>
cd share-note-cloudflare
npm install
```

### 第二步：创建 Cloudflare D1 数据库

登录并使用 Wrangler 创建 D1 数据库：

```bash
npx wrangler d1 create notesx-db
```

命令成功后会输出类似如下内容：
```text
[[d1_databases]]
binding = "DB"
database_name = "notesx-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

执行数据库表初始化：
```bash
npx wrangler d1 execute notesx-db --remote --file=./schema.sql
```

### 第三步：创建 Cloudflare R2 存储桶

```bash
npx wrangler r2 bucket create notesx-storage
```

### 第四步：修改 `wrangler.toml`

打开 `wrangler.toml`，填写你的真实配置：

```toml
name = "share-note-worker"
main = "src/index.ts"
compatibility_date = "2024-09-01"

[assets]
directory = "./public"
binding = "ASSETS"

[[d1_databases]]
binding = "DB"
database_name = "notesx-db"
database_id = "填入你创建的_D1_DATABASE_ID"

[[r2_buckets]]
binding = "R2"
bucket_name = "notesx-storage"

[vars]
BASE_WEB_URL = "https://sharenotes.guoyingwei.top"  # 你的自定义域名或 workers.dev 域名
HASH_SALT = "生成一段任意随机长字符串作为盐值"
ALLOW_NEW_USERS = "true"
FILENAME_LENGTH_HTML = "8"
MAXIMUM_UPLOAD_SIZE_MB = "5"
```

### 第五步：部署到 Cloudflare

```bash
npx wrangler deploy
```

部署完成后，在 Cloudflare 控制台中给该 Worker 绑定你的自定义域名（例如 `notes.yourdomain.com`），确保开启 HTTPS。

---

## 在 Obsidian 中配置生效

1. 打开你的 Obsidian 库文件：`<Vault>/.obsidian/plugins/share-note/data.json`；
2. 将 `"server"` 地址修改为你的 Worker 域名：
   ```json
   {
     "server": "https://sharenotes.guoyingwei.top",
     "api_key": ""
   }
   ```
3. 在 Obsidian 设置中打开 **Share Note** 插件，点击 **Connect** 按钮；
4. 浏览器会自动打开连接页面，并提示跳转回 Obsidian，自动填入新生成的 `API Key`；
5. 现在就可以在任一笔记右上角点击分享，享受秒级上传与安全加密的笔记直享服务！

---

## 费用说明 (Free Tier)

对于个人或小团队分享笔记使用，完全落在 Cloudflare 永久免费额度之内：
- **Cloudflare Workers**：每天 100,000 次请求免费
- **Cloudflare D1**：每天 5,000,000 次读取、100,000 次写入免费，5GB 存储免费
- **Cloudflare R2**：10GB 存储免费，每月 10,000,000 次读、1,000,000 次写免费，**0 出口流量费**

---

## 鸣谢与许可 (Credits & License)

- 服务端原版：[note-sx/server](https://github.com/note-sx/server) (MIT License, Copyright Alan Grainger)
- 客户端插件：[share-note](https://github.com/alangrainger/share-note) (MIT License, Copyright Alan Grainger)
- 本仓库代码同样基于 [MIT License](LICENSE) 开源发布。
