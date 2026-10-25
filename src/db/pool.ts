import { Pool } from "pg";
import { requireEnv } from "../env.js";

export const pool = new Pool({ 
    connectionString: requireEnv("DATABASE_URL")
});