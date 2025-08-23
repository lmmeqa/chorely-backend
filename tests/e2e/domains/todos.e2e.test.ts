import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll, vi } from 'vitest';

import { json, agent } from '../../helpers/hono-test-client';
import { buildTwoPersonHouse } from '../helpers/test-scenarios';
import { supabaseSignupOrLogin } from '../helpers/supabase';
import { createOrJoinUser } from '../helpers/users';
import { cleanupTestData } from '../helpers/reset-backend';
describe('Todos E2E', () => {
  const scenario = buildTwoPersonHouse();
  const [alice] = scenario.users;
  let homeId = '';
  let tokens: Record<string, string> = {};
  let choreUuid = '';
  let todoId = '';

  beforeAll(async () => {
    for (const u of scenario.users) tokens[u.email] = await supabaseSignupOrLogin(u.email, u.password);
    const h = await json('POST', '/homes', { name: scenario.homeName });
    assert.equal(h.status, 201); homeId = h.json.id;
    for (const u of scenario.users) {
      await createOrJoinUser(agent as any, u.email, u.name, homeId);
    }
    const c = await json('POST', '/chores', { name: 'Todo Chore', description: 'todo desc', time: '2038-01-01T00:00:00', icon: 'wind', home_id: homeId, points: 1 }, { Authorization: `Bearer ${tokens[alice.email]}` });
    assert.equal(c.status, 201); choreUuid = c.json.uuid;
  }, 30000);

  it('GET /todos, POST /todos, GET /todos/:id, GET /todos/chore/:choreId, POST /todos/generate', async () => {
    const tokenA = tokens[alice.email];
    // Initially empty or some items
    const all1 = await json('GET', '/todos');
    assert.equal(all1.status, 200);

    // Create a todo
    const created = await json('POST', '/todos', { name: 'First todo', chore_id: choreUuid, order: 0 });
    assert.equal(created.status, 201);
    todoId = created.json.id;

    const byId = await json('GET', `/todos/${todoId}`);
    assert.equal(byId.status, 200);
    assert.equal(byId.json.id, todoId);

    const forChore = await json('GET', `/todos/chore/${choreUuid}`);
    assert.equal(forChore.status, 200);
    assert.ok(forChore.json.some((t: any) => t.id === todoId));

    // Exercise generate endpoint (will log 401 from OpenAI key but should still 200 per controller)
    const gen = await json('POST', '/todos/generate', { choreName: 'A', choreDescription: 'B' }, { Authorization: `Bearer ${tokenA}` });
    assert.equal(gen.status, 200);
    assert.ok(Array.isArray(gen.json.todos));
  });

  it('inserts todos at beginning, middle, and end with correct order shifting', async () => {
    // Helper to fetch todos for this chore ordered by 'order'
    const fetchTodos = async () => {
      const r = await json('GET', `/todos/chore/${choreUuid}`);
      assert.equal(r.status, 200);
      const arr = Array.isArray(r.json) ? r.json : [];
      // Ensure list is sorted by order and contiguous
      arr.sort((a: any, b: any) => a.order - b.order);
      return arr;
    };

    // Wait briefly for any async generation to complete to avoid race with shifting logic
    const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
    let prevLen = -1;
    for (let i = 0; i < 10; i++) {
      const arr = await fetchTodos();
      if (arr.length === prevLen) break;
      prevLen = arr.length;
      await wait(100);
    }

    // Snapshot initial state
    let todos = await fetchTodos();
    const initialLen = todos.length;

    // 1) Insert at END (omit order → model appends)
    const endRes = await json('POST', '/todos', { name: 'Z_End', chore_id: choreUuid });
    assert.equal(endRes.status, 201);
    todos = await fetchTodos();
    assert.equal(todos.length, initialLen + 1);
    assert.equal(todos[todos.length - 1].name, 'Z_End');
    assert.equal(todos[todos.length - 1].order, todos.length - 1);

    // 2) Insert at BEGINNING (order: 0 → shift others +1)
    const beginRes = await json('POST', '/todos', { name: 'A_Begin', chore_id: choreUuid, order: 0 });
    assert.equal(beginRes.status, 201);
    todos = await fetchTodos();
    assert.equal(todos[0].name, 'A_Begin');
    // All orders should be contiguous 0..n-1 and match index
    for (let i = 0; i < todos.length; i++) assert.equal(todos[i].order, i);

    // 3) Insert in MIDDLE
    const midIndex = Math.floor(todos.length / 2);
    const midRes = await json('POST', '/todos', { name: 'M_Middle', chore_id: choreUuid, order: midIndex });
    assert.equal(midRes.status, 201);
    todos = await fetchTodos();
    assert.equal(todos[midIndex].name, 'M_Middle');
    for (let i = 0; i < todos.length; i++) assert.equal(todos[i].order, i);

    // Sanity: ensure our three inserts exist at expected positions
    assert.equal(todos[0].name, 'A_Begin');
    assert.equal(todos[todos.length - 1].name, 'Z_End');
  });

  it('generates todos synchronously during chore creation without race conditions', async () => {
    // Create a chore - todo generation should happen synchronously
    const tokenA = tokens[alice.email];
    const c = await json('POST', '/chores', {
      name: 'Sync Chore', description: 'synchronous todo generation', time: '2039-01-01T00:00:00', icon: 'wind', home_id: homeId, points: 1,
    }, { Authorization: `Bearer ${tokenA}` });
    assert.equal(c.status, 201);
    
    // Immediately check that todos were generated (no race condition)
    const todos = await json('GET', `/todos/chore/${c.json.uuid}`);
    assert.equal(todos.status, 200);
    assert.ok(Array.isArray(todos.json), 'Todos should be an array');
    assert.ok(todos.json.length > 0, 'Todos should be generated immediately');
    
    // Verify we can add a manual todo without conflicts
    const manualTodo = await json('POST', '/todos', { 
      name: 'Manual Todo', 
      chore_id: c.json.uuid, 
      order: 0 
    });
    assert.equal(manualTodo.status, 201, 'Manual todo insertion should succeed');
    
    // Verify the manual todo was inserted at the beginning and others shifted
    const updatedTodos = await json('GET', `/todos/chore/${c.json.uuid}`);
    assert.equal(updatedTodos.status, 200);
    assert.equal(updatedTodos.json[0].name, 'Manual Todo', 'Manual todo should be first');
    assert.ok(updatedTodos.json.length > todos.json.length, 'Should have more todos after manual insert');
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});
