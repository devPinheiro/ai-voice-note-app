import { LogOut, PanelLeft, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { cn } from "../../lib/utils";

interface ChatSidebarProps {
  userName: string;
  conversations: Doc<"conversations">[] | undefined;
  activeId: Id<"conversations"> | null;
  collapsed: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  onSelect: (id: Id<"conversations">) => void;
  onDelete: (id: Id<"conversations">) => void;
  onSignOut: () => void;
}

export function ChatSidebar({
  userName,
  conversations,
  activeId,
  collapsed,
  onToggle,
  onNewChat,
  onSelect,
  onDelete,
  onSignOut,
}: ChatSidebarProps) {
  const [query, setQuery] = useState("");
  const initial = userName.trim().charAt(0).toUpperCase() || "U";

  const filtered = useMemo(() => {
    const list = conversations ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return list;
    }
    return list.filter((conversation) => conversation.title.toLowerCase().includes(needle));
  }, [conversations, query]);

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col bg-[#171717] text-[#ececec] transition-[width] duration-200",
        collapsed ? "w-0 overflow-hidden md:w-[52px] md:overflow-visible" : "w-[260px]"
      )}
    >
      <div className="flex items-center gap-1 p-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#b4b4b4] hover:bg-white/10 hover:text-white"
          title={collapsed ? "Open sidebar" : "Close sidebar"}
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        {!collapsed && (
          <button
            type="button"
            onClick={onNewChat}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-[#b4b4b4] hover:bg-white/10 hover:text-white"
            title="New chat"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {collapsed ? (
        <div className="hidden flex-1 flex-col items-center gap-2 px-2 md:flex">
          <button
            type="button"
            onClick={onNewChat}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#b4b4b4] hover:bg-white/10 hover:text-white"
            title="New chat"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="px-2 pb-2">
            <button
              type="button"
              onClick={onNewChat}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-white/10"
            >
              <Plus className="h-4 w-4" />
              New chat
            </button>
          </div>

          <div className="px-2 pb-3">
            <label className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5 text-[#8e8e8e]">
              <Search className="h-3.5 w-3.5 shrink-0" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search chats"
                className="w-full bg-transparent text-sm text-[#ececec] outline-none placeholder:text-[#8e8e8e]"
              />
            </label>
          </div>

          <div className="flex-1 overflow-y-auto px-2">
            <p className="px-2 pb-1 text-xs font-medium text-[#8e8e8e]">Chats</p>
            {conversations === undefined && (
              <p className="px-2 py-2 text-xs text-[#8e8e8e]">Loading…</p>
            )}
            {conversations?.length === 0 && (
              <p className="px-2 py-2 text-xs text-[#8e8e8e]">No chats yet</p>
            )}
            {filtered.map((conversation) => (
              <div
                key={conversation._id}
                className={cn(
                  "group mb-0.5 flex items-center rounded-lg",
                  activeId === conversation._id ? "bg-white/10" : "hover:bg-white/5"
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(conversation._id)}
                  className="min-w-0 flex-1 truncate px-2 py-2 text-left text-sm"
                >
                  {conversation.title}
                </button>
                <button
                  type="button"
                  title="Delete chat"
                  onClick={() => onDelete(conversation._id)}
                  className="mr-1 hidden h-7 w-7 items-center justify-center rounded-md text-[#8e8e8e] hover:bg-white/10 hover:text-red-400 group-hover:flex"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className={cn("mt-auto border-t border-white/5 p-2", collapsed && "hidden md:block")}>
        <button
          type="button"
          onClick={onSignOut}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-[#b4b4b4] hover:bg-white/10 hover:text-white",
            collapsed && "justify-center px-0"
          )}
          title="Sign out"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#10a37f] text-xs font-semibold text-white">
            {initial}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 truncate text-left">{userName}</span>
              <LogOut className="h-4 w-4 shrink-0" />
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
