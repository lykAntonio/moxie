import { useState } from "react";
import type { GenParams, Platform } from "../lib/types";

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "wechat", label: "微信公众号" },
  { value: "woshipm", label: "人人都是产品经理" },
];
const TYPES = ["干货教程", "观点分析", "案例拆解", "经验复盘"];
const AUDIENCES = ["产品经理", "运营人员", "创业者", "职场新人"];
const TONES = ["专业严谨", "通俗易懂", "互动亲切", "犀利深刻"];
const LENGTHS: { value: GenParams["length"]; label: string }[] = [
  { value: "short", label: "短文 800-1200 字" },
  { value: "medium", label: "中篇 1500-2500 字" },
  { value: "long", label: "长文 3000 字以上" },
];

interface Props {
  loading: boolean;
  onGenerate: (p: GenParams) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenSettings: () => void;
}

export default function InputPanel({ loading, onGenerate, theme, onToggleTheme, onOpenSettings }: Props) {
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState<Platform>("wechat");
  const [type, setType] = useState(TYPES[0]);
  const [audience, setAudience] = useState(AUDIENCES[0]);
  const [tone, setTone] = useState(TONES[1]);
  const [length, setLength] = useState<GenParams["length"]>("medium");

  function submit() {
    if (!title.trim()) {
      alert("请先输入文章标题");
      return;
    }
    onGenerate({ title: title.trim(), platform, type, audience, tone, length });
  }

  const Chips = <T extends string>(opts: { value: T; label: string }[] | T[], cur: T, set: (v: T) => void) => (
    <div className="chips">
      {(opts as any[]).map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const l = typeof o === "string" ? o : o.label;
        return (
          <button key={v} className={"chip" + (cur === v ? " active" : "")} onClick={() => set(v)} type="button">
            {l}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="panel input-panel">
      <div className="panel-head">
        <span className="brand">墨<span className="brand-accent">写</span></span>
        <span className="brand-sub">文章生成器</span>
        <button className="theme-toggle" onClick={onOpenSettings} title="设置 API Key">
          ⚙️
        </button>
        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          title={theme === "light" ? "切换到夜间模式" : "切换到日间模式"}
        >
          {theme === "light" ? "🌙 夜间" : "☀️ 日间"}
        </button>
      </div>

      <label className="field-label">文章标题</label>
      <input
        className="text-input"
        placeholder="例如：AI 时代，产品经理如何重构竞争力"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <label className="field-label">发布平台</label>
      {Chips(PLATFORMS, platform, setPlatform)}

      <label className="field-label">文章类型</label>
      {Chips(TYPES, type, setType)}

      <label className="field-label">目标读者</label>
      {Chips(AUDIENCES, audience, setAudience)}
      <input
        className="text-input small"
        placeholder="或自定义目标读者…"
        onChange={(e) => e.target.value && setAudience(e.target.value)}
      />

      <label className="field-label">语气风格</label>
      {Chips(TONES, tone, setTone)}

      <label className="field-label">文章长度</label>
      {Chips(LENGTHS, length, setLength)}

      <button className="primary-btn" onClick={submit} disabled={loading}>
        {loading ? "正在生成…" : "✦ 一键生成文章"}
      </button>
      <p className="hint-text">生成文字后，可在中间区点「为文章配图」补 3 张插画。</p>
    </div>
  );
}
