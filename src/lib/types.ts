export type Platform = "wechat" | "woshipm";

export interface GenParams {
  title: string;
  platform: Platform;
  type: string; // 文章类型
  audience: string; // 目标读者
  tone: string; // 语气风格
  length: "short" | "medium" | "long";
}

export interface ImageScene {
  position: string; // 开头/中间/结尾
  scene: string; // 画面描述
}

export type Block =
  | { id: string; type: "markdown"; content: string }
  | {
      id: string;
      type: "image";
      url: string; // 为空表示尚未生成
      caption: string;
      scene: string; // 画面描述（也是出图 prompt 主体）
      position: string;
      status: "pending" | "done";
    };

export interface HistoryItem {
  id: string;
  title: string;
  platform: Platform;
  blocks: Block[];
  wordCount: number;
  imageCount: number;
  createdAt: number;
}
