export function joinTranscript(current: string, next: string) {
  const incoming = next.trim();
  if (!incoming) {
    return current;
  }

  if (!current.trim()) {
    return incoming;
  }

  const needsSpace = !current.endsWith(" ") && !incoming.startsWith(" ");
  return `${current}${needsSpace ? " " : ""}${incoming}`;
}

export function promptTail(text: string, maxChars = 200) {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  return trimmed.slice(-maxChars).replace(/^\S*\s/, "").trim();
}

function words(text: string) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function normalizeWord(word: string) {
  return word.replace(/[^\p{L}\p{N}']+/gu, "").toLowerCase();
}

export function agreeWindows(previous: string, next: string) {
  const prevWords = words(previous);
  const nextWords = words(next);

  if (prevWords.length === 0 || nextWords.length === 0) {
    return { commit: "", overlapWords: 0 };
  }

  const maxK = Math.min(prevWords.length, nextWords.length);
  let overlap = 0;

  for (let k = maxK; k >= 2; k--) {
    const prevSlice = prevWords.slice(-k);
    const nextSlice = nextWords.slice(0, k);
    if (prevSlice.every((word, index) => normalizeWord(word) === normalizeWord(nextSlice[index]))) {
      overlap = k;
      break;
    }
  }

  if (overlap < 2) {
    return { commit: "", overlapWords: 0 };
  }

  return {
    commit: prevWords.slice(0, prevWords.length - overlap).join(" "),
    overlapWords: overlap,
  };
}
