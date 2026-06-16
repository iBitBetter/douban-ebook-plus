# Douban eBook ++ — 豆瓣读书增强

> 一键从豆瓣直达你的电子书平台。Only one click from Douban to your favorite ebook platforms.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![Platforms](https://img.shields.io/badge/Platforms-7-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

在豆瓣读书详情页注入一个在线阅读链接面板，支持 **7 个主流电子书平台**。其中 5 个平台实现了智能直达（书名→书籍详情页），Z-Library 支持多镜像自动探活。

---

## 支持平台

| 平台 | 解析方式 | 状态 |
|------|---------|------|
| 微信读书 | 书名 → bookDetail 直链 | ✅ 直达 |
| 豆瓣阅读 | 书名 → reader/ebook 直链 | ✅ 直达 |
| 得到 | 书名 → ebook/reader 直链 | ✅ 直达 |
| 多看阅读 | 书名 → reader/app.html 直链 | ✅ 直达 |
| 网易蜗牛读书 | 书名 → share/book 直链 | ✅ 直达 |
| Z-Library | 多镜像探活 + ISBN 搜索 | ✅ 直达 |
| Anna's Archive | ISBN / 书名搜索 | 🔗 搜索 |

---

## 安装

### 开发者模式加载

```bash
git clone https://github.com/BitBetter/douban-ebook-plus.git
```

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目文件夹 `douban-ebook-plus/`

---

## 项目结构

```
douban-ebook-plus/
├── manifest.json          # Manifest V3 声明
├── background.js          # Service Worker — API 代理 + 镜像探测
├── content.js             # Content Script — UI 注入 + 面板逻辑
├── content.css            # 面板样式
├── utils/
│   └── weread-encode.js   # 微信读书 bookId MD5 编码算法
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## 架构

```
豆瓣书籍页 (book.douban.com/subject/*)
        │
        ▼
  content.js ─── 提取书名/ISBN ──→ 生成面板 DOM ──→ sendMessage ──→ background.js
        │                                                              │
        │                    ┌─────────────────────────────────────────┘
        │                    ▼
        │              Service Worker (无 CORS 限制)
        │                    │
        │     ┌──────────────┼──────────────┬──────────────┐
        │     ▼              ▼              ▼              ▼
        │  weread API    duokan API    dedao API     woniu API
        │     │              │              │              │
        │     ▼              ▼              ▼              ▼
        │  bookDetail    app.html      ebook/reader   share/book
        │     │              │              │              │
        │     └──────────────┴──────────────┴──────────────┘
        │                    │
        │                    ▼
        └─────────── 更新链接 + 标记「直达」
```

## API 逆向实录

### 微信读书

- **搜索 API**：`GET /web/search/global?keyword=`
- **编码算法**：bookId → MD5 → 自定义 hex 变换 → 3 字符校验码。纯 JS MD5 实现（不依赖 Node crypto），与 obsidian-weread-plugin 编码逻辑一致。
- **直链**：`https://weread.qq.com/web/bookDetail/{encodedId}`

### 豆瓣阅读

- **搜索 API**：`GET /j/search?query=`
- **过滤**：`type === "ebook"`
- **直链**：`https://read.douban.com/reader/ebook/{id}/`

### 得到

- **搜索 API**：`POST /api/search/pc/suggest` + `searchType=2`
- **过滤**：`type === 2`（电子书）
- **直链**：`https://www.dedao.cn/ebook/reader?id={enid}`

### 多看阅读

- **搜索 API**：`GET /target/search/web?s=`（从 JS 源码中逆向发现）
- **直链**：`https://www.duokan.com/reader/www/app.html?id={book_id}`

### 网易蜗牛读书

- **搜索 API**：`GET /search/book.json?word=`（从 `web_intro/index.js` 中逆向发现）
- **⚠️ 注意**：仅支持书名搜索，ISBN 无效！
- **直链**：`https://du.163.com/share/book/{bookId}`

### Z-Library 镜像智能探测

维护 3 个镜像地址优先级列表，顺序 `HEAD` 探活（3 秒超时），返回第一个可用的并拼接 `/s/{ISBN}` 搜索链接：

```
zh.chris101.ru  →  zh.vbh101.ru/s/{ISBN}
zlib.ch         →  zlib.ch/s/{ISBN}
zlib.re         →  zlib.re/s/{ISBN}
```

全部不可达时兜底第一个镜像首页。

---

## 踩坑笔记

| 坑 | 现象 | 解决 |
|----|------|------|
| **CORS 拦截** | content.js 直接 fetch 蜗牛 API 被拒 | 走 Service Worker（扩展有跨域特权） |
| **ISBN 搜索失效** | 蜗牛搜索用 ISBN 返回空结果 | 书名优先，ISBN 作备选（部分平台不支持 ISBN） |
| **Number 精度丢失** | 蜗牛 bookId（19 位）JSON.parse 后被截断 | 优先用 API 返回的字符串字段 `book.bookId` |
| **302 吞噬参数** | zlib 镜像重定向丢弃 `/s/{isbn}` 路径 | 镜像分离 `homeUrl`（探活）和 `searchBase`（构造链接） |
| **Worker 缓存** | 修改代码后旧逻辑仍在运行 | 卸装重装扩展（不是刷新）以彻底更新 Service Worker |
| **host_permissions** | 新增镜像域名后 CORS 仍被拦截 | `manifest.json` 的 `host_permissions` 需显式添加新域名 |

---

## 开发与调试

```bash
# 语法检查
node -e "new Function(require('fs').readFileSync('./background.js','utf8')); console.log('bg OK')"
node -e "new Function(require('fs').readFileSync('./content.js','utf8'));  console.log('ct OK')"

# 手动测试 API（Git Bash / WSL）
curl -s 'https://du.163.com/search/book.json?word=三体&page=1&pageSize=3'
```

调试日志关键字：`[DB+]` 开头，在豆瓣页面按 F12 → Console 查看。

---

## 技术栈

- **Manifest V3** — Chrome 扩展最新标准
- **Service Worker** — 跨域 API 代理
- **纯 JS** — 零依赖，无构建步骤
- **内联 SVG** — 平台图标自包含，无网络请求

---

## License

MIT © BitBetter
