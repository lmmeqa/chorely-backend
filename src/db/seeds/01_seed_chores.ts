/*  src/db/seeds/01_seed_data.ts
    ------------------------------------------------------------------
    Populates initial demo data for users, chore templates, chores,
    and todo tasks.  Run with:

        npx ts-node -r tsconfig-paths/register \
          ./node_modules/knex/bin/cli.js seed:run \
          --knexfile src/db/knexfile.ts

    or (inside Docker) by calling the same CLI in your entry-point.
------------------------------------------------------------------- */

import { Knex } from 'knex';
import { v4 as uuid } from 'uuid';

/** Helper so we can reuse timestamps */
const now = new Date().toISOString();

/**
 * Seed script – Knex will call this automatically.
 */
export async function seed(knex: Knex): Promise<void> {
  // 1️⃣  Clear tables (respect FK order)
  await knex('chores').del();
  await knex('chore_templates').del();
  await knex('users').del();


  // 3️⃣  Chore templates -------------------------------------------
  /* Each entry is a blueprint that can later be instantiated into a
     specific chore row. */
  const templates = [
    {
      uuid: uuid(),
      name: 'Sorting Boxes',
      description: 'Sort and label storage boxes',
      icon: 'package',
      default_time: 75,
    },
    {
      uuid: uuid(),
      name: 'Organizing Shelves',
      description: 'Organize the living-room shelves',
      icon: 'package',
      default_time: 75,
    },
    {
      uuid: uuid(),
      name: 'Dusting',
      description: 'Dust all surfaces',
      icon: 'feather',
      default_time: 25,
    },
    {
      uuid: uuid(),
      name: 'Mopping Floors',
      description: 'Mop kitchen & bath',
      icon: 'droplets',
      default_time: 35,
    },
    {
      uuid: uuid(),
      name: 'Taking Out Trash',
      description: 'Empty all bins & take to curb',
      icon: 'trash-2',
      default_time: 10,
    },
    {
      uuid: uuid(),
      name: 'Sweeping Porch',
      description: 'Sweep the front porch',
      icon: 'brush',
      default_time: 15,
    },
    {
      uuid: uuid(),
      name: 'Washing Dishes',
      description: 'Wash and dry dishes',
      icon: 'droplets',
      default_time: 30,
    },
    {
      uuid: uuid(),
      name: 'Vacuuming House',
      description: 'Vacuum entire house',
      icon: 'wind',
      default_time: 45,
    },
    {
      uuid: uuid(),
      name: 'Laundry',
      description: 'Wash, dry & fold laundry',
      icon: 'shirt',
    },
  ];

  await knex('chore_templates').insert(
    templates.map((t) => ({ ...t, created_at: now, updated_at: now }))
  );

  // 4️⃣  Concrete chores  ------------------------------------------
  /* We create a few sample chores from those templates.
     - status values: 'unapproved' | 'unclaimed' | 'claimed' | 'complete'
  */
  const chores = [
    // unapproved
    {
      uuid: uuid(),
    //   template_id: templates[0].id,
      status: 'unapproved',
    //   assigned_to: null,
    },
    // unclaimed
    {
      uuid: uuid(),
    //   template_id: templates[1].id,
      status: 'unclaimed',
    //   assigned_to: null,
    },
    {
      uuid: uuid(),
    //   template_id: templates[2].id,
      status: 'unclaimed',
    //   assigned_to: null,
    },
    {
      uuid: uuid(),
    //   template_id: templates[3].id,
      status: 'unclaimed',
    //   assigned_to: null,
    },
    // claimed
    {
      uuid: uuid(),
    //   template_id: templates[5].id,
      status: 'claimed',
    //   assigned_to: null,
    },
    {
      uuid: uuid(),
    //   template_id: templates[6].id,
      status: 'claimed',
    //   assigned_to: null,
    },
    // complete
    {
      uuid: uuid(),
    //   template_id: templates[7].id,
      status: 'complete',
    //   assigned_to: null,
    },
    {
      uuid: uuid(),
    //   template_id: templates[8].id,
      status: 'complete',
    //   assigned_to: null,
    },
  ];

  await knex('chores').insert(
    chores.map((c) => ({ ...c, created_at: now, updated_at: now }))
  )}