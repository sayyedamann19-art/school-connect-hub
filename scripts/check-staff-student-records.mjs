import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/lib/staff-student-records.functions.ts', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '').replaceAll('export ', '');
const schema = new Proxy(() => {}, { get: () => schema, apply: () => schema });
const builder = () => ({ middleware() { return this; }, inputValidator() { return this; }, handler(fn) { return fn; } });
const sandbox = vm.createContext({ createServerFn: builder, requireSupabaseAuth: {}, z: schema });
vm.runInContext(stripTypeScriptTypes(source) + '\nthis.readProfile = getStaffStudentProfile; this.readHistory = getStaffStudentHistory;', sandbox);

function fixture({ role = 'admin', active = true, deleted = null, permissionError = false, historyError = false, rows = 2 } = {}) {
  const log = [];
  const students = ['A', 'B'].map(id => ({ id, full_name: `Child ${id}`, gr_number: id, class_id: id, photo_path: null }));
  const db = {
    teachers: role === 'teacher' ? [{ id: 'teacher', profile_id: 'caller', is_active: active, deleted_at: deleted }] : [],
    students,
    attendance: Array.from({ length: rows }, (_, i) => ({ id: String(i).padStart(3, '0'), student_id: i === 1 && rows === 2 ? 'B' : 'A', date: '2026-11-03', status: i === 1 ? 'absent' : 'present', note: `note-${i}` })),
    academic_results: students.map(s => ({ id: s.id, student_id: s.id, created_at: '2026-11-03T00:00:00Z', status: s.id === 'A' ? 'present' : 'absent', marks_obtained: s.id === 'A' ? 91 : null, maximum_marks: 100, exam: { name: 'Test', academic_year: '2026-2027', status: 'draft' }, subject: { name: 'English' } })),
  };
  function query(table, initial) {
    let data = initial ?? db[table] ?? [];
    let failed = historyError && table === 'attendance';
    const q = {
      select() { return q; },
      eq(key, value) { log.push({ table, key, value }); data = data.filter(r => r[key] === value); return q; },
      is(key, value) { data = data.filter(r => r[key] === value); return q; },
      order() { return q; }, range(from, to) { data = data.slice(from, to + 1); return q; },
      maybeSingle: async () => ({ data: data[0] ?? null, error: null }),
      then(resolve) { return Promise.resolve({ data, error: failed ? {} : null }).then(resolve); },
    }; return q;
  }
  const sb = {
    from(table) { log.push({ table }); return query(table); },
    rpc(name, args) {
      log.push({ rpc: name, args });
      if (name === 'is_admin') return Promise.resolve({ data: role === 'admin', error: permissionError ? {} : null });
      if (name === 'teaches_student') return Promise.resolve({ data: args._student_id === 'A', error: null });
      if (name === 'get_student_parent_contacts') return Promise.resolve({ data: [{ student_id: args._student_ids[0], full_name: `Parent ${args._student_ids[0]}`, phone: 'test' }], error: null });
      if (name === 'get_student_notes') return query('notes', [{ id: args._student_id, note_date: '2026-11-03', teacher_name: 'Teacher', subject: 'English', note: `ONLY ${args._student_id}` }]);
      if (name === 'get_student_character_points') return query('points', [{ id: args._student_id, awarded_on: '2026-11-03', teacher_name: 'Teacher', reason: `ONLY ${args._student_id}`, points: args._student_id === 'A' ? 7 : -3 }]);
      throw Error(name);
    },
  };
  const context = { supabase: sb, userId: 'caller' };
  return { log, profile: studentId => sandbox.readProfile({ data: { studentId }, context }),
    history: (studentId, section = 'attendance', page = 0) => sandbox.readHistory({ data: { studentId, section, page }, context }) };
}

test('admin switches A to B without returning A profile or contacts', async () => {
  const f = fixture(); assert.equal((await f.profile('A')).student.id, 'A');
  const b = await f.profile('B'); assert.equal(b.student.id, 'B'); assert.equal(b.parents[0].student_id, 'B');
});
test('teacher can read assigned A but not unassigned B', async () => {
  const f = fixture({ role: 'teacher' }); assert.equal((await f.profile('A')).student.id, 'A');
  const start = f.log.length; await assert.rejects(f.history('B'), /not in a class/);
  assert.equal(f.log.slice(start).some(r => r.table === 'attendance'), false);
});
test('parents and other non-staff cannot enter staff record endpoint', async () => {
  await assert.rejects(fixture({ role: 'parent' }).profile('A'), /authorised staff/);
});
test('inactive teachers are blocked', async () => {
  await assert.rejects(fixture({ role: 'teacher', active: false }).history('A'), /authorised staff/);
});
test('deleted teachers are blocked', async () => {
  await assert.rejects(fixture({ role: 'teacher', deleted: '2026-11-03' }).history('A'), /authorised staff/);
});
test('permission lookup failure fails closed', async () => {
  const f = fixture({ permissionError: true }); await assert.rejects(f.profile('A'), /access/);
  assert.equal(f.log.some(r => r.table === 'students'), false);
});
test('missing or RLS-hidden student has no history', async () => {
  const f = fixture(); await assert.rejects(f.history('missing'), /Student not found/);
  assert.equal(f.log.some(r => r.table === 'attendance'), false);
});
test('all history sections keep their requested student identity and data', async () => {
  const f = fixture();
  for (const section of ['attendance', 'feedback', 'character', 'results']) {
    const a = await f.history('A', section); const b = await f.history('B', section);
    assert.equal(a.studentId, 'A'); assert.equal(b.studentId, 'B');
    assert.equal(a.records.length, 1); assert.equal(b.records.length, 1);
    if (section === 'character') { assert.equal(a.records[0].value, '+7 points'); assert.equal(b.records[0].value, '-3 points'); }
    if (section === 'feedback') { assert.equal(a.records[0].detail, 'ONLY A'); assert.equal(b.records[0].detail, 'ONLY B'); }
    if (section === 'results') { assert.equal(a.records[0].value, '91 / 100'); assert.equal(b.records[0].value, 'Absent'); assert.match(a.records[0].detail, /Draft/); }
  }
});
test('history paging retains the 51st row and exposes a final short page', async () => {
  const f = fixture({ rows: 52 }); const first = await f.history('A'); const last = await f.history('A', 'attendance', 1);
  assert.equal(first.records.length, 50); assert.equal(first.hasMore, true);
  assert.equal(last.records.length, 2); assert.equal(last.records[0].id, '050'); assert.equal(last.hasMore, false);
});
test('history errors are not shown as an empty successful result', async () => {
  await assert.rejects(fixture({ historyError: true }).history('A'), /Couldn't load attendance/);
});
