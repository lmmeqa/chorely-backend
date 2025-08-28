import assert from 'node:assert/strict';
import { json } from '../../helpers/hono-test-client';

export async function createOrJoinUser(
  _agent: any,
  email: string,
  name: string,
  homeId: string
): Promise<void> {
  // Create user first without homeIds
  const create = await json('POST', '/user', { email, name });
  

  if (create.status === 201) {
    // User was created successfully, now join the home
    const join = await json('POST', '/user/join', { email, homeId });
    assert.equal(join.status, 204, `Expected 204 from /user/join for ${email}, got ${join.status}`);
    return;
  }

  if (create.status === 409 || create.status === 200) {
    // User already exists, join the home
    const join = await json('POST', '/user/join', { email, homeId });
    assert.equal(join.status, 204, `Expected 204 from /user/join for ${email}, got ${join.status}`);
    return;
  }

  assert.fail(`Unexpected status from POST /user for ${email}: ${create.status}, response: ${JSON.stringify(create.json)}`);
}


