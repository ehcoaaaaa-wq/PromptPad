import { useMemo } from "react";
import { Clock, Folder, FolderPlus, Hash, MoreHorizontal, Pin, Star, Trash2 } from "lucide-react";
import type { PromptFolder } from "../types";
import type { PromptSelection } from "../lib/prompt-list";
import { addFolder, deleteFolder, updateFolder, useStore } from "../store";
import { pushToast } from "../hooks/useToast";

export type SidebarSelection = PromptSelection;

export function Sidebar({ selection, onSelect }: { selection: SidebarSelection; onSelect: (s: SidebarSelection) => void }) {
  const store = useStore();
  const tags = useMemo(() => [...new Set(store.prompts.flatMap((prompt) => prompt.tags))].sort(), [store.prompts]);
  const createFolder = async (parentId?: string) => {
    const name = window.prompt("文件夹名称");
    if (!name?.trim()) return;
    try { const folder = await addFolder(name, parentId); onSelect({ kind: "folder", folderId: folder.id }); }
    catch (error) { pushToast("error", "创建文件夹失败：" + String(error)); }
  };
  const manageFolder = async (folder: PromptFolder) => {
    const name = window.prompt("修改文件夹名称", folder.name);
    if (name === null) return;
    if (!name.trim()) { pushToast("error", "文件夹名称不能为空"); return; }
    try { await updateFolder(folder.id, { name: name.trim() }); }
    catch (error) { pushToast("error", "重命名失败：" + String(error)); }
  };
  const removeFolder = async (folder: PromptFolder) => {
    if (!window.confirm(`删除文件夹“${folder.name}”？模板不会删除，子文件夹会移到上一级。`)) return;
    try { await deleteFolder(folder.id); if (selection.kind === "folder" && selection.folderId === folder.id) onSelect({ kind: "all" }); }
    catch (error) { pushToast("error", "删除文件夹失败：" + String(error)); }
  };

  return (
    <aside className="library-sidebar w-56 shrink-0 p-2 overflow-y-auto text-sm border-r border-zinc-200 dark:border-zinc-800">
      <SectionTitle>视图</SectionTitle>
      <Item icon={<Hash className="w-3.5 h-3.5" />} label="全部" active={selection.kind === "all"} onClick={() => onSelect({ kind: "all" })} count={store.prompts.length} />
      <Item icon={<Star className="w-3.5 h-3.5 fill-current" />} iconClass="text-rose-500" label="收藏" active={selection.kind === "favorites"} onClick={() => onSelect({ kind: "favorites" })} count={store.prompts.filter((p) => p.favorite).length} />
      <Item icon={<Pin className="w-3.5 h-3.5 fill-current" />} iconClass="text-amber-500" label="置顶" active={selection.kind === "pinned"} onClick={() => onSelect({ kind: "pinned" })} count={store.prompts.filter((p) => p.pinned).length} />
      <Item icon={<Clock className="w-3.5 h-3.5" />} label="最近使用" active={selection.kind === "recent"} onClick={() => onSelect({ kind: "recent" })} count={store.prompts.filter((p) => p.lastUsedAt).length} />
      <div className="flex items-center px-2.5 pt-3 pb-1">
        <SectionTitle>文件夹</SectionTitle>
        <button onClick={() => void createFolder()} title="新建文件夹" className="ml-auto p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"><FolderPlus className="w-3.5 h-3.5" /></button>
      </div>
      {store.folders.length === 0 && <div className="px-2.5 py-1 text-xs text-zinc-400">用文件夹整理模板</div>}
      {store.folders.filter((folder) => !folder.parentId).map((folder) => (
        <FolderBranch key={folder.id} folder={folder} depth={0} folders={store.folders} prompts={store.prompts} selection={selection}
          onSelect={(folderId) => onSelect({ kind: "folder", folderId })} onAddChild={(folderId) => void createFolder(folderId)} onManage={manageFolder} onDelete={removeFolder} />
      ))}
      <SectionTitle>标签</SectionTitle>
      {tags.length === 0 && <div className="px-2.5 py-1 text-xs text-zinc-400">暂无标签</div>}
      {tags.map((tag) => <Item key={tag} label={tag} active={selection.kind === "tag" && selection.tag === tag} onClick={() => onSelect({ kind: "tag", tag })} count={store.prompts.filter((p) => p.tags.includes(tag)).length} />)}
      <div className="mt-3 border-t border-zinc-200 dark:border-zinc-800 pt-2">
        <Item icon={<Trash2 className="w-3.5 h-3.5" />} label="回收站" active={selection.kind === "trash"} onClick={() => onSelect({ kind: "trash" })} count={store.trash.length} />
      </div>
    </aside>
  );
}

function FolderBranch({ folder, depth, folders, prompts, selection, onSelect, onAddChild, onManage, onDelete }: {
  folder: PromptFolder; depth: number; folders: PromptFolder[]; prompts: { folderIds?: string[] }[]; selection: SidebarSelection;
  onSelect: (id: string) => void; onAddChild: (id: string) => void; onManage: (folder: PromptFolder) => void; onDelete: (folder: PromptFolder) => void;
}) {
  const children = folders.filter((item) => item.parentId === folder.id);
  const count = prompts.filter((prompt) => prompt.folderIds?.includes(folder.id)).length;
  const active = selection.kind === "folder" && selection.folderId === folder.id;
  return <div>
    <div className={"folder-branch group flex items-center rounded-md mb-0.5 " + (active ? "is-active bg-blue-500/10 text-blue-600 dark:text-blue-400" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60")} style={{ paddingLeft: 8 + depth * 14 }}>
      <button onClick={() => onSelect(folder.id)} className="min-w-0 flex-1 flex items-center gap-2 py-1.5 text-left">
        <Folder className="w-3.5 h-3.5 shrink-0 text-zinc-400" /><span className="truncate flex-1">{folder.name}</span><span className="text-[11px] text-zinc-400">{count}</span>
      </button>
      <button onClick={() => onAddChild(folder.id)} title="添加子文件夹" className="p-1 opacity-0 group-hover:opacity-100 focus:opacity-100"><FolderPlus className="w-3 h-3" /></button>
      <button onClick={() => onManage(folder)} title="重命名文件夹" className="p-1 opacity-0 group-hover:opacity-100 focus:opacity-100"><MoreHorizontal className="w-3.5 h-3.5" /></button>
      <button onClick={() => onDelete(folder)} title="删除文件夹" className="p-1 pr-2 opacity-0 group-hover:opacity-100 focus:opacity-100 text-rose-500"><Trash2 className="w-3 h-3" /></button>
    </div>
    {children.map((child) => <FolderBranch key={child.id} folder={child} depth={depth + 1} folders={folders} prompts={prompts} selection={selection} onSelect={onSelect} onAddChild={onAddChild} onManage={onManage} onDelete={onDelete} />)}
  </div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="sidebar-heading text-[10.5px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider px-2.5 pt-2 pb-1">{children}</div>;
}

function Item({ label, icon, iconClass, active, onClick, count }: { label: string; icon?: React.ReactNode; iconClass?: string; active: boolean; onClick: () => void; count: number }) {
  return <button onClick={onClick} className={"sidebar-item w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2 mb-0.5 transition-colors " + (active ? "is-active bg-blue-500/10 text-blue-600 dark:text-blue-400" : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300")}>
    {icon && <span className={iconClass ?? "text-zinc-400"}>{icon}</span>}<span className="truncate flex-1">{label}</span><span className="text-[11.5px] text-zinc-400 dark:text-zinc-500">{count}</span>
  </button>;
}
