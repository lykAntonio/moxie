import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Block } from "../lib/types";

interface Props {
  title: string;
  blocks: Block[];
  wordCount: number;
  imageCount: number;
  createdAt: number | null;
}

function fmtTime(ts: number | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function PreviewPanel({ title, blocks, wordCount, imageCount, createdAt }: Props) {
  const hasContent = blocks.length > 0;

  return (
    <div className="panel preview-panel">
      <div className="panel-bar">
        <span className="panel-title">预览 · 阅读效果</span>
        <div className="stat-row">
          <span>📝 {wordCount} 字</span>
          <span>🎨 {imageCount} 图</span>
          <span>🕒 {fmtTime(createdAt)}</span>
        </div>
      </div>

      <div className="preview-scroll">
        {!hasContent ? (
          <div className="empty">
            <div className="empty-icon">📰</div>
            <div className="empty-title">预览区</div>
            <div className="empty-desc">生成文章后这里显示公众号风格的阅读效果</div>
          </div>
        ) : (
          <article className="wx-article">
            {title && <h1 className="wx-title">{title}</h1>}
            {blocks.map((b) =>
              b.type === "markdown" ? (
                <ReactMarkdown key={b.id} remarkPlugins={[remarkGfm]}>
                  {b.content}
                </ReactMarkdown>
              ) : b.url ? (
                <figure key={b.id} className="wx-figure">
                  <img src={b.url} alt={b.caption} />
                </figure>
              ) : null
            )}
          </article>
        )}
      </div>
    </div>
  );
}
