import type { PromptBlock, PromptSnippet } from "../types";

export function legacyBlocks(content: string): PromptBlock[] {
  return [{ id: crypto.randomUUID(), type: "text", content }];
}

export function renderBlocks(blocks: PromptBlock[], snippets: PromptSnippet[]): string {
  const snippetMap = new Map(snippets.map((snippet) => [snippet.id, snippet.content]));
  return blocks.map((block) => {
    if (block.type === "text") return block.content;
    if (block.type === "variable") return `{{${block.name}}}`;
    if (block.type === "file") return block.path ? `${block.kind === "image" ? "图片" : "文件"}路径：${block.path}` : `{{${block.kind}}}`;
    return snippetMap.get(block.snippetId) ?? "";
  }).filter(Boolean).join("\n\n");
}

export function resolvePromptContent(prompt: { content: string; blocks?: PromptBlock[] }, snippets: PromptSnippet[]): string {
  return prompt.blocks ? renderBlocks(prompt.blocks, snippets) : prompt.content;
}
