import { useEffect, useMemo, useState } from "react";
import InputPanel from "./components/InputPanel";
import EditorPanel from "./components/EditorPanel";
import PreviewPanel from "./components/PreviewPanel";
import HistoryPanel from "./components/HistoryPanel";
import type { Block, GenParams, HistoryItem, Platform } from "./lib/types";
import { generateArticle, illustrate } from "./lib/api";
import {
  buildBlocks,
  blocksToMarkdown,
  countImages,
  countWords,
  moveBlock,
  removeBlock,
  uid,
} from "./lib/blocks";
import { deleteHistory, loadHistory, upsertHistory } from "./lib/storage";

export default function App() {
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState<Platform>("wechat");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const [docId, setDocId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [illustrating, setIllustrating] = useState(false);
  const [busyImgId, setBusyImgId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [toast, setToast] = useState<string>("");

  useEffect(() => setHistory(loadHistory()), []);

  const wordCount = useMemo(() => countWords(blocks), [blocks]);
  const imageCount = useMemo(() => countImages(blocks), [blocks]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }

  function persist(next: {
    id: string;
    title: string;
    platform: Platform;
    blocks: Block[];
    createdAt: number;
  }) {
    const item: HistoryItem = {
      id: next.id,
      title: next.title,
      platform: next.platform,
      blocks: next.blocks,
      wordCount: countWords(next.blocks),
      imageCount: countImages(next.blocks),
      createdAt: next.createdAt,
    };
    setHistory(upsertHistory(item));
  }

  async function handleGenerate(p: GenParams) {
    setLoading(true);
    try {
      const res = await generateArticle(p);
      const newBlocks = buildBlocks(res.article, res.image_scenes);
      const id = uid();
      const ts = Date.now();
      setTitle(res.title);
      setPlatform(p.platform);
      setBlocks(newBlocks);
      setCreatedAt(ts);
      setDocId(id);
      persist({ id, title: res.title, platform: p.platform, blocks: newBlocks, createdAt: ts });
      flash("文章已生成，可点「为文章配图」补插画");
    } catch (e: any) {
      flash("生成失败：" + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function handleIllustrate() {
    const imgBlocks = blocks.filter((b): b is Extract<Block, { type: "image" }> => b.type === "image");
    const scenes = imgBlocks.map((b) => b.scene).filter(Boolean);
    if (scenes.length === 0) {
      flash("没有可用的配图场景");
      return;
    }
    setIllustrating(true);
    try {
      const res = await illustrate(scenes);
      // 按场景顺序回填到 pending 的 image block
      let k = 0;
      const next = blocks.map((b) => {
        if (b.type !== "image") return b;
        const img = res.images[k++];
        if (!img) return b;
        return { ...b, url: img.url, status: "done" as const };
      });
      setBlocks(next);
      if (docId && createdAt) persist({ id: docId, title, platform, blocks: next, createdAt });
      flash(`已配图 ${res.images.length} 张`);
    } catch (e: any) {
      flash("配图失败：" + (e?.message || e));
    } finally {
      setIllustrating(false);
    }
  }

  function updateBlocks(next: Block[]) {
    setBlocks(next);
    if (docId && createdAt) persist({ id: docId, title, platform, blocks: next, createdAt });
  }

  function editMarkdown(id: string, content: string) {
    updateBlocks(
      blocks.map((b) => (b.id === id && b.type === "markdown" ? { ...b, content } : b))
    );
  }

  function addMarkdownAfter(id: string) {
    const i = blocks.findIndex((b) => b.id === id);
    if (i < 0) return;
    const nb: Block = { id: uid(), type: "markdown", content: "" };
    updateBlocks([...blocks.slice(0, i + 1), nb, ...blocks.slice(i + 1)]);
  }

  function splitMarkdown(id: string, pos: number) {
    const i = blocks.findIndex((b) => b.id === id);
    if (i < 0) return;
    const b = blocks[i];
    if (b.type !== "markdown") return;
    const before = b.content.slice(0, pos).trimEnd();
    const after = b.content.slice(pos).trimStart();
    if (!after) return; // 光标在末尾，无需拆分
    const next = blocks.slice();
    next.splice(
      i,
      1,
      { ...b, content: before },
      { id: uid(), type: "markdown", content: after }
    );
    updateBlocks(next);
    flash("已拆分为两个文字块");
  }

  async function regenerateImage(id: string) {
    const b = blocks.find((x) => x.id === id);
    if (!b || b.type !== "image" || !b.scene) return;
    setBusyImgId(id);
    try {
      const res = await illustrate([b.scene]);
      const img = res.images[0];
      if (img) {
        const next = blocks.map((x) =>
          x.id === id && x.type === "image" ? { ...x, url: img.url, status: "done" as const } : x
        );
        setBlocks(next);
        if (docId && createdAt) persist({ id: docId, title, platform, blocks: next, createdAt });
        flash("已重新生成这张图");
      }
    } catch (e: any) {
      flash("重新生成失败：" + (e?.message || e));
    } finally {
      setBusyImgId(null);
    }
  }

  function handleCopy() {
    const md = blocksToMarkdown(blocks, title);
    navigator.clipboard.writeText(md).then(
      () => flash("已复制最终 Markdown"),
      () => flash("复制失败，请手动选择")
    );
  }

  function handleRestore(item: HistoryItem) {
    setTitle(item.title);
    setPlatform(item.platform);
    setBlocks(item.blocks);
    setCreatedAt(item.createdAt);
    setDocId(item.id);
    flash("已恢复历史文章");
  }

  function handleDelete(id: string) {
    setHistory(deleteHistory(id));
    if (id === docId) {
      setBlocks([]);
      setTitle("");
      setCreatedAt(null);
      setDocId(null);
    }
  }

  return (
    <div className="app">
      <aside className="col col-left">
        <InputPanel loading={loading} onGenerate={handleGenerate} />
        <HistoryPanel items={history} activeId={docId} onRestore={handleRestore} onDelete={handleDelete} />
      </aside>

      <main className="col col-mid">
        <EditorPanel
          blocks={blocks}
          illustrating={illustrating}
          busyImgId={busyImgId}
          onMove={(id, dir) => updateBlocks(moveBlock(blocks, id, dir))}
          onRemove={(id) => updateBlocks(removeBlock(blocks, id))}
          onEditMarkdown={editMarkdown}
          onAddBelow={addMarkdownAfter}
          onSplit={splitMarkdown}
          onRegen={regenerateImage}
          onIllustrate={handleIllustrate}
          onCopy={handleCopy}
        />
      </main>

      <section className="col col-right">
        <PreviewPanel
          title={title}
          blocks={blocks}
          wordCount={wordCount}
          imageCount={imageCount}
          createdAt={createdAt}
        />
      </section>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
