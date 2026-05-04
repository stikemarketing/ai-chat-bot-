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

export default function ChatComposer({
  value,
  onChange,
  onSend,
  disabled = false,
  isSending = false,
}: ChatComposerProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (disabled || isSending || !value.trim()) {
      return;
    }

    onSend();
  }

  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Send message
        </p>
      </div>

      <form className="space-y-3" onSubmit={handleSubmit}>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Type your message..."
          disabled={disabled || isSending}
          rows={4}
          className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-70"
        />

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={disabled || isSending || !value.trim()}
            className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}