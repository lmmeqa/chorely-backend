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
    // 2 UNCLAIMED chores
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
      
      // For seed data, use the points as-is since they already represent the final values
      // The dynamic calculation is only for real-time chore claiming, not seed data
      pointsToAward = chore.points;
      
      await knex("user_homes")
        .where({ home_id: chore.home_id, user_email: chore.user_email })
        .increment("points", pointsToAward);
    }
  }

  /* Create todo items for chores */
  const todoData: [string, string[]][] = [
    [
      "Vacuum Living Room",
      [
        "Clear the floor of any small objects or debris",
        "Plug in the vacuum cleaner and unwind the cord",
        "Start from one corner of the room and vacuum in rows",
        "Pay extra attention to high-traffic areas and under furniture",
        "Empty the vacuum canister or replace the bag when full",
        "Once done, wind the cord and store the vacuum cleaner"
      ],
    ],
    [
      "Wash Dishes",
      [
        "Scrape off any leftover food from plates and utensils",
        "Fill the sink with warm soapy water",
        "Wash dishes in order: glasses, plates, utensils, then pots and pans",
        "Rinse each item thoroughly with clean water",
        "Place items in the drying rack or dry with a clean towel",
        "Empty the sink and wipe down the counter"
      ],
    ],

    [
      "Clean Bathroom",
      [
        "Gather cleaning supplies and put on gloves",
        "Clean the toilet inside and out with disinfectant",
        "Clean the sink and countertop with cleaner",
        "Clean the shower walls and floor",
        "Wipe down mirrors and fixtures",
        "Empty the trash and replace the liner"
      ],
    ],
    [
      "Organize Closet",
      [
        "Remove all items from the closet",
        "Sort items into categories: keep, donate, trash",
        "Clean the closet shelves and vacuum the floor",
        "Arrange items back in an organized manner",
        "Use storage solutions for better organization"
      ],
    ],
    [
      "Laundry",
      [
        "Sort clothes by color and fabric type",
        "Check pockets and remove any items",
        "Add detergent and start the washing machine",
        "Transfer clothes to the dryer when done",
        "Fold clean clothes and put them away"
      ],
    ],
    [
      "Sweep Porch",
      [
        "Get a broom and dustpan",
        "Sweep all debris from the front porch",
        "Sweep all debris from the back porch",
        "Collect the debris with the dustpan",
        "Dispose of the debris in the trash"
      ],
    ],
    [
      "Make Bed",
      [
        "Remove any items from the bed",
        "Straighten the fitted sheet and tuck in corners",
        "Smooth out the top sheet and tuck it under the mattress",
        "Fluff and arrange pillows at the head of the bed",
        "Add any decorative pillows or throws",
        "Smooth out the comforter or duvet cover"
      ],
    ],
    [
      "Water Plants",
      [
        "Check if the soil is dry before watering",
        "Water all indoor plants thoroughly",
        "Water all outdoor plants as needed",
        "Avoid overwatering by checking soil moisture",
        "Clean up any spilled water"
      ],
    ],
  ];

  const todoRows = todoData.flatMap(([choreName, steps]) =>
    steps.map((name, order) => ({
      id: uuidv4(),
      chore_id: choreByName[choreName].uuid,
      name,
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
             user_email: userByEmail["alice@demo.com"].email, // Alice votes to sustain
             vote: "sustain",
           },
           {
             dispute_uuid: disputes[1].uuid,
             user_email: userByEmail["alice@demo.com"].email, // Alice votes to sustain
             vote: "sustain",
           },
         ];

  await knex("dispute_votes").insert(disputeVotes);
}
