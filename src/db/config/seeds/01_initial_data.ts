import { Knex } from "knex";
import { v4 as uuidv4 } from "uuid";

// Helper function to create future timestamps
const minutesFromNow = (mins: number) => {
  const d = new Date();
  d.setMinutes(d.getMinutes() + mins);
  return d.toISOString();
};

// Helper function for past timestamps
const hoursAgo = (hours: number) => {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d.toISOString();
};

// Simple helper that returns local seed image paths
const img = (query: string) => `/seed/${query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}.jpg`;



export async function seed(knex: Knex): Promise<void> {
  // Set timezone for this session
  await knex.raw("SET timezone = 'America/Los_Angeles'");


  
  // clear in FK-safe order
  await knex("dispute_votes").del().catch(() => {});
  await knex("chore_approvals").del().catch(() => {});
  await knex("todo_items").del().catch(() => {});
  await knex("disputes").del().catch(() => {});
  await knex("chores").del().catch(() => {});
  await knex("user_homes").del().catch(() => {});
  await knex("users").del().catch(() => {});
  await knex("home").del().catch(() => {});

  /* Create one demo house */
  const demoHouse = { id: uuidv4(), name: "Demo House" };
  await knex("home").insert(demoHouse);

  /* Create demo users - all in the same house */
  const users = [
    { email: "alice@demo.com", name: "Alice Johnson" },
    { email: "bob@demo.com", name: "Bob Smith" },
    { email: "charlie@demo.com", name: "Charlie Brown" },
    { email: "diana@demo.com", name: "Diana Prince" },
  ];
  await knex("users").insert(users);
  const userByEmail = Object.fromEntries(users.map((u) => [u.email, u]));

  /* Add all users to the demo house */
  await knex("user_homes").insert(
    users.map(user => ({
      user_email: user.email,
      home_id: demoHouse.id,
      points: 0 // Start with 0 points, will be updated after chores are created
    }))
  );

  /* Create comprehensive chore data */
  const chores = [
    // 5 UNCLAIMED chores
    {
      uuid: uuidv4(),
      name: "Vacuum Living Room",
      description: "Vacuum the entire living room including under furniture.",
      time: minutesFromNow(2000),
      icon: "wind",
      status: "unclaimed",
      user_email: null,
      home_id: demoHouse.id,
      claimed_at: null,
      completed_at: null,
      points: 30,
      photo_url: img("vacuum living room")
    },
    {
      uuid: uuidv4(),
      name: "Wash Dishes",
      description: "Wash and dry all dishes in the sink.",
      time: minutesFromNow(720),
      icon: "droplets",
      status: "unclaimed",
      user_email: null,
      home_id: demoHouse.id,
      claimed_at: null,
      completed_at: null,
      points: 20,
      photo_url: img("washing dishes kitchen sink")
    },
    {
      uuid: uuidv4(),
      name: "Take Out Trash",
      description: "Empty all trash cans and take to the curb.",
      time: minutesFromNow(1000),
      icon: "trash-2",
      status: "unclaimed",
      user_email: null,
      home_id: demoHouse.id,
      claimed_at: null,
      completed_at: null,
      points: 10,
      photo_url: img("taking out trash bin")
    },
    {
      uuid: uuidv4(),
      name: "Dust Shelves",
      description: "Dust all shelves and surfaces in the house.",
      time: minutesFromNow(1429),
      icon: "feather",
      status: "unclaimed",
      user_email: null,
      home_id: demoHouse.id,
      claimed_at: null,
      completed_at: null,
      points: 25,
      photo_url: img("dusting shelves")
    },
    {
      uuid: uuidv4(),
      name: "Mop Kitchen",
      description: "Mop the kitchen floor thoroughly.",
      time: minutesFromNow(1429),
      icon: "droplets",
      status: "unclaimed",
      user_email: null,
      home_id: demoHouse.id,
      claimed_at: null,
      completed_at: null,
      points: 35,
      photo_url: img("mopping kitchen floor")
    },

    // 2 COMPLETED chores (that will be disputed)
    {
      uuid: uuidv4(),
      name: "Clean Bathroom",
      description: "Clean the bathroom including toilet, sink, and shower.",
      time: minutesFromNow(45),
      icon: "droplets",
      status: "complete",
      user_email: userByEmail["alice@demo.com"].email,
      home_id: demoHouse.id,
      claimed_at: hoursAgo(2),
      completed_at: hoursAgo(4),
      points: 45,
      photo_url: img("clean bathroom sink shower")
    },
    {
      uuid: uuidv4(),
      name: "Organize Closet",
      description: "Organize the master bedroom closet.",
      time: minutesFromNow(60),
      icon: "package",
      status: "complete",
      user_email: userByEmail["bob@demo.com"].email,
      home_id: demoHouse.id,
      claimed_at: hoursAgo(3),
      completed_at: hoursAgo(1),
      points: 60,
      photo_url: img("organized closet wardrobe")
    },

    // CLAIMED chores (in progress)
    {
      uuid: uuidv4(),
      name: "Laundry",
      description: "Wash, dry, and fold one load of laundry.",
      time: minutesFromNow(90),
      icon: "shirt",
      status: "claimed",
      user_email: userByEmail["charlie@demo.com"].email,
      home_id: demoHouse.id,
      claimed_at: hoursAgo(1),
      completed_at: null,
      points: 90,
      photo_url: img("laundry washing machine")
    },
    {
      uuid: uuidv4(),
      name: "Sweep Porch",
      description: "Sweep the front and back porches.",
      time: minutesFromNow(15),
      icon: "brush",
      status: "claimed",
      user_email: userByEmail["diana@demo.com"].email,
      home_id: demoHouse.id,
      claimed_at: hoursAgo(30),
      completed_at: null,
      points: 15,
      photo_url: img("sweeping porch")
    },

    // COMPLETED chores (approved)
    {
      uuid: uuidv4(),
      name: "Make Bed",
      description: "Make all beds in the house.",
      time: minutesFromNow(10),
      icon: "bed",
      status: "complete",
      user_email: userByEmail["alice@demo.com"].email,
      home_id: demoHouse.id,
      claimed_at: hoursAgo(4),
      completed_at: hoursAgo(3),
      points: 10,
      photo_url: img("made bed bedroom")
    },
    {
      uuid: uuidv4(),
      name: "Water Plants",
      description: "Water all indoor and outdoor plants.",
      time: minutesFromNow(20),
      icon: "droplets",
      status: "complete",
      user_email: userByEmail["bob@demo.com"].email,
      home_id: demoHouse.id,
      claimed_at: hoursAgo(5),
      completed_at: hoursAgo(4),
      points: 20,
      photo_url: img("watering plants indoor")
    },
  ];
  await knex("chores").insert(chores);
  const choreByName = Object.fromEntries(chores.map((c) => [c.name, c]));

  // Award points for completed chores
  const completedChores = chores.filter(c => c.status === "complete");
  for (const chore of completedChores) {
    if (chore.user_email && chore.points > 0) {
      let pointsToAward = chore.points;
      
      // Calculate dynamic points based on when the chore was claimed
      if (chore.claimed_at) {
        const created = new Date(); // Use current time as created time for seed data
        const claimed = new Date(chore.claimed_at);
        const hoursUnclaimed = (claimed.getTime() - created.getTime()) / (1000 * 60 * 60);
        const bonusMultiplier = Math.min(1 + (hoursUnclaimed / 24) * 0.1, 2.0);
        pointsToAward = Math.round(chore.points * bonusMultiplier);
      }
      
      await knex("user_homes")
        .where({ home_id: chore.home_id, user_email: chore.user_email })
        .increment("points", pointsToAward);
    }
  }

  /* Create todo items for chores */
  const todoData: [string, [string, string][]][] = [
    [
      "Vacuum Living Room",
      [
        ["Clear floor", "Remove any items from the floor"],
        ["Vacuum main area", "Vacuum the open floor space"],
        ["Vacuum under furniture", "Use attachments to reach under couches and tables"],
        ["Empty vacuum", "Empty the vacuum cleaner bag/canister"],
      ],
    ],
    [
      "Wash Dishes",
      [
        ["Scrape plates", "Remove leftover food from dishes"],
        ["Wash with soap", "Use hot, soapy water to wash each dish"],
        ["Rinse thoroughly", "Rinse off all soap suds"],
        ["Dry and put away", "Use a towel or drying rack"],
      ],
    ],
    [
      "Take Out Trash",
      [
        ["Collect trash", "Gather trash from all bins in the house"],
        ["Replace liners", "Put new liners in all the trash cans"],
        ["Take out to curb", "Take the main trash bag to the outdoor bin/curb"],
      ],
    ],
    [
      "Dust Shelves",
      [
        ["Gather supplies", "Get a duster or microfiber cloth"],
        ["Dust high surfaces", "Start from top to bottom"],
        ["Dust furniture", "Dust tables, shelves, and other furniture"],
      ],
    ],
    [
      "Mop Kitchen",
      [
        ["Sweep first", "Remove loose dirt and debris"],
        ["Prepare mop solution", "Fill a bucket with water and cleaning solution"],
        ["Mop the floor", "Mop from the farthest corner towards the door"],
        ["Let it dry", "Allow the floor to air dry completely"],
      ],
    ],
    [
      "Clean Bathroom",
      [
        ["Gather supplies", "Get cleaning supplies and gloves"],
        ["Clean toilet", "Clean inside and outside of toilet"],
        ["Clean sink", "Clean sink and countertop"],
        ["Clean shower", "Clean shower walls and floor"],
      ],
    ],
    [
      "Organize Closet",
      [
        ["Remove everything", "Take all items out of the closet"],
        ["Sort items", "Group items into categories: keep, donate, trash"],
        ["Clean closet", "Wipe down shelves and vacuum floor"],
        ["Arrange items", "Place items back in an organized manner"],
      ],
    ],
    [
      "Laundry",
      [
        ["Sort clothes", "Separate lights, darks, and colors"],
        ["Wash load", "Put one load in the washing machine with detergent"],
        ["Dry load", "Transfer washed clothes to the dryer"],
        ["Fold and put away", "Fold the dry clothes and put them away"],
      ],
    ],
    [
      "Sweep Porch",
      [
        ["Get broom and dustpan", "Grab the necessary tools"],
        ["Sweep front porch", "Sweep all debris from the front porch"],
        ["Sweep back porch", "Sweep all debris from the back porch"],
        ["Dispose of debris", "Use the dustpan to collect and throw away the pile"],
      ],
    ],
    [
      "Make Bed",
      [
        ["Strip old sheets", "Remove old sheets and pillowcases"],
        ["Put on fitted sheet", "Put on the fitted sheet"],
        ["Put on flat sheet", "Put on the flat sheet and tuck in"],
        ["Add pillows", "Add pillows and arrange them nicely"],
      ],
    ],
    [
      "Water Plants",
      [
        ["Check soil", "Check if soil is dry before watering"],
        ["Water indoor plants", "Water all indoor plants"],
        ["Water outdoor plants", "Water all outdoor plants"],
        ["Clean up", "Wipe up any spilled water"],
      ],
    ],
  ];

  const todoRows = todoData.flatMap(([choreName, steps]) =>
    steps.map(([name, description], order) => ({
      id: uuidv4(),
      chore_id: choreByName[choreName].uuid,
      name,
      description,
      order,
    }))
  );

  await knex("todo_items").insert(todoRows);

  /* Create 2 active disputes */
  const disputes = [
    {
      uuid: uuidv4(),
      chore_id: choreByName["Clean Bathroom"].uuid,
      disputer_email: userByEmail["charlie@demo.com"].email,
      reason: "The bathroom wasn't cleaned properly. There's still soap scum in the shower and the toilet wasn't disinfected.",
      image_url: img("dirty bathroom shower tiles"),
      status: "pending",
      created_at: hoursAgo(2),
      updated_at: new Date().toISOString(),
    },
    {
      uuid: uuidv4(),
      chore_id: choreByName["Organize Closet"].uuid,
      disputer_email: userByEmail["diana@demo.com"].email,
      reason: "The closet organization is incomplete. Clothes are still mixed up and there's no proper categorization.",
      image_url: img("messy closet clothes floor"),
      status: "pending",
      created_at: hoursAgo(1),
      updated_at: new Date().toISOString(),
    },
  ];

  await knex("disputes").insert(disputes);

  /* Create dispute votes - only one vote per dispute so they don't auto-resolve */
  const disputeVotes = [
    {
      dispute_uuid: disputes[0].uuid,
      user_email: userByEmail["alice@demo.com"].email, // Alice votes to approve
      vote: "approve",
    },
    {
      dispute_uuid: disputes[1].uuid,
      user_email: userByEmail["alice@demo.com"].email, // Alice votes to approve
      vote: "approve",
    },
  ];

  await knex("dispute_votes").insert(disputeVotes);
}
