import { Knex } from "knex";
import { v4 as uuidv4 } from "uuid";

export async function seed(knex: Knex): Promise<void> {
  await knex("todo_items").del();
  await knex("chores").del();
  await knex("user_homes").del();
  await knex("users").del();
  await knex("homes").del();

  /* homes */
  const homes = [
    { id: uuidv4(), name: "Main House",         address: "123 Main St, Berkeley, CA" },
    { id: uuidv4(), name: "Summer Cabin",       address: "456 Lake View Dr, Tahoe, CA" },
    { id: uuidv4(), name: "Downtown Apartment", address: "789 Market St, SF, CA" },
  ];
  await knex("homes").insert(homes);
  const homeByName = Object.fromEntries(homes.map(h => [h.name, h]));

  /* users */
  const users = [
    { id: uuidv4(), email: "user@example.com" },
    { id: uuidv4(), email: "roommate@example.com" },
    { id: uuidv4(), email: "family@example.com" },
  ];
  await knex("users").insert(users);
  const userByEmail = Object.fromEntries(users.map(u => [u.email, u]));

  /* join: user_homes */
  await knex("user_homes").insert([
    { user_id: userByEmail["user@example.com"].id,     home_id: homeByName["Main House"].id },
    { user_id: userByEmail["user@example.com"].id,     home_id: homeByName["Summer Cabin"].id },
    { user_id: userByEmail["roommate@example.com"].id, home_id: homeByName["Main House"].id },
    { user_id: userByEmail["family@example.com"].id,   home_id: homeByName["Summer Cabin"].id },
    { user_id: userByEmail["family@example.com"].id,   home_id: homeByName["Downtown Apartment"].id },
  ]);

  /* chores */
  const chores = [
    {
      uuid: uuidv4(), name: "Sorting Boxes", description: "This is an unapproved chore.",
      time: "1h 15m", icon: "package", status: "unapproved", user_id: null,
      home_id: homeByName["Main House"].id,
    },
    {
      uuid: uuidv4(), name: "Organizing", description: "Organize the living-room shelves.",
      time: "1h 15m", icon: "package", status: "unclaimed", user_id: null,
      home_id: homeByName["Main House"].id,
    },
    {
      uuid: uuidv4(), name: "Dusting", description: "Dust all surfaces in the main room.",
      time: "25m", icon: "feather", status: "unclaimed", user_id: null,
      home_id: homeByName["Main House"].id,
    },
    {
      uuid: uuidv4(), name: "Mopping", description: "Mop the kitchen and bathroom floors.",
      time: "35m", icon: "droplets", status: "unclaimed", user_id: null,
      home_id: homeByName["Main House"].id,
    },
    {
      uuid: uuidv4(), name: "Taking out trash", description: "Empty all trash cans and take out the garbage.",
      time: "10m", icon: "trash-2", status: "unclaimed", user_id: null,
      home_id: homeByName["Main House"].id,
    },
    {
      uuid: uuidv4(), name: "Sweeping", description: "Sweep the front porch.",
      time: "12h 10m", icon: "brush", status: "claimed",
      user_id: userByEmail["user@example.com"].id,
      home_id: homeByName["Main House"].id,
    },
    {
      uuid: uuidv4(), name: "Washing Dishes", description: "Wash and dry all dishes in the sink.",
      time: "30m", icon: "droplets", status: "claimed",
      user_id: userByEmail["user@example.com"].id,
      home_id: homeByName["Main House"].id,
    },
    {
      uuid: uuidv4(), name: "Vacuum", description: "Vacuum the entire house.",
      time: "45m", icon: "wind", status: "complete",
      user_id: userByEmail["user@example.com"].id,
      home_id: homeByName["Summer Cabin"].id,
    },
    {
      uuid: uuidv4(), name: "Laundry", description: "Wash, dry, and fold one load of laundry.",
      time: "2h", icon: "shirt", status: "complete",
      user_id: userByEmail["user@example.com"].id,
      home_id: homeByName["Summer Cabin"].id,
    },
  ];
  await knex("chores").insert(chores);
  const choreByName = Object.fromEntries(chores.map(c => [c.name, c]));

  /* todo items */
  const todoData: [string, [string, string][]][] = [
    ["Sorting Boxes", [
      ["Step 1", "Detailed description for step 1."],
      ["Step 2", "Detailed description for step 2."],
    ]],
    ["Organizing", [
      ["Clear shelves", "Remove all items from the shelves."],
      ["Sort items", "Group items into categories: keep, donate, trash."],
      ["Wipe shelves", "Clean the shelves with a damp cloth."],
      ["Arrange items", "Place items back on the shelves in an organized manner."],
    ]],
    ["Dusting", [
      ["Gather supplies", "Get a duster or microfiber cloth."],
      ["Dust high surfaces", "Start from top to bottom."],
      ["Dust furniture", "Dust tables, shelves, and other furniture."],
    ]],
    ["Mopping", [
      ["Sweep/vacuum first", "Remove loose dirt and debris."],
      ["Prepare mop solution", "Fill a bucket with water and cleaning solution."],
      ["Mop the floors", "Mop from the farthest corner towards the door."],
      ["Let it dry", "Allow the floor to air dry completely."],
    ]],
    ["Taking out trash", [
      ["Collect trash", "Gather trash from all bins in the house."],
      ["Replace liners", "Put new liners in all the trash cans."],
      ["Take out to curb", "Take the main trash bag to the outdoor bin/curb."],
    ]],
    ["Sweeping", [
      ["Get broom and dustpan", "Grab the necessary tools."],
      ["Sweep into a pile", "Sweep all debris into one area."],
      ["Dispose of debris", "Use the dustpan to collect and throw away the pile."],
    ]],
    ["Washing Dishes", [
      ["Scrape plates", "Remove leftover food from dishes."],
      ["Wash with soap", "Use hot, soapy water to wash each dish."],
      ["Rinse thoroughly", "Rinse off all soap suds."],
      ["Dry and put away", "Use a towel or drying rack."],
    ]],
    ["Vacuum", [
      ["Clear the floor", "Pick up any large items or clutter from the floor."],
      ["Vacuum room by room", "Work systematically through the house."],
      ["Use attachments", "Use attachments for corners and edges."],
    ]],
    ["Laundry", [
      ["Sort clothes", "Separate lights, darks, and colors."],
      ["Wash load", "Put one load in the washing machine with detergent."],
      ["Dry load", "Transfer washed clothes to the dryer."],
      ["Fold and put away", "Fold the dry clothes and put them away."],
    ]],
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
}