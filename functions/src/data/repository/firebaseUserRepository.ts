import {Firestore} from "firebase-admin/firestore";
import {DomainError, Season, User} from "../../domain/model/models";
import {Clock, UserRepository} from "../../domain/repository/contracts";
import {INITIAL_MERIT, league} from "../../domain/policy/gamePolicy";
import {mapUser} from "../dto/userDto";
import {writeCurrentUser, writeMember} from "./seasonWrites";
import {seasonAt} from "../../domain/policy/seasonPolicy";
import {validateUserName} from "../../domain/policy/userPolicy";
import {createHash} from "node:crypto";
export class FirebaseUserRepository implements UserRepository {
  constructor(private db: Firestore, private clock: Clock) {}
  async assertOpen(id: string): Promise<void> {
    if ((await this.db.doc(`users/${id}`).get()).get("accountClosed") === true) throw new DomainError("permission-denied", "Esta cuenta está cerrada.");
  }
  async initialize(id: string, name: string, email: string | null, season: Season): Promise<User> {
    return this.db.runTransaction(async (tx) => {
      season = seasonAt(this.clock.now());
      const ref = this.db.doc(`users/${id}`);
      const snapshot = await tx.get(ref);
      if (snapshot.get("accountClosed") === true) throw new DomainError("permission-denied", "Esta cuenta está cerrada.");
      if (!snapshot.exists) {
        const user = {id, name: name || "Writer", username: null, email, merit: INITIAL_MERIT, rating: 0, seasonIndex: season.index};
        tx.create(ref, {...user, league: 1});
        tx.set(this.db.doc(`seasons/${season.id}`), season, {merge: true});
        writeMember(this.db, tx, user);
        return user;
      }
      const user = writeCurrentUser(this.db, tx, mapUser(id, snapshot.data()!), season);
      tx.update(ref, {league: league(user.rating)});
      writeMember(this.db, tx, user);
      return user;
    });
  }
  async updateName(id: string, name: string): Promise<void> {
    name = validateUserName(name);
    await this.db.runTransaction(async (tx) => {
      const key = createHash("sha256").update(name.normalize("NFKC").toLowerCase()).digest("hex");
      const ref = this.db.doc(`users/${id}`), claimRef = this.db.doc(`usernames/${key}`);
      const [snapshot, claim] = await tx.getAll(ref, claimRef);
      if (!snapshot.exists || snapshot.get("accountClosed") === true) throw new DomainError("permission-denied", "Perfil no disponible.");
      if (claim.exists && claim.get("userId") !== id) throw new DomainError("failed-precondition", `Username ${name} is already in use`);
      const previous = snapshot.get("username");
      if (previous && previous !== name) throw new DomainError("failed-precondition", "Tu username está asociado permanentemente a tu cuenta.");
      const user = {...mapUser(id, snapshot.data()!), name, username: name};
      tx.set(claimRef, {userId: id, username: name});
      tx.update(ref, {name, username: name, league: league(user.rating)});
      if (user.seasonIndex !== Number.MIN_SAFE_INTEGER) writeMember(this.db, tx, user);
    });
  }
}
