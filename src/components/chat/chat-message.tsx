import { Mic } from "lucide-react";
import type { Doc } from "../../../convex/_generated/dataModel";
import { cn } from "../../lib/utils";

interface ChatMessageProps {
  message: Doc<"messages">;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-[22px] px-5 py-3 text-[15px] leading-7 md:max-w-[70%]",
          isUser ? "bg-[#323232] text-[#ececec]" : "bg-transparent text-[#ececec]"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.source === "voice" && (
          <p className="mt-2 flex items-center gap-1 text-xs text-[#8e8e8e]">
            <Mic className="h-3 w-3" />
            Voice
          </p>
        )}
      </div>
    </div>
  );
}
