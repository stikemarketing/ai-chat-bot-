type TypingBubbleProps = {
  name: string;
};

export default function TypingBubble({ name }: TypingBubbleProps) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-[1.5rem] border border-black/6 bg-[#f7f2f2] px-4 py-3 sm:max-w-[78%]">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/35">
          {name}
        </p>

        <div className="flex items-center gap-3">
          <span className="text-sm leading-7 text-black/62">{name} is typing</span>

          <div className="flex items-center gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-black/35 [animation-delay:0ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-black/35 [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-black/35 [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}