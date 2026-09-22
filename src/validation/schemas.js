const { z } = require('zod');

const uuid = () => z.string().uuid();

const registerSchema = z.object({
  company_id: uuid().optional(),
  role: z.enum(['admin', 'manager', 'supervisor', 'worker', 'builder']),
  full_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const companySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['contractor', 'client']),
  address: z.string().optional(),
  phone: z.string().optional(),
});

const workerSchema = z.object({
  user_id: uuid().optional(),
  contractor_id: uuid(),
  full_name: z.string().min(1),
  phone: z.string().optional(),
});

const certificationSchema = z.object({
  worker_id: uuid(),
  level: z.enum(['basic', 'advanced', 'supervisor']),
  issuing_body: z.string().optional(),
  cert_number: z.string().optional(),
  issued_date: z.string(),
  expiry_date: z.string().optional(),
  document_id: uuid().optional(),
});

const crewSchema = z.object({
  contractor_id: uuid(),
  name: z.string().min(1),
});

const crewMemberSchema = z.object({
  worker_id: uuid(),
});

const siteSchema = z.object({
  company_id: uuid(),
  name: z.string().min(1),
  address: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const jobRequestSchema = z.object({
  site_id: uuid(),
  requested_by: uuid().optional(),
  work_type: z.enum(['basic', 'advanced']),
  needed_by: z.string(),
  notes: z.string().optional(),
});

const scheduleSchema = z.object({
  crew_id: uuid(),
  scheduled_date: z.string(),
});

const materialSchema = z.object({
  contractor_id: uuid(),
  name: z.string().min(1),
  unit: z.string().default('ea'),
  qty_on_hand: z.number().int().nonnegative().default(0),
  reorder_threshold: z.number().int().nonnegative().default(0),
});

const stockAdjustSchema = z.object({
  delta: z.number().int(),
});

const jobMaterialSchema = z.object({
  material_id: uuid(),
  qty_required: z.number().int().positive(),
});

const scaffoldSchema = z.object({
  job_id: uuid(),
  type: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const inspectionSchema = z.object({
  scaffold_id: uuid(),
  inspector_worker_id: uuid(),
  result: z.enum(['green', 'yellow', 'red']),
  notes: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const handoverSchema = z.object({
  scaffold_id: uuid(),
  job_id: uuid(),
  handed_over_by: uuid(),
  issued_to_name: z.string().min(1),
  issued_to_user_id: uuid().optional(),
});

const documentSchema = z.object({
  owner_type: z.enum(['inspection', 'handover', 'certification', 'job', 'site']),
  owner_id: uuid(),
  doc_type: z.enum(['photo', 'signature', 'certificate', 'handover_pdf', 'other']),
  file_url: z.string().url(),
  uploaded_by: uuid().optional(),
});

module.exports = {
  registerSchema, loginSchema, companySchema, workerSchema, certificationSchema,
  crewSchema, crewMemberSchema, siteSchema, jobRequestSchema, scheduleSchema,
  materialSchema, stockAdjustSchema, jobMaterialSchema, scaffoldSchema,
  inspectionSchema, handoverSchema, documentSchema,
};
