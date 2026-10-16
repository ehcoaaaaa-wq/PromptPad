import type { ProjectProfile, Prompt, PromptBlock, PromptFolder, PromptSnippet, TrashedPrompt } from "../types";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePrompt(value: unknown, index: number): Prompt {
  if (!isObject(value) || typeof value.title !== "string" || typeof value.content !== "string") {
    throw new Error(`第 ${index + 1} 个模板缺少标题或正文`);
  }
  if (!value.title.trim()) throw new Error(`第 ${index + 1} 个模板的标题为空`);
  if (value.id !== undefined && (typeof value.id !== "string" || !value.id)) {
    throw new Error(`第 ${index + 1} 个模板的 ID 格式不正确`);
  }
  if (value.tags !== undefined && (!Array.isArray(value.tags) || !value.tags.every((tag) => typeof tag === "string"))) {
    throw new Error(`第 ${index + 1} 个模板的标签格式不正确`);
  }
  if (value.variables !== undefined && (!Array.isArray(value.variables) || !value.variables.every(
    (variable) => isObject(variable) && typeof variable.name === "string" &&
      (variable.description === undefined || typeof variable.description === "string") &&
      (variable.required === undefined || typeof variable.required === "boolean") &&
      (variable.defaultValue === undefined || typeof variable.defaultValue === "string"),
  ))) {
    throw new Error(`第 ${index + 1} 个模板的变量格式不正确`);
  }
  if ((value.favorite !== undefined && typeof value.favorite !== "boolean") ||
    (value.pinned !== undefined && typeof value.pinned !== "boolean") ||
    (value.includesProjectContext !== undefined && typeof value.includesProjectContext !== "boolean")) {
    throw new Error(`第 ${index + 1} 个模板的收藏或置顶状态格式不正确`);
  }
  if ((value.createdAt !== undefined && typeof value.createdAt !== "string") ||
    (value.updatedAt !== undefined && typeof value.updatedAt !== "string")) {
    throw new Error(`第 ${index + 1} 个模板的时间格式不正确`);
  }
  const now = new Date().toISOString();
  if (value.useCount !== undefined && (!Number.isSafeInteger(value.useCount) || (value.useCount as number) < 0)) {
    throw new Error(`第 ${index + 1} 个模板的使用次数无效`);
  }
  if (value.lastUsedAt !== undefined && (typeof value.lastUsedAt !== "string" || !Number.isFinite(Date.parse(value.lastUsedAt)))) {
    throw new Error(`第 ${index + 1} 个模板的使用时间无效`);
  }
  return {
    id: typeof value.id === "string" && value.id ? value.id : crypto.randomUUID(),
    title: value.title,
    content: value.content,
    tags: (value.tags as string[] | undefined) ?? [],
    variables: (value.variables as Prompt["variables"] | undefined) ?? [],
    favorite: value.favorite === true,
    pinned: value.pinned === true,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : now,
    useCount: (value.useCount as number | undefined) ?? 0,
    ...(typeof value.lastUsedAt === "string" ? { lastUsedAt: new Date(value.lastUsedAt).toISOString() } : {}),
    includesProjectContext: value.includesProjectContext === true,
    folderIds: Array.isArray(value.folderIds) ? value.folderIds.filter((id): id is string => typeof id === "string") : [],
    ...(Array.isArray(value.blocks) ? { blocks: normalizeBlocks(value.blocks, index) } : {}),
  };
}

function normalizeBlocks(value: unknown[], index: number): PromptBlock[] {
  if (value.length > 200) throw new Error(`第 ${index + 1} 个模板的片段数量超过 200 个`);
  return value.map((block, blockIndex) => {
    if (!isObject(block) || typeof block.id !== "string" || !block.id || typeof block.type !== "string") {
      throw new Error(`第 ${index + 1} 个模板的第 ${blockIndex + 1} 个片段格式不正确`);
    }
    if (block.type === "text" && typeof block.content === "string") return { id: block.id, type: "text", content: block.content };
    if (block.type === "variable" && typeof block.name === "string" && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(block.name)) return { id: block.id, type: "variable", name: block.name };
    if (block.type === "file" && (block.kind === "file" || block.kind === "image") && typeof block.path === "string") return { id: block.id, type: "file", kind: block.kind, path: block.path };
    if (block.type === "snippet" && typeof block.snippetId === "string") return { id: block.id, type: "snippet", snippetId: block.snippetId };
    throw new Error(`第 ${index + 1} 个模板的第 ${blockIndex + 1} 个片段内容无效`);
  });
}

function frontmatterValue(frontmatter: string, key: string): string | undefined {
  return frontmatter.split("\n").find((line) => line.startsWith(`${key}:`))?.slice(key.length + 1).trim();
}

function parseField(raw: string | undefined, fallback: unknown): unknown {
  if (raw === undefined) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function parseIncoming(path: string, text: string): Prompt[] {
  if (text.length > 10_000_000) throw new Error("文件超过 10 MB，请拆分后导入");
  let raw: unknown;
  if (path.toLowerCase().endsWith(".json")) {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) raw = parsed;
    else if (isObject(parsed) && Array.isArray(parsed.prompts) &&
      (parsed.schemaVersion === undefined || parsed.schemaVersion === 1)) raw = parsed.prompts;
    else throw new Error("JSON 模板库格式不正确或版本不支持");
  } else {
    const normalized = text.replace(/\r\n/g, "\n");
    const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) throw new Error("Markdown 缺少 frontmatter");
    const fm = match[1];
    raw = [{
      id: parseField(frontmatterValue(fm, "id"), crypto.randomUUID()),
      title: parseField(frontmatterValue(fm, "title"), "未命名"),
      content: match[2],
      tags: parseField(frontmatterValue(fm, "tags"), []),
      variables: parseField(frontmatterValue(fm, "variables"), []),
      favorite: parseField(frontmatterValue(fm, "favorite"), false),
      pinned: parseField(frontmatterValue(fm, "pinned"), false),
      createdAt: parseField(frontmatterValue(fm, "createdAt"), undefined),
      updatedAt: parseField(frontmatterValue(fm, "updatedAt"), undefined),
      useCount: parseField(frontmatterValue(fm, "useCount"), undefined),
      lastUsedAt: parseField(frontmatterValue(fm, "lastUsedAt"), undefined),
      includesProjectContext: parseField(frontmatterValue(fm, "includesProjectContext"), false),
      folderIds: parseField(frontmatterValue(fm, "folderIds"), []),
      blocks: parseField(frontmatterValue(fm, "blocks"), undefined),
    }];
  }
  return normalizePrompts(raw);
}

export function normalizeProjectProfiles(value: unknown): ProjectProfile[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 500) throw new Error("项目背景格式无效或数量超过 500 个");
  const projects = value.map((item, index) => {
    if (!isObject(item) || typeof item.id !== "string" || !item.id ||
      typeof item.name !== "string" || !item.name.trim() || typeof item.background !== "string") {
      throw new Error("第 " + (index + 1) + " 个项目背景格式不正确");
    }
    return { id: item.id, name: item.name.trim(), background: item.background };
  });
  if (new Set(projects.map((project) => project.id)).size !== projects.length) throw new Error("项目背景 ID 重复");
  return projects;
}

export function normalizeFolders(value: unknown): PromptFolder[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 2000) throw new Error("文件夹格式无效或数量超过 2000 个");
  const folders = value.map((item, index) => {
    if (!isObject(item) || typeof item.id !== "string" || !item.id || typeof item.name !== "string" || !item.name.trim() || (item.parentId !== undefined && typeof item.parentId !== "string")) throw new Error(`第 ${index + 1} 个文件夹格式不正确`);
    return { id: item.id, name: item.name.trim(), ...(typeof item.parentId === "string" ? { parentId: item.parentId } : {}) };
  });
  const ids = new Set(folders.map((folder) => folder.id));
  if (ids.size !== folders.length || folders.some((folder) => folder.parentId && (!ids.has(folder.parentId) || folder.parentId === folder.id))) throw new Error("文件夹 ID 重复或父级无效");
  for (const folder of folders) {
    const seen = new Set([folder.id]);
    let parentId = folder.parentId;
    while (parentId) {
      if (seen.has(parentId)) throw new Error("文件夹层级存在循环");
      seen.add(parentId);
      parentId = folders.find((item) => item.id === parentId)?.parentId;
    }
  }
  return folders;
}

export function normalizeSnippets(value: unknown): PromptSnippet[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 2000) throw new Error("片段库格式无效或数量超过 2000 个");
  const snippets = value.map((item, index) => {
    if (!isObject(item) || typeof item.id !== "string" || !item.id || typeof item.name !== "string" || !item.name.trim() || typeof item.content !== "string") throw new Error(`第 ${index + 1} 个文本片段格式不正确`);
    return { id: item.id, name: item.name.trim(), content: item.content };
  });
  if (new Set(snippets.map((snippet) => snippet.id)).size !== snippets.length) throw new Error("文本片段 ID 重复");
  return snippets;
}

export function normalizeTrash(value: unknown): TrashedPrompt[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 10_000) throw new Error("回收站格式无效");
  return value.map((item, index) => {
    if (!isObject(item) || typeof item.deletedAt !== "string" || !Number.isFinite(Date.parse(item.deletedAt))) throw new Error(`回收站第 ${index + 1} 项格式不正确`);
    return { prompt: normalizePrompt(item.prompt, index), deletedAt: new Date(item.deletedAt).toISOString() };
  });
}

export function parseProjectProfiles(path: string, text: string): ProjectProfile[] | null {
  if (!path.toLowerCase().endsWith(".json")) return null;
  const parsed: unknown = JSON.parse(text);
  if (!isObject(parsed) || !("projects" in parsed)) return null;
  return normalizeProjectProfiles(parsed.projects);
}

export function normalizePrompts(raw: unknown, requireIds = false): Prompt[] {
  if (!Array.isArray(raw) || raw.length > 10_000) throw new Error("模板数量无效或超过 10000 条");
  if (requireIds && raw.some((item) => !isObject(item) || typeof item.id !== "string" || !item.id)) {
    throw new Error("模板库包含缺少 ID 的模板");
  }
  const prompts = raw.map(normalizePrompt);
  const ids = new Set(prompts.map((prompt) => prompt.id));
  if (ids.size !== prompts.length) throw new Error("导入文件中存在重复的模板 ID");
  return prompts;
}

export type ConflictAction = "skip" | "replace" | "copy";

export function parseLibraryExtras(path: string, text: string): { folders: PromptFolder[]; snippets: PromptSnippet[]; trash: TrashedPrompt[] } | null {
  if (!path.toLowerCase().endsWith(".json")) return null;
  const parsed: unknown = JSON.parse(text);
  if (!isObject(parsed) || !Array.isArray(parsed.prompts)) return null;
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return { folders: normalizeFolders(parsed.folders), snippets: normalizeSnippets(parsed.snippets), trash: normalizeTrash(parsed.trash).filter((item) => Date.parse(item.deletedAt) > cutoff) };
}

export function mergeIncoming(existing: Prompt[], incoming: Prompt[], action: ConflictAction): Prompt[] {
  const byId = new Map(existing.map((prompt) => [prompt.id, prompt]));
  for (const prompt of incoming) {
    if (!byId.has(prompt.id) || action === "replace") byId.set(prompt.id, prompt);
    else if (action === "copy") {
      const id = crypto.randomUUID();
      byId.set(id, { ...prompt, id });
    }
  }
  return Array.from(byId.values());
}
