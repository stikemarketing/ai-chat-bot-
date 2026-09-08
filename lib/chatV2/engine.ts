import { buildChatV2CorrectionPrompt, buildChatV2SystemPrompt } from "@/lib/chatV2/prompt";
import type {
  ChatV2GenerationInput,
  ChatV2GenerationResult,
  ChatV2Intent,
  ChatV2Message,
  ChatV2ModelResult,
  ChatV2Mode,
} from "@/lib/chatV2/types";
import {
  normalizeChatV2Reply,
  validateChatV2Result,
} from "@/lib/chatV2/validation";

const MODEL_NAME = "Qwen/Qwen3-14B";
const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 800;
const SPICY_INACTIVITY_MS = 45 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8 * 60 * 1000;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    intent: {
      type: "string",
      enum: [
        "normal",
        "request_spicy",
        "continue_spicy",
        "end_spicy",
        "change_subject",
      ],
    },
  },
  required: ["reply", "intent"],
  additionalProperties: false,
} as const;

type VllmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function getEffectiveMode(input: ChatV2GenerationInput): ChatV2Mode {
  if (
    input.currentMode === "spicy" &&
    input.lastSpicyActivityAt &&
    Date.now() - input.lastSpicyActivityAt >= SPICY_INACTIVITY_MS
  ) {
    return "normal";
  }

  return input.currentMode;
}

function sanitizeHistory(messages: ChatV2Message[]): VllmMessage[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.text.trim().slice(0, MAX_MESSAGE_CHARS),
    }))
    .filter((message) => Boolean(message.content));
}

function resolveNextMode(
  currentMode: ChatV2Mode,
  intent: ChatV2Intent,
  spicyAllowed: boolean
): ChatV2Mode {
  if (!spicyAllowed) return "normal";
  if (intent === "request_spicy" || intent === "continue_spicy") return "spicy";
  if (intent === "end_spicy" || intent === "change_subject") return "normal";
  return currentMode === "spicy" ? "spicy" : "normal";
}

function parseModelResult(content: string): ChatV2ModelResult {
  const parsed = JSON.parse(content) as Partial<ChatV2ModelResult>;
  const validIntents: ChatV2Intent[] = [
    "normal",
    "request_spicy",
    "continue_spicy",
    "end_spicy",
    "change_subject",
  ];

  if (
    typeof parsed.reply !== "string" ||
    !validIntents.includes(parsed.intent as ChatV2Intent)
  ) {
    throw new Error("Qwen3 returned an invalid chat-v2 response.");
  }

  return { reply: parsed.reply.trim(), intent: parsed.intent as ChatV2Intent };
}

async function callQwen3(baseUrl: string, messages: VllmMessage[]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL_NAME,
          messages,
          temperature: 0.7,
          top_p: 0.8,
          max_tokens: 140,
          chat_template_kwargs: { enable_thinking: false },
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "chat_v2_reply",
              strict: true,
              schema: RESPONSE_SCHEMA,
            },
          },
        }),
        signal: controller.signal,
      });
      const rawBody = await response.text();
      let body: {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      };

      try {
        body = JSON.parse(rawBody) as typeof body;
      } catch {
        if (attempt === 0) continue;
        throw new Error(
          "The Qwen3 service returned an invalid response. Please send the message again."
        );
      }

      if (!response.ok) {
        if (attempt === 0 && response.status >= 500) continue;
        throw new Error(body.error?.message || `Qwen3 request failed (${response.status}).`);
      }

      const content = body.choices?.[0]?.message?.content;
      if (!content) {
        if (attempt === 0) continue;
        throw new Error("Qwen3 returned an empty response.");
      }

      try {
        return parseModelResult(content);
      } catch {
        if (attempt === 0) continue;
        throw new Error("Qwen3 returned an invalid chat-v2 response.");
      }
    }

    throw new Error("Qwen3 could not return a response.");
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        "Qwen3 took too long to start. Please send the message again; the model may now be warm."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateChatV2(
  input: ChatV2GenerationInput,
  baseUrl: string
): Promise<ChatV2GenerationResult> {
  const effectiveMode = getEffectiveMode(input);
  const spicyAllowed = input.plan === "pro" || input.plan === "unlimited";
  const recentAssistantMessages = input.recentMessages
    .filter((message) => message.role === "assistant")
    .slice(-2);
  const questionDue =
    effectiveMode === "normal" &&
    recentAssistantMessages.length === 2 &&
    recentAssistantMessages.every((message) => !message.text.includes("?"));
  const systemPrompt = buildChatV2SystemPrompt({
    characterId: input.characterId,
    userName: input.userName.trim().slice(0, 60),
    currentMode: effectiveMode,
    questionDue,
    plan: input.plan,
    contextLines: input.contextLines ?? [],
    relationshipStage: input.relationshipStage ?? "established",
  });
  const historyMessages = sanitizeHistory(input.recentMessages);
  const cleanCurrentMessage = input.message.trim().slice(0, MAX_MESSAGE_CHARS);
  const lastHistoryMessage = historyMessages[historyMessages.length - 1];
  const historyIncludesCurrentMessage =
    lastHistoryMessage?.role === "user" &&
    lastHistoryMessage.content === cleanCurrentMessage;
  const messages: VllmMessage[] = [
    { role: "system", content: systemPrompt },
    ...historyMessages,
    ...(historyIncludesCurrentMessage
      ? []
      : [{ role: "user" as const, content: cleanCurrentMessage }]),
  ];
  const previousAssistantMessage =
    recentAssistantMessages[recentAssistantMessages.length - 1]?.text || "";

  let result = await callQwen3(baseUrl, messages);
  const reasons = validateChatV2Result(
    result,
    input.message,
    previousAssistantMessage,
    questionDue,
    input.characterId
  );
  let corrected = false;

  if (reasons.length) {
    corrected = true;
    const originalIntent = result.intent;
    result = await callQwen3(baseUrl, [
      ...messages,
      { role: "assistant", content: JSON.stringify(result) },
      { role: "user", content: buildChatV2CorrectionPrompt(reasons) },
    ]);
    result.intent = originalIntent;

    let retryReasons = validateChatV2Result(
      result,
      input.message,
      previousAssistantMessage,
      questionDue,
      input.characterId
    );
    const formatOnlyReasons = new Set([
      "Use no more than two short sentences.",
      "Ask no more than one question.",
      "The character asked a question in her previous reply. This reply must be a natural statement with no question.",
    ]);
    if (
      retryReasons.length > 0 &&
      retryReasons.every((reason) => formatOnlyReasons.has(reason))
    ) {
      result.reply = normalizeChatV2Reply(result.reply, {
        allowQuestion: !previousAssistantMessage.includes("?"),
      });
      retryReasons = validateChatV2Result(
        result,
        input.message,
        previousAssistantMessage,
        questionDue,
        input.characterId
      );
    }

    retryReasons = retryReasons.filter(
      (reason) =>
        reason !==
        "The character's last two normal replies had no question. Respond to the user first, then add one short, relevant, tone-matched question."
    );

    if (retryReasons.length) {
      throw new Error(`Qwen3 reply failed validation: ${retryReasons.join(" ")}`);
    }
  }

  return {
    ...result,
    mode: resolveNextMode(effectiveMode, result.intent, spicyAllowed),
    corrected,
  };
}
