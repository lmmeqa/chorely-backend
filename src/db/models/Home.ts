import db from "./db";

export interface HomeRow {
  id: string;
  name: string;
  address: string;
}

export default class Home {
  static async create(name: string, address: string): Promise<HomeRow> {
    return (await db("homes").insert({ name, address }).returning("*"))[0];
  }

  static findById(id: string) {
    return db<HomeRow>("homes").where({ id }).first();
  }

  static all() {
    return db<HomeRow>("homes");
  }
}