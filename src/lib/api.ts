import type { GenParams, ImageScene } from "./types";

export interface GenerateResult {
  title: string;
  article: string;
  image_scenes: ImageScene[];
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `请求失败 (${res.status})`);
  return data as T;
}

export function generateArticle(params: GenParams) {
  return post<GenerateResult>("/api/generate", params);
}

export interface IllustrateResult {
  images: { index: number; position: string; url: string; caption: string }[];
}

export function illustrate(scenes: string[]) {
  return post<IllustrateResult>("/api/illustrate", { scenes });
}
