import { checkDb } from './db/pool.js';
import consola from 'consola';
import { createApp } from './app.js';
import { deleteExpiredSessions } from './db/sessions.js';

const PORT = 3000;
const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

await checkDb();
const app = createApp();

app.listen(PORT, () => {
    consola.info(`Server running at http://localhost:${PORT}/`);
});

// Clean up expires sessions
deleteExpiredSessions().catch(err => consola.error(err));
setInterval(() => deleteExpiredSessions().catch(err => consola.error(err)), SESSION_CLEANUP_INTERVAL_MS).unref();