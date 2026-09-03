import { cn } from "../../lib/utils";

interface LiveTranscriptProps {
  committed: string;
  interim: string;
  active?: boolean;
  className?: string;
  emptyLabel?: string;
}

export function LiveTranscript({
  committed,
  interim,
  active = false,
  className,
  emptyLabel = "Listening…",
}: LiveTranscriptProps) {
  const empty = !committed.trim() && !interim.trim();

  return (
    <p className={cn("whitespace-pre-wrap", className)}>
      {committed ? <span>{committed}</span> : null}
      {committed && interim ? " " : null}
      {interim ? <span className="text-[#8e8e8e]">{interim}</span> : null}
      {empty && active ? <span className="text-[#8e8e8e]">{emptyLabel}</span> : null}
      {active ? (
        <span className="ml-1 inline-block h-5 w-0.5 animate-pulse bg-white align-middle" />
      ) : null}
    </p>
  );
}
