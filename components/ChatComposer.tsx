// components/ChatComposer.tsx
"use client";

import { FormEvent } from "react";

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  isSending?: boolean;
};

const quickEmojis = ["😘", "😏", "🥰", "❤️", "😉", "🔥", "💋", "✨", "😍", "🙈"];

export default function ChatComposer({
  value,
  onChange,
  onSend,
  disabled = false,
  isSending = false,
}: ChatComposerProps) {
  const isDisabled = disabled || isSending || !value.trim();
  const isInputDisabled = disabled || isSending;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isDisabled) {
      return;
    }

    onSend();
  }

  function handleEmojiClick(emoji: string) {
    if (isInputDisabled) {
      return;
    }

    const nextValue = value ? `${value}${emoji}` : emoji;
    onChange(nextValue);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#ff315f] sm:text-[13px]">
            Send message
          </p>
          <p className="mt-1 text-sm text-black/48">
            Keep it natural, personal, and easy to reply to.
          </p>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-black/8 bg-white/72 px-3 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.03)]">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-black/35">
          Quick emojis
        </p>

        <div className="flex flex-wrap gap-2">
          {quickEmojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleEmojiClick(emoji)}
              disabled={isInputDisabled}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-black/8 bg-[#fcf8f8] text-xl transition hover:border-[#c1123f]/18 hover:bg-[#fff1f4] disabled:cursor-not-allowed disabled:opacity-45"
              aria-label={`Add emoji ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.5rem] border border-black/8 bg-[#fcf8f8] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Type your message..."
          disabled={isInputDisabled}
          rows={4}
          className="min-h-[124px] w-full resize-none bg-transparent px-4 py-4 text-base leading-7 text-black outline-none placeholder:text-black/30 disabled:cursor-not-allowed disabled:opacity-60 sm:px-5"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isDisabled}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-black px-6 py-3 text-base font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:bg-black/20 disabled:text-black/35"
        >
          {isSending ? "Sending..." : "Send"}
        </button>
      </div>
    </form>
  );
}