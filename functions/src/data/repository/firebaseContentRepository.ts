import {Firestore} from "firebase-admin/firestore";
import {Challenge, DomainError, Word, WritingMode} from "../../domain/model/models";
import {ContentRepository} from "../../domain/repository/contracts";
import {WORDS_PER_MODE} from "../../domain/policy/gamePolicy";
export class FirebaseContentRepository implements ContentRepository {
  constructor(private db: Firestore) {}
  private async words(): Promise<Word[]> {
    const docs = await this.db.collection("words").where("isActive", "==", true).orderBy("__name__").limit(500).get();
    return docs.docs.map((doc) => ({text: String(doc.get("word") ?? ""), definition: String(doc.get("definition") ?? ""), sentence: String(doc.get("sentence") ?? ""),
      phonetic: String(doc.get("phonetic") ?? ""), partOfSpeech: String(doc.get("partOfSpeech") ?? ""), rarity: String(doc.get("rarity") ?? "")})).filter((w) => w.text.trim());
  }
  async dailyWord(day: number): Promise<Word> {
    const ref = this.db.doc(`dailyWords/${day}`), saved = await ref.get();
    if (saved.exists && this.hasMetadata(saved.data() as Word)) return saved.data() as Word;
    const words = await this.words();
    if (!words.length) throw new DomainError("failed-precondition", "No hay palabras activas disponibles.");
    const word = saved.exists ? words.find((item) => item.text === saved.get("text")) : words[((day % words.length) + words.length) % words.length];
    if (!word || !this.hasMetadata(word)) throw new DomainError("failed-precondition", "La palabra del momento no tiene su información completa.");
    return this.db.runTransaction(async (tx) => {
      const current = await tx.get(ref);
      if (current.exists && this.hasMetadata(current.data() as Word)) return current.data() as Word;
      tx.set(ref, word); return word;
    });
  }
  private hasMetadata(word: Word): boolean {
    return [word.text, word.definition, word.phonetic, word.partOfSpeech, word.rarity].every((value) => typeof value === "string" && value.trim());
  }
  async challenge(mode: WritingMode): Promise<Challenge> {
    const words = await this.words(), count = WORDS_PER_MODE[mode];
    // Fisher-Yates keeps selection independent of unstable sort comparators.
    for (let i = words.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [words[i], words[j]] = [words[j], words[i]]; }
    if (words.length < count) throw new DomainError("failed-precondition", `Se necesitan ${count} palabras activas.`);
    if (mode === "STANDARD") return {words: words.slice(0, count), topic: null, theme: null};
    const topics = (await this.db.collection("topics").limit(100).get()).docs.filter((doc) => doc.get("isActive") !== false);
    if (!topics.length) throw new DomainError("failed-precondition", "No hay temas de escritura disponibles.");
    const topic = topics[Math.floor(Math.random() * topics.length)];
    const themeId = topic.get("themeId"), theme = typeof themeId === "string" && themeId ? await this.db.doc(`themes/${themeId}`).get() : null;
    const topicName = String(topic.get("name") ?? topic.get("title") ?? "").trim();
    if (!topicName) throw new DomainError("failed-precondition", "The game restrictions could not be loaded");
    return {words: words.slice(0, count), topic: topicName, theme: theme?.get("name") ?? null, advanced: ["FIRST_PERSON", "QUESTION"]};
  }
}
