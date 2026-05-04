// lib/activityState.ts
export type ActivityType =
  | "gym"
  | "dog_walk"
  | "work"
  | "sleep"
  | "driving"
  | "busy";

export type ActivityState = {
  active: boolean;
  type: ActivityType | null;
  startedAt: number | null;
  sourceText: string | null;
};

const START_PATTERNS: Array<{ type: ActivityType; patterns: RegExp[] }> = [
  {
    type: "gym",
    patterns: [
      /\bgoing (to )?(the )?gym\b/i,
      /\boff to (the )?gym\b/i,
      /\bheaded to (the )?gym\b/i,
      /\bat the gym\b/i,
      /\bgym now\b/i,
      /\bgonna hit (the )?gym\b/i,
    ],
  },
  {
    type: "dog_walk",
    patterns: [
      /\btaking (my|the) dog out\b/i,
      /\bwalking (my|the) dog\b/i,
      /\bdog walk\b/i,
      /\bout with (my|the) dog\b/i,
    ],
  },
  {
    type: "work",
    patterns: [
      /\bgoing to work\b/i,
      /\boff to work\b/i,
      /\bat work\b/i,
      /\bstarting work\b/i,
      /\bback to work\b/i,
    ],
  },
  {
    type: "sleep",
    patterns: [
      /\bgoing to bed\b/i,
      /\boff to bed\b/i,
      /\bgoing sleep\b/i,
      /\bgonna sleep\b/i,
      /\btrying to sleep\b/i,
      /\bheading to bed\b/i,
    ],
  },
  {
    type: "driving",
    patterns: [
      /\bdriving\b/i,
      /\bon my way\b/i,
      /\bin the car\b/i,
      /\babout to drive\b/i,
    ],
  },
  {
    type: "busy",
    patterns: [
      /\bbusy\b/i,
      /\bgot stuff to do\b/i,
      /\bgot things to do\b/i,
      /\bgotta go\b/i,
      /\bbe right back\b/i,
      /\bbrb\b/i,
    ],
  },
];

const END_PATTERNS = [
  /\bi'm back\b/i,
  /\bim back\b/i,
  /\bback now\b/i,
  /\bjust got back\b/i,
  /\bdone now\b/i,
  /\bfinished now\b/i,
  /\bhome now\b/i,
  /\bout now\b/i,
  /\bfinished\b/i,
];

export function getEmptyActivityState(): ActivityState {
  return {
    active: false,
    type: null,
    startedAt: null,
    sourceText: null,
  };
}

export function detectStartedActivity(message: string): ActivityType | null {
  for (const entry of START_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(message))) {
      return entry.type;
    }
  }

  return null;
}

export function detectEndedActivity(message: string): boolean {
  return END_PATTERNS.some((pattern) => pattern.test(message));
}

export function updateActivityState(
  previous: ActivityState,
  message: string,
  now = Date.now()
): ActivityState {
  const trimmed = message.trim();

  if (!trimmed) {
    return previous;
  }

  if (detectEndedActivity(trimmed)) {
    return getEmptyActivityState();
  }

  const startedActivity = detectStartedActivity(trimmed);

  if (startedActivity) {
    return {
      active: true,
      type: startedActivity,
      startedAt: now,
      sourceText: trimmed,
    };
  }

  return previous;
}

export function getActivityAgeMinutes(state: ActivityState, now = Date.now()) {
  if (!state.active || !state.startedAt) {
    return 0;
  }

  return Math.max(0, Math.floor((now - state.startedAt) / 60000));
}

export function getActivityPromptLine(state: ActivityState, now = Date.now()) {
  if (!state.active || !state.type || !state.startedAt) {
    return "The user has no currently active short-term activity state.";
  }

  const minutes = getActivityAgeMinutes(state, now);

  return `The user is currently in an active short-term state: ${state.type}. It started about ${minutes} minute(s) ago. Do not act like it is already finished unless the user clearly says they are back or done.`;
}