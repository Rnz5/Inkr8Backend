import {FieldValue, Firestore} from "firebase-admin/firestore";
import {Challenge, DomainError, Evaluation, Game, PlayMode, Season, WritingMode} from "../../domain/model/models";
import {Clock, GameRepository} from "../../domain/repository/contracts";
import {league, meritReward, RANKED_COST, validateWriting, wordCount} from "../../domain/policy/gamePolicy";
import {acceptsRating, seasonAt} from "../../domain/policy/seasonPolicy";
import {mapUser} from "../dto/userDto";
import {mapGame} from "../mapper/gameMapper";
import {writeCurrentUser, writeMember} from "./seasonWrites";
import {TIMEOUT_MESSAGE} from "../../domain/policy/evaluationPolicy";
export class FirebaseGameRepository implements GameRepository {
  constructor(private db: Firestore, private clock: Clock) {}
  async start(id: string, userId: string, mode: PlayMode, writingMode: WritingMode, challenge: Challenge, season: Season, now: number): Promise<Game> {
    return this.db.runTransaction(async (tx) => {
      season = seasonAt(this.clock.now());
      const ref = this.db.doc(`submissions/${id}`), userRef = this.db.doc(`users/${userId}`);
      const [existing, snapshot] = await tx.getAll(ref, userRef);
      if (!snapshot.exists || snapshot.get("accountClosed") === true) throw new DomainError("permission-denied", "Perfil no disponible.");
      if (existing.exists) {
        const game = mapGame(existing);
        if (game.authorId !== userId || game.mode !== mode || game.writingMode !== writingMode) throw new DomainError("permission-denied", "El ID pertenece a otra partida.");
        return game;
      }
      const user = mapUser(userId, snapshot.data()!);
      const cost = mode === "RANKED" ? RANKED_COST : 0;
      if (user.merit < cost) throw new DomainError("failed-precondition", "The ranked match cannot be started. Insufficient Merit");
      const normalized = writeCurrentUser(this.db, tx, user, season);
      const game: Game = {id, authorId: userId, mode, writingMode, challenge, status: "DRAFT", content: "", seasonIndex: season.index, timestamp: now};
      tx.create(ref, {...game, seasonId: season.id, entryCost: cost, schemaVersion: 2});
      tx.update(userRef, {merit: user.merit - cost, league: league(normalized.rating)});
      writeMember(this.db, tx, normalized);
      return game;
    });
  }
  async submit(id: string, userId: string, content: string): Promise<void> {
    await this.db.runTransaction(async (tx) => {
      const ref = this.db.doc(`submissions/${id}`);
      const [snapshot, user] = await tx.getAll(ref, this.db.doc(`users/${userId}`));
      const game = mapGame(snapshot);
      if (game.authorId !== userId || user.get("accountClosed") === true) throw new DomainError("permission-denied", "Partida no disponible.");
      if (game.status !== "DRAFT") {
        if (game.content === content) return;
        throw new DomainError("failed-precondition", "La partida ya fue enviada.");
      }
      validateWriting(content, game.writingMode);
      tx.update(ref, {content, status: "PENDING", wordCount: wordCount(content), submittedAt: this.clock.now(), pendingAt: this.clock.now()});
    });
  }
  async retry(id: string, userId: string): Promise<void> {
    await this.db.runTransaction(async (tx) => {
      const ref = this.db.doc(`submissions/${id}`), snapshot = await tx.get(ref), game = mapGame(snapshot);
      if (game.authorId !== userId) throw new DomainError("permission-denied", "Partida no disponible.");
      if (game.status === "FAILED") tx.update(ref, {status: "PENDING", error: null, nextRetryAt: null, pendingAt: this.clock.now()});
    });
  }
  async get(id: string): Promise<Game> { return mapGame(await this.db.doc(`submissions/${id}`).get()); }
  async complete(game: Game, evaluation: Evaluation, season: Season): Promise<void> {
    await this.db.runTransaction(async (tx) => {
      season = seasonAt(this.clock.now());
      const ref = this.db.doc(`submissions/${game.id}`), userRef = this.db.doc(`users/${game.authorId}`);
      const [snapshot, userSnapshot] = await tx.getAll(ref, userRef);
      if (snapshot.get("status") !== "PENDING") return;
      if (!userSnapshot.exists || userSnapshot.get("accountClosed") === true) { tx.update(ref, {status: "FAILED", error: "Perfil no disponible."}); return; }
      const user = writeCurrentUser(this.db, tx, mapUser(game.authorId, userSnapshot.data()!), season);
      const reward = meritReward(evaluation.score, wordCount(game.content), game.mode === "RANKED");
      tx.update(userRef, {merit: user.merit + reward});
      tx.update(ref, {status: "EVALUATED", evaluation: {...evaluation, meritEarned: reward},
        queuedAt: Number(snapshot.get("submittedAt") ?? this.clock.now()), nextRetryAt: null,
        matchStatus: game.mode === "RANKED" ? (acceptsRating(game.seasonIndex, season.index) ? "PENDING" : "EXPIRED") : "NONE", error: null});
      writeMember(this.db, tx, user);
      if (game.mode === "RANKED") tx.set(this.db.doc(`seasons/s${game.seasonIndex}/members/${game.authorId}`), {meritEarned: FieldValue.increment(reward)}, {merge: true});
    });
  }
  async fail(id: string, message: string): Promise<void> {
    await this.db.runTransaction(async (tx) => {
      const ref = this.db.doc(`submissions/${id}`), snapshot = await tx.get(ref);
      if (snapshot.get("status") === "PENDING") tx.update(ref, {status: "FAILED", error: message});
    });
  }
  async defer(id: string): Promise<void> {
    await this.db.runTransaction(async (tx) => {
      const ref = this.db.doc(`submissions/${id}`), snapshot = await tx.get(ref);
      if (snapshot.get("status") === "PENDING") tx.update(ref, {
        status: "FAILED", error: TIMEOUT_MESSAGE, nextRetryAt: this.clock.now() + 5 * 60000,
      });
    });
  }
  async recoverEvaluations(): Promise<void> {
    const now = this.clock.now();
    const [deferred, interrupted] = await Promise.all([
      this.db.collection("submissions").where("status", "==", "FAILED").where("nextRetryAt", ">", 0).where("nextRetryAt", "<=", now).limit(100).get(),
      this.db.collection("submissions").where("status", "==", "PENDING").where("pendingAt", "<=", now - 10 * 60000).limit(100).get(),
    ]);
    for (const doc of interrupted.docs) await this.defer(doc.id);
    for (const doc of deferred.docs) await this.db.runTransaction(async (tx) => {
      const fresh = await tx.get(doc.ref);
      if (fresh.get("status") === "FAILED" && fresh.get("nextRetryAt") > 0 && fresh.get("nextRetryAt") <= now) {
        tx.update(doc.ref, {status: "PENDING", nextRetryAt: null, pendingAt: now, error: null});
      }
    });
  }
}
