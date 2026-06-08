import type { HistoryItem } from "../lib/types";

interface Props {
  items: HistoryItem[];
  activeId: string | null;
  onRestore: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
}

const PLATFORM_LABEL: Record<string, string> = { wechat: "公众号", woshipm: "人人都是PM" };

function ago(ts: number): string {
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return "刚刚";
  if (d < 3600) return Math.floor(d / 60) + " 分钟前";
  if (d < 86400) return Math.floor(d / 3600) + " 小时前";
  const x = new Date(ts);
  return `${x.getMonth() + 1}/${x.getDate()}`;
}

export default function HistoryPanel({ items, activeId, onRestore, onDelete }: Props) {
  return (
    <div className="history">
      <div className="history-head">历史记录 <span className="count">{items.length}</span></div>
      {items.length === 0 && <div className="history-empty">暂无历史，生成后自动保存</div>}
      <div className="history-list">
        {items.map((it) => (
          <div
            key={it.id}
            className={"history-item" + (activeId === it.id ? " active" : "")}
            onClick={() => onRestore(it)}
          >
            <div className="history-main">
              <div className="history-title">{it.title || "（无标题）"}</div>
              <div className="history-meta">
                <span className="tag">{PLATFORM_LABEL[it.platform] || it.platform}</span>
                <span>{it.wordCount}字 · {it.imageCount}图</span>
                <span>{ago(it.createdAt)}</span>
              </div>
            </div>
            <button
              className="history-del"
              title="删除"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(it.id);
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
