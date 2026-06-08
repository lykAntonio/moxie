import { useRef } from "react";
import type { Block } from "../lib/types";

interface Props {
  blocks: Block[];
  illustrating: boolean;
  busyImgId: string | null;
  onMove: (id: string, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
  onEditMarkdown: (id: string, content: string) => void;
  onAddBelow: (id: string) => void;
  onSplit: (id: string, pos: number) => void;
  onRegen: (id: string) => void;
  onIllustrate: () => void;
  onCopy: () => void;
}

export default function EditorPanel({
  blocks,
  illustrating,
  busyImgId,
  onMove,
  onRemove,
  onEditMarkdown,
  onAddBelow,
  onSplit,
  onRegen,
  onIllustrate,
  onCopy,
}: Props) {
  const cursor = useRef<Record<string, number>>({});
  const hasContent = blocks.length > 0;
  const pendingImages = blocks.some((b) => b.type === "image" && b.status === "pending");

  return (
    <div className="panel editor-panel">
      <div className="panel-bar">
        <span className="panel-title">编辑 · Blocks</span>
        <div className="bar-actions">
          <button className="ghost-btn" onClick={onIllustrate} disabled={!hasContent || illustrating}>
            {illustrating ? "配图中…(约 1 分钟)" : pendingImages ? "🎨 为文章配图" : "🎨 重新配图"}
          </button>
          <button className="ghost-btn" onClick={onCopy} disabled={!hasContent}>
            ⧉ 复制 Markdown
          </button>
        </div>
      </div>

      <div className="blocks-scroll">
        {!hasContent && (
          <div className="empty">
            <div className="empty-icon">✎</div>
            <div className="empty-title">还没有内容</div>
            <div className="empty-desc">在左侧填写要求，点「一键生成文章」</div>
          </div>
        )}

        {blocks.map((b, i) => (
          <div key={b.id} className={"block-card " + b.type}>
            {b.type === "markdown" ? (
              <>
                <div className="block-tag">MD · 可编辑</div>
                <textarea
                  className="md-edit"
                  value={b.content}
                  spellCheck={false}
                  onChange={(e) => onEditMarkdown(b.id, e.target.value)}
                  onSelect={(e) => (cursor.current[b.id] = e.currentTarget.selectionStart)}
                  onKeyUp={(e) => (cursor.current[b.id] = e.currentTarget.selectionStart)}
                  onClick={(e) => (cursor.current[b.id] = e.currentTarget.selectionStart)}
                  onInput={(e) => {
                    const t = e.currentTarget;
                    t.style.height = "auto";
                    t.style.height = Math.min(t.scrollHeight, 420) + "px";
                  }}
                  ref={(el) => {
                    if (el) {
                      el.style.height = "auto";
                      el.style.height = Math.min(el.scrollHeight, 420) + "px";
                    }
                  }}
                />
                <div className="block-toolbar">
                  <button
                    className="mini-btn wide"
                    onClick={() => onSplit(b.id, cursor.current[b.id] ?? b.content.length)}
                    title="在光标处把本块拆成两块"
                  >
                    ✂ 从光标拆分
                  </button>
                  <button className="mini-btn wide" onClick={() => onAddBelow(b.id)} title="在下方插入新文字块">
                    ＋ 下方加块
                  </button>
                  <button className="mini-btn" onClick={() => onMove(b.id, -1)} disabled={i === 0} title="上移">
                    ↑
                  </button>
                  <button
                    className="mini-btn"
                    onClick={() => onMove(b.id, 1)}
                    disabled={i === blocks.length - 1}
                    title="下移"
                  >
                    ↓
                  </button>
                  <button className="mini-btn danger" onClick={() => onRemove(b.id)} title="删除此块">
                    ✕
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="block-tag img">图 · {b.position}</div>
                <div className="img-block-body">
                  {b.url && busyImgId !== b.id ? (
                    <img className="thumb" src={b.url} alt={b.caption} />
                  ) : (
                    <div className={"thumb placeholder" + (illustrating || busyImgId === b.id ? " loading" : "")}>
                      {illustrating || busyImgId === b.id ? "生成中…" : "待生成"}
                    </div>
                  )}
                  <div className="img-meta">
                    <div className="img-scene">{b.scene || "（无场景描述）"}</div>
                    <div className="img-actions">
                      <button
                        className="mini-btn wide"
                        onClick={() => onRegen(b.id)}
                        disabled={illustrating || busyImgId === b.id || !b.scene}
                        title="只重新生成这一张图"
                      >
                        ⟳ 重新生成
                      </button>
                      <button className="mini-btn" onClick={() => onMove(b.id, -1)} disabled={i === 0} title="上移">
                        ↑
                      </button>
                      <button
                        className="mini-btn"
                        onClick={() => onMove(b.id, 1)}
                        disabled={i === blocks.length - 1}
                        title="下移"
                      >
                        ↓
                      </button>
                      <button className="mini-btn danger" onClick={() => onRemove(b.id)} title="删除图片">
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
