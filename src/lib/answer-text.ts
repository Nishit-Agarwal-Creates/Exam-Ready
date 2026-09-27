const squash = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
/** False when the model answer only restates the key (e.g. "2 × 1." after "(b) 2 × 1"). */
export function answerAddsInfo(keyLine: string, answer: string): boolean {
  if (!answer.trim()) return false;
  if (!keyLine) return true;
  return !squash(keyLine).includes(squash(answer));
}
