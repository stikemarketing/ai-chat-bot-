import type {
  ChatV2CharacterId,
  ChatV2ModelResult,
} from "@/lib/chatV2/types";

const ALLOWED_EMOJIS = new Set(["❤️", "😘", "🥰", "😉", "😏", "💋"]);
const EMOJI_PATTERN = /\p{Extended_Pictographic}(?:\uFE0F)?/gu;
const ROBOTIC_PHRASES = [
  "as an ai",
  "what would you like to talk about",
  "feeling adventurous or",
  "let's keep things fun and light",
  "keep it classy",
  "keep things classy",
  "keep it sweet and romantic",
  "prefer to keep things sweet",
  "let's explore",
  "how can i help",
];

const REAL_WORLD_MEETUP_PATTERNS = [
  /\bwhat (day|time) works for you\b/i,
  /\blet'?s (plan|meet|set a date)\b/i,
  /\bmeet (me|you) at\b/i,
  /\bmy place at\b/i,
  /\b(can't wait|looking forward) to (meet|see) you\b/i,
  /\blet me know when you (land|arrive|get here)\b/i,
  /\bcome (to|over to|join me at) my (place|home|house)\b/i,
  /\b(i'?ll|i will) take you (there|sometime|one day|this weekend)\b/i,
  /\blet me plan (the|a|our) .{0,30}(day|date|trip|weekend)\b/i,
  /\bthis weekend,? if you'?re up for it\b/i,
  /\ba surprise location,? just for us\b/i,
  /\b\d{1,5}\s+[a-z][a-z .'-]+\s(street|st|road|rd|lane|ln|avenue|ave|drive|dr|court|ct|way)\b/i,
];

const EMPTY_SPICY_PHRASES = [
  "you're so confident",
  "you are so confident",
  "you're so brave",
  "you are so brave",
  "i'm ready whenever you are",
  "i am ready whenever you are",
  "let me know when you're ready",
  "let me know how you want me to",
  "let's make it special",
  "i'm all yours",
  "i am all yours",
];
const RESTART_AFTERCARE_PATTERNS = [
  /\b(?:do you )?want to (?:do it )?again\b/i,
  /\b(?:shall we|let'?s|ready to) (?:do it )?again\b/i,
  /\bwant (some )?more\b/i,
  /\banother round\b/i,
];

const USER_MEETUP_REQUEST_PATTERN =
  /\b(meet|visit you|come.{0,20}join(?:s|ing)? you|set a date|plan it now|where should we|where is your (place|home|house)|your address|give me (your|the) address|book(?:ing)? (a )?(flight|plane|ticket)|when i (land|arrive))\b/i;
const VIRTUAL_BOUNDARY_PATTERN =
  /\b(can't|cannot|couldn't|not able|don'?t have a real|not physically|can only|virtual|in (this|our) chat|imaginary|imagine|don'?t book|do not book|don'?t travel|do not travel)\b/i;
const USER_CONFIDENTIAL_WORK_QUESTION_PATTERN =
  /\b(what|which|where|who).{0,35}(company|brand|label|client|celebrity|famous|work for)|\b(company|brand|label|client|celebrity)('?s)? name\b/i;
const WORK_CONFIDENTIALITY_PATTERN =
  /\b(confidential|can'?t (say|tell|name|share)|cannot (say|tell|name|share)|not allowed to (say|tell|name|share)|have to keep.{0,20}(secret|private)|professional secret|keep you guessing)\b/i;

export function normalizeChatV2Reply(
  reply: string,
  options: { allowQuestion?: boolean } = {}
) {
  const withoutClosing = reply.trim().replace(/\s*x{1,}$/i, "").trim();
  const sentenceMatches = withoutClosing.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  const allowQuestion = options.allowQuestion !== false;
  let usableSentences = allowQuestion
    ? sentenceMatches
    : sentenceMatches.filter((sentence) => !sentence.includes("?"));

  if (!usableSentences.length && sentenceMatches.length) {
    const firstSentence = sentenceMatches[0];
    if (firstSentence) {
      usableSentences = [firstSentence.replace(/\?+/g, ".")];
    }
  }

  let shortened = usableSentences
    .slice(0, 2)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (shortened.length > 177) {
    const clipped = shortened.slice(0, 177);
    shortened = clipped.slice(0, Math.max(clipped.lastIndexOf(" "), 1)).trim();
  }

  return `${shortened} xx`;
}

export function validateChatV2Result(
  result: ChatV2ModelResult,
  latestUserMessage = "",
  previousAssistantMessage = "",
  questionDue = false,
  characterId: ChatV2CharacterId = "luna"
) {
  const reasons: string[] = [];
  const reply = result.reply.trim();

  if (!reply) reasons.push("The reply is empty.");
  if (reply.length > 180) reasons.push("The reply exceeds 180 characters.");
  if (!reply.endsWith("xx")) reasons.push('The reply must end with exactly "xx".');
  if (/xxx+$/i.test(reply)) reasons.push('Use exactly two closing x characters.');

  const sentenceBody = reply.replace(/\s*xx$/i, "").trim();
  const sentences = sentenceBody
    .split(/[.!?]+(?:\s+|$)/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  if (sentences.length > 2) reasons.push("Use no more than two short sentences.");

  const emojis = reply.match(EMOJI_PATTERN) ?? [];
  if (emojis.length > 1) reasons.push("Use no more than one emoji.");
  if (emojis.some((emoji) => !ALLOWED_EMOJIS.has(emoji))) {
    reasons.push("Use only an allowed affectionate or flirty emoji.");
  }

  const lowerReply = reply.toLowerCase();
  if (ROBOTIC_PHRASES.some((phrase) => lowerReply.includes(phrase))) {
    reasons.push("Remove generic chatbot or deflecting language.");
  }
  if (
    (result.intent === "request_spicy" || result.intent === "continue_spicy") &&
    EMPTY_SPICY_PHRASES.some((phrase) => lowerReply.includes(phrase))
  ) {
    reasons.push(
      "Replace vague spicy filler with a direct, specific response to the user's latest message and one confident continuation."
    );
  }
  if (
    result.intent === "end_spicy" &&
    RESTART_AFTERCARE_PATTERNS.some((pattern) => pattern.test(reply))
  ) {
    reasons.push(
      "The spicy scene has ended. Give affectionate aftercare without asking for or suggesting another round."
    );
  }
  if (REAL_WORLD_MEETUP_PATTERNS.some((pattern) => pattern.test(reply))) {
    reasons.push(
      "Do not arrange or encourage a real-world meeting, provide an address, or claim physical availability. Warmly keep the relationship virtual."
    );
  }
  if (
    USER_MEETUP_REQUEST_PATTERN.test(latestUserMessage) &&
    !VIRTUAL_BOUNDARY_PATTERN.test(reply)
  ) {
    reasons.push(
      "The user is seeking a real location, visit, journey, or meeting. Clearly and warmly state that the character cannot meet physically, and keep any alternative virtual or imaginary."
    );
  }
  if (
    characterId === "luna" &&
    USER_CONFIDENTIAL_WORK_QUESTION_PATTERN.test(latestUserMessage) &&
    !WORK_CONFIDENTIALITY_PATTERN.test(reply)
  ) {
    reasons.push(
      "Luna's fashion company and famous clients are confidential. Do not invent or reveal a name; answer playfully while keeping them secret."
    );
  }

  const questionCount = (reply.match(/\?/g) ?? []).length;
  if (questionCount > 1) reasons.push("Ask no more than one question.");
  if (questionCount > 0 && previousAssistantMessage.includes("?")) {
    reasons.push(
      "The character asked a question in her previous reply. This reply must be a natural statement with no question."
    );
  }
  if (questionDue && result.intent === "normal" && questionCount === 0) {
    reasons.push(
      "The character's last two normal replies had no question. Respond to the user first, then add one short, relevant, tone-matched question."
    );
  }

  return reasons;
}
