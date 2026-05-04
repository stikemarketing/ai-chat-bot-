"use client";

import { useEffect } from "react";
import { getUser } from "@/lib/user";

declare global {
  interface Window {
    voiceflow?: {
      chat?: {
        load: (config: Record<string, unknown>) => void;
      };
    };
    __voiceflowLoaded?: boolean;
    __voiceflowLoading?: boolean;
  }
}

const VOICEFLOW_SCRIPT_SRC = "https://cdn.voiceflow.com/widget-next/bundle.mjs";
const VOICEFLOW_PROJECT_ID = "69bc56253c67e5591100d99a";

type VoiceflowWidgetProps = {
  characterId: string;
  characterName: string;
};

export default function VoiceflowWidget({
  characterId,
  characterName,
}: VoiceflowWidgetProps) {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const clearOldVoiceflowSession = () => {
      const keysToDelete: string[] = [];

      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);

        if (key && key.toLowerCase().includes("voiceflow")) {
          keysToDelete.push(key);
        }
      }

      for (const key of keysToDelete) {
        window.localStorage.removeItem(key);
      }

      window.sessionStorage.removeItem("voiceflow-chat-session");
    };

    if (window.__voiceflowLoaded || window.__voiceflowLoading) {
      return;
    }

    window.__voiceflowLoading = true;
    clearOldVoiceflowSession();

    const existingScript = document.querySelector(
      `script[src="${VOICEFLOW_SCRIPT_SRC}"]`
    ) as HTMLScriptElement | null;

    const loadWidget = () => {
      if (window.__voiceflowLoaded) {
        return;
      }

      const user = getUser();

      window.voiceflow?.chat?.load({
        verify: { projectID: VOICEFLOW_PROJECT_ID },
        url: "https://general-runtime.voiceflow.com",
        versionID: "production",
        userID: user?.id || "guest_user",
        voice: {
          url: "https://runtime-api.voiceflow.com",
        },
        launch: {
          event: {
            type: "launch",
            payload: {
              user_name: user?.name || "",
              user_email: user?.email || "",
              user_timezone: user?.timezone || "",
              selected_character_id: characterId,
              selected_character_name: characterName,
            },
          },
        },
        user: {
          name: user?.name || "Guest",
        },
      });

      window.__voiceflowLoaded = true;
      window.__voiceflowLoading = false;
    };

    if (window.voiceflow?.chat) {
      loadWidget();
      return;
    }

    if (window.voiceflow?.chat) {
  window.__voiceflowLoaded = true;
  window.__voiceflowLoading = false;
  return;
}

    const script = document.createElement("script");
    script.src = VOICEFLOW_SCRIPT_SRC;
    script.type = "text/javascript";
    script.addEventListener("load", loadWidget, { once: true });
    document.body.appendChild(script);
  }, [characterId, characterName]);

  return (
    <div className="mt-8 rounded-2xl border border-dashed border-white/15 bg-black/20 p-8 text-sm text-zinc-400">
      Voiceflow widget loaded in the bottom-right corner.
    </div>
  );
}