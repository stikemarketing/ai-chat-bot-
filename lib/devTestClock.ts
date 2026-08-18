// lib/devTestClock.ts

function getConfiguredTestNow() {
  const rawValue =
    process.env.NEXT_PUBLIC_DEV_TEST_NOW?.trim() ||
    process.env.DEV_TEST_NOW?.trim() ||
    "";

  if (!rawValue) {
    return null;
  }

  const parsedDate = new Date(rawValue);

  if (Number.isNaN(parsedDate.getTime())) {
    console.warn(
      `Ignoring invalid development test date "${rawValue}". Falling back to real time.`
    );
    return null;
  }

  return parsedDate;
}

export function getAppNow() {
  // Production must always use the real clock.
  if (process.env.NODE_ENV === "production") {
    return new Date();
  }

  return getConfiguredTestNow() || new Date();
}

export function isDevTestClockActive() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return getConfiguredTestNow() !== null;
}
