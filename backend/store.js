'use strict';
/*
 * Stockage des données.
 * - PostgreSQL (DATABASE_URL) : une ligne par enregistrement (table records) et une ligne par document (table files).
 * - PGlite (PGLITE_DIR) : PostgreSQL embarqué, pour les tests et le développement.
 * - Fichier JSON (sinon) : développement local uniquement.
 * Le serveur garde les données en mémoire et les écrit en différé, uniquement ce qui a changé.
 * Une seule instance du serveur doit tourner à la fois.
 */
const fs = require('fs');
const path = require('path');

const COLLECTIONS = ['users', 'codes', 'sessions', 'links', 'progress', 'assignments', 'works', 'submissions', 'messages'];
const emptyDb = () => ({ users: {}, codes: {}, sessions: {}, links: [], progress: {}, assignments: [], works: [], submissions: [], messages: [] });

/* Transforme la base en liste d'enregistrements { "collection/id": json } */
function records(db) {
  const out = new Map();
  for (const c of COLLECTIONS) {
    const v = db[c];
    if (Array.isArray(v)) v.forEach(x => out.set(c + '\u0000' + x.id, JSON.stringify(x)));
    else for (const [k, x] of Object.entries(v || {})) out.set(c + '\u0000' + k, JSON.stringify(x));
  }
  return out;
}

/* ---------- Pilote SQL commun (pg ou PGlite) ---------- */
function sqlStore(exec) {
  let last = new Map();
  const pendingFiles = new Map();   // id -> { mime, buf } en attente d'écriture
  const deletedFiles = new Set();
  let working = Promise.resolve();

  async function init() {
    await exec.query('CREATE TABLE IF NOT EXISTS records (collection text NOT NULL, id text NOT NULL, data jsonb NOT NULL, PRIMARY KEY (collection, id))');
    await exec.query('CREATE TABLE IF NOT EXISTS files (id text PRIMARY KEY, mime text NOT NULL, data bytea NOT NULL)');
  }
  async function load() {
    await init();
    const db = emptyDb();
    const r = await exec.query('SELECT collection, id, data FROM records');
    for (const row of r.rows) {
      const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      if (Array.isArray(db[row.collection])) db[row.collection].push(data);
      else if (db[row.collection]) db[row.collection][row.id] = data;
    }
    db.messages.sort((a, b) => a.at - b.at);
    last = records(db);
    return db;
  }
  async function flushNow(db) {
    const cur = records(db);
    const up = [], del = [];
    for (const [k, v] of cur) if (last.get(k) !== v) up.push([k, v]);
    for (const k of last.keys()) if (!cur.has(k)) del.push(k);
    const files = [...pendingFiles.entries()], gone = [...deletedFiles];
    if (!up.length && !del.length && !files.length && !gone.length) return;
    pendingFiles.clear(); deletedFiles.clear();
    try {
      await exec.tx(async q => {
        for (const [k, v] of up) { const [c, id] = k.split('\u0000'); await q('INSERT INTO records (collection, id, data) VALUES ($1, $2, $3::jsonb) ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data', [c, id, v]); }
        for (const k of del) { const [c, id] = k.split('\u0000'); await q('DELETE FROM records WHERE collection = $1 AND id = $2', [c, id]); }
        for (const [id, f] of files) await q('INSERT INTO files (id, mime, data) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING', [id, f.mime, f.buf]);
        for (const id of gone) await q('DELETE FROM files WHERE id = $1', [id]);
      });
      last = cur;
    } catch (e) {
      // on remet les fichiers en attente et on réessaiera au prochain enregistrement
      files.forEach(([id, f]) => { if (!deletedFiles.has(id)) pendingFiles.set(id, f); });
      gone.forEach(id => deletedFiles.add(id));
      throw e;
    }
  }
  return {
    kind: 'sql',
    load,
    flush(db) { working = working.then(() => flushNow(db)); return working; },
    putFile(id, mime, buf) { pendingFiles.set(id, { mime, buf }); deletedFiles.delete(id); },
    delFile(id) { if (!pendingFiles.delete(id)) deletedFiles.add(id); },
    async getFile(id) {
      const p = pendingFiles.get(id);
      if (p) return { mime: p.mime, buf: p.buf };
      const r = await exec.query('SELECT mime, data FROM files WHERE id = $1', [id]);
      return r.rows[0] ? { mime: r.rows[0].mime, buf: Buffer.from(r.rows[0].data) } : null;
    },
    async close() { if (exec.close) await exec.close(); }
  };
}

function pgStore(url) {
  const { Pool } = require('pg');
  const local = /localhost|127\.0\.0\.1/.test(url);
  const pool = new Pool({ connectionString: url, max: 5, ssl: local ? false : { rejectUnauthorized: true } });
  pool.on('error', e => console.error('PostgreSQL :', e.message));
  return sqlStore({
    query: (s, p) => pool.query(s, p),
    async tx(fn) {
      const c = await pool.connect();
      try { await c.query('BEGIN'); await fn((s, p) => c.query(s, p)); await c.query('COMMIT'); }
      catch (e) { try { await c.query('ROLLBACK'); } catch (_) { /* ignoré */ } throw e; }
      finally { c.release(); }
    },
    close: () => pool.end()
  });
}

function pgliteStore(dir) {
  const { PGlite } = require('@electric-sql/pglite');
  const db = new PGlite(dir);
  return sqlStore({
    query: (s, p) => db.query(s, p),
    tx: fn => db.transaction(tx => fn((s, p) => tx.query(s, p))),
    close: () => db.close()
  });
}

/* ---------- Fichier JSON (développement local) ---------- */
function jsonStore(dir) {
  fs.mkdirSync(path.join(dir, 'files'), { recursive: true });
  const file = path.join(dir, 'db.json');
  return {
    kind: 'json',
    async load() { const db = emptyDb(); try { Object.assign(db, JSON.parse(fs.readFileSync(file, 'utf8'))); } catch (e) { /* première exécution */ } return db; },
    async flush(db) { const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, file); },
    putFile(id, mime, buf) { fs.writeFileSync(path.join(dir, 'files', id), buf); },
    delFile(id) { fs.unlink(path.join(dir, 'files', id), () => {}); },
    async getFile(id) { try { return { mime: null, buf: fs.readFileSync(path.join(dir, 'files', id)) }; } catch (e) { return null; } },
    async close() {}
  };
}

function createStore(env, dataDir) {
  if (env.DATABASE_URL) return pgStore(env.DATABASE_URL);
  if (env.PGLITE_DIR) return pgliteStore(env.PGLITE_DIR === 'memory' ? undefined : env.PGLITE_DIR);
  return jsonStore(dataDir);
}
module.exports = { createStore, emptyDb };
