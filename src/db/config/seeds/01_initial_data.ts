import { Knex } from "knex";
import { v4 as uuidv4 } from "uuid";

// Helper function to create Pacific timezone timestamps
const minutesFromNow = (mins: number) => {
  const d = new Date();
  d.setMinutes(d.getMinutes() + mins);
  // Convert to Pacific timezone and format as ISO string
  const pacificTime = new Date(d.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles"
  }));
  return pacificTime.toISOString();
};

// Helper function for past timestamps in Pacific time
const hoursAgo = (hours: number) => {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  // Convert to Pacific timezone and format as ISO string
  const pacificTime = new Date(d.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles"
  }));
  return pacificTime.toISOString();
};

export async function seed(knex: Knex): Promise<void> {
  // Set timezone for this session
  await knex.raw("SET timezone = 'America/Los_Angeles'");
  
  // clear in FK-safe order
  await knex("chore_approvals").del().catch(() => {});
  await knex("todo_items").del().catch(() => {});
  await knex("disputes").del().catch(() => {});
  await knex("chores").del().catch(() => {});
  await knex("user_homes").del().catch(() => {});
  await knex("users").del().catch(() => {});
  await knex("home").del().catch(() => {});

  /* home (singular, no address column) */
  const homes = [
    { id: uuidv4(), name: "Main House" },
    { id: uuidv4(), name: "Summer Cabin" },
    { id: uuidv4(), name: "Downtown Apartment" },
  ];
  await knex("home").insert(homes);
  const homeByName = Object.fromEntries(homes.map((h) => [h.name, h]));

  /* users (now requires name; email used as FK) */
  const users = [
    {  email: "user@example.com", name: "John Doe" },
    { email: "roommate@example.com", name: "Jane Smith" },
    {email: "family@example.com", name: "Mike Johnson" },
  ];
  await knex("users").insert(users);
  const userByEmail = Object.fromEntries(users.map((u) => [u.email, u]));

  /* user_homes (email-based FK) */
  await knex("user_homes").insert([
    { user_email: "user@example.com", home_id: homeByName["Main House"].id },
    { user_email: "user@example.com", home_id: homeByName["Summer Cabin"].id },
    { user_email: "roommate@example.com", home_id: homeByName["Main House"].id },
    { user_email: "family@example.com", home_id: homeByName["Summer Cabin"].id },
    { user_email: "family@example.com", home_id: homeByName["Downtown Apartment"].id },
  ]);

  /* chores (time -> timestamptz; user_email instead of user_id; add completed_at for completed chores) */
  const chores = [
    {
      uuid: uuidv4(),
      name: "Sorting Boxes",
      description: "This is an unapproved chore.",
      time: minutesFromNow(75), // 1h 15m
      icon: "package",
      status: "unapproved",
      user_email: null,
      home_id: homeByName["Main House"].id,
      completed_at: null,
    },
    {
      uuid: uuidv4(),
      name: "Organizing",
      description: "Organize the living-room shelves.",
      time: minutesFromNow(75),
      icon: "package",
      status: "unclaimed",
      user_email: null,
      home_id: homeByName["Main House"].id,
      completed_at: null,
    },
    {
      uuid: uuidv4(),
      name: "Dusting",
      description: "Dust all surfaces in the main room.",
      time: minutesFromNow(25),
      icon: "feather",
      status: "unclaimed",
      user_email: null,
      home_id: homeByName["Main House"].id,
      completed_at: null,
    },
    {
      uuid: uuidv4(),
      name: "Mopping",
      description: "Mop the kitchen and bathroom floors.",
      time: minutesFromNow(35),
      icon: "droplets",
      status: "unclaimed",
      user_email: null,
      home_id: homeByName["Main House"].id,
      completed_at: null,
    },
    {
      uuid: uuidv4(),
      name: "Taking out trash",
      description: "Empty all trash cans and take out the garbage.",
      time: minutesFromNow(10),
      icon: "trash-2",
      status: "unclaimed",
      user_email: null,
      home_id: homeByName["Main House"].id,
      completed_at: null,
    },
    {
      uuid: uuidv4(),
      name: "Sweeping",
      description: "Sweep the front porch.",
      time: minutesFromNow(730), // 12h 10m
      icon: "brush",
      status: "claimed",
      user_email: userByEmail["user@example.com"].email,
      home_id: homeByName["Main House"].id,
      completed_at: null,
    },
    {
      uuid: uuidv4(),
      name: "Washing Dishes",
      description: "Wash and dry all dishes in the sink.",
      time: minutesFromNow(30),
      icon: "droplets",
      status: "claimed",
      user_email: userByEmail["user@example.com"].email,
      home_id: homeByName["Main House"].id,
      completed_at: null,
    },
    {
      uuid: uuidv4(),
      name: "Vacuum",
      description: "Vacuum the entire house.",
      time: minutesFromNow(45),
      icon: "wind",
      status: "complete",
      user_email: userByEmail["user@example.com"].email,
      home_id: homeByName["Summer Cabin"].id,
      completed_at: hoursAgo(2),
    },
    {
      uuid: uuidv4(),
      name: "Laundry",
      description: "Wash, dry, and fold one load of laundry.",
      time: minutesFromNow(120), // 2h
      icon: "shirt",
      status: "complete",
      user_email: userByEmail["user@example.com"].email,
      home_id: homeByName["Summer Cabin"].id,
      completed_at: hoursAgo(1),
    },
  ];
  await knex("chores").insert(chores);
  const choreByName = Object.fromEntries(chores.map((c) => [c.name, c]));

  /* todo items */
  const todoData: [string, [string, string][]][] = [
    [
      "Sorting Boxes",
      [
        ["Step 1", "Detailed description for step 1."],
        ["Step 2", "Detailed description for step 2."],
      ],
    ],
    [
      "Organizing",
      [
        ["Clear shelves", "Remove all items from the shelves."],
        ["Sort items", "Group items into categories: keep, donate, trash."],
        ["Wipe shelves", "Clean the shelves with a damp cloth."],
        [
          "Arrange items",
          "Place items back on the shelves in an organized manner.",
        ],
      ],
    ],
    [
      "Dusting",
      [
        ["Gather supplies", "Get a duster or microfiber cloth."],
        ["Dust high surfaces", "Start from top to bottom."],
        ["Dust furniture", "Dust tables, shelves, and other furniture."],
      ],
    ],
    [
      "Mopping",
      [
        ["Sweep/vacuum first", "Remove loose dirt and debris."],
        [
          "Prepare mop solution",
          "Fill a bucket with water and cleaning solution.",
        ],
        ["Mop the floors", "Mop from the farthest corner towards the door."],
        ["Let it dry", "Allow the floor to air dry completely."],
      ],
    ],
    [
      "Taking out trash",
      [
        ["Collect trash", "Gather trash from all bins in the house."],
        ["Replace liners", "Put new liners in all the trash cans."],
        [
          "Take out to curb",
          "Take the main trash bag to the outdoor bin/curb.",
        ],
      ],
    ],
    [
      "Sweeping",
      [
        ["Get broom and dustpan", "Grab the necessary tools."],
        ["Sweep into a pile", "Sweep all debris into one area."],
        [
          "Dispose of debris",
          "Use the dustpan to collect and throw away the pile.",
        ],
      ],
    ],
    [
      "Washing Dishes",
      [
        ["Scrape plates", "Remove leftover food from dishes."],
        ["Wash with soap", "Use hot, soapy water to wash each dish."],
        ["Rinse thoroughly", "Rinse off all soap suds."],
        ["Dry and put away", "Use a towel or drying rack."],
      ],
    ],
    [
      "Vacuum",
      [
        [
          "Clear the floor",
          "Pick up any large items or clutter from the floor.",
        ],
        ["Vacuum room by room", "Work systematically through the house."],
        ["Use attachments", "Use attachments for corners and edges."],
      ],
    ],
    [
      "Laundry",
      [
        ["Sort clothes", "Separate lights, darks, and colors."],
        ["Wash load", "Put one load in the washing machine with detergent."],
        ["Dry load", "Transfer washed clothes to the dryer."],
        ["Fold and put away", "Fold the dry clothes and put them away."],
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

  /* disputes (incorporating mock.ts data while honoring DB FKs) */
  // mock-like disputes; map to existing users/emails and chores
  const mockDisputes = [
    {
      // from mock: "Kitchen Cleaning" (no exact chore in seed) → fall back to an existing chore
      uuid: uuidv4(),
      choreName: "Kitchen Cleaning",
      reason: "Not cleaned properly",
      disputer_email: "user@example.com", // John
      image_url: null as string | null,
      status: "pending" as const,
      created_at: "2024-01-15T10:30:00Z",
    },
    {
      uuid: uuidv4(),
      choreName: "Dusting", // exact match in seed
      reason: "Incomplete dusting",
      disputer_email: "roommate@example.com", // Jane
      image_url: null as string | null,
      status: "pending" as const,
      created_at: "2024-01-14T15:45:00Z",
    },
  ];

  const resolveChoreId = (name: string) =>
    (choreByName[name] ? choreByName[name].uuid : choreByName["Dusting"].uuid);

  const disputeRows = mockDisputes.map((d) => ({
    uuid: d.uuid,
    chore_id: resolveChoreId(d.choreName),
    disputer_email: d.disputer_email,
    reason: d.reason,
    image_url: d.image_url,
    status: d.status,
    created_at: d.created_at,
    updated_at: new Date().toISOString(),
  }));

  await knex("disputes").insert(disputeRows);
}
