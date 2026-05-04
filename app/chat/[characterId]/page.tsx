// app/chat/[characterId]/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { notFound, useParams } from "next/navigation";
import { characters } from "@/lib/characters";
import { getUserWithFirestoreFallback, type StoredUser } from "@/lib/user";
import ChatComposer from "@/components/ChatComposer";
import TypingBubble from "@/components/TypingBubble";
import {
  countMessagesFromFirestore,
  getMessagesFromFirestore,
  saveMessageToFirestore,
  type ChatMessage,
} from "@/firebase/messages";
import {
  getEmptyActivityState,
  updateActivityState,
  type ActivityState,
} from "@/lib/activityState";
import {
  getMessageLimitForPlan,
  hasReachedMessageLimit,
  normalizePlan,
} from "@/lib/plans";

const ASSISTANT_TYPING_DELAY_MS = 8000;
const ASSISTANT_MESSAGE_DELAY_MS = 8000;
const OPENER_TYPING_DELAY_MS = 1200;
const OPENER_MESSAGE_DELAY_MS = 1800;
const MAX_RECENT_MESSAGES_FOR_MODEL = 12;

type ChatApiResponse = {
  reply?: string;
  error?: string;
};

type ApiRecentMessage = {
  role: "user" | "assistant";
  text: string;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toRecentMessagesForModel(
  messages: ChatMessage[],
  currentMessage: string
): ApiRecentMessage[] {
  const history = messages
    .filter(
      (message): message is ChatMessage & { role: "user" | "assistant"; text: string } =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.text === "string" &&
        message.text.trim().length > 0
    )
    .slice(-MAX_RECENT_MESSAGES_FOR_MODEL)
    .map((message) => ({
      role: message.role,
      text: message.text.trim(),
    }));

  const trimmedCurrentMessage = currentMessage.trim();
  const lastMessage = history[history.length - 1];

  const alreadyIncluded =
    lastMessage?.role === "user" && lastMessage.text === trimmedCurrentMessage;

  if (alreadyIncluded || !trimmedCurrentMessage) {
    return history;
  }

  return [
    ...history,
    {
      role: "user",
      text: trimmedCurrentMessage,
    },
  ];
}

export default function ChatPage() {
  const params = useParams();
  const characterId =
    typeof params.characterId === "string" ? params.characterId : "";

  const character = characters.find((item) => item.id === characterId);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [composerValue, setComposerValue] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isAssistantTyping, setIsAssistantTyping] = useState(false);
  const [activityState, setActivityState] = useState<ActivityState>(
    getEmptyActivityState()
  );

  const hasAttemptedOpenerRef = useRef(false);

  useEffect(() => {
    async function loadPageData() {
      setMounted(true);

      const savedUser = await getUserWithFirestoreFallback();
      setUser(savedUser);

      if (!savedUser?.id) {
        setIsLoadingMessages(false);
        return;
      }

      try {
        const [savedMessages, savedMessageCount] = await Promise.all([
          getMessagesFromFirestore(savedUser.id),
          countMessagesFromFirestore(savedUser.id),
        ]);

        setMessages(savedMessages);
        setMessageCount(savedMessageCount);
      } catch (error) {
        console.error("Failed to load messages:", error);
      } finally {
        setIsLoadingMessages(false);
      }
    }

    loadPageData();
  }, []);

  async function refreshMessages(userId: string) {
    const [savedMessages, savedMessageCount] = await Promise.all([
      getMessagesFromFirestore(userId),
      countMessagesFromFirestore(userId),
    ]);

    setMessages(savedMessages);
    setMessageCount(savedMessageCount);
  }

  useEffect(() => {
    async function sendAutomaticOpener() {
      if (!user?.id || !character) {
        return;
      }

      if (isLoadingMessages || messages.length > 0 || hasAttemptedOpenerRef.current) {
        return;
      }

      hasAttemptedOpenerRef.current = true;

      try {
        setIsAssistantTyping(true);
        await delay(OPENER_TYPING_DELAY_MS);

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: user.id,
            mode: "opener",
            userName: user.name,
            timezone: user.timezone,
            characterId: character.id,
            characterName: character.name,
            recentMessages: [],
            activityState,
          }),
        });

        const data = (await response.json()) as ChatApiResponse;

        if (!response.ok) {
          throw new Error(data.error || "Failed to get opener reply.");
        }

        if (!data.reply) {
          throw new Error("Opener reply was empty.");
        }

        await delay(OPENER_MESSAGE_DELAY_MS);

        await saveMessageToFirestore({
          userId: user.id,
          characterId: character.id,
          characterName: character.name,
          role: "assistant",
          text: data.reply,
        });

        await refreshMessages(user.id);
      } catch (error) {
        console.error("Failed to send opener message:", error);
      } finally {
        setIsAssistantTyping(false);
      }
    }

    sendAutomaticOpener();
  }, [user, character, isLoadingMessages, messages.length, activityState]);

  if (!character) {
    notFound();
  }

  const effectivePlan = normalizePlan(user?.plan);

  const isLocked =
    mounted && user ? user.selectedCharacter !== character.id : false;

  const messageLimit = getMessageLimitForPlan(effectivePlan);
  const hasReachedFreeLimit = hasReachedMessageLimit({
    plan: effectivePlan,
    messageCount,
  });

  async function handleSendMessage() {
    if (
      !user?.id ||
      !character ||
      hasReachedFreeLimit ||
      isSendingMessage ||
      isAssistantTyping
    ) {
      return;
    }

    const trimmedMessage = composerValue.trim();

    if (!trimmedMessage) {
      return;
    }

    try {
      setIsSendingMessage(true);
      setIsAssistantTyping(false);

      const outgoingMessage = trimmedMessage;
      const nextActivityState = updateActivityState(activityState, outgoingMessage);

      setActivityState(nextActivityState);
      setComposerValue("");

      const optimisticMessages: ChatMessage[] = [
        ...messages,
        {
          id: `temp-user-${Date.now()}`,
          role: "user",
          text: outgoingMessage,
        } as ChatMessage,
      ];

      setMessages(optimisticMessages);

      await saveMessageToFirestore({
        userId: user.id,
        characterId: character.id,
        characterName: character.name,
        role: "user",
        text: outgoingMessage,
      });

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          mode: "chat",
          message: outgoingMessage,
          userName: user.name,
          timezone: user.timezone,
          characterId: character.id,
          characterName: character.name,
          recentMessages: toRecentMessagesForModel(messages, outgoingMessage),
          activityState: nextActivityState,
        }),
      });

      const data = (await response.json()) as ChatApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "Failed to get assistant reply.");
      }

      if (!data.reply) {
        throw new Error("Assistant reply was empty.");
      }

      await refreshMessages(user.id);
      setIsSendingMessage(false);

      await delay(ASSISTANT_TYPING_DELAY_MS);
      setIsAssistantTyping(true);

      await delay(ASSISTANT_MESSAGE_DELAY_MS);

      await saveMessageToFirestore({
        userId: user.id,
        characterId: character.id,
        characterName: character.name,
        role: "assistant",
        text: data.reply,
      });

      setIsAssistantTyping(false);
      await refreshMessages(user.id);
    } catch (error) {
      console.error("Failed to send chat message:", error);
      setIsAssistantTyping(false);
      setIsSendingMessage(false);

      if (user?.id) {
        await refreshMessages(user.id);
      }

      alert("Could not send message. Check Terminal and your API route.");
    }
  }

  if (isLocked) {
    const activeCharacter = characters.find(
      (item) => item.id === user?.selectedCharacter
    );

    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
              Character locked
            </p>

            <h1 className="text-3xl font-bold sm:text-4xl">
              This account is locked to{" "}
              {activeCharacter?.name || user?.selectedCharacter}
            </h1>

            <p className="max-w-2xl text-sm leading-6 text-zinc-300 sm:text-base">
              For the MVP, each account can only access one active character.
              You cannot open {character.name} on this account right now.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href={`/chat/${user?.selectedCharacter}`}
                className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
              >
                Go to active chat
              </Link>

              <Link
                href="/characters"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Back to characters
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href="/characters"
          className="text-sm text-zinc-400 hover:text-white"
        >
          ← Back to characters
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <aside className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <h1 className="text-2xl font-bold">{character.name}</h1>
            <p className="mt-2 text-sm text-zinc-400">{character.mood}</p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <h2 className="mb-3 text-lg font-semibold">
              About {character.name}
            </h2>
            <p className="text-sm leading-6 text-zinc-300">{character.bio}</p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <h2 className="mb-3 text-lg font-semibold">User</h2>
            <div className="space-y-2 text-sm text-zinc-300">
              <p>Name: {mounted ? user?.name || "Not saved yet" : "Loading..."}</p>
              <p>Email: {mounted ? user?.email || "Not saved yet" : "Loading..."}</p>
              <p>
                Timezone: {mounted ? user?.timezone || "Not saved yet" : "Loading..."}
              </p>
              <p>Plan: {mounted ? effectivePlan : "Loading..."}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <h2 className="mb-3 text-lg font-semibold">Status</h2>
            <div className="space-y-2 text-sm text-zinc-300">
              <p>Plan: {mounted ? effectivePlan : "Loading..."}</p>
              <p>
                Saved user messages: {messageCount}
                {messageLimit === null ? " / unlimited" : ` / ${messageLimit}`}
              </p>
              <p>
                {isAssistantTyping
                  ? `${character.name} is typing...`
                  : "App-side chat: Connected"}
              </p>
            </div>
          </section>
        </aside>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
              Chat Shell
            </p>
            <h2 className="text-2xl font-semibold">
              Conversation with {character.name}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-zinc-300">
              Your app-side messages are being saved for both user and assistant replies.
            </p>
          </div>

          {hasReachedFreeLimit ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
                Upgrade
              </p>
              <h3 className="mt-2 text-xl font-semibold">
                Your free trial limit has been reached
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
                Upgrade to Pro to keep chatting and unlock unlimited saved messages.
              </p>
              <div className="mt-5">
                <Link
                  href="/upgrade"
                  className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
                >
                  View plans
                </Link>
              </div>
            </div>
          ) : null}

          <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Saved message history
            </h3>

            {isLoadingMessages ? (
              <p className="text-sm text-zinc-400">Loading saved messages...</p>
            ) : messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-zinc-400">No saved messages yet.</p>
                {isAssistantTyping ? <TypingBubble name={character.name} /> : null}
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className="rounded-xl border border-white/10 bg-white/5 p-3"
                  >
                    <p className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-500">
                      {message.role}
                    </p>
                    <p className="text-sm text-zinc-200">{message.text}</p>
                  </div>
                ))}

                {isAssistantTyping ? <TypingBubble name={character.name} /> : null}
              </div>
            )}
          </div>

          {mounted ? (
            <ChatComposer
              value={composerValue}
              onChange={setComposerValue}
              onSend={handleSendMessage}
              disabled={hasReachedFreeLimit || isSendingMessage || isAssistantTyping}
              isSending={isSendingMessage}
            />
          ) : (
            <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
              Loading composer...
            </div>
          )}
        </section>
      </div>
    </div>
  );
}