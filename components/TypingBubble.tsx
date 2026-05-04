type TypingBubbleProps = {
  name: string;
};

export default function TypingBubble({ name }: TypingBubbleProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
        assistant
      </p>

      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-200">{name} is typing</span>

        <div className="flex items-center gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-300 [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-300 [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-300 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}