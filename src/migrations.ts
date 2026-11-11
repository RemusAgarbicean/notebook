import type { Database } from 'sql.js'

const NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))"

// The columns every Record table shares, plus the type's own fields.
const record = (table: string, fields = '') => `
  create table ${table} (
    id integer primary key,
    title text not null,
    notes text not null default '',
    ${fields}
    created_at text not null default ${NOW},
    updated_at text not null default ${NOW}
  );`

// Ordered and append-only: a migration that has shipped is never edited, and
// new ones only add columns or tables. Entry n upgrades user_version n to n + 1.
export const MIGRATIONS: string[] = [
  `
  ${record('system', 'summary text, url text,')}
  ${record('acronym', 'expansion text not null,')}
  ${record('person', 'role text, email text, go_to_for text,')}
  ${record('team')}
  ${record('process')}
  ${record(
    'project',
    `status text not null default 'active' check (status in ('active', 'on hold', 'done')),
     due text, summary text, done_at text,`,
  )}
  ${record('diagram', 'canvas text,')}
  ${record('bookmark', 'url text not null,')}
  ${record(
    'open_question',
    `status text not null default 'open' check (status in ('open', 'answered')),
     answer text, answered_at text,`,
  )}
  ${record('task', 'done integer not null default 0, due text, done_at text,')}
  ${record(
    'journal_entry',
    `date text not null,
     kind text not null default 'log' check (kind in ('meeting', 'log')),`,
  )}

  create table label (
    id integer primary key,
    forward text not null,
    reverse text not null,
    protected integer not null default 0
  );
  insert into label (forward, reverse, protected) values
    ('owns', 'owned by', 1),
    ('member of', 'has member', 1),
    ('ask about', 'go-to for', 1),
    ('attended', 'attended by', 1),
    ('uses', 'used by', 0),
    ('part of', 'contains', 1),
    ('related to', 'related to', 0),
    ('answered by', 'answers', 1);

  create table relation (
    from_type text not null,
    from_id integer not null,
    label_id integer not null references label (id),
    to_type text not null,
    to_id integer not null,
    created_at text not null default ${NOW},
    unique (from_type, from_id, label_id, to_type, to_id),
    check (from_type <> to_type or from_id <> to_id)
  );

  create table tag (id integer primary key, name text not null unique);

  create table record_tag (
    tag_id integer not null references tag (id),
    type text not null,
    id integer not null,
    primary key (tag_id, type, id)
  );

  create table setting (key text primary key, value text);
  `,
]

export const schemaVersion = (db: Database) =>
  db.exec('pragma user_version')[0].values[0][0] as number

/** Runs the missing migrations in one transaction. Returns whether the database changed. */
export function migrate(db: Database): boolean {
  const from = schemaVersion(db)
  if (from > MIGRATIONS.length)
    throw new Error(
      'This Notebook was saved by a newer version of the app. Open it with the newer notebook.html.',
    )
  if (from === MIGRATIONS.length) return false
  db.run('begin')
  try {
    for (const sql of MIGRATIONS.slice(from)) db.exec(sql)
    db.run(`pragma user_version = ${MIGRATIONS.length}`)
    db.run('commit')
  } catch (e) {
    db.run('rollback')
    throw e
  }
  return true
}
