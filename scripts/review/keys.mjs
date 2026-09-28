/** The external key the source loader gives a pack question. Must match scripts/build-sources.mjs. */
export function packQuestionKey(sourceKey, item) {
  return `${sourceKey}#${item.number}${item.part ? item.part.replace(/[^a-z0-9ivx]/gi, "") : ""}`;
}
