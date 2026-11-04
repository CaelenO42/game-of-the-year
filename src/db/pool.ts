import { Pool } from "pg";
import { requireEnv } from "../env.js";
import consola from "consola";

export const pool = new Pool({ 
    connectionString: requireEnv("DATABASE_URL")
});

export async function checkDb() {
    try {
        await pool.query("SELECT 1");
    } catch (err) {
        const code = (err as {code?: string}).code;
        if (code === "ECONNREFUSED") consola.error("Cannot connect to Postgres DB. Try running docker compose up -d");
        else consola.error("Postgres check failed:", err);
        process.exit(1);
    }
}