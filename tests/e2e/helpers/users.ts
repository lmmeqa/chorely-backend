import assert from 'node:assert/strict';
import type { SuperTest, Test } from 'supertest';

// Tracks which emails have already received a 201 Created in this test run
const createdOnce = new Set<string>();

export async function createOrJoinUser(
  agent: SuperTest<Test>,
  email: string,
  name: string,
  homeId: string
): Promise<void> {
  const create = await agent
    .post('/user')
    .set('Content-Type', 'application/json')
    .send({ email, name, homeIds: [homeId] });

  if (create.status === 201) {
    // Ensure at most one 201 per email across the entire run
    assert.equal(createdOnce.has(email), false, `User ${email} was created more than once in this run`);
    createdOnce.add(email);
    return;
  }

  if (create.status === 409) {
    const join = await agent
      .post('/user/join')
      .set('Content-Type', 'application/json')
      .send({ email, homeId });
    assert.equal(join.status, 204, `Expected 204 from /user/join for ${email}, got ${join.status}`);
    return;
  }

  assert.fail(`Unexpected status from POST /user for ${email}: ${create.status}`);
}


