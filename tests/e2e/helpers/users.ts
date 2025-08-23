import assert from 'node:assert/strict';
import { json } from '../../helpers/hono-test-client';

// Tracks which emails have already received a 201 Created in this test run
const createdOnce = new Set<string>();

export async function createOrJoinUser(
  _agent: any,
  email: string,
  name: string,
  homeId: string
): Promise<void> {
  const create = await json('POST', '/user', { email, name, homeIds: [homeId] });

  if (create.status === 201) {
    // Ensure at most one 201 per email across the entire run
    assert.equal(createdOnce.has(email), false, `User ${email} was created more than once in this run`);
    createdOnce.add(email);
    return;
  }

  if (create.status === 409) {
    const join = await json('POST', '/user/join', { email, homeId });
    assert.equal(join.status, 204, `Expected 204 from /user/join for ${email}, got ${join.status}`);
    return;
  }

  assert.fail(`Unexpected status from POST /user for ${email}: ${create.status}`);
}


