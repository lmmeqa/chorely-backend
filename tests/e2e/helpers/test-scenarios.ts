import crypto from 'node:crypto';

export type ScenarioUser = {
  name: string;
  email: string;
  password: string;
};

export type HouseScenario = {
  label: string;
  users: ScenarioUser[];
  homeName: string;
};

function makeEmail(suffix: string): string {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString('hex');
  return `e2e_${suffix}_${ts}_${rand}@demo.com`;
}

export function buildTwoPersonHouse(): HouseScenario {
  const password = 'Password1!';
  // Stable emails to allow re-use of Supabase users across test runs
  const u1: ScenarioUser = { name: 'Alice', email: 'alice@e2e.local', password };
  const u2: ScenarioUser = { name: 'Bob', email: 'bob@e2e.local', password };
  return {
    label: 'Two Person House',
    users: [u1, u2],
    homeName: `E2E Home Two Person ${Date.now()}`,
  };
}

export function buildFourPersonHouse(): HouseScenario {
  const password = 'Password1!';
  const u1: ScenarioUser = { name: 'Alice', email: 'alice@e2e.local', password };
  const u2: ScenarioUser = { name: 'Bob', email: 'bob@e2e.local', password };
  const u3: ScenarioUser = { name: 'Diana', email: 'diana@e2e.local', password };
  const u4: ScenarioUser = { name: 'Charlie', email: 'charlie@e2e.local', password };
  return {
    label: 'Four Person House',
    users: [u1, u2, u3, u4],
    homeName: `E2E Home Four Person ${Date.now()}`,
  };
}

export const Scenarios = {
  twoPerson: buildTwoPersonHouse,
  fourPerson: buildFourPersonHouse,
};

export interface TestUser {
  name: string;
  email: string;
  password: string;
}

export interface TestScenario {
  name: string;
  users: TestUser[];
  description: string;
}

export const TWO_PERSON_SCENARIO: TestScenario = {
  name: 'Two Person House',
  users: [
    {
      name: 'Alice',
      email: `alice_${Date.now()}@demo.com`,
      password: 'Password1!'
    },
    {
      name: 'Bob',
      email: `bob_${Date.now()}@demo.com`,
      password: 'Password1!'
    }
  ],
  description: 'Basic two-person household for simple chore management testing'
};

export const FOUR_PERSON_SCENARIO: TestScenario = {
  name: 'Four Person House',
  users: [
    {
      name: 'Alice',
      email: `alice_${Date.now()}@demo.com`,
      password: 'Password1!'
    },
    {
      name: 'Bob',
      email: `bob_${Date.now()}@demo.com`,
      password: 'Password1!'
    },
    {
      name: 'Diana',
      email: `diana_${Date.now()}@demo.com`,
      password: 'Password1!'
    },
    {
      name: 'Charlie',
      email: `charlie_${Date.now()}@demo.com`,
      password: 'Password1!'
    }
  ],
  description: 'Four-person household for complex interactions like multiple disputes, voting patterns, and approval dynamics'
};

export const SCENARIOS = {
  TWO_PERSON: TWO_PERSON_SCENARIO,
  FOUR_PERSON: FOUR_PERSON_SCENARIO
};

// Helper function to get a fresh scenario (with new timestamps)
export function getFreshScenario(scenario: TestScenario): TestScenario {
  const timestamp = Date.now();
  return {
    ...scenario,
    users: scenario.users.map(user => ({
      ...user,
      email: user.email.replace(/\d+@/, `${timestamp}@`)
    }))
  };
}
