import express, { Request, Response } from 'express';
import cors from 'cors';
import { store } from './dataStore.js';
import { AttendanceRecord, StoreVisit, CustomerParty, Invoice, PaymentRecord, TrackingPoint } from './types.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '15mb' })); // allow store visit photo uploads

// Health & Info
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'SAM MOBILE ERP Backend API', timestamp: new Date().toISOString() });
});

// 1. Staff
app.get('/api/staff', (_req: Request, res: Response) => {
  res.json(store.getStaff());
});

// 2. Attendance
app.get('/api/attendance', (req: Request, res: Response) => {
  const date = req.query.date as string | undefined;
  res.json(store.getAttendance(date));
});

app.post('/api/attendance/punch-in', (req: Request, res: Response) => {
  const record: AttendanceRecord = req.body;
  if (!record.id) record.id = 'ATT-' + Date.now();
  const created = store.addAttendance(record);
  res.status(201).json(created);
});

app.put('/api/attendance/punch-out/:id', (req: Request, res: Response) => {
  const { punchOutTime, punchOutLocation } = req.body;
  const updated = store.updatePunchOut(req.params.id, punchOutTime, punchOutLocation);
  if (!updated) return res.status(404).json({ error: 'Attendance record not found' });
  res.json(updated);
});

// 3. Tracking
app.get('/api/tracking', (_req: Request, res: Response) => {
  res.json(store.getTracking());
});

app.post('/api/tracking', (req: Request, res: Response) => {
  const pt: TrackingPoint = req.body;
  if (!pt.id) pt.id = 'TRK-' + Date.now();
  const created = store.addTracking(pt);
  res.status(201).json(created);
});

// 4. Store Visits (with Photo & Location submission)
app.get('/api/visits', (_req: Request, res: Response) => {
  res.json(store.getVisits());
});

app.post('/api/visits', (req: Request, res: Response) => {
  const visit: StoreVisit = req.body;
  if (!visit.id) visit.id = 'VST-' + Date.now();
  const created = store.addVisit(visit);
  res.status(201).json(created);
});

app.patch('/api/visits/:id/verify', (req: Request, res: Response) => {
  const { isVerified } = req.body;
  const updated = store.updateVisitVerified(req.params.id, isVerified);
  if (!updated) return res.status(404).json({ error: 'Visit not found' });
  res.json(updated);
});

// 5. Parties & Customer Biodata
app.get('/api/parties', (_req: Request, res: Response) => {
  res.json(store.getParties());
});

app.post('/api/parties', (req: Request, res: Response) => {
  const party: CustomerParty = req.body;
  if (!party.id) party.id = 'CUST-' + Date.now();
  const created = store.addParty(party);
  res.status(201).json(created);
});

// 6. Invoices
app.get('/api/invoices', (_req: Request, res: Response) => {
  res.json(store.getInvoices());
});

app.post('/api/invoices', (req: Request, res: Response) => {
  const invoice: Invoice = req.body;
  if (!invoice.id) invoice.id = 'INV-' + Date.now();
  const created = store.addInvoice(invoice);
  res.status(201).json(created);
});

// 7. Payments / Collection (UPI vs Cash)
app.get('/api/payments', (_req: Request, res: Response) => {
  res.json(store.getPayments());
});

app.post('/api/payments', (req: Request, res: Response) => {
  const payment: PaymentRecord = req.body;
  if (!payment.id) payment.id = 'PAY-' + Date.now();
  const created = store.addPayment(payment);
  res.status(201).json(created);
});

app.listen(PORT, () => {
  console.log(`🚀 SAM MOBILE Backend API server running at http://localhost:${PORT}`);
});
