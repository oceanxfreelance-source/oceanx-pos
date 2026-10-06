import type { FastifyInstance } from 'fastify';
import { adminSetPasswordSchema, createUserSchema, paginationQuerySchema, roleSchema, updateUserSchema } from '@oceanx/shared';
import { bizCtx, requireAnyPermission, requirePermission } from '../../guards/business';
import { idParam } from '../../lib/params';
import { parse } from '../../lib/validation';
import { createRole, deleteRole, getRole, listRoles, permissionCatalog, updateRole } from '../../services/roles';
import { adminSetPassword, createUser, deleteUser, getUser, listUsers, updateUser } from '../../services/users';

export async function userRoutes(app: FastifyInstance) {
  const { db } = app.deps;

  app.get('/users', { preHandler: requirePermission('users.view') }, async (req) =>
    listUsers(db, bizCtx(req), parse(paginationQuerySchema, req.query)),
  );
  app.get('/users/:id', { preHandler: requirePermission('users.view') }, async (req) => getUser(db, bizCtx(req), idParam(req)));
  app.post('/users', { preHandler: requirePermission('users.create') }, async (req, reply) => {
    const created = await createUser(db, bizCtx(req), parse(createUserSchema, req.body), req);
    reply.status(201);
    return created;
  });
  app.patch('/users/:id', { preHandler: requirePermission('users.edit') }, async (req) =>
    updateUser(db, bizCtx(req), idParam(req), parse(updateUserSchema, req.body), req),
  );
  app.post('/users/:id/password', { preHandler: requirePermission('users.edit') }, async (req) => {
    await adminSetPassword(db, bizCtx(req), idParam(req), parse(adminSetPasswordSchema, req.body), req);
    return { ok: true };
  });
  app.delete('/users/:id', { preHandler: requirePermission('users.delete') }, async (req) => {
    await deleteUser(db, bizCtx(req), idParam(req), req);
    return { ok: true };
  });

  // People who can create/edit users need the role list to assign roles (read-only).
  app.get('/roles', { preHandler: requireAnyPermission('roles.view', 'users.create', 'users.edit') }, async (req) => ({
    items: await listRoles(db, bizCtx(req)),
  }));
  app.get('/roles/:id', { preHandler: requirePermission('roles.view') }, async (req) => getRole(db, bizCtx(req), idParam(req)));
  app.post('/roles', { preHandler: requirePermission('roles.manage') }, async (req, reply) => {
    const role = await createRole(db, bizCtx(req), parse(roleSchema, req.body), req);
    reply.status(201);
    return role;
  });
  app.put('/roles/:id', { preHandler: requirePermission('roles.manage') }, async (req) =>
    updateRole(db, bizCtx(req), idParam(req), parse(roleSchema, req.body), req),
  );
  app.delete('/roles/:id', { preHandler: requirePermission('roles.manage') }, async (req) => {
    await deleteRole(db, bizCtx(req), idParam(req), req);
    return { ok: true };
  });

  app.get('/permissions', { preHandler: requirePermission('roles.view') }, async (req) => ({ items: permissionCatalog(bizCtx(req)) }));
}
