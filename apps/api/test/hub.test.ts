import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client, createSuperAdmin, createTestEnv, loginSuperAdmin, resetDb, setupBusiness, type TestEnv } from './helpers';

let env: TestEnv;
let sa: Client;

beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(async () => env.close());
beforeEach(async () => {
  await resetDb(env.db);
  await createSuperAdmin(env.db);
  sa = await loginSuperAdmin(env);
});

describe('OceanX Hub (main office)', () => {
  it('lead from a DM → client; services price list; quote → accepted → invoice → paid; overview', async () => {
    const web = (await sa.post('/api/superadmin/hub/services', { name: 'Business website', category: 'websites', price: 7500, unit: 'project' })).json();
    expect(web.price).toBe(750000);

    const lead = (await sa.post('/api/superadmin/hub/leads', { name: 'Hassan Ali', company: 'Blue Lagoon Spa', phone: '7712345', source: 'instagram', serviceId: web.id, nextFollowUp: '2026-01-01' })).json();
    expect(lead.status).toBe('new');
    let ov = (await sa.get('/api/superadmin/hub/overview')).json();
    expect(ov).toMatchObject({ leadsOpen: 1, followUpsDue: 1, clients: 0 });

    const won = (await sa.post(`/api/superadmin/hub/leads/${lead.id}/convert`, {})).json();
    expect(won.status).toBe('won');
    expect((await sa.post(`/api/superadmin/hub/leads/${lead.id}/convert`, {})).json().error.code).toBe('conflict');
    const client = (await sa.get(`/api/superadmin/hub/clients/${won.clientId}`)).json().client;
    expect(client).toMatchObject({ name: 'Hassan Ali', company: 'Blue Lagoon Spa', kind: 'company' });

    // Quotation: totals come from the server, never the client.
    const q = (
      await sa.post('/api/superadmin/hub/documents?kind=quote', {
        clientId: client.id,
        issueDate: '2026-10-10',
        dueDate: '2026-10-31',
        discount: 500,
        items: [
          { serviceId: web.id, description: 'Business website', quantity: 1, unitPrice: 7500 },
          { description: 'Logo design', quantity: 2, unitPrice: 1250.5, total: 1 },
        ],
      })
    ).json();
    expect(q.number).toMatch(/^OXQ-\d{4}-00001$/);
    expect(q).toMatchObject({ subtotal: 1000100, discount: 50000, total: 950100, status: 'draft' });
    expect((await sa.post(`/api/superadmin/hub/documents/${q.id}/convert`)).json().error.code).toBe('invalid_status_transition');
    await sa.post(`/api/superadmin/hub/documents/${q.id}/status`, { status: 'sent' });
    await sa.post(`/api/superadmin/hub/documents/${q.id}/status`, { status: 'accepted' });
    const inv = (await sa.post(`/api/superadmin/hub/documents/${q.id}/convert`)).json();
    expect(inv).toMatchObject({ kind: 'invoice', total: 950100, status: 'draft', sourceQuoteId: q.id });
    expect(inv.number).toMatch(/^OXI-\d{4}-00001$/);
    expect((await sa.post(`/api/superadmin/hub/documents/${q.id}/convert`)).json().error.code).toBe('already_converted');

    // Payments only on an issued invoice, never more than is due.
    expect((await sa.post(`/api/superadmin/hub/documents/${inv.id}/payments`, { amount: 100, paidAt: '2026-10-10' })).json().error.code).toBe('invalid_status_transition');
    await sa.post(`/api/superadmin/hub/documents/${inv.id}/status`, { status: 'issued' });
    expect((await sa.put(`/api/superadmin/hub/documents/${inv.id}`, { clientId: client.id, issueDate: '2026-10-10', items: [{ description: 'x', quantity: 1, unitPrice: 1 }] })).json().error.code).toBe('document_locked');
    expect((await sa.post(`/api/superadmin/hub/documents/${inv.id}/payments`, { amount: 9502, paidAt: '2026-10-10' })).json().error.code).toBe('payment_exceeds_balance');
    expect((await sa.post(`/api/superadmin/hub/documents/${inv.id}/payments`, { amount: 5000, method: 'bank_transfer', reference: 'TT-1', paidAt: today() })).json().status).toBe('partially_paid');
    ov = (await sa.get('/api/superadmin/hub/overview')).json();
    expect(ov).toMatchObject({ invoicesUnpaid: 1, amountDue: 450100, receivedThisMonth: 500000, leadsOpen: 0, clients: 1 });
    expect((await sa.post(`/api/superadmin/hub/documents/${inv.id}/payments`, { amount: 4501, paidAt: today() })).json().status).toBe('paid');
    const detail = (await sa.get(`/api/superadmin/hub/documents/${inv.id}`)).json();
    expect(detail.payments).toHaveLength(2);
    expect(detail.company.name).toBe('OceanX');
    expect((await sa.get('/api/superadmin/hub/clients')).json().items[0]).toMatchObject({ amountDue: 0 });
  });

  it('projects with tasks for the team; support tickets with numbers and notes', async () => {
    const team = (await sa.get('/api/superadmin/hub/team')).json().items;
    const me = team[0].id as string;
    const client = (await sa.post('/api/superadmin/hub/clients', { name: 'Reef Builders', kind: 'company' })).json();
    const p = (await sa.post('/api/superadmin/hub/projects', { title: 'Install POS at 3 outlets', clientId: client.id, status: 'in_progress', dueDate: '2026-11-01', value: 3000, assignedTo: me })).json();
    expect(p.value).toBe(300000);
    const t1 = (await sa.post('/api/superadmin/hub/tasks', { title: 'Deliver tablets', projectId: p.id, assignedTo: me, priority: 'high' })).json();
    await sa.post('/api/superadmin/hub/tasks', { title: 'Train staff', projectId: p.id });
    const done = (await sa.put(`/api/superadmin/hub/tasks/${t1.id}`, { ...t1, status: 'done' })).json();
    expect(done.completedAt).toBeTruthy();
    const projects = (await sa.get('/api/superadmin/hub/projects?status=active')).json().items;
    expect(projects[0]).toMatchObject({ title: 'Install POS at 3 outlets', clientName: 'Reef Builders', tasksOpen: 1, tasksDone: 1 });
    expect((await sa.get('/api/superadmin/hub/tasks?status=open&mine=true')).json().items).toHaveLength(0);
    expect((await sa.post('/api/superadmin/hub/tasks', { title: 'x', assignedTo: '00000000-0000-4000-8000-000000000000' })).json().error.code).toBe('validation_failed');

    const shop = await setupBusiness(env, sa, 'Help Mart', { type: 'retail_shop' });
    const tk = (await sa.post('/api/superadmin/hub/tickets', { subject: 'Printer not printing receipts', businessId: shop.businessId, priority: 'urgent', channel: 'whatsapp' })).json();
    expect(tk.number).toMatch(/^OXT-\d{4}-00001$/);
    await sa.post(`/api/superadmin/hub/tickets/${tk.id}/notes`, { body: 'Reinstalled the driver; working.' });
    const resolved = (await sa.put(`/api/superadmin/hub/tickets/${tk.id}`, { subject: tk.subject, businessId: shop.businessId, priority: 'urgent', status: 'resolved' })).json();
    expect(resolved.resolvedAt).toBeTruthy();
    const got = (await sa.get(`/api/superadmin/hub/tickets/${tk.id}`)).json();
    expect(got.ticket.businessName).toBe('Help Mart');
    expect(got.notes[0].body).toContain('driver');
    const ov = (await sa.get('/api/superadmin/hub/overview')).json();
    expect(ov).toMatchObject({ projectsActive: 1, openTasks: 1, ticketsOpen: 0, posBusinessesActive: 1 });

    // The Hub is Super Admin only: business owners get nothing.
    expect((await shop.owner.get('/api/superadmin/hub/overview')).statusCode).toBe(401);
    expect((await new Client(env.app).get('/api/superadmin/hub/clients')).statusCode).toBe(401);
  });
});

function today() {
  return new Date().toISOString().slice(0, 10);
}
