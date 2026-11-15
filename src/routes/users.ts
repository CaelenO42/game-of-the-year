import { Router } from "express";
import { getUserByUsername } from "../db/users.js";

export const usersRouter = Router();

usersRouter.get('/user/:username', async (req, res) => {
    const profile = await getUserByUsername(req.params.username);
    if (!profile) return res.status(404).render('errors/404');

    if (req.params.username !== profile.username) {
        return res.redirect(301, `/user/${profile.username}`);
    }

    return res.render('users/profile', { profile });
});