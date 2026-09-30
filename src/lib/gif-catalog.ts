export type CatalogGif = {
  name: string;
  url: string;
  tags: readonly string[];
};

// The animated files are bundled locally; provenance is in public/gifs/README.md.
export const sharedGifCatalog: readonly CatalogGif[] = [
  { name: "Gülümse", url: "/gifs/smile.gif", tags: ["mutlu", "gülümseme", "sevinç", "smile", "happy"] },
  { name: "Kalp gözler", url: "/gifs/love.gif", tags: ["aşk", "sevgi", "beğeni", "love", "heart eyes"] },
  { name: "Alkış", url: "/gifs/clap.gif", tags: ["tebrik", "bravo", "başarı", "clap", "applause"] },
  { name: "Beğendim", url: "/gifs/thumbs-up.gif", tags: ["onay", "evet", "tamam", "like", "thumbs up", "yes"] },
  { name: "Kalp", url: "/gifs/heart.gif", tags: ["aşk", "sevgi", "love", "heart"] },
  { name: "Kutlama", url: "/gifs/celebrate.gif", tags: ["tebrik", "parti", "konfeti", "celebrate", "party", "confetti"] },
  { name: "Ateş", url: "/gifs/fire.gif", tags: ["harika", "süper", "heyecan", "fire", "lit", "hot"] },
  { name: "Merhaba", url: "/gifs/wave.gif", tags: ["selam", "görüşürüz", "veda", "hello", "wave", "bye"] },
  { name: "Parıltı", url: "/gifs/sparkles.gif", tags: ["ışıltı", "yıldız", "harika", "sparkles", "magic"] },
  { name: "Gözler", url: "/gifs/eyes.gif", tags: ["bakış", "merak", "izliyorum", "eyes", "looking", "curious"] },
  { name: "Tamam", url: "/gifs/ok.gif", tags: ["onay", "anlaştık", "mükemmel", "ok", "okay", "perfect"] },
  { name: "Yüzde yüz", url: "/gifs/hundred.gif", tags: ["kesinlikle", "doğru", "başarı", "hundred", "100", "agree"] },
  { name: "Kalp eller", url: "/gifs/heart-hands.gif", tags: ["sevgi", "destek", "teşekkür", "heart hands", "love", "support"] },
  { name: "Teşekkürler", url: "/gifs/thanks.gif", tags: ["dua", "lütfen", "minnet", "thanks", "please", "pray"] },
];

export function normalizeGifSearch(value: string) {
  return value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/\p{M}/gu, "").replace(/ı/g, "i").trim();
}

export function gifMatchesQuery(item: { name: string; tags?: readonly string[] }, query: string) {
  const terms = normalizeGifSearch(query).split(/\s+/).filter(Boolean);
  const searchable = normalizeGifSearch([item.name, ...(item.tags ?? [])].join(" "));
  return terms.every(term => searchable.includes(term));
}
