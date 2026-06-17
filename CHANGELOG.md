# Changelog

## [v1.1] — 2026-06-17

### ✨ 新增

- **设置页**：`options.html` + `options.js` + `options.css`，支持 Z-Library 镜像 CRUD（增删改查）、拖拽排序（上下箭头）、恢复默认
- **Anna's Archive 可配置化**：设置页新增搜索地址输入，支持 `{query}` 占位符，存储 key `annas_base`，默认 `https://annas-archive.gl/search?q={query}`

### 🔧 优化

- **面板位置**：从左侧 `.related_info` 移至右侧 `.aside`（豆瓣右侧边栏），挨着评分/购买区域
- **Z-Library 镜像可配置**：从硬编码 `ZLIB_MIRRORS` 改为 `chrome.storage.sync` 动态读取，`getMirrorList()` 异步获取，`DEFAULT_ZLIB_MIRRORS` 兜底
- **镜像探测逻辑**：从 HEAD 探测 `homeUrl` 改为直接探测 `searchBase + '/s/{ISBN}'` 搜索链接，响应成功即显示「直达」标识
- **默认镜像精简**：从 3 个减为 1 个，探测地址 `https://zh.zlib.re/`，搜索地址 `https://zh.vbh101.ru/`

### 🐛 修复

- **Z-Library 兜底链接**：镜像不可达时返回 `searchBase + '/'` 改为 `searchBase + '/s/{ISBN}'`，确保降级也能搜到书籍
- **options.js 加载失败**：插入 `saveAnnasUrl` 函数时误删 `function escapeHtml(str) {` 行，导致整个脚本语法错误

### 📦 技术变更

- `manifest.json`：`host_permissions` 改为 `"*://*/*"` 通配符，彻底消除逐域名 CORS 拦截
- `permissions`：新增 `"storage"`，用于 `chrome.storage.sync` 持久化配置
- `options_ui`：新增 `open_in_tab: true`，设置页独立标签页打开
- `content.js`：新增 `resolveAnnasConfig()` 异步从 storage 读取搜索地址、`addDirectBadge()` 直达标记
