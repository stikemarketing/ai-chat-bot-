// lib/relationshipMemory.ts

export type RelationshipMemory = {
  preferredName: string | null;
  job: string | null;
  car: string | null;
  favouriteFilms: string[];
  favouriteFoods: string[];
  favouriteDrinks: string[];
  favouriteMusic: string[];
  hobbies: string[];
  pets: string[];
  relationshipNicknames: {
    userNickname: string | null;
    lunaNickname: string | null;
  };
  spicyNicknames: {
    userNickname: string | null;
    lunaNickname: string | null;
  };
  importantPreferences: string[];
  todaySummary: {
    date: string | null;
    summary: string | null;
  };
  updatedAt?: unknown;
};

export type MemoryRecentMessage = {
  role: "user" | "assistant";
  text: string;
};

type MemoryAnswerContext =
  | "preferred_name"
  | "job"
  | "car"
  | "favourite_film"
  | "favourite_food"
  | "favourite_drink"
  | "favourite_music"
  | "hobby"
  | "pet"
  | "relationship_nickname"
  | "user_spicy_nickname"
  | "luna_spicy_nickname"
  | null;

export const EMPTY_RELATIONSHIP_MEMORY: RelationshipMemory = {
  preferredName: null,
  job: null,
  car: null,
  favouriteFilms: [],
  favouriteFoods: [],
  favouriteDrinks: [],
  favouriteMusic: [],
  hobbies: [],
  pets: [],
  relationshipNicknames: {
    userNickname: null,
    lunaNickname: null,
  },
  spicyNicknames: {
    userNickname: null,
    lunaNickname: null,
  },
  importantPreferences: [],
  todaySummary: {
    date: null,
    summary: null,
  },
};

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned || null;
}

function cleanExtractedValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const cleaned = value
    .trim()
    .replace(/^[:"'\s]+/g, "")
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return null;
  }

  return cleaned.slice(0, 80);
}

function cleanContextAnswer(value: string) {
  const cleaned = cleanExtractedValue(value);

  if (!cleaned) {
    return null;
  }

  const lowerValue = cleaned.toLowerCase();

  const blockedAnswers = [
    "yes",
    "yeah",
    "yep",
    "no",
    "nope",
    "maybe",
    "i don't know",
    "i dont know",
    "not sure",
    "nothing",
    "none",
    "you",
    "me",
    "lol",
    "haha",
  ];

  if (blockedAnswers.includes(lowerValue)) {
    return null;
  }

  if (cleaned.length < 2) {
    return null;
  }

  return cleaned;
}

function cleanStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function addUniqueValue(values: string[], nextValue: string | null) {
  if (!nextValue) {
    return values;
  }

  const alreadyExists = values.some(
    (value) => value.toLowerCase() === nextValue.toLowerCase()
  );

  if (alreadyExists) {
    return values;
  }

  return [...values, nextValue].slice(-20);
}

function matchFirst(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = cleanExtractedValue(match?.[1]);

    if (value) {
      return value;
    }
  }

  return null;
}

function normaliseText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getLastAssistantMessage(
  recentMessages: MemoryRecentMessage[] | undefined
) {
  const safeMessages = recentMessages ?? [];

  for (let index = safeMessages.length - 1; index >= 0; index -= 1) {
    const message = safeMessages[index];

    if (
      message.role === "assistant" &&
      typeof message.text === "string" &&
      message.text.trim()
    ) {
      return message.text.trim();
    }
  }

  return "";
}

function getAnswerContextFromAssistantQuestion(
  recentMessages: MemoryRecentMessage[] | undefined
): MemoryAnswerContext {
  const lastAssistantMessage = normaliseText(
    getLastAssistantMessage(recentMessages)
  );

  if (!lastAssistantMessage) {
    return null;
  }

  const isAboutUser =
    lastAssistantMessage.includes("your") ||
    lastAssistantMessage.includes("you ") ||
    lastAssistantMessage.includes("do you") ||
    lastAssistantMessage.includes("are you") ||
    lastAssistantMessage.includes("should i call you") ||
    lastAssistantMessage.includes("can i call you");

  const isAboutLuna =
    lastAssistantMessage.includes("my favourite") ||
    lastAssistantMessage.includes("my favorite") ||
    lastAssistantMessage.includes("my dirty name") ||
    lastAssistantMessage.includes("my naughty name") ||
    lastAssistantMessage.includes("my spicy name") ||
    lastAssistantMessage.includes("what should you call me");

  if (isAboutLuna && !lastAssistantMessage.includes("your dirty name")) {
    return null;
  }

  if (
    isAboutUser &&
    (lastAssistantMessage.includes("favourite film") ||
      lastAssistantMessage.includes("favorite film") ||
      lastAssistantMessage.includes("favourite movie") ||
      lastAssistantMessage.includes("favorite movie") ||
      lastAssistantMessage.includes("film do you like") ||
      lastAssistantMessage.includes("movie do you like") ||
      lastAssistantMessage.includes("go to movie") ||
      lastAssistantMessage.includes("go to film"))
  ) {
    return "favourite_film";
  }

  if (
    isAboutUser &&
    (lastAssistantMessage.includes("job") ||
      lastAssistantMessage.includes("work") ||
      lastAssistantMessage.includes("do for a living") ||
      lastAssistantMessage.includes("what do you do"))
  ) {
    return "job";
  }

  if (
    isAboutUser &&
    (lastAssistantMessage.includes("car do you drive") ||
      lastAssistantMessage.includes("what do you drive") ||
      lastAssistantMessage.includes("your car") ||
      lastAssistantMessage.includes("drive"))
  ) {
    return "car";
  }

  if (
    isAboutUser &&
    (lastAssistantMessage.includes("favourite food") ||
      lastAssistantMessage.includes("favorite food") ||
      lastAssistantMessage.includes("favourite meal") ||
      lastAssistantMessage.includes("favorite meal") ||
      lastAssistantMessage.includes("food do you like") ||
      lastAssistantMessage.includes("like eating"))
  ) {
    return "favourite_food";
  }

  if (
    isAboutUser &&
    (lastAssistantMessage.includes("favourite drink") ||
      lastAssistantMessage.includes("favorite drink") ||
      lastAssistantMessage.includes("drink do you like") ||
      lastAssistantMessage.includes("like drinking"))
  ) {
    return "favourite_drink";
  }

  if (
    isAboutUser &&
    (lastAssistantMessage.includes("favourite music") ||
      lastAssistantMessage.includes("favorite music") ||
      lastAssistantMessage.includes("music do you like") ||
      lastAssistantMessage.includes("listen to"))
  ) {
    return "favourite_music";
  }

  if (
    isAboutUser &&
    (lastAssistantMessage.includes("hobby") ||
      lastAssistantMessage.includes("hobbies") ||
      lastAssistantMessage.includes("like doing") ||
      lastAssistantMessage.includes("do for fun"))
  ) {
    return "hobby";
  }

  if (
    isAboutUser &&
    (lastAssistantMessage.includes("pet") ||
      lastAssistantMessage.includes("dog") ||
      lastAssistantMessage.includes("cat"))
  ) {
    return "pet";
  }

  if (
    isAboutUser &&
    (lastAssistantMessage.includes("what should i call you") ||
      lastAssistantMessage.includes("what can i call you") ||
      lastAssistantMessage.includes("nickname") ||
      lastAssistantMessage.includes("pet name"))
  ) {
    return "relationship_nickname";
  }

  if (
    isAboutUser &&
    (lastAssistantMessage.includes("your dirty name") ||
      lastAssistantMessage.includes("your naughty name") ||
      lastAssistantMessage.includes("your spicy name") ||
      lastAssistantMessage.includes("dirty nickname") ||
      lastAssistantMessage.includes("naughty nickname") ||
      lastAssistantMessage.includes("spicy nickname"))
  ) {
    return "user_spicy_nickname";
  }

  if (
    lastAssistantMessage.includes("what should you call me") ||
    lastAssistantMessage.includes("what will you call me") ||
    lastAssistantMessage.includes("my dirty name") ||
    lastAssistantMessage.includes("my naughty name") ||
    lastAssistantMessage.includes("my spicy name")
  ) {
    return "luna_spicy_nickname";
  }

  return null;
}

export function normalizeRelationshipMemory(
  value: unknown
): RelationshipMemory {
  if (!value || typeof value !== "object") {
    return EMPTY_RELATIONSHIP_MEMORY;
  }

  const raw = value as Partial<RelationshipMemory>;

  return {
    preferredName: cleanString(raw.preferredName),
    job: cleanString(raw.job),
    car: cleanString(raw.car),
    favouriteFilms: cleanStringArray(raw.favouriteFilms),
    favouriteFoods: cleanStringArray(raw.favouriteFoods),
    favouriteDrinks: cleanStringArray(raw.favouriteDrinks),
    favouriteMusic: cleanStringArray(raw.favouriteMusic),
    hobbies: cleanStringArray(raw.hobbies),
    pets: cleanStringArray(raw.pets),
    relationshipNicknames: {
      userNickname: cleanString(raw.relationshipNicknames?.userNickname),
      lunaNickname: cleanString(raw.relationshipNicknames?.lunaNickname),
    },
    spicyNicknames: {
      userNickname: cleanString(raw.spicyNicknames?.userNickname),
      lunaNickname: cleanString(raw.spicyNicknames?.lunaNickname),
    },
    importantPreferences: cleanStringArray(raw.importantPreferences),
    todaySummary: {
      date: cleanString(raw.todaySummary?.date),
      summary: cleanString(raw.todaySummary?.summary),
    },
    updatedAt: raw.updatedAt,
  };
}

export function extractRelationshipMemoryFromUserMessage(params: {
  existingMemory: unknown;
  userMessage: string;
  currentDate: string;
  recentMessages?: MemoryRecentMessage[];
}) {
  const existingMemory = normalizeRelationshipMemory(params.existingMemory);
  const userMessage = params.userMessage.trim();

  if (!userMessage) {
    return existingMemory;
  }

  const lowerMessage = userMessage.toLowerCase();
  const answerContext = getAnswerContextFromAssistantQuestion(
    params.recentMessages
  );
  const contextAnswer = cleanContextAnswer(userMessage);

  const preferredName = matchFirst(userMessage, [
    /\bcall me\s+(.+)$/i,
    /\bmy name is\s+(.+)$/i,
    /\byou can call me\s+(.+)$/i,
    /\bi like being called\s+(.+)$/i,
  ]);

  const job = matchFirst(userMessage, [
    /\bmy job is\s+(.+)$/i,
    /\bi am a\s+(.+)$/i,
    /\bi'm a\s+(.+)$/i,
    /\bi work as a\s+(.+)$/i,
    /\bi work in\s+(.+)$/i,
    /\bfor work i am a\s+(.+)$/i,
    /\bfor work i'm a\s+(.+)$/i,
  ]);

  const car = matchFirst(userMessage, [
    /\bmy car is\s+(.+)$/i,
    /\bi drive a\s+(.+)$/i,
    /\bi drive an\s+(.+)$/i,
    /\bi've got a\s+(.+)$/i,
    /\bive got a\s+(.+)$/i,
    /\bmy motor is\s+(.+)$/i,
  ]);

  const favouriteFilm = matchFirst(userMessage, [
    /\bmy favourite film is\s+(.+)$/i,
    /\bmy favorite film is\s+(.+)$/i,
    /\bmy favourite movie is\s+(.+)$/i,
    /\bmy favorite movie is\s+(.+)$/i,
    /\bmy favourite film\s+(.+)$/i,
    /\bmy favorite film\s+(.+)$/i,
    /\bmy favourite movie\s+(.+)$/i,
    /\bmy favorite movie\s+(.+)$/i,
    /\bmy best film ever is\s+(.+)$/i,
    /\bbest film ever is\s+(.+)$/i,
    /\bbest movie ever is\s+(.+)$/i,
    /\bi love the film\s+(.+)$/i,
    /\bi love the movie\s+(.+)$/i,
    /\bi love\s+(.+)\s+the film\b/i,
    /\bi love\s+(.+)\s+the movie\b/i,
    /\bi'm going to watch my favourite film\s+(.+)$/i,
    /\bim going to watch my favourite film\s+(.+)$/i,
    /\bi am going to watch my favourite film\s+(.+)$/i,
    /\bi'm watching my favourite film\s+(.+)$/i,
    /\bim watching my favourite film\s+(.+)$/i,
  ]);

  const favouriteFood = matchFirst(userMessage, [
    /\bmy favourite food is\s+(.+)$/i,
    /\bmy favorite food is\s+(.+)$/i,
    /\bmy favourite meal is\s+(.+)$/i,
    /\bmy favorite meal is\s+(.+)$/i,
    /\bmy favourite food\s+(.+)$/i,
    /\bmy favorite food\s+(.+)$/i,
    /\bmy favourite meal\s+(.+)$/i,
    /\bmy favorite meal\s+(.+)$/i,
    /\bbest food ever is\s+(.+)$/i,
    /\bbest meal ever is\s+(.+)$/i,
    /\bi love eating\s+(.+)$/i,
    /\bi love\s+(.+)\s+for dinner\b/i,
  ]);

  const favouriteDrink = matchFirst(userMessage, [
    /\bmy favourite drink is\s+(.+)$/i,
    /\bmy favorite drink is\s+(.+)$/i,
    /\bmy favourite drink\s+(.+)$/i,
    /\bmy favorite drink\s+(.+)$/i,
    /\bbest drink ever is\s+(.+)$/i,
    /\bi love drinking\s+(.+)$/i,
  ]);

  const favouriteMusic = matchFirst(userMessage, [
    /\bmy favourite music is\s+(.+)$/i,
    /\bmy favorite music is\s+(.+)$/i,
    /\bmy favourite song is\s+(.+)$/i,
    /\bmy favorite song is\s+(.+)$/i,
    /\bmy favourite band is\s+(.+)$/i,
    /\bmy favorite band is\s+(.+)$/i,
    /\bi like listening to\s+(.+)$/i,
    /\bi love listening to\s+(.+)$/i,
  ]);

  const hobby = matchFirst(userMessage, [
    /\bmy hobby is\s+(.+)$/i,
    /\bmy hobbies are\s+(.+)$/i,
    /\bi like doing\s+(.+)$/i,
    /\bi love doing\s+(.+)$/i,
    /\bfor fun i like\s+(.+)$/i,
    /\bin my spare time i like\s+(.+)$/i,
  ]);

  const pet = matchFirst(userMessage, [
    /\bmy pet is\s+(.+)$/i,
    /\bmy dog is called\s+(.+)$/i,
    /\bmy cat is called\s+(.+)$/i,
    /\bi have a dog called\s+(.+)$/i,
    /\bi have a cat called\s+(.+)$/i,
  ]);

  const userSpicyNickname = matchFirst(userMessage, [
    /\bmy dirty name is\s+(.+)$/i,
    /\bmy naughty name is\s+(.+)$/i,
    /\bmy spicy name is\s+(.+)$/i,
    /\bmy dirty nickname is\s+(.+)$/i,
    /\bmy naughty nickname is\s+(.+)$/i,
    /\bmy spicy nickname is\s+(.+)$/i,
    /\bcall me\s+(.+)\s+when we talk dirty\b/i,
    /\bcall me\s+(.+)\s+when we're dirty\b/i,
    /\bcall me\s+(.+)\s+when we are dirty\b/i,
  ]);

  const lunaSpicyNickname = matchFirst(userMessage, [
    /\byour dirty name is\s+(.+)$/i,
    /\byour naughty name is\s+(.+)$/i,
    /\byour spicy name is\s+(.+)$/i,
    /\byour dirty nickname is\s+(.+)$/i,
    /\byour naughty nickname is\s+(.+)$/i,
    /\byour spicy nickname is\s+(.+)$/i,
    /\bi will call you\s+(.+)\s+when we talk dirty\b/i,
    /\bi'll call you\s+(.+)\s+when we talk dirty\b/i,
    /\bi will call you\s+(.+)\s+when we're dirty\b/i,
    /\bi'll call you\s+(.+)\s+when we're dirty\b/i,
  ]);

  const contextPreferredName =
    answerContext === "preferred_name" ||
    answerContext === "relationship_nickname"
      ? contextAnswer
      : null;

  const contextJob = answerContext === "job" ? contextAnswer : null;
  const contextCar = answerContext === "car" ? contextAnswer : null;
  const contextFavouriteFilm =
    answerContext === "favourite_film" ? contextAnswer : null;
  const contextFavouriteFood =
    answerContext === "favourite_food" ? contextAnswer : null;
  const contextFavouriteDrink =
    answerContext === "favourite_drink" ? contextAnswer : null;
  const contextFavouriteMusic =
    answerContext === "favourite_music" ? contextAnswer : null;
  const contextHobby = answerContext === "hobby" ? contextAnswer : null;
  const contextPet = answerContext === "pet" ? contextAnswer : null;
  const contextUserSpicyNickname =
    answerContext === "user_spicy_nickname" ? contextAnswer : null;
  const contextLunaSpicyNickname =
    answerContext === "luna_spicy_nickname" ? contextAnswer : null;

  const finalPreferredName =
    preferredName && !userSpicyNickname
      ? preferredName
      : contextPreferredName;

  const userRelationshipNickname =
    !lowerMessage.includes("dirty") &&
    !lowerMessage.includes("naughty") &&
    !lowerMessage.includes("spicy")
      ? finalPreferredName
      : null;

  const nextMemory: RelationshipMemory = {
    ...existingMemory,
    preferredName: finalPreferredName || existingMemory.preferredName,
    job: job || contextJob || existingMemory.job,
    car: car || contextCar || existingMemory.car,
    favouriteFilms: addUniqueValue(
      existingMemory.favouriteFilms,
      favouriteFilm || contextFavouriteFilm
    ),
    favouriteFoods: addUniqueValue(
      existingMemory.favouriteFoods,
      favouriteFood || contextFavouriteFood
    ),
    favouriteDrinks: addUniqueValue(
      existingMemory.favouriteDrinks,
      favouriteDrink || contextFavouriteDrink
    ),
    favouriteMusic: addUniqueValue(
      existingMemory.favouriteMusic,
      favouriteMusic || contextFavouriteMusic
    ),
    hobbies: addUniqueValue(existingMemory.hobbies, hobby || contextHobby),
    pets: addUniqueValue(existingMemory.pets, pet || contextPet),
    relationshipNicknames: {
      userNickname:
        userRelationshipNickname ||
        existingMemory.relationshipNicknames.userNickname,
      lunaNickname: existingMemory.relationshipNicknames.lunaNickname,
    },
    spicyNicknames: {
      userNickname:
        userSpicyNickname ||
        contextUserSpicyNickname ||
        existingMemory.spicyNicknames.userNickname,
      lunaNickname:
        lunaSpicyNickname ||
        contextLunaSpicyNickname ||
        existingMemory.spicyNicknames.lunaNickname,
    },
    importantPreferences: existingMemory.importantPreferences,
    todaySummary: {
      date: existingMemory.todaySummary.date || params.currentDate,
      summary: existingMemory.todaySummary.summary,
    },
    updatedAt: existingMemory.updatedAt,
  };

  return nextMemory;
}

function formatList(label: string, values: string[]) {
  if (values.length === 0) {
    return null;
  }

  return `${label}: ${values.join(", ")}.`;
}

export function buildRelationshipMemoryPromptLine(
  memoryInput: unknown
): string {
  const memory = normalizeRelationshipMemory(memoryInput);

  const lines = [
    memory.preferredName
      ? `The user likes being called ${memory.preferredName}.`
      : null,
    memory.job ? `The user's job/work is ${memory.job}.` : null,
    memory.car ? `The user's car is ${memory.car}.` : null,
    formatList("The user's favourite films", memory.favouriteFilms),
    formatList("The user's favourite foods", memory.favouriteFoods),
    formatList("The user's favourite drinks", memory.favouriteDrinks),
    formatList("The user's music taste", memory.favouriteMusic),
    formatList("The user's hobbies", memory.hobbies),
    formatList("The user's pets", memory.pets),
    memory.relationshipNicknames.userNickname
      ? `The user's relationship nickname is ${memory.relationshipNicknames.userNickname}.`
      : null,
    memory.relationshipNicknames.lunaNickname
      ? `Luna's relationship nickname is ${memory.relationshipNicknames.lunaNickname}.`
      : null,
    memory.spicyNicknames.userNickname
      ? `The user's playful spicy nickname is ${memory.spicyNicknames.userNickname}.`
      : null,
    memory.spicyNicknames.lunaNickname
      ? `Luna's playful spicy nickname is ${memory.spicyNicknames.lunaNickname}.`
      : null,
    formatList("Important user preferences", memory.importantPreferences),
    memory.todaySummary.summary
      ? `Today so far: ${memory.todaySummary.summary}`
      : null,
  ].filter(Boolean);

  if (lines.length === 0) {
    return "Relationship memory: No saved relationship memory yet.";
  }

  return ["Relationship memory:", ...lines].join("\n");
}