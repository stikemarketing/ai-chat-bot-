export type ImageLimitReplyKind = "normal" | "spicy";

type ImageLimitReplyParams = {
  characterName: string;
  kind: ImageLimitReplyKind;
  userMessage: string;
  recentAssistantMessages?: string[];
};

type CharacterLimitReplyPools = {
  normal: readonly string[];
  spicy: readonly string[];
};

const IMAGE_LIMIT_REPLIES: Record<string, CharacterLimitReplyPools> = {
  luna: {
    normal: [
      "Mmm… I’ve sent all the selfies I can for today 😘 We can still chat as much as you like though. If you want unlimited pictures from me too, upgrade to Unlimited xx",
      "You’ve had all my selfies for today, babe 💕 But I’m still right here to chat with you. Go Unlimited if you want pictures from me without the daily limit xx",
      "Aww, I can’t send another selfie until the reset 😘 We can absolutely keep chatting though. Unlimited takes the image limit away if you want more of me xx",
      "Mmm, I’ve used up my selfie allowance with you for today 😏 We can keep talking all you want. Upgrade to Unlimited if you don’t want me counting pictures xx",
      "No more selfies from me until midnight, trouble 😘 But I’m not going anywhere — we can keep chatting. Unlimited unlocks unrestricted images xx",
      "I’d send you another if I could 💕 For now we can keep chatting, and my pictures reset at midnight. Unlimited removes the image limit completely xx",
      "You’ve had all the normal pictures I can send today 😘 We can still talk for as long as you like. If you want more pictures too, Unlimited is the one xx",
      "Mmm, I’ve got to make you wait for more selfies until midnight 😏 But we can keep chatting. Upgrade to Unlimited if waiting for pictures isn’t your thing xx",
      "That’s all the selfies I can send you today, babe 😘 I’m still here to chat though. Unlimited means you can ask me for pictures whenever you like xx",
      "I’ve run out of selfies for today 💕 We can still keep each other company in chat. If you want unrestricted pictures from me, upgrade to Unlimited xx",
    ],
    spicy: [
      "Mmm… I’ve sent all the naughty pictures I can today 😘 We can still keep chatting and getting into trouble though. If you want unlimited pictures from me too, upgrade to Unlimited 😏 xx",
      "I’ve used up my spicy pictures for today, babe 💋 But I can still talk dirty with you. Go Unlimited if you want my pictures without the daily limit xx",
      "Mmm, I can’t send another spicy picture until midnight 😏 We can still keep the mood going in chat. Unlimited takes the image limit away xx",
      "I was just getting warmed up too 😘 I’m out of spicy pictures for today, but I can still chat with you. Upgrade to Unlimited if you want more images whenever you like xx",
      "No more naughty pictures from me until the reset 💋 But I’m still here and we can keep talking. Unlimited unlocks unrestricted image access xx",
      "I can’t send another spicy one today 😏 That doesn’t mean we have to stop chatting. Go Unlimited if you want me to keep the pictures coming too xx",
      "Mmm, I’ve hit my spicy picture limit with you for today 😘 We can still have plenty of fun in chat. Unlimited removes the daily image cap xx",
      "You’ve had all the cheeky pictures I can send today 💋 But I can still keep you company in chat. Upgrade to Unlimited if you want more images too xx",
      "I have to behave with pictures until midnight now 😏 But I can still be naughty with you in chat. Unlimited means no daily image limit xx",
      "I’m out of spicy pictures for today, babe 😘 We can still keep chatting as much as you like. If you want unrestricted pictures from me, Unlimited is waiting xx",
    ],
  },
  ivy: {
    normal: [
      "Mm… I’ve sent all the selfies I can today 😏 We can still chat as much as you like. Unlimited removes the daily image limit if you want more photos from me.",
      "I can’t send another normal photo until midnight, but I’m still here to talk. Upgrade to Unlimited if you want unrestricted pictures from me.",
      "That’s all the selfies I can send today. We can keep chatting, of course 😏 Unlimited simply removes the image limit.",
      "I’ve used up today’s selfie allowance with you. Keep talking to me — I’m not going anywhere. Unlimited unlocks unrestricted image access.",
      "No more normal pictures from me until the reset 😏 We can still keep the conversation going. Unlimited means no daily image cap.",
      "I’d send another if I could. For now, we can keep chatting and the pictures reset at midnight. Unlimited removes that restriction.",
      "I’m out of selfies for today, but certainly not out of conversation 😏 Upgrade to Unlimited if you want pictures from me without counting them.",
      "I can’t send more normal photos today. We can still talk for as long as you like. Unlimited takes away the daily image limit.",
      "That’s my selfie allowance used for today 😏 I’m still here to chat. If you want unrestricted photos too, Unlimited is the upgrade.",
      "I have to make you wait until midnight for another selfie. In the meantime, keep me company in chat 😏 Unlimited removes the wait for images.",
    ],
    spicy: [
      "Mm… I’ve sent all the spicy pictures I can today 😏 We can still keep the conversation interesting. Unlimited removes the daily image limit.",
      "I can’t send another spicy image until midnight, but I can still flirt with you here. Upgrade to Unlimited if you want unrestricted pictures too.",
      "That’s all the naughty pictures I can send today 😏 We can absolutely keep chatting. Unlimited means no daily image cap.",
      "I’ve used up today’s spicy allowance with you. Keep talking to me — I’m still here. Unlimited unlocks unrestricted spicy images.",
      "No more spicy pictures from me until the reset 😏 That doesn’t stop us chatting. Unlimited removes the image restriction.",
      "I’d keep the pictures coming if I could. For now we can keep the mood going in chat, and my image allowance resets at midnight.",
      "I’m out of spicy images for today, but not out of ways to keep your attention 😏 Unlimited removes the daily picture limit.",
      "I can’t send another naughty picture today. We can still keep talking as much as you like. Unlimited unlocks unrestricted image access.",
      "That’s my spicy image allowance used for today 😏 I’m still right here to chat. Upgrade to Unlimited if you want more pictures too.",
      "I have to behave with pictures until midnight now 😏 But I can still keep you entertained in chat. Unlimited removes that particular limit.",
    ],
  },
  sienna: {
    normal: [
      "Aww, I’ve sent all the selfies I can today 🤍 We can still keep chatting as much as you like. Unlimited removes the daily image limit if you want more pictures from me.",
      "I can’t send another selfie until midnight, lovely 🤍 But I’m still here to talk. Upgrade to Unlimited if you want unrestricted pictures too.",
      "That’s all the normal pictures I can send today 🤍 We can absolutely keep chatting. Unlimited means no daily image limit.",
      "I’ve used up today’s selfie allowance with you 🤍 Keep talking to me — I’m still right here. Unlimited unlocks unrestricted image access.",
      "No more normal photos from me until the reset 🤍 But we can keep each other company in chat. Unlimited removes the image cap.",
      "I’d send another if I could 🤍 For now we can keep chatting, and the pictures reset at midnight. Unlimited takes the daily limit away.",
      "I’m out of selfies for today, but not out of conversation 🤍 Upgrade to Unlimited if you want more pictures from me whenever you like.",
      "I can’t send more normal images today 🤍 We can still talk for as long as you want. Unlimited removes the daily picture restriction.",
      "That’s my selfie allowance used for today 🤍 I’m still here to chat. If you want unrestricted photos too, Unlimited is there whenever you’re ready.",
      "I have to make you wait until midnight for another selfie 🤍 In the meantime, stay and chat with me. Unlimited removes the image wait.",
    ],
    spicy: [
      "Mm… I’ve sent all the spicy pictures I can today 🤍 We can still keep the mood going in chat. Unlimited removes the daily image limit if you want more.",
      "I can’t send another spicy image until midnight, lovely 🤍 But I can still flirt with you here. Upgrade to Unlimited if you want unrestricted pictures too.",
      "That’s all the naughty pictures I can send today 🤍 We can absolutely keep chatting. Unlimited means no daily image cap.",
      "I’ve used up today’s spicy allowance with you 🤍 Keep talking to me — I’m still right here. Unlimited unlocks unrestricted spicy images.",
      "No more spicy pictures from me until the reset 🤍 That doesn’t mean we have to stop talking. Unlimited removes the image restriction.",
      "I’d keep teasing you with pictures if I could 🤍 For now we can keep the mood warm in chat, and my image allowance resets at midnight.",
      "I’m out of spicy images for today, but I can still keep your attention here 🤍 Unlimited removes the daily picture limit.",
      "I can’t send another naughty picture today 🤍 We can still keep chatting as much as you like. Unlimited unlocks unrestricted image access.",
      "That’s my spicy image allowance used for today 🤍 I’m still here to chat. Upgrade to Unlimited if you want more pictures too.",
      "I have to behave with pictures until midnight now 🤍 But I can still be playful with you in chat. Unlimited removes that limit.",
    ],
  },
};

function getCharacterKey(characterName: string) {
  const lowerName = characterName.trim().toLowerCase();

  if (lowerName === "ivy") return "ivy";
  if (lowerName === "sienna") return "sienna";
  return "luna";
}

function normalizeReplyForRepeatCheck(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSeed(text: string) {
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function getImageLimitReply(params: ImageLimitReplyParams) {
  const characterKey = getCharacterKey(params.characterName);
  const replies = IMAGE_LIMIT_REPLIES[characterKey][params.kind];

  const recentReplies = new Set(
    (params.recentAssistantMessages ?? [])
      .map((reply) => normalizeReplyForRepeatCheck(reply))
      .filter(Boolean)
      .slice(-20)
  );

  const seed = getSeed(
    `${characterKey}:${params.kind}:${params.userMessage.trim().toLowerCase()}`
  );
  const startIndex = seed % replies.length;

  for (let offset = 0; offset < replies.length; offset += 1) {
    const reply = replies[(startIndex + offset) % replies.length];

    if (!recentReplies.has(normalizeReplyForRepeatCheck(reply))) {
      return reply;
    }
  }

  return replies[startIndex];
}
