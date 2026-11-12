import cookieParser from 'cookie-parser';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import nunjucks from 'nunjucks';
import { enforceOnboarding, loadUser } from './middleware/auth.js';
import consola from 'consola';
import { timeAgo } from './date.js';
import { authRouter } from './routes/auth.js';
import { homeRouter } from './routes/home.js';
import { gamesRouter } from './routes/games.js';
import { usersRouter } from './routes/users.js';
import path from 'node:path';
import { userGamesRouter } from './routes/userGames.js';

export function createApp(): Express {
    const app = express();

    // ┌───────────────────────┐
    // │     Nunjucks Init     │
    // └───────────────────────┘
    const njk = nunjucks.configure(path.join(import.meta.dirname, '../views'), {
        autoescape: true,
        express: app,
        noCache: process.env.NODE_ENV !== 'production'
    });
    njk.addFilter('timeAgo', (d: Date) => timeAgo(d, new Date()));
    njk.addFilter('fullDate', (d: Date) => new Intl.DateTimeFormat('en-US', {dateStyle: 'long'}).format(d));
    app.set("view engine", "njk");

    // ┌───────────────────────┐
    // │       Middleware      │
    // └───────────────────────┘
    app.use(express.json());
    app.use(express.static(path.join(import.meta.dirname, '../public')));
    app.use(cookieParser());
    app.use(express.urlencoded({ extended: false }))

    app.use(loadUser);
    app.use(enforceOnboarding);

    // ┌───────────────────────┐
    // │        Routers        │
    // └───────────────────────┘
    app.use(homeRouter);
    app.use(authRouter);
    app.use(gamesRouter);
    app.use(usersRouter);
    app.use(userGamesRouter);

    // ┌───────────────────────┐
    // │      Error Routes     │
    // └───────────────────────┘
    app.use((req, res) => {
        res.status(404).render('404');
    });

    // 500 Error catch all
    app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
        consola.error(err);
        if (res.headersSent) return next(err);
        res.status(500).render('500'); 
    });

    return app;
}