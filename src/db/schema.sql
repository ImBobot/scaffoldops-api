-- ============================================================
-- ScaffoldOps NZ — PostgreSQL schema
-- Companies → Workers → Certifications → Jobs → Scaffolds →
-- Inspections → Materials → Sites → Documents → Users
-- ============================================================

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ---------- enums ----------
create type company_type      as enum ('contractor', 'client');
create type user_role         as enum ('admin', 'manager', 'supervisor', 'worker', 'builder');
create type cert_level        as enum ('basic', 'advanced', 'supervisor');
create type request_status    as enum ('requested', 'scheduled', 'cancelled');
create type job_status        as enum ('scheduled', 'in_progress', 'complete', 'cancelled');
create type work_type         as enum ('basic', 'advanced');
create type tag_status        as enum ('green', 'yellow', 'red'); -- Scafftag convention
create type document_owner    as enum ('inspection', 'handover', 'certification', 'job', 'site');

-- ---------- companies ----------
-- 'contractor' = your own scaffolding company (supports multiple branches later)
-- 'client'     = the builder/client company that requests scaffolding
create table companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  type          company_type not null,
  address       text,
  phone         text,
  created_at    timestamptz not null default now()
);

-- ---------- users ----------
-- app logins: internal staff (admin/manager/supervisor/worker) and builder-side users
create table users (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid references companies(id),
  role          user_role not null,
  full_name     text not null,
  email         text unique not null,
  phone         text,
  password_hash text not null,
  created_at    timestamptz not null default now()
);
create index idx_users_company on users(company_id);

-- ---------- workers ----------
-- crew members; user_id is nullable because a worker may not have app
-- login credentials yet (e.g. added by a manager ahead of onboarding)
create table workers (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references users(id),
  contractor_id     uuid not null references companies(id),
  full_name         text not null,
  phone             text,
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);
create index idx_workers_contractor on workers(contractor_id);

-- ---------- certifications ----------
-- history of certs per worker; "current cert" = highest level, not expired
create table certifications (
  id             uuid primary key default gen_random_uuid(),
  worker_id      uuid not null references workers(id) on delete cascade,
  level          cert_level not null,
  issuing_body   text,
  cert_number    text,
  issued_date    date not null,
  expiry_date    date,
  document_id    uuid, -- FK added after documents table exists
  created_at     timestamptz not null default now()
);
create index idx_certifications_worker on certifications(worker_id);

-- ---------- crews ----------
-- not in your original list, but needed to assign a group of workers to a job
create table crews (
  id             uuid primary key default gen_random_uuid(),
  contractor_id  uuid not null references companies(id),
  name           text not null,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table crew_members (
  crew_id    uuid not null references crews(id) on delete cascade,
  worker_id  uuid not null references workers(id) on delete cascade,
  primary key (crew_id, worker_id)
);

-- ---------- sites ----------
create table sites (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id), -- the client company
  name          text not null,
  address       text not null,
  latitude      numeric(9,6),
  longitude     numeric(9,6),
  created_at    timestamptz not null default now()
);
create index idx_sites_company on sites(company_id);

-- ---------- job requests ----------
-- builder-submitted requests, before a manager schedules them
create table job_requests (
  id             uuid primary key default gen_random_uuid(),
  site_id        uuid not null references sites(id),
  requested_by   uuid references users(id),
  work_type      work_type not null,
  needed_by      date not null,
  notes          text,
  status         request_status not null default 'requested',
  created_at     timestamptz not null default now()
);
create index idx_job_requests_status on job_requests(status);

-- ---------- jobs ----------
-- created once a manager schedules a request (crew + date + location confirmed)
create table jobs (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid references job_requests(id),
  site_id        uuid not null references sites(id),
  crew_id        uuid not null references crews(id),
  work_type      work_type not null,
  scheduled_date date not null,
  status         job_status not null default 'scheduled',
  created_at     timestamptz not null default now()
);
create index idx_jobs_site on jobs(site_id);
create index idx_jobs_crew on jobs(crew_id);
create index idx_jobs_date on jobs(scheduled_date);

-- ---------- materials ----------
create table materials (
  id                  uuid primary key default gen_random_uuid(),
  contractor_id       uuid not null references companies(id),
  name                text not null,
  unit                text not null default 'ea',
  qty_on_hand         integer not null default 0,
  reorder_threshold   integer not null default 0,
  created_at          timestamptz not null default now()
);

create table job_materials (
  job_id        uuid not null references jobs(id) on delete cascade,
  material_id   uuid not null references materials(id),
  qty_required  integer not null,
  primary key (job_id, material_id)
);

-- ---------- scaffolds ----------
-- one row per physical scaffold structure, tagged with a QR code on site
create table scaffolds (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references jobs(id),
  qr_code        text unique not null, -- encoded value scanned in the field
  type           text not null,        -- e.g. "Independent — double lift"
  status         tag_status not null default 'yellow',
  latitude       numeric(9,6),
  longitude      numeric(9,6),
  erected_at     timestamptz not null default now(),
  dismantled_at  timestamptz
);
create index idx_scaffolds_job on scaffolds(job_id);
create index idx_scaffolds_status on scaffolds(status);

-- ---------- inspections ----------
-- scan → inspect → photograph → sign; result sets the scaffold's current tag
create table inspections (
  id                    uuid primary key default gen_random_uuid(),
  scaffold_id           uuid not null references scaffolds(id) on delete cascade,
  inspector_worker_id   uuid not null references workers(id),
  result                tag_status not null,
  notes                 text,
  inspected_at          timestamptz not null default now(),
  latitude              numeric(9,6), -- GPS-stamped, confirms on-site inspection
  longitude             numeric(9,6)
);
create index idx_inspections_scaffold on inspections(scaffold_id);

-- ---------- handovers ----------
-- digital handover once a scaffold passes inspection (green tag)
create table handovers (
  id                 uuid primary key default gen_random_uuid(),
  scaffold_id        uuid not null references scaffolds(id),
  job_id             uuid not null references jobs(id),
  handed_over_by     uuid not null references workers(id),
  issued_to_name     text not null,
  issued_to_user_id  uuid references users(id),
  handed_over_at     timestamptz not null default now()
);
create index idx_handovers_scaffold on handovers(scaffold_id);

-- ---------- documents ----------
-- polymorphic file storage: inspection photos, signatures, cert scans, handover
-- signatures, all point here instead of each table growing its own file columns
create table documents (
  id             uuid primary key default gen_random_uuid(),
  owner_type     document_owner not null,
  owner_id       uuid not null,   -- id of the inspection / handover / certification / etc.
  doc_type       text not null,  -- 'photo' | 'signature' | 'certificate' | 'handover_pdf' | 'other'
  file_url       text not null,  -- S3 / cloud storage key
  uploaded_by    uuid references users(id),
  created_at     timestamptz not null default now()
);
create index idx_documents_owner on documents(owner_type, owner_id);

-- deferred FK now that documents exists
alter table certifications
  add constraint fk_certifications_document
  foreign key (document_id) references documents(id);

-- ============================================================
-- Notes
-- ============================================================
-- 1. UUID primary keys throughout: the mobile app (Expo) needs to create
--    scaffolds, inspections and handovers OFFLINE at a job site with no
--    signal, then sync later. Client-generated UUIDs avoid id collisions
--    on sync in a way that serial/identity columns can't.
--
-- 2. Competency check (your module 03) is a query, not a stored field:
--      select max(level) from certifications
--      where worker_id = any(:crew_worker_ids)
--        and (expiry_date is null or expiry_date >= current_date)
--    compare against the job's work_type before allowing a schedule to save.
--
-- 3. Material shortfall check (module 04) is also computed, not stored:
--      select material_id, sum(qty_required) as committed
--      from job_materials group by material_id
--    compare against materials.qty_on_hand.
--
-- 4. scaffolds.status is a live cache of the *latest* inspection's result —
--    set it in the same transaction that inserts the inspection row, so the
--    dashboard never has to compute "latest inspection per scaffold" live.
