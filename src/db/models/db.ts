import knex from "knex";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require("../config/knexfile");
export default knex(config);