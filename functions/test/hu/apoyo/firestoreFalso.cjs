// Firestore falso en memoria para las pruebas de exposición (HU 1.1–1.6).
// Implementa solo lo que usan los repositorios probados: doc().get(), collection().where().orderBy().limit().get(),
// runTransaction() con get/getAll/create/set/update. Las escrituras de la transacción se aplican al final,
// como en Firestore. No reemplaza a las pruebas con el emulador (npm run test:integration); sirve para
// ejecutar los caminos en segundos y sin Java durante la exposición.
const {createHash} = require('node:crypto');

class Snapshot {
  constructor(path, data) { this.path = path; this.id = path.split('/').pop(); this._data = data; }
  get exists() { return this._data !== undefined; }
  get(field) { return this._data === undefined ? undefined : this._data[field]; }
  data() { return this._data === undefined ? undefined : structuredClone(this._data); }
}

class FirestoreFalso {
  constructor(inicial = {}) {
    this.store = new Map(Object.entries(inicial).map(([path, data]) => [path, structuredClone(data)]));
    this.escrituras = [];        // registro de escrituras confirmadas: {op, path, data}
    this.lecturasCatalogo = 0;   // veces que se consultó la colección words
    this.antesDeTransaccion = null; // gancho para simular otro escritor concurrente
  }
  leer(path) { return this.store.has(path) ? structuredClone(this.store.get(path)) : undefined; }
  doc(path) { return {path, get: async () => new Snapshot(path, this.leer(path))}; }
  collection(nombre) {
    const filtros = [];
    const consulta = {
      where: (campo, op, valor) => { filtros.push([campo, op, valor]); return consulta; },
      orderBy: () => consulta,
      limit: () => consulta,
      get: async () => {
        if (nombre === 'words') this.lecturasCatalogo++;
        const docs = [...this.store.entries()]
          .filter(([path]) => path.startsWith(`${nombre}/`) && path.split('/').length === 2)
          .filter(([, data]) => filtros.every(([campo, , valor]) => data[campo] === valor))
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([path, data]) => new Snapshot(path, structuredClone(data)));
        return {docs};
      },
    };
    return consulta;
  }
  async runTransaction(fn) {
    if (this.antesDeTransaccion) { const gancho = this.antesDeTransaccion; this.antesDeTransaccion = null; gancho(this); }
    const pendientes = [];
    const tx = {
      get: async (ref) => new Snapshot(ref.path, this.leer(ref.path)),
      getAll: async (...refs) => refs.map((ref) => new Snapshot(ref.path, this.leer(ref.path))),
      create: (ref, data) => { pendientes.push({op: 'create', path: ref.path, data}); return tx; },
      set: (ref, data, opciones) => { pendientes.push({op: opciones?.merge ? 'merge' : 'set', path: ref.path, data}); return tx; },
      update: (ref, data) => { pendientes.push({op: 'update', path: ref.path, data}); return tx; },
    };
    const resultado = await fn(tx);
    for (const w of pendientes) {
      const actual = this.store.get(w.path);
      if (w.op === 'create' && actual !== undefined) throw new Error(`ALREADY_EXISTS ${w.path}`);
      if (w.op === 'update' && actual === undefined) throw new Error(`NOT_FOUND ${w.path}`);
      const base = w.op === 'merge' || w.op === 'update' ? (actual ?? {}) : {};
      this.store.set(w.path, {...base, ...structuredClone(w.data)});
      this.escrituras.push({op: w.op, path: w.path, data: structuredClone(w.data)});
    }
    return resultado;
  }
}

// Clave del documento usernames/{clave}: contrato de almacenamiento de FirebaseUserRepository.updateName.
const claveUsername = (nombre) => createHash('sha256').update(nombre.normalize('NFKC').toLowerCase()).digest('hex');
const relojFijo = (iso) => ({now: () => Date.parse(iso)});

module.exports = {FirestoreFalso, claveUsername, relojFijo};
