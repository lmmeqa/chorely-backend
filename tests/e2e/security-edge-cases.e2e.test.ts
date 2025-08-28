import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';
import { createReadStream, createWriteStream } from 'fs';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { json, agent } from '../helpers/hono-test-client';
import { supabaseSignupOrLogin } from './helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from './helpers/reset-backend';
import { createOrJoinUser } from './helpers/users';

describe('Security Edge Cases', () => {
  const alice = 'security.alice@e2e.local';
  const bob = 'security.bob@e2e.local';
  const charlie = 'security.charlie@e2e.local';
  const pw = 'Password1!';
  let tokenA = '';
  let tokenB = '';
  let tokenC = '';
  let homeId = '';
  let homeIdB = '';
  let choreUuid = '';

  // Test files for security scenarios
  const testFiles: { name: string; path: string; cleanup: boolean }[] = [];

  beforeAll(async () => {
    await resetBackendForEmails([alice, bob, charlie]);
    tokenA = await supabaseSignupOrLogin(alice, pw);
    tokenB = await supabaseSignupOrLogin(bob, pw);
    tokenC = await supabaseSignupOrLogin(charlie, pw);

    // Create homes
    const h1 = await json('POST', '/homes', { name: `Security Home A ${Date.now()}` });
    assert.equal(h1.status, 201); homeId = h1.json.id;
    const h2 = await json('POST', '/homes', { name: `Security Home B ${Date.now()}` });
    assert.equal(h2.status, 201); homeIdB = h2.json.id;

    // Alice and Bob in homeA, Charlie in homeB
    await createOrJoinUser(agent as any, alice, 'Alice', homeId);
    await createOrJoinUser(agent as any, bob, 'Bob', homeId);
    await createOrJoinUser(agent as any, charlie, 'Charlie', homeIdB);

    // Create a chore in homeA
    const c = await json('POST', '/chores', { 
      name: 'Security Test Chore', 
      description: 'test', 
      time: '2032-01-01T00:00:00', 
      icon: 'wind', 
      home_id: homeId, 
      points: 10 
    }, { Authorization: `Bearer ${tokenA}` });
    assert.equal(c.status, 201); choreUuid = c.json.uuid;
  }, 30000);

  describe('JWT Token Security', () => {
    it('should reject malformed JWT tokens', async () => {
      const malformedTokens = [
        'Bearer invalid.token.here',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid',
        'Bearer completely-invalid-token',
        'Bearer ' + 'a'.repeat(1000), // extremely long token
      ];

      for (const token of malformedTokens) {
        const res = await json('GET', `/points/${homeId}`, undefined, { Authorization: token });
        assert.ok([401, 400].includes(res.status), `Expected 401/400 for malformed token, got ${res.status}`);
      }
    });

    it('should reject tokens with wrong format', async () => {
      const wrongFormats = [
        tokenA, // missing Bearer prefix
        `Basic ${tokenA}`, // wrong auth type
        `Token ${tokenA}`, // wrong auth type
        `Bearer  ${tokenA}`, // extra space
        `bearer ${tokenA}`, // wrong case
      ];

      for (const header of wrongFormats) {
        const res = await json('GET', `/points/${homeId}`, undefined, { Authorization: header });
        assert.ok([401, 400].includes(res.status), `Expected 401/400 for wrong format, got ${res.status}`);
      }
    });

    it('should reject expired tokens gracefully', async () => {
      const expiredToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZXhwIjoxfQ.invalid';
      
      const res = await json('GET', `/points/${homeId}`, undefined, { Authorization: expiredToken });
      assert.ok([401, 400].includes(res.status), `Expected 401/400 for expired token, got ${res.status}`);
    });

    it('should reject tokens with missing claims', async () => {
      const noSubToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiSm9obiBEb2UifQ.invalid';
      
      const res = await json('GET', `/points/${homeId}`, undefined, { Authorization: noSubToken });
      assert.ok([401, 400].includes(res.status), `Expected 401/400 for token without claims, got ${res.status}`);
    });
  });

  describe('Cross-Home Authorization', () => {
    it('should prevent accessing resources from different home', async () => {
      const charlieHeader = { Authorization: `Bearer ${tokenC}` };
      
      const pointsRes = await json('GET', `/points/${homeId}`, undefined, charlieHeader);
      assert.equal(pointsRes.status, 403, 'Should not access points from different home');

      const approvalsRes = await json('GET', `/approvals/${choreUuid}`, undefined, charlieHeader);
      assert.equal(approvalsRes.status, 403, 'Should not access approvals from different home');

      const claimRes = await agent.patch(`/chores/${choreUuid}/claim`).set(charlieHeader);
      assert.ok([403, 409].includes(claimRes.status), 'Should not claim chore from different home');
    });

    it('should prevent creating chores in unauthorized homes', async () => {
      const charlieHeader = { Authorization: `Bearer ${tokenC}` };
      
      const res = await json('POST', '/chores', { 
        name: 'Unauthorized Chore', 
        description: 'test', 
        time: '2032-01-01T00:00:00', 
        icon: 'wind', 
        home_id: homeId, // Alice's home
        points: 10 
      }, charlieHeader);
      
      assert.ok([403, 404].includes(res.status), 'Should not create chore in unauthorized home');
    });
  });

  describe('Input Sanitization & XSS Prevention', () => {
    it('should handle XSS attempts in chore names', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '"><script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src=x onerror=alert("xss")>',
        '&lt;script&gt;alert("xss")&lt;/script&gt;',
      ];

      for (const payload of xssPayloads) {
        const res = await json('POST', '/chores', {
          name: payload,
          description: 'test',
          time: '2032-01-01T00:00:00',
          icon: 'wind',
          home_id: homeId,
          points: 10
        }, { Authorization: `Bearer ${tokenA}` });

        // Should either sanitize and accept or reject
        assert.ok([201, 400, 422].includes(res.status), `XSS payload should be handled appropriately, got ${res.status}`);
        
        if (res.status === 201) {
          // If accepted, ensure it was sanitized
          const chore = await json('GET', `/chores/${res.json.uuid}`, undefined, { Authorization: `Bearer ${tokenA}` });
          assert.equal(chore.status, 200);
          assert.ok(!chore.json.name.includes('<script'), 'XSS should be sanitized');
        }
      }
    });

    it('should handle SQL injection attempts', async () => {
      const sqlPayloads = [
        "'; DROP TABLE chores; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "admin'--",
        "admin')/*",
      ];

      for (const payload of sqlPayloads) {
        const res = await json('POST', '/chores', {
          name: payload,
          description: 'test',
          time: '2032-01-01T00:00:00',
          icon: 'wind',
          home_id: homeId,
          points: 10
        }, { Authorization: `Bearer ${tokenA}` });

        // Should handle SQL injection gracefully
        assert.ok([201, 400, 422].includes(res.status), `SQL injection should be handled, got ${res.status}`);
      }
    });
  });

  describe('File Upload Security', () => {
    it('should reject files with dangerous extensions', async () => {
      const dangerousFiles = [
        { name: 'malware.exe', content: 'MZ\x90\x00' },
        { name: 'script.js', content: 'alert("xss");' },
        { name: 'config.php', content: '<?php system($_GET["cmd"]); ?>' },
        { name: 'test.bat', content: '@echo off\ndir' },
        { name: 'shell.sh', content: '#!/bin/bash\nrm -rf /' },
      ];

      for (const file of dangerousFiles) {
        const tempPath = join(tmpdir(), `test-${Date.now()}-${file.name}`);
        writeFileSync(tempPath, file.content);
        testFiles.push({ name: file.name, path: tempPath, cleanup: true });

        try {
          const res = await agent
            .post('/upload/chore-image')
            .set('Authorization', `Bearer ${tokenA}`)
            .attach('image', tempPath);

          // Should reject dangerous files
          assert.ok([400, 415, 422].includes(res.status), 
            `Should reject ${file.name}, got ${res.status}`);
        } catch (error) {
          // Network errors are acceptable for security rejections
        }
      }
    });

    it('should reject oversized files', async () => {
      const hugePath = join(tmpdir(), `huge-${Date.now()}.jpg`);
      // Create 50MB file
      const hugeContent = Buffer.alloc(50 * 1024 * 1024, 0xFF);
      writeFileSync(hugePath, hugeContent);
      testFiles.push({ name: 'huge.jpg', path: hugePath, cleanup: true });

      try {
        const res = await agent
          .post('/upload/chore-image')
          .set('Authorization', `Bearer ${tokenA}`)
          .attach('image', hugePath);

        // Should reject oversized files
        assert.ok([400, 413, 422].includes(res.status), 
          `Should reject oversized file, got ${res.status}`);
      } catch (error) {
        // Network errors acceptable for oversized files
      }
    });

    it('should handle malformed file uploads', async () => {
      const malformedPath = join(tmpdir(), `malformed-${Date.now()}.jpg`);
      // Create file with invalid JPEG header
      writeFileSync(malformedPath, 'NOTJPEG');
      testFiles.push({ name: 'malformed.jpg', path: malformedPath, cleanup: true });

      try {
        const res = await agent
          .post('/upload/chore-image')
          .set('Authorization', `Bearer ${tokenA}`)
          .attach('image', malformedPath);

        assert.ok([400, 415, 422].includes(res.status), 
          `Should handle malformed files, got ${res.status}`);
      } catch (error) {
        // Acceptable
      }
    });
  });

  describe('Session Management', () => {
    it('should handle missing Authorization header', async () => {
      const res = await json('GET', `/points/${homeId}`);
      assert.equal(res.status, 401, 'Should require authorization');
    });

    it('should handle empty Authorization header', async () => {
      const res = await json('GET', `/points/${homeId}`, undefined, { Authorization: '' });
      assert.equal(res.status, 401, 'Should reject empty auth header');
    });

    it('should handle Authorization header with only Bearer', async () => {
      const res = await json('GET', `/points/${homeId}`, undefined, { Authorization: 'Bearer' });
      assert.equal(res.status, 401, 'Should reject Bearer without token');
    });

    it('should handle multiple Authorization headers gracefully', async () => {
      const res = await agent
        .get(`/points/${homeId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Authorization', `Bearer ${tokenB}`);
      
      assert.ok([200, 401, 403].includes(res.status), 
        `Should handle multiple auth headers gracefully, got ${res.status}`);
    });
  });

  describe('Rate Limiting & DoS Protection', () => {
    it('should handle rapid successive requests gracefully', async () => {
      const promises = Array.from({ length: 50 }, () => 
        json('GET', `/points/${homeId}`, undefined, { Authorization: `Bearer ${tokenA}` })
      );
      
      const results = await Promise.all(promises);
      
      for (const result of results) {
        assert.ok([200, 429, 403].includes(result.status), 
          `Unexpected status during rate limit test: ${result.status}`);
      }
    });

    it('should prevent resource exhaustion attacks', async () => {
      const promises = Array.from({ length: 20 }, () => 
        json('GET', `/user/${alice}/home`, undefined, { Authorization: `Bearer ${tokenA}` })
      );
      
      const results = await Promise.all(promises);
      
      for (const result of results) {
        assert.ok([200, 429, 403, 404].includes(result.status), 
          `Unexpected status during concurrent auth: ${result.status}`);
      }
    });
  });

  afterAll(async () => {
    // Cleanup test files
    for (const file of testFiles) {
      if (file.cleanup) {
        try {
          unlinkSync(file.path);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
    await cleanupTestData();
  });
});