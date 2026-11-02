import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/lib/student-delete.functions.ts', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '').replace('export const adminDeleteStudent', 'const adminDeleteStudent');
const builder = { middleware() { return this; }, inputValidator() { return this; }, handler(fn) { return fn; } };
const context = vm.createContext({ createServerFn: () => builder, requireSupabaseAuth: {} });
vm.runInContext(stripTypeScriptTypes(source) + '\nthis.handler = adminDeleteStudent;', context);

function fixture({ admin = true, missing = false, failed = false, parentReadFailed = false } = {}) {
  const writes = [];
  let deleted = false;
  const profiles = ['orphan', 'sibling', 'staff'].map(id => ({ id, full_name: id }));
  const roles = [{ user_id: 'orphan', role: 'parent' }, { user_id: 'sibling', role: 'parent' }, { user_id: 'staff', role: 'parent' }, { user_id: 'staff', role: 'teacher' }];
  const sb = {
    rpc: async () => ({ data: admin, error: null }),
    from(table) {
      let deleting = false;
      const query = {
        select() { return this; }, eq(key, value) { if (deleting) writes.push({ table, key, value }); return this; }, in() { return this; },
        delete() { deleting = true; return this; },
        async maybeSingle() { deleted = !failed && !missing; return { data: missing ? null : { id: 'student', photo_path: null }, error: failed ? {} : null }; },
        then(resolve) {
          const data = table === 'profiles' ? profiles : table === 'user_roles' ? roles : deleted ? [{ parent_id: 'sibling' }] : profiles.map(p => ({ parent_id: p.id }));
          return Promise.resolve({ data, error: deleted && parentReadFailed ? {} : null }).then(resolve);
        },
      }; return query;
    },
  };
  return { writes, run: () => context.handler({ data: { studentId: 'student' }, context: { supabase: sb } }) };
}
test('only the selected student is deleted; only newly childless pure parents are offered', async () => {
  const f = fixture(); const result = await f.run();
  assert.deepEqual(f.writes, [{ table: 'students', key: 'id', value: 'student' }]);
  assert.equal(JSON.stringify(result.parents), JSON.stringify([{ id: 'orphan', name: 'orphan' }]));
});
test('non-admin is refused before reads or writes', async () => {
  const f = fixture({ admin: false }); await assert.rejects(f.run(), /Only administrators/); assert.equal(f.writes.length, 0);
});
test('database deletion failure is reported as failure', async () => {
  await assert.rejects(fixture({ failed: true }).run(), /Couldn't delete/);
});
test('missing student does not report success', async () => {
  await assert.rejects(fixture({ missing: true }).run(), /no longer exists/);
});
test('parent lookup failure after deletion reports success with a warning', async () => {
  const result = await fixture({ parentReadFailed: true }).run();
  assert.equal(result.parents.length, 0); assert.match(result.warning, /Parents page/);
});

const adminSource = readFileSync(new URL('../src/lib/admin.functions.ts', import.meta.url), 'utf8');
const parentSource = adminSource.slice(adminSource.indexOf('export const adminDeleteParent'), adminSource.indexOf('/** Suspends or restores a parent login'))
  .replace('export const adminDeleteParent', 'const adminDeleteParent')
  .replace('const { isManageableParent, soleParentStudents } = await import("@/lib/account-rules");', '');
const parentContext = vm.createContext({
  createServerFn: () => builder, requireSupabaseAuth: {}, assertAdmin: async () => {},
  isManageableParent: roles => roles.includes('parent') && !roles.includes('admin') && !roles.includes('teacher'),
  soleParentStudents: students => students.filter(s => s.otherParents === 0),
});
vm.runInContext(stripTypeScriptTypes(parentSource) + '\nthis.handler = adminDeleteParent;', parentContext);
function parentFixture(roles, children) {
  const writes = [];
  const sb = { from(table) {
    const q = { select() { return q; }, eq() { return q; }, in() { return q; }, neq() { return q; },
      delete() { writes.push(table); return q; },
      then(resolve) { return Promise.resolve({ data: table === 'user_roles' ? roles.map(role => ({role})) : children.map(student_id => ({student_id})), error: null }).then(resolve); }
    }; return q;
  }};
  return { writes, run: () => parentContext.handler({ data: { parentId: 'parent', requireUnlinked: true, unlinkSoleChildren: false }, context: { supabase: sb } }) };
}
test('parent who gains another linked child is protected at action time', async () => {
  const f = parentFixture(['parent'], ['new-child']);
  await assert.rejects(f.run(), /now linked/); assert.equal(f.writes.length, 0);
});
test('staff-linked parent account is protected', async () => {
  const f = parentFixture(['parent', 'teacher'], []);
  await assert.rejects(f.run(), /Only parent/); assert.equal(f.writes.length, 0);
});
test('childless parent removal uses existing access-removal flow', async () => {
  const f = parentFixture(['parent'], []); await f.run();
  assert.deepEqual(f.writes, ['parent_students', 'user_roles']);
});
