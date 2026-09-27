/** Attempt ids submitted on this device, newest first. Students don't need an account to find past results. */
const KEY = "er:history";

export function rememberAttempt(id: string) {
  try {
    const list = readHistory();
    localStorage.setItem(KEY, JSON.stringify([id, ...list.filter((x) => x !== id)].slice(0, 50)));
  } catch {
    /* storage blocked: history just isn't kept */
  }
}

export function readHistory(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function forgetAttempt(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(readHistory().filter((x) => x !== id)));
  } catch {
    /* ignore */
  }
}
