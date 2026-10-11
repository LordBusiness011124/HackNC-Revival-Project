import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { freshState, type ChatMessage, type RepairState, type Role } from './engine.js';
import { seedInventory, type InventoryDevice } from './inventory.js';

export interface Store {
  kind: 'tiger' | 'file';
  read(): Promise<RepairState>;
  // Runs fn against the latest state and persists whatever it changed.
  update<T>(fn: (s: RepairState) => T): Promise<T>;
  reset(): Promise<void>;
  inventory(): Promise<InventoryDevice[]>;
}

export function createStore(): Store {
  return process.env.DATABASE_URL ? tigerStore(process.env.DATABASE_URL) : fileStore(path.resolve('data/state.json'));
}

function fileStore(dataPath: string): Store {
  let state: RepairState = freshState();
  const loaded = readFile(dataPath, 'utf8').then(raw => { state = JSON.parse(raw); }, e => { if (e.code !== 'ENOENT') console.warn('Saved state could not be read; starting a fresh demo.'); });
  let writing = Promise.resolve();
  function save() {
    const serialized = JSON.stringify(state, null, 2);
    writing = writing.catch(() => {}).then(async () => {
      await mkdir(path.dirname(dataPath), { recursive: true });
      await writeFile(`${dataPath}.tmp`, serialized);
      await rename(`${dataPath}.tmp`, dataPath);
    });
    return writing;
  }
  return {
    kind: 'file',
    async read() { await loaded; return state; },
    async update(fn) { await loaded; const result = fn(state); await save(); return result; },
    async reset() { await loaded; state = freshState(); await save(); },
    async inventory() { return seedInventory; },
  };
}

const REPAIR_ID = 'LZ-001';
// messages and events are append-only logs keyed by time, so they become
// TimescaleDB hypertables on Tiger Data. On plain Postgres they stay regular tables.
const schema = `
create table if not exists repairs (
  id text primary key,
  donor boolean not null default false,
  repairer boolean not null default false,
  intake jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists chat_sessions (
  session_id text primary key,
  role text not null check (role in ('donor', 'repairer'))
);
create table if not exists processed_messages (
  message_id text primary key,
  processed_at timestamptz not null default now()
);
create table if not exists messages (
  id uuid not null, time timestamptz not null, seq bigserial,
  sender text not null, text text not null, role text not null, channel text not null,
  primary key (id, time)
);
create table if not exists events (
  id uuid not null, time timestamptz not null, seq bigserial,
  text text not null,
  primary key (id, time)
);
create table if not exists devices (
  id text primary key,
  owner text not null, model text not null, condition text not null, role text not null,
  location_name text not null, lat double precision not null, lng double precision not null,
  created_at timestamptz not null default now()
);
create table if not exists parts (
  device_id text not null references devices(id) on delete cascade,
  name text not null,
  status text not null check (status in ('available', 'reserved', 'needed')),
  primary key (device_id, name)
);
do $$ begin
  if exists (select 1 from pg_extension where extname = 'timescaledb') then
    perform create_hypertable('messages', 'time', if_not_exists => true, migrate_data => true);
    perform create_hypertable('events', 'time', if_not_exists => true, migrate_data => true);
  end if;
end $$;
`;

type Loaded = { state: RepairState; seen: Set<string> };

function tigerStore(connectionString: string): Store {
  const pool = new pg.Pool({ connectionString, max: 5 });
  let setupDone: Promise<void> | null = null;
  // Retries on the next request if the database was unreachable.
  const ready = () => setupDone ??= setup().catch(e => { setupDone = null; throw e; });

  async function setup() {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('select pg_advisory_xact_lock(4242001)');
      await client.query(schema);
      const created = await client.query('insert into repairs (id) values ($1) on conflict do nothing', [REPAIR_ID]);
      if (created.rowCount) await insertEvents(client, freshState().events);
      for (const d of seedInventory) {
        await client.query('insert into devices (id, owner, model, condition, role, location_name, lat, lng) values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict do nothing', [d.id, d.owner, d.model, d.condition, d.role, d.location.name, d.location.lat, d.location.lng]);
        for (const p of d.parts) await client.query('insert into parts (device_id, name, status) values ($1, $2, $3) on conflict do nothing', [d.id, p.name, p.status]);
      }
      await client.query('commit');
    } catch (e) { await client.query('rollback'); throw e; } finally { client.release(); }
  }

  // Loads the same window the engine keeps in memory: latest 100 messages, 40 events, 500 processed ids.
  async function load(db: pg.PoolClient | pg.Pool): Promise<Loaded> {
    const queries: [string, unknown[]?][] = [
      ['select donor, repairer, intake from repairs where id = $1', [REPAIR_ID]],
      ['select session_id, role from chat_sessions'],
      ['select message_id from (select message_id, processed_at from processed_messages order by processed_at desc limit 500) p order by processed_at'],
      ['select id, time, sender, text, role, channel from (select * from messages order by time desc, seq desc limit 100) m order by time, seq'],
      ['select id, time, text from events order by time desc, seq desc limit 40'],
    ];
    // The pool can run these in parallel; a single transaction client must run them in order.
    const results: pg.QueryResult[] = [];
    if (db instanceof pg.Pool) results.push(...await Promise.all(queries.map(([text, values]) => db.query(text, values))));
    else for (const [text, values] of queries) results.push(await db.query(text, values));
    const [repair, sessions, processed, messages, events] = results;
    const row = repair.rows[0] ?? { donor: false, repairer: false, intake: null };
    const state: RepairState = {
      donor: row.donor, repairer: row.repairer, intake: row.intake,
      sessions: Object.fromEntries(sessions.rows.map(r => [r.session_id, r.role as Role])),
      processed: processed.rows.map(r => r.message_id),
      messages: messages.rows.map(r => ({ id: r.id, time: r.time.toISOString(), sender: r.sender, text: r.text, role: r.role, channel: r.channel })),
      events: events.rows.map(r => ({ id: r.id, time: r.time.toISOString(), text: r.text })),
    };
    const seen = new Set([...state.messages.map(m => m.id), ...state.events.map(e => e.id), ...state.processed.map(id => `p:${id}`), ...Object.entries(state.sessions).map(([k, v]) => `s:${k}:${v}`)]);
    return { state, seen };
  }

  async function insertEvents(db: pg.PoolClient, events: RepairState['events']) {
    // Engine keeps events newest-first; insert oldest-first so seq follows time.
    for (const e of [...events].reverse()) await db.query('insert into events (id, time, text) values ($1, $2, $3) on conflict do nothing', [e.id, e.time, e.text]);
  }

  async function persist(db: pg.PoolClient, { state: s, seen }: Loaded) {
    await db.query('update repairs set donor = $2, repairer = $3, intake = $4, updated_at = now() where id = $1', [REPAIR_ID, s.donor, s.repairer, s.intake]);
    for (const [session, role] of Object.entries(s.sessions)) {
      if (!seen.has(`s:${session}:${role}`)) await db.query('insert into chat_sessions (session_id, role) values ($1, $2) on conflict (session_id) do update set role = excluded.role', [session, role]);
    }
    for (const id of s.processed) if (!seen.has(`p:${id}`)) await db.query('insert into processed_messages (message_id) values ($1) on conflict do nothing', [id]);
    for (const m of s.messages) if (!seen.has(m.id)) await insertMessage(db, m);
    await insertEvents(db, s.events.filter(e => !seen.has(e.id)));
  }

  function insertMessage(db: pg.PoolClient, m: ChatMessage) {
    return db.query('insert into messages (id, time, sender, text, role, channel) values ($1, $2, $3, $4, $5, $6) on conflict do nothing', [m.id, m.time, m.sender, m.text, m.role, m.channel]);
  }

  async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    await ready();
    const client = await pool.connect();
    try {
      await client.query('begin');
      // Serialize writers so two confirmations can't overwrite each other.
      await client.query('select 1 from repairs where id = $1 for update', [REPAIR_ID]);
      const result = await fn(client);
      await client.query('commit');
      return result;
    } catch (e) { await client.query('rollback'); throw e; } finally { client.release(); }
  }

  return {
    kind: 'tiger',
    async read() { await ready(); return (await load(pool)).state; },
    update: fn => transaction(async client => {
      const loaded = await load(client);
      const result = fn(loaded.state);
      await persist(client, loaded);
      return result;
    }),
    reset: () => transaction(async client => {
      await client.query('truncate messages, events, chat_sessions, processed_messages');
      const fresh = freshState();
      await client.query('update repairs set donor = false, repairer = false, intake = null, updated_at = now() where id = $1', [REPAIR_ID]);
      await insertEvents(client, fresh.events);
    }),
    async inventory() {
      await ready();
      const { rows } = await pool.query(`
        select d.*, coalesce(json_agg(json_build_object('name', p.name, 'status', p.status) order by p.name) filter (where p.name is not null), '[]') as parts
        from devices d left join parts p on p.device_id = d.id
        group by d.id order by d.created_at, d.id`);
      return rows.map(r => ({ id: r.id, owner: r.owner, model: r.model, condition: r.condition, role: r.role, location: { name: r.location_name, lat: r.lat, lng: r.lng }, parts: r.parts }));
    },
  };
}
