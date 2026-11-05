import {Firestore} from "firebase-admin/firestore";
import {Season} from "../../domain/model/models";
import {Clock, MatchRepository} from "../../domain/repository/contracts";
import {Matchmaker} from "./matchmaker";
import {MatchBaseline} from "./matchBaseline";
import {MatchRecovery} from "./matchRecovery";

export class FirebaseMatchRepository implements MatchRepository {
  private readonly matchmaker: Matchmaker;
  private readonly baseline: MatchBaseline;
  private readonly recovery: MatchRecovery;

  constructor(private db: Firestore, clock: Clock) {
    this.matchmaker = new Matchmaker(db, clock);
    this.baseline = new MatchBaseline(db, clock);
    this.recovery = new MatchRecovery(db);
  }

  async match(id: string, season: Season): Promise<void> {
    try {
      if (!await this.matchmaker.pairCandidates(id, season)) await this.baseline.resolve(id, season);
    } catch (error) {
      await this.db.runTransaction(async (tx) => {
        const ref = this.db.doc(`submissions/${id}`), game = await tx.get(ref);
        if (game.get("matchStatus") === "PENDING") tx.update(ref, {matchError: "The game ranking could not be updated"});
      });
      throw error;
    }
  }

  async recover(season: Season): Promise<void> {
    await this.recovery.recoverExpired(season);
    await this.recovery.retryPending(season, (id, currentSeason) => this.match(id, currentSeason));
  }
}
