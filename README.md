# 墨写 · Web 文章生成器 Agent

为「微信公众号」和「人人都是产品经理」生成文章 + 自动配插画的单页应用。

- 文本：DeepSeek API（`deepseek-chat`）
- 配图：复用 `article-illustrator` skill（Apimart / Nano Banana Pro）
- 前端：Vite + React + TypeScript + react-markdown
- 历史记录：浏览器 localStorage

## 架构

```
浏览器 (React SPA)  ──/api──►  本地后端 server/index.mjs
  · 三栏：输入 / Blocks 编辑 / 公众号风预览        ├─► DeepSeek API（写文）
  · localStorage 历史记录                          ├─► generate.py（Apimart 出图）
                                                   └─► /images 托管本地配图
```

> 为什么要后端：DeepSeek / Apimart 的 Key 不能放在浏览器（CORS + 泄露风险），且出图要调用本地 Python 脚本。

## first run

1. 安装依赖（已完成）：`npm install`
2. 配置 Key：复制 `.env.example` 为 `.env`，填入 `DEEPSEEK_API_KEY`
   ```bash
   cp .env.example .env
   # 然后编辑 .env，填入 DEEPSEEK_API_KEY=sk-xxxx
   ```
   Apimart key 默认自动读取 `~/.claude/skills/article-illustrator/config.json`，无需重复配置。
3. 启动（同时跑前端 + 后端）：
   ```bash
   npm run dev
   ```
   打开终端里 Vite 给出的地址（默认 http://localhost:5273）。

## 用法

1. 左侧填标题/平台/类型/读者/语气/长度 → 「一键生成文章」（仅出文字，快）
2. 中间 Blocks 区 → 「为文章配图」生成 3 张插画（约 1 分钟，消耗 Apimart 额度）
3. 图片块可上移/下移/删除；「复制 Markdown」导出最终图文
4. 右侧公众号风预览，顶部显示字数/图数/创作时间
5. 每次生成自动存历史；点历史可恢复，✕ 可删除

## 目录

```
墨写/
├─ index.html              入口
├─ vite.config.ts          dev 代理 /api /images → 8787
├─ server/index.mjs        后端代理（DeepSeek + 出图 + 图片托管）
├─ src/
│  ├─ App.tsx              主逻辑/状态
│  ├─ components/          InputPanel / EditorPanel / PreviewPanel / HistoryPanel
│  └─ lib/                 types / api / blocks（切分组装）/ storage（历史）
├─ illustrations/          生成的配图（git 忽略）
└─ .env                    你的 Key（git 忽略）
```
