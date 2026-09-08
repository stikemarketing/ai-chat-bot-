export type ChatV2Role = "user" | "assistant";
export type ChatV2CharacterId = "luna" | "ivy" | "sienna";

export type ChatV2Message = {
  role: ChatV2Role;
  text: string;
};

export type ChatV2Mode = "normal" | "spicy";

export type ChatV2Intent =
  | "normal"
  | "request_spicy"
  | "continue_spicy"
  | "end_spicy"
  | "change_subject";

export type ChatV2ModelResult = {
  reply: string;
  intent: ChatV2Intent;
};

export type ChatV2GenerationInput = {
  characterId: ChatV2CharacterId;
  plan: AppPlan;
  userName: string;
  message: string;
  recentMessages: ChatV2Message[];
  currentMode: ChatV2Mode;
  lastSpicyActivityAt?: number | null;
  contextLines?: string[];
  relationshipStage?: "new" | "developing" | "established";
};

export type ChatV2GenerationResult = ChatV2ModelResult & {
  mode: ChatV2Mode;
  corrected: boolean;
};
import type { AppPlan } from "@/lib/plans";
