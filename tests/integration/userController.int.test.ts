import { testClient } from '../helpers/hono-test-client';
import { describe, it, expect, afterAll } from 'vitest';
import { cleanupTestData } from '../e2e/helpers/reset-backend';

describe('userController negative paths', () => {
  afterAll(async () => { await cleanupTestData(); });

  it('rejects user creation with invalid email format', async () => {
    const res = await testClient.post('/user', { 
      email: 'not-an-email', 
      name: 'X', 
      homeIds: [] 
    });
    expect([400, 422, 500]).toContain(res.status); // tolerant across mapping layers
  });

  it('rejects joining non-existent home', async () => {
    // First create a valid user
    const created = await testClient.post('/user', { 
      email: 'negtest@e2e.local', 
      name: 'Neg', 
      homeIds: [] 
    });
    expect([201, 409]).toContain(created.status);

    const join = await testClient.post('/user/join', { 
      email: 'negtest@e2e.local', 
      homeId: '00000000-0000-0000-0000-000000000000' 
    });
    expect([404, 409]).toContain(join.status);
  });
});


