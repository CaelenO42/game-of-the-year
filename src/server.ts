import { checkDb } from './db/pool.js';
import consola from 'consola';
import { createApp } from './app.js';

const PORT = 3000;

await checkDb();
const app = createApp();

app.listen(PORT, () => {
    consola.info(`Server running at http://localhost:${PORT}/`);
});