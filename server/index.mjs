// 墨写 后端代理服务（Node 内置 http，零额外运行时依赖，仅用 dotenv 读 .env）
// 职责：① 转发 DeepSeek 写文 ② 调用 article-illustrator/generate.py 出图 ③ 托管图片
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env") });

const PORT = Number(process.env.PORT || 8787);
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

// article-illustrator skill 路径
const SKILL_DIR = path.join(os.homedir(), ".claude", "skills", "article-illustrator");
const GENERATE_PY = path.join(SKILL_DIR, "scripts", "generate.py");
const ILLUSTRATIONS_DIR = path.join(ROOT, "illustrations");

// 固定手绘插画风格前缀（来自 article-illustrator skill，请勿更改）
const STYLE_PREFIX =
  "手绘漫画插画风格，温暖、亲和、有故事感；柔和的色调与自然松弛的线条笔触；不要写实摄影感、不要赛博朋克、不要冷硬的科技感、不要 3D 渲染或 AI 塑料感。画面干净整洁，主体清晰突出，背景简洁不杂乱、留白得当，适合内容平台正文配图。画面中如出现任何文字、招牌、标语、标签，一律使用规范的简体中文，文字简洁、无错别字、无乱码、无外文。";

/* ---------- 工具 ---------- */
function sendJSON(res, code, obj) {
  const body = Buffer.from(JSON.stringify(obj), "utf-8");
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

/* ---------- prompt 组装 ---------- */
const LENGTH_MAP = {
  short: "800-1200 字（短文）",
  medium: "1500-2500 字（中篇）",
  long: "3000 字以上（长文）",
};
const PLATFORM_NOTE = {
  wechat:
    "目标平台是【微信公众号】：标题可带一点吸引力但不浮夸；开头三句内抛出钩子；段落短、多换行、适当使用 emoji 和加粗；小标题清晰；结尾有金句或引导互动。",
  woshipm:
    "目标平台是【人人都是产品经理】：偏专业社区，标题朴实务实；逻辑严谨、结构化强（多用小标题、有序列表、表格）；少用 emoji；重视方法论、案例和可迁移的结论。",
};

function buildMessages(p) {
  const lengthDesc = LENGTH_MAP[p.length] || LENGTH_MAP.medium;
  const platformNote = PLATFORM_NOTE[p.platform] || PLATFORM_NOTE.wechat;
  const sys =
    "你是资深内容主笔「墨写」，擅长为内容平台撰写高质量中文文章。" +
    "你必须只输出一个 JSON 对象，不要任何额外解释或 markdown 代码围栏。";
  const user = `请根据以下要求创作一篇文章。

- 标题：${p.title}
- 发布平台：${platformNote}
- 文章类型：${p.type}
- 目标读者：${p.audience}
- 语气风格：${p.tone}
- 文章长度：${lengthDesc}

写作要求：
1. 用规范、地道的简体中文；结构清晰，有小标题（使用 ## 二级标题），可用列表、表格、引用增强可读性。
2. 正文用 Markdown，但【不要】在正文里插入任何图片。
3. 另外给出 3 个用于配图的画面场景，分别对应文章的开头、中间、结尾，要求是“具体、可画”的画面（谁/在做什么/在什么环境/什么情绪），不要抽象词。

只输出如下 JSON（不要代码围栏）：
{
  "title": "最终文章标题",
  "article": "完整 Markdown 正文（不含图片，不要重复标题作为一级标题）",
  "image_scenes": [
    { "position": "开头", "scene": "具体画面描述" },
    { "position": "中间", "scene": "具体画面描述" },
    { "position": "结尾", "scene": "具体画面描述" }
  ]
}`;
  return [
    { role: "system", content: sys },
    { role: "user", content: user },
  ];
}

/* ---------- DeepSeek 调用 ---------- */
async function callDeepSeek(messages) {
  if (!DEEPSEEK_KEY) {
    const err = new Error(
      "未配置 DEEPSEEK_API_KEY。请在 墨写/.env 中填入你的 DeepSeek key 后重启服务。"
    );
    err.code = "NO_KEY";
    throw err;
  }
  const resp = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      temperature: 1.0,
      max_tokens: 8000,
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`DeepSeek ${resp.status}: ${text.slice(0, 500)}`);
  }
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content || "";
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    // 兜底：尝试剥离可能的代码围栏
    const m = content.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : { title: "", article: content, image_scenes: [] };
  }
  return parsed;
}

/* ---------- 出图：调用 generate.py --batch ---------- */
function pickSize(index) {
  return index === 2 ? "1:1" : "16:9"; // 结尾图方形，其余横向
}

function runIllustrator(scenes) {
  return new Promise((resolve, reject) => {
    const stamp = Date.now().toString(36);
    const outDir = path.join("illustrations", stamp); // 相对 ROOT（generate.py 要求相对路径）
    fs.mkdirSync(path.join(ROOT, outDir), { recursive: true });

    const positions = ["开头", "中间", "结尾"];
    const tasks = scenes.slice(0, 3).map((scene, i) => ({
      prompt: `${STYLE_PREFIX}画面内容：${scene}。构图：${i === 2 ? "方形" : "横向"}。`,
      output: `${outDir}/0${i + 1}.png`,
      size: pickSize(i),
    }));

    const tasksFile = path.join(ROOT, `.tasks-${stamp}.json`);
    fs.writeFileSync(tasksFile, JSON.stringify(tasks), "utf-8");

    const env = { ...process.env };
    if (process.env.APIMART_API_KEY) env.APIMART_API_KEY = process.env.APIMART_API_KEY;

    const child = spawn("python3", [GENERATE_PY, "--batch", path.basename(tasksFile)], {
      cwd: ROOT,
      env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => {
      try {
        fs.unlinkSync(tasksFile);
      } catch {}
      if (code !== 0) {
        return reject(new Error(`generate.py 退出码 ${code}：${stderr.slice(-600)}`));
      }
      let result;
      try {
        result = JSON.parse(stdout);
      } catch {
        return reject(new Error(`无法解析出图结果：${stdout.slice(-400)}`));
      }
      const images = (result.images || []).map((img, i) => ({
        index: i + 1,
        position: positions[i] || `位置${i + 1}`,
        // 浏览器访问路径：/images/<stamp>/0N.png
        url: "/images/" + img.output.replace(/^illustrations\//, ""),
        caption: positions[i] || "",
      }));
      resolve(images);
    });
  });
}

/* ---------- 静态图片 ---------- */
function serveImage(res, urlPath) {
  // urlPath 形如 /images/<stamp>/0N.png
  const rel = decodeURIComponent(urlPath.replace(/^\/images\//, ""));
  const fpath = path.join(ILLUSTRATIONS_DIR, rel);
  if (!fpath.startsWith(ILLUSTRATIONS_DIR) || !fs.existsSync(fpath)) {
    return sendJSON(res, 404, { error: "image not found" });
  }
  const ext = path.extname(fpath).toLowerCase();
  const ctype =
    ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "application/octet-stream";
  const data = fs.readFileSync(fpath);
  res.writeHead(200, { "Content-Type": ctype, "Content-Length": data.length, "Cache-Control": "no-store" });
  res.end(data);
}

/* ---------- 路由 ---------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  try {
    if (req.method === "GET" && pathname === "/api/health") {
      return sendJSON(res, 200, { ok: true, hasKey: !!DEEPSEEK_KEY, model: DEEPSEEK_MODEL });
    }

    if (req.method === "POST" && pathname === "/api/generate") {
      const p = await readBody(req);
      if (!p.title) return sendJSON(res, 400, { error: "缺少文章标题" });
      const result = await callDeepSeek(buildMessages(p));
      return sendJSON(res, 200, {
        title: result.title || p.title,
        article: result.article || "",
        image_scenes: result.image_scenes || [],
      });
    }

    if (req.method === "POST" && pathname === "/api/illustrate") {
      const { scenes } = await readBody(req);
      if (!Array.isArray(scenes) || scenes.length === 0) {
        return sendJSON(res, 400, { error: "缺少配图场景 scenes" });
      }
      const images = await runIllustrator(scenes);
      return sendJSON(res, 200, { images });
    }

    if (req.method === "GET" && pathname.startsWith("/images/")) {
      return serveImage(res, pathname);
    }

    return sendJSON(res, 404, { error: "not found" });
  } catch (e) {
    const code = e.code === "NO_KEY" ? 400 : 500;
    return sendJSON(res, code, { error: String(e.message || e) });
  }
});

server.listen(PORT, () => {
  console.log("=".repeat(52));
  console.log("  墨写 后端服务已启动  http://localhost:" + PORT);
  console.log("  DeepSeek key: " + (DEEPSEEK_KEY ? "已配置 ✓" : "未配置 ✗（请填 .env）"));
  console.log("  模型: " + DEEPSEEK_MODEL);
  console.log("  出图脚本: " + (fs.existsSync(GENERATE_PY) ? "已找到 ✓" : "未找到 ✗"));
  console.log("=".repeat(52));
});
