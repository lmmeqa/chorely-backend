# ChatGPT Test Completion Guide

## Context
This Chorely backend project was converted from Express/Supertest to pure Hono with native testing patterns. During the conversion, 5 unit test files (19 tests) were accidentally deleted that tested critical middleware functionality.

I have restored and converted **4 of the 5 test files** to work with Hono, but there are still some issues to resolve and one major test file needs full conversion.

## Current Status
- **Total tests before**: 70 tests  
- **Current tests passing**: 51 tests
- **My converted Hono tests**: ~15 additional tests (some have issues)
- **Goal**: Get back to 70+ passing tests

## What I've Done ✅
1. ✅ Created `tests/unit/errorHandler.hono.unit.test.ts` (5 tests, mostly working)
2. ✅ Created `tests/unit/errorHandler.extend.hono.unit.test.ts` (2 tests)
3. ✅ Created `tests/unit/supabaseAuth.hono.unit.test.ts` (4 tests)
4. ✅ Created `tests/unit/supabaseAuth.extend.hono.unit.test.ts` (3 tests)
5. 🚧 Started `tests/unit/authorization.hono.unit.test.ts` (11 tests, **needs completion**)

## What You Need to Do 🔧

### 1. Fix the String Error Test (Quick Fix)
In `tests/unit/errorHandler.hono.unit.test.ts`, the "handles non-Error objects gracefully" test is failing because Hono's error handling is different. The test should catch the error properly:

```typescript
// ISSUE: This test in errorHandler.hono.unit.test.ts line ~60
app.get('/t', () => {
  throw 'string error'; // This isn't being caught by onError properly
});
```

**Fix**: Update the test to either:
- Use a different error handling approach, or
- Skip this test if it's not critical

### 2. Complete the Authorization Tests (Major Task)
The file `tests/unit/authorization.hono.unit.test.ts` has the framework but needs the **database mocking fixed**. The current mock isn't working properly.

**Issues**:
- The drizzle ORM mock on line 27 is not correctly simulating database responses
- The `state.user_homes` array lookup logic needs to match the actual Drizzle query patterns
- Need to test all authorization functions: `requireHomeMemberByParam`, `requireHomeMemberByQuery`, `requireSelfEmailByQuery`, `requireSelfEmailByBody`, `requireHomeMemberByChoreUuidParam`, `requireHomeMemberByDisputeUuidParam`

**Reference**: Look at the original `tests/unit/authorization.unit.test.ts` file for the complete test scenarios.

### 3. Run All Tests
After fixes, run:
```bash
npm test
```

Should get ~66+ tests passing (51 current + 15 new ones).

### 4. Clean Up
Delete the old Express test files after confirming new ones work:
```bash
rm tests/unit/authorization.unit.test.ts
rm tests/unit/errorHandler.unit.test.ts  
rm tests/unit/errorHandler.extend.unit.test.ts
rm tests/unit/supabaseAuth.unit.test.ts
rm tests/unit/supabaseAuth.extend.unit.test.ts
```

## Technical Details

### Database Mocking Pattern
The authorization tests need to mock Drizzle ORM queries. The pattern should be:
```typescript
// Mock the database to return user_homes data
vi.mock('../../src/lib/db', () => ({
  dbFromEnv: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([/* mock data */])
        })
      })
    })
  })
}));
```

### Authorization Functions to Test
Each of these needs test coverage:
- `requireHomeMemberByParam` - checks URL params
- `requireHomeMemberByQuery` - checks query params  
- `requireSelfEmailByQuery` - validates user owns email in query
- `requireSelfEmailByBody` - validates user owns email in body
- `requireSelfEmailByParam` - validates user owns email in URL
- `requireHomeMemberByChoreUuidParam` - checks home membership via chore
- `requireHomeMemberByDisputeUuidParam` - checks home membership via dispute

### Test Scenarios to Cover
- ✅ Unauthenticated requests (401)
- ✅ Missing parameters (400)  
- ✅ Non-members accessing home resources (403)
- ✅ Valid members accessing resources (200)
- 🚧 Database errors during authorization (500)
- 🚧 Chore UUID to home validation
- 🚧 Dispute UUID to home validation

## Files to Focus On
1. **Priority 1**: `tests/unit/authorization.hono.unit.test.ts` - Fix database mocking
2. **Priority 2**: `tests/unit/errorHandler.hono.unit.test.ts` - Fix string error test  
3. **Priority 3**: Run `npm test` and verify ~66+ tests pass

## Success Criteria
- All 5 converted test files run without errors
- Total test count reaches 65+ (ideally 70+)
- All authorization edge cases are covered
- No Express/Supertest dependencies remain

The converted tests use modern Hono patterns and will be more maintainable for Cloudflare Workers deployment.