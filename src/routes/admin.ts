import { Router } from "express";
import { normalizePage } from "../lib/page.js";
import { listUsers, setBanned, setRole } from "../db/users.js";
import { getCookie, requireAuth, requireRole } from "../middleware/auth.js";
import { validateRole } from "../validation/roles.js";

export const adminRouter = Router();
adminRouter.use('/admin', requireAuth, requireRole('admin'));

const PAGE_SIZE = 20;
const MAX_PAGE = 500;

adminRouter.get('/admin/users', async (req, res) => {
    const page = normalizePage(req.query.p, MAX_PAGE);
    const { users, total } = await listUsers(PAGE_SIZE, page);

    if (users.length === 0 && page > 1) return res.redirect('/admin/users?p=1');

    return res.render('admin/users', { users, total, page, totalPages: Math.ceil(total / PAGE_SIZE) });
})

adminRouter.post('/admin/users/:id/role', async (req, res) => {
    if (!req.user) return res.status(401).end();

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'id must be a number'});

    const validate = validateRole(req.body.role);
    if (!validate.ok) return res.status(400).json({ error: validate.error });

    const result = await setRole(req.user.id, id, validate.role);

    if (!result.ok) {
        switch(result.reason) {
            case 'no_user': return res.status(404).json({ error: 'The requested user does not exist.' });
            case 'not_admin': return res.status(403).json({ error: 'You do not have permission to do this.' });
            case 'self': return res.status(400).json({ error: "You can't demote yourself!" });
            case 'target_is_admin': return res.status(409).json({ error: 'User must be demoted before banning them.' })
        }
    }
    return res.render('admin/partials/admin_user', { u: result.user });
})

adminRouter.post('/admin/users/:id/ban', async (req, res) => {
    if (!req.user) return res.status(401).end();

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'id must be a number'});

    if (req.body.ban !== 'true' && req.body.ban !== 'false') return res.status(400).json({ error: 'ban must be true or false' });
    const banned = req.body.ban === 'true';

    const result = await setBanned(req.user.id, id, banned);

    if (!result.ok) {
        switch(result.reason) {
            case 'no_user': return res.status(404).json({ error: 'The requested user does not exist.' });
            case 'not_admin': return res.status(403).json({ error: 'You do not have permission to do this.' });
            case 'self': return res.status(400).json({ error: "You can't ban yourself!" });
            case 'target_is_admin': return res.status(409).json({ error: 'User must be demoted before banning them.' })
        }
    }
    return res.render('admin/partials/admin_user', { u: result.user });
})