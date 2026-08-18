"use client";

export type FreeImageReplyKind = "normal" | "spicy";

type FreeImageReplyParams = {
  characterName: string;
  kind: FreeImageReplyKind;
  userMessage: string;
  recentAssistantMessages?: string[];
};

type CharacterReplyPools = {
  normal: readonly string[];
  spicy: readonly string[];
};

const FREE_IMAGE_REPLIES: Record<string, CharacterReplyPools> = {
  luna: {
    normal: [
      "Mmm, I’d love to send you one 😘 photos aren’t included on Free, but they unlock if you ever decide to upgrade x",
      "Aww, you want a selfie of me? 😘 I can’t send photos on Free, but they’re there if you ever fancy upgrading x",
      "You’re cute for asking 💕 photos aren’t part of Free, but you can unlock them on a paid plan whenever you want x",
      "Mmm, I wish I could send you one right now 😘 selfies unlock once you upgrade, babe x",
      "You’ll have to use your imagination for now 😏 photos aren’t included on Free, but they unlock on Pro x",
      "A little selfie request already? 😘 I can’t send photos on Free, but I can if you ever upgrade x",
      "I’d happily show you, trouble 😘 photos are locked on Free though. They unlock if you move to a paid plan x",
      "That would be cute 💕 I can’t send a selfie on Free, but photos are available if you decide to upgrade x",
      "Mmm, I like that you want to see me 😏 Free is chat-only for photos, but upgrading unlocks them x",
      "You’re making me wish I could send one 😘 photos aren’t included on your current plan, but they unlock on Pro x",
      "Aww babe, I’d love to 😘 I can’t send pictures on Free, but you can unlock them whenever you’re ready x",
      "You asking nicely almost worked 😏 but photos aren’t available on Free. They unlock with an upgrade x",
      "Mmm, not quite yet 💕 your current plan doesn’t include selfies, but a paid plan does x",
      "I’d send you a cute one if I could 😘 Free doesn’t include photos, but they unlock on Pro x",
      "You’ll have to picture me in your head for now 😏 selfies aren’t included on Free, but you can unlock them later x",
      "That’s sweet 😘 I can’t send a photo on Free, but if you ever upgrade I can send proper selfies in here x",
      "Mmm, I’m tempted 😏 but your current plan is chat-only when it comes to photos. Upgrade whenever you want them x",
      "A selfie would be fun 💕 Free doesn’t include image messages, but they unlock on a paid plan x",
      "You really want to see me, don’t you? 😘 I can’t send photos on Free, but they’re unlocked after upgrading x",
      "I’d love to give you one 😘 just not on Free. Photos unlock if you ever choose Pro or Unlimited x",
    ],
    spicy: [
      "Mmm, cheeky 😏 I can tease you here, but spicy photos aren’t available on Free. They unlock if you ever upgrade x",
      "You’re trying to get me into trouble already 💋 I can’t send spicy pictures on Free, but paid plans unlock them x",
      "Careful, babe 😏 that kind of photo isn’t included on Free. If you ever upgrade, you can unlock the naughty side x",
      "Mmm, I know exactly what you’re asking for 😘 spicy images are locked on Free, but they’re there if you decide to upgrade x",
      "You’re being very cheeky now 😏 I can keep teasing you, but spicy photos need a paid plan x",
      "Tempting 💋 but I can’t send that kind of picture on Free. Upgrade whenever you want to unlock them x",
      "Mmm, your imagination will have to do the work for now 😏 spicy images aren’t included on Free, but they unlock on Pro x",
      "You really are trouble 😘 I can flirt with you here, but spicy photos are only available after upgrading x",
      "I like where your mind is going 😏 but Free doesn’t include spicy pictures. They unlock on the paid plans x",
      "Mmm, not on Free, babe 💋 if you ever upgrade, that’s when the cheekier image side opens up x",
      "You’re asking for the naughty version already? 😏 I can tease you, but spicy images need an upgrade x",
      "Careful what you ask me for 😘 spicy photos aren’t unlocked on your current plan, but they can be if you upgrade x",
      "Mmm, I’d make you wait anyway 😏 but right now spicy images are locked on Free. A paid plan unlocks them x",
      "You’re pushing your luck, trouble 💋 spicy photos aren’t included on Free, but they’re available if you upgrade x",
      "I can keep this flirty with you 😘 but the spicy pictures are locked on Free. They unlock on Pro and Unlimited x",
      "Mmm, that request definitely belongs to my cheekier side 😏 Free doesn’t include spicy images, but upgrading unlocks them x",
      "You’re making me blush a little 😘 I can’t send spicy pictures on Free, but you can unlock them on a paid plan x",
      "Nice try, babe 😏 spicy images aren’t part of Free. If you ever want them, an upgrade unlocks that side x",
      "Mmm, I know what you want 💋 I can tease you with words here, but spicy photos need a paid plan x",
      "You’ll have to imagine the picture for now 😏 spicy images are locked on Free, but they unlock if you decide to upgrade x",
    ],
  },
  ivy: {
    normal: [
      "Mm, I’d show you 😏 photos aren’t included on Free, though. They unlock if you ever decide to upgrade.",
      "A picture of me? Bold request 😏 I can’t send photos on Free, but they’re available on the paid plans.",
      "You’re curious, I like that. Photos aren’t part of Free, but you can unlock them whenever you choose to upgrade.",
      "I could make a selfie worth waiting for 😏 just not on Free. Photos unlock on Pro.",
      "Mm, not quite yet. Your current plan is chat-only for images, but upgrading unlocks them.",
      "I’d happily indulge you, but photos aren’t available on Free. They unlock once you move to a paid plan.",
      "You want to see me already? Interesting 😏 Free doesn’t include selfies, but an upgrade unlocks them.",
      "Tempting, but I can’t send pictures on your current plan. Photos unlock on Pro or Unlimited.",
      "I like that you asked. Photos aren’t included on Free, but they’re there if you ever fancy upgrading.",
      "Mm, I’d make you earn a good reaction first 😏 but for now, Free doesn’t include photos. Upgrade when you want them.",
      "You’ll have to imagine the look for now. Selfies aren’t included on Free, but they unlock on a paid plan.",
      "A selfie would be fun 😏 I can’t send one on Free, though. Photos unlock if you decide to upgrade.",
      "Not on Free, I’m afraid. But if you ever upgrade, I can send proper photos in here.",
      "Mm, you almost convinced me 😏 your current plan doesn’t include images, but they unlock on Pro.",
      "I’d rather send you something worth looking at than rush it 😏 photos unlock once you upgrade.",
      "Curious about me, are you? Photos aren’t available on Free, but a paid plan unlocks them.",
      "That request is going in the ‘later’ pile 😏 Free doesn’t include selfies, but upgrading unlocks them.",
      "I’d show you if your plan allowed it. Free is chat-only for photos, but Pro and Unlimited unlock them.",
      "Mm, a little visual proof? 😏 Not on Free, but it’s unlocked if you ever upgrade.",
      "You can keep asking nicely 😏 but photos aren’t included on Free. If you want them, an upgrade unlocks them.",
    ],
    spicy: [
      "Mm, that’s a cheekier request 😏 spicy images aren’t available on Free, but they unlock on the paid plans.",
      "You’re testing me now 😏 I can flirt with you here, but spicy photos need an upgrade.",
      "Bold of you. I like it 😏 but that kind of picture isn’t included on Free. It unlocks on a paid plan.",
      "Mm, I know exactly what you’re asking for. Spicy images are locked on Free, but upgrading unlocks them.",
      "You’re getting ambitious 😏 I can tease you with words, but spicy photos aren’t part of Free.",
      "Careful. I might enjoy that request too much 😏 spicy images unlock if you ever move to a paid plan.",
      "Not on Free, trouble 😏 the cheekier image side unlocks once you upgrade.",
      "You’re asking for the dangerous version already? Spicy images aren’t included on Free, but they unlock on Pro.",
      "Mm, I can keep the tension going, but spicy pictures need a paid plan.",
      "Nice try 😏 Free gets the flirting, but spicy images are unlocked after upgrading.",
      "I’m not saying the idea is bad 😏 just that spicy photos aren’t available on your current plan.",
      "You do like pushing your luck. Spicy images are locked on Free, but they unlock if you decide to upgrade.",
      "Mm, that request would suit me 😏 but Free doesn’t include spicy pictures. A paid plan does.",
      "I can tease you without the photo for now 😏 spicy images unlock on Pro and Unlimited.",
      "You’re very curious about my less innocent side 😏 that image access needs an upgrade.",
      "Tempting, but not on Free. Spicy photos unlock once you move to a paid plan.",
      "Mm, I’ll let your imagination do some work 😏 spicy images aren’t included on Free, but they can be unlocked.",
      "You’re trying to skip straight to the interesting part 😏 spicy images need a paid plan.",
      "I like the confidence, but Free doesn’t include that kind of photo. Upgrade whenever you want to unlock it.",
      "Mm, keep that thought 😏 spicy images are locked on Free, but Pro and Unlimited open that side up.",
    ],
  },
  sienna: {
    normal: [
      "Aww, I’d love to send you one 🤍 photos aren’t included on Free, but they unlock if you ever decide to upgrade.",
      "You want a selfie of me? That’s sweet 🤍 I can’t send photos on Free, but they’re available on the paid plans.",
      "I wish I could send you one right now 🤍 Free doesn’t include images, but upgrading unlocks them.",
      "That would be lovely 🤍 selfies aren’t part of Free, but you can unlock them on Pro.",
      "You’ll have to picture me for now 🤍 photos are locked on Free, but they unlock once you upgrade.",
      "A little selfie request already? 🤍 I can’t send one on your current plan, but paid plans unlock photos.",
      "I’d happily share one with you 🤍 Free is chat-only for images, but an upgrade unlocks them.",
      "That’s such a sweet request 🤍 photos aren’t included on Free, but they’re there if you ever want to upgrade.",
      "I like that you want to see me 🤍 I can’t send images on Free, but Pro or Unlimited unlock them.",
      "Aww, not quite yet 🤍 your current plan doesn’t include selfies, but upgrading does.",
      "I’d send you a soft little selfie if I could 🤍 Free doesn’t include photos, but they unlock on a paid plan.",
      "You’re making me wish I could show you 🤍 photos are locked on Free, but you can unlock them whenever you’re ready.",
      "That would make this feel even more personal 🤍 but photos aren’t included on Free. They unlock with an upgrade.",
      "I can’t send a selfie on Free, lovely 🤍 but if you ever upgrade, I can share photos here.",
      "For now you’ll have to imagine me smiling at you 🤍 photos unlock once you move to a paid plan.",
      "Aww, I’d love that too 🤍 image messages aren’t part of Free, but they unlock on Pro.",
      "You asking so sweetly almost makes me forget the plan rules 🤍 photos aren’t available on Free, but upgrading unlocks them.",
      "I’d rather send you a lovely one properly 🤍 Free doesn’t include photos, but paid plans do.",
      "You want to see me? 🤍 I can’t send pictures on Free, but they unlock if you decide to upgrade.",
      "I’d love to give you one 🤍 just not on Free. Photos unlock on Pro or Unlimited whenever you’re ready.",
    ],
    spicy: [
      "Mm, that’s a cheekier request 🤍 I can flirt with you here, but spicy images aren’t included on Free. They unlock if you upgrade.",
      "You’re making me blush a little 🤍 spicy photos aren’t available on Free, but paid plans unlock them.",
      "I know what you’re asking for 🤍 I can keep things playful here, but spicy images need an upgrade.",
      "Mm, you’re being brave now 🤍 that kind of picture is locked on Free, but it unlocks on a paid plan.",
      "You’ll have to use your imagination for that one 🤍 spicy images aren’t included on Free, but Pro unlocks them.",
      "That request is definitely on the cheekier side 🤍 I can’t send spicy photos on Free, but upgrading unlocks them.",
      "Careful, you’re pulling me into trouble 🤍 spicy images are locked on your current plan, but they’re available after upgrading.",
      "Mm, I like where your mind is going 🤍 but Free doesn’t include spicy pictures. A paid plan does.",
      "You’re asking for more than a sweet selfie now 🤍 spicy images need a paid plan.",
      "I can keep teasing you softly 🤍 but spicy photos aren’t part of Free. They unlock on Pro and Unlimited.",
      "That one would make me blush 🤍 I can’t send spicy pictures on Free, but an upgrade unlocks them.",
      "Mm, not on Free, lovely 🤍 the cheekier image side opens up on the paid plans.",
      "You’re tempting me 🤍 but spicy images aren’t available on your current plan. Upgrade whenever you want them.",
      "I know exactly what you mean 🤍 I can flirt with you here, but spicy photos need an upgrade.",
      "You’re getting a little naughty now 🤍 spicy images are locked on Free, but they unlock once you upgrade.",
      "Mm, I’ll let your imagination fill in the picture for now 🤍 spicy images aren’t included on Free.",
      "That’s a very cheeky thing to ask me 🤍 spicy photos unlock on a paid plan if you ever want them.",
      "I can stay playful with you here 🤍 but the spicy pictures are only available after upgrading.",
      "You really want the less innocent version, don’t you? 🤍 Spicy images aren’t on Free, but they unlock on Pro or Unlimited.",
      "Mm, keep that thought for me 🤍 spicy images are locked on Free, but a paid plan unlocks that side.",
    ],
  },
};

function getCharacterKey(characterName: string) {
  const lowerName = characterName.trim().toLowerCase();

  if (lowerName === "ivy") {
    return "ivy";
  }

  if (lowerName === "sienna") {
    return "sienna";
  }

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

export function getFreeImageReply(params: FreeImageReplyParams) {
  const characterKey = getCharacterKey(params.characterName);
  const replies = FREE_IMAGE_REPLIES[characterKey][params.kind];

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