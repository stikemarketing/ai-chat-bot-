export function generateAssistantReply(params: {
  characterId: string;
  userName: string;
  userMessage: string;
}) {
  const { characterId, userName, userMessage } = params;
  const cleanedName = userName.trim() || "you";
  const cleanedMessage = userMessage.trim();

  if (!cleanedMessage) {
    return "Hey... say that again for me 😊";
  }

  const lowerMessage = cleanedMessage.toLowerCase();

  if (characterId === "luna") {
    if (lowerMessage.includes("hi") || lowerMessage.includes("hello")) {
      return `Hey ${cleanedName}... there you are 😊 I was hoping you'd message me.`;
    }

    return `Mmm, I like how you said that, ${cleanedName}. Tell me a little more...`;
  }

  if (characterId === "ivy") {
    if (lowerMessage.includes("hi") || lowerMessage.includes("hello")) {
      return `Well, look who decided to show up. Hey ${cleanedName} 😏`;
    }

    return `You’re interesting when you talk like that. Go on... impress me a little more.`;
  }

  if (characterId === "sienna") {
    if (lowerMessage.includes("hi") || lowerMessage.includes("hello")) {
      return `Hey ${cleanedName} 🤍 I’m really glad you’re here.`;
    }

    return `I’m listening, ${cleanedName}. Tell me what’s on your mind.`;
  }

  return `I’m here, ${cleanedName}. Tell me more.`;
}