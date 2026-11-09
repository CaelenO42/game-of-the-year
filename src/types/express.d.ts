import type { UserRow } from "../db/users.js";

declare global {
    namespace Express {
        interface Request {
            user?: UserRow | undefined;
        }
    }
}