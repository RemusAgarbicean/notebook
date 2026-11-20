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

// The columns a bank Question and a Questionnaire Item share: the wording and how it is answered.
const QUESTION_COLUMNS = `
    text text not null,
    help text not null default '',
    answer_type text not null default 'short_text'
      check (answer_type in ('short_text', 'long_text', 'yes_no', 'single_choice', 'multi_choice', 'number', 'date', 'scale')),
    options text not null default '[]',
    allow_other integer not null default 0,
    unit text,
    scale_low text,
    scale_high text,`

// Part of migration 3, so as frozen as it is: the starter Question bank and Question sets.
// [category, text, answer type, extras]; a Question's id is its place in this list, from 1.
type Starter = [string, string, string, { help?: string; options?: string[]; other?: true; unit?: string; scale?: [string, string] }?]
const STARTER_QUESTIONS: Starter[] = [
  ['Goals and scope', 'What problem does this project solve?', 'long_text'],
  ['Goals and scope', 'What does success look like?', 'long_text', { help: 'How will we know the project worked?' }],
  ['Goals and scope', 'What is in scope?', 'long_text'],
  ['Goals and scope', 'What is explicitly out of scope?', 'long_text'],
  ['Goals and scope', 'Who asked for this project?', 'short_text'],
  ['Stakeholders', 'Who is the project sponsor?', 'short_text'],
  ['Stakeholders', 'Who makes the final decisions?', 'short_text'],
  ['Stakeholders', 'Who else needs to be kept informed?', 'long_text'],
  ['Stakeholders', 'Who are the end users?', 'long_text'],
  ['Requirements', 'What must the solution do?', 'long_text', { help: 'The must-haves first.' }],
  ['Requirements', 'What would be nice to have?', 'long_text'],
  ['Requirements', 'Is there a solution or workaround today?', 'yes_no'],
  ['Requirements', 'What kind of change is this?', 'single_choice', {
    options: ['New system', 'Change to an existing system', 'Process change', 'Report or data request'],
    other: true,
  }],
  ['Access', 'Who needs access, and to which systems?', 'long_text'],
  ['Access', 'Which access level is needed?', 'single_choice', { options: ['Read only', 'Read and write', 'Admin'], other: true }],
  ['Access', 'Does it need VPN or remote access?', 'yes_no'],
  ['Access', 'Are service accounts or API keys needed?', 'yes_no'],
  ['Access', 'Who approves the access?', 'short_text'],
  ['Access', 'Until when is the access needed?', 'date'],
  ['Dependencies', 'Which systems does it depend on?', 'long_text'],
  ['Dependencies', 'Which systems or teams depend on it?', 'long_text'],
  ['Dependencies', 'How do the systems connect?', 'multi_choice', { options: ['API', 'File transfer', 'Database link', 'Manual'], other: true }],
  ['Dependencies', 'Does it depend on another project?', 'yes_no'],
  ['Dependencies', 'Which environments are involved?', 'multi_choice', { options: ['Dev', 'Test', 'Acceptance', 'Production'] }],
  ['Data', 'Which data does it use or produce?', 'long_text'],
  ['Data', 'Does it handle personal data (GDPR)?', 'yes_no'],
  ['Data', 'Where is the data stored?', 'short_text'],
  ['Data', 'How much data is involved?', 'number', { unit: 'GB' }],
  ['Data', 'How sensitive is the data?', 'single_choice', { options: ['Public', 'Internal', 'Confidential', 'Secret'] }],
  ['Timeline and budget', 'Target go-live date', 'date'],
  ['Timeline and budget', 'Is there a hard deadline?', 'yes_no', { help: 'If so, what happens when it is missed?' }],
  ['Timeline and budget', 'What is the budget?', 'number', { unit: '€' }],
  ['Timeline and budget', 'Which milestones should we know about?', 'long_text'],
  ['Risks', 'How critical is this to the business?', 'scale', { scale: ['Low', 'High'] }],
  ['Risks', 'What are the biggest risks you see?', 'long_text'],
  ['Risks', 'What happens if it is late or does not happen?', 'long_text'],
  ['Risks', 'How sure are you of the requirements so far?', 'scale', { scale: ['Not sure', 'Very sure'] }],
  ['Non-functional', 'How many users?', 'number', { unit: 'users' }],
  ['Non-functional', 'When must it be available?', 'single_choice', { options: ['Office hours', 'Extended hours', '24/7'] }],
  ['Non-functional', 'Are there performance expectations?', 'long_text'],
  ['Non-functional', 'Are there security or compliance requirements?', 'long_text'],
  ['Non-functional', 'Which languages must it support?', 'multi_choice', { options: ['English', 'German', 'French', 'Dutch'], other: true }],
]
// [name, the Questions' ids in order]
const STARTER_SETS: [string, number[]][] = [
  ['New project intake', [1, 2, 3, 4, 6, 7, 10, 14, 20, 24, 26, 30, 31, 34, 35, 38]],
  ['Access request', [14, 15, 16, 17, 18, 19]],
  ['Integration / dependency check', [20, 21, 22, 23, 24, 25, 27, 29]],
]

function starterContent() {
  const q = (s: string | null | undefined) => (s == null ? 'null' : `'${s.replaceAll("'", "''")}'`)
  const questions = STARTER_QUESTIONS.map(
    ([category, text, type, x = {}], i) =>
      `(${i + 1}, ${q(text)}, ${q(x.help ?? '')}, '${type}', ${q(JSON.stringify(x.options ?? []))}, ${x.other ? 1 : 0}, ${q(x.unit)}, ${q(x.scale?.[0])}, ${q(x.scale?.[1])}, ${q(category)}, ${i + 1})`,
  )
  const sets = STARTER_SETS.map(([name], i) => `(${i + 1}, ${q(name)}, ${i + 1})`)
  const members = STARTER_SETS.flatMap(([, ids], s) => ids.map((id, i) => `(${s + 1}, ${id}, ${i + 1})`))
  return `
  insert into question (id, text, help, answer_type, options, allow_other, unit, scale_low, scale_high, category, position) values
    ${questions.join(',\n    ')};
  insert into question_set (id, name, position) values ${sets.join(', ')};
  insert into question_set_item (set_id, question_id, position) values ${members.join(', ')};`
}

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
  // Images pasted into notes. autoincrement: an id is never handed out again, so a reference
  // left in some text, or an Undo delete, can't end up pointing at a different Image.
  `
  create table image (
    id integer primary key autoincrement,
    owner_type text not null,
    owner_id integer not null,
    mime text not null,
    width integer not null,
    height integer not null,
    bytes integer not null,
    data blob not null,
    created_at text not null default ${NOW}
  );
  `,
  // Questionnaires, the Question bank and Question sets, seeded with the starter content. An Item keeps
  // its own copy of a Question's wording; question_id only remembers where it came from.
  // autoincrement: a deleted Question's id never comes back, so an Item can't seem to come from a newer one.
  `
  ${record('questionnaire', `status text not null default 'draft' check (status in ('draft', 'in progress', 'done')),`)}

  create table question (
    id integer primary key autoincrement,
    ${QUESTION_COLUMNS}
    category text not null default '',
    position integer not null default 0,
    created_at text not null default ${NOW},
    updated_at text not null default ${NOW}
  );

  create table question_set (
    id integer primary key autoincrement,
    name text not null,
    position integer not null default 0
  );

  create table question_set_item (
    set_id integer not null references question_set (id),
    question_id integer not null references question (id),
    position integer not null default 0,
    primary key (set_id, question_id)
  );

  create table questionnaire_item (
    id integer primary key autoincrement,
    questionnaire_id integer not null,
    position integer not null default 0,
    question_id integer,
    section text not null default '',
    ${QUESTION_COLUMNS}
    answer text,
    follow_up_id integer
  );
  create index questionnaire_item_of on questionnaire_item (questionnaire_id, position);

  ${starterContent()}

  -- The Respondents label takes id 9. A label the user added there moves to a free id, with its Relations.
  update relation set label_id = (select max(id) + 1 from label) where label_id = 9;
  update label set id = (select max(id) + 1 from label) where id = 9;
  insert into label (id, forward, reverse, protected) values (9, 'responds to', 'has respondent', 1);
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
