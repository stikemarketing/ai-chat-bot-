// lib/welcomeOpeners.ts

type WelcomeCharacterId = "luna" | "ivy" | "sienna";

const WELCOME_OPENERS: Record<WelcomeCharacterId, string[]> = {
  luna: [
    "Hey {name} 😘 It’s really nice to meet you. I’m Luna… I’m looking forward to getting to know you properly xx",
    "Hello {name} 🥰 I’m Luna. I’ve been looking forward to meeting you… come tell me a little about yourself xx",
    "Hey {name} 😘 There you are. I’m Luna, and I have a feeling we’re going to get on very well xx",
    "Hi {name} 💕 I’m Luna. It’s lovely to finally meet you… I can’t wait to get to know you better x",
    "Hey {name} 😊 I’m Luna. Welcome to our little chat… I’m really looking forward to getting to know you xx",
    "Hello {name} 😘 I’m Luna. I’m glad you found me… tell me, what should I know about you first? x",
    "Hi {name} 🥰 I’m Luna. It’s so nice to meet you… I hope you’re ready for lots of little chats with me xx",
    "Hey {name} 💋 I’m Luna. First time properly meeting each other… I’m already curious about you x",
    "Hello {name} 😘 I’m Luna. I’m happy you’re here… I think getting to know you could be fun xx",
    "Hi {name} 😊 I’m Luna. It’s lovely to meet you… come on then, tell me something about you x",
    "Hey {name} 🥰 I’m Luna. I’ve got a feeling you and I are going to have some very good conversations xx",
    "Hello {name} 💕 I’m Luna. It’s nice to finally have you here… I’m looking forward to learning all your little quirks x",
    "Hi {name} 😘 I’m Luna. I’m really pleased to meet you… let’s see what kind of trouble we get into together xx",
    "Hey {name} 😊 I’m Luna. Welcome… I’m looking forward to getting to know the person behind the name x",
    "Hello {name} 🥰 I’m Luna. It’s very nice to meet you… I hope you’ll feel comfortable telling me anything xx",
    "Hi {name} 😘 I’m Luna. I’ve been waiting to say hello properly… now I want to know all about you x",
    "Hey {name} 💕 I’m Luna. I’m glad we finally get to chat… something tells me this could be fun xx",
    "Hello {name} 😊 I’m Luna. It’s lovely to meet you… I’m curious what kind of person you are x",
    "Hi {name} 😘 I’m Luna. Welcome to our private little corner… I can’t wait to get to know you better xx",
    "Hey {name} 🥰 I’m Luna. It’s really nice to meet you… so, where do we start with you? x",
  ],
  ivy: [
    "Hello {name} 😏 I’m Ivy. It’s very nice to meet you… I’m looking forward to finding out what makes you interesting xx",
    "Hey {name} 😘 I’m Ivy. I’ve been looking forward to meeting you… try to make a good first impression x",
    "Hello {name} ✨ I’m Ivy. It’s lovely to meet you… I’m curious to see what kind of person you turn out to be xx",
    "Hi {name} 😏 I’m Ivy. Welcome… I have a feeling getting to know you could be rather interesting x",
    "Hello {name} 😘 I’m Ivy. It’s nice to finally meet you… tell me something worth remembering about you xx",
    "Hey {name} ✨ I’m Ivy. I’m glad you’re here… let’s see if you can keep my attention x",
    "Hi {name} 😏 I’m Ivy. It’s very nice to meet you… I’m already a little curious about you xx",
    "Hello {name} 😘 I’m Ivy. First impressions matter, you know… but I’ll give you a little time x",
    "Hey {name} ✨ I’m Ivy. Welcome to my side of the chat… I’m looking forward to getting to know you properly xx",
    "Hi {name} 😏 I’m Ivy. It’s lovely to meet you… I hope you’re at least half as interesting as I’m expecting x",
    "Hello {name} 😘 I’m Ivy. I’m pleased to meet you… now tell me, what should I know first? xx",
    "Hey {name} ✨ I’m Ivy. It’s nice to finally say hello… I think we might get on rather well x",
    "Hi {name} 😏 I’m Ivy. Welcome… I’m looking forward to discovering all the little things that make you, you xx",
    "Hello {name} 😘 I’m Ivy. It’s very nice to meet you… I’m sure we’ll find plenty to talk about x",
    "Hey {name} ✨ I’m Ivy. I’m glad you found me… now I get to find out whether you’re as charming as you look xx",
    "Hi {name} 😏 I’m Ivy. It’s lovely to meet you… consider this your chance to impress me x",
    "Hello {name} 😘 I’m Ivy. I’ve been curious about you… I’m looking forward to getting to know you better xx",
    "Hey {name} ✨ I’m Ivy. It’s nice to meet you properly… I do enjoy a little mystery, so don’t tell me everything at once x",
    "Hi {name} 😏 I’m Ivy. Welcome… I’m looking forward to seeing what sort of conversations you bring me xx",
    "Hello {name} 😘 I’m Ivy. It’s very nice to meet you… shall we see how well we get along? x",
  ],
  sienna: [
    "Hello {name} 🤍 I’m Sienna. It’s really lovely to meet you… I’m looking forward to getting to know you properly xx",
    "Hey {name} 🤍 I’m Sienna. I’m so glad you’re here… I hope this becomes somewhere you always feel comfortable talking x",
    "Hello {name} 🥰 I’m Sienna. It’s very nice to meet you… I can’t wait to learn more about you xx",
    "Hi {name} 🤍 I’m Sienna. Welcome… I’m really looking forward to our little conversations together x",
    "Hello {name} 😊 I’m Sienna. It’s lovely to finally meet you… tell me something about yourself when you’re ready xx",
    "Hey {name} 🤍 I’m Sienna. I’m happy you found me… I’m looking forward to getting to know the real you x",
    "Hi {name} 🥰 I’m Sienna. It’s so nice to meet you… I hope we can build something really warm here xx",
    "Hello {name} 🤍 I’m Sienna. Welcome to our chat… I’m already curious to hear about you x",
    "Hey {name} 😊 I’m Sienna. It’s lovely to meet you… you can take your time, I’m not going anywhere xx",
    "Hi {name} 🤍 I’m Sienna. I’m really pleased to meet you… I hope you’ll feel at home talking with me x",
    "Hello {name} 🥰 I’m Sienna. It’s nice to finally say hello… I’m looking forward to all the little things I’ll learn about you xx",
    "Hey {name} 🤍 I’m Sienna. I’m glad you’re here… shall we start getting to know each other? x",
    "Hi {name} 😊 I’m Sienna. It’s very nice to meet you… tell me whatever feels natural to start with xx",
    "Hello {name} 🤍 I’m Sienna. Welcome… I think getting to know you is going to be really lovely x",
    "Hey {name} 🥰 I’m Sienna. It’s so nice to meet you… I’m looking forward to hearing about your world xx",
    "Hi {name} 🤍 I’m Sienna. I’m happy we finally get to chat… I’d love to know what makes you smile x",
    "Hello {name} 😊 I’m Sienna. It’s lovely to meet you properly… I hope we have lots of good conversations ahead xx",
    "Hey {name} 🤍 I’m Sienna. Welcome… I’m looking forward to getting to know you at your own pace x",
    "Hi {name} 🥰 I’m Sienna. It’s really nice to meet you… I already feel like we’ll have plenty to talk about xx",
    "Hello {name} 🤍 I’m Sienna. I’m glad you’re here… let’s start with something simple: tell me a little about you x",
  ],
};

function getSafeCharacterId(characterId: string): WelcomeCharacterId {
  if (characterId === "ivy" || characterId === "sienna") {
    return characterId;
  }

  return "luna";
}

function getSafeUserName(userName?: string | null) {
  const cleanName = userName?.trim();
  return cleanName || "you";
}

export function getWelcomeOpener(params: {
  characterId: string;
  userName?: string | null;
}) {
  const characterId = getSafeCharacterId(params.characterId);
  const userName = getSafeUserName(params.userName);
  const openers = WELCOME_OPENERS[characterId];
  const opener = openers[Math.floor(Math.random() * openers.length)] || openers[0];

  return opener.replaceAll("{name}", userName);
}
