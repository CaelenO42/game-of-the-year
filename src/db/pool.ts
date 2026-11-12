import { Pool, type PoolClient } from "pg";
import { requireEnv } from "../env.js";
import consola from "consola";

export const pool = new Pool({ 
    connectionString: requireEnv("DATABASE_URL")
});

pool.on("error", (err) => {
    consola.error("Unexpected error on idle Postgres client:", err);
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

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}