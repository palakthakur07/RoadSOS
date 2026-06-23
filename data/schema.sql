-- ─────────────────────────────────────────────────────────────
-- RoadSoS: incidents table
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";  -- for gen_random_uuid()

create table if not exists incidents (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('accident','pothole','road_block','flood','signal_fault','debris','other')),
  lat           double precision not null check (lat >= -90 and lat <= 90),
  lng           double precision not null check (lng >= -180 and lng <= 180),
  description   text not null check (char_length(description) >= 10),
  severity      text not null default 'medium' check (severity in ('low','medium','high','critical')),
  reporter_name text not null default 'Anonymous',
  status        text not null default 'reported' check (status in ('reported','acknowledged','resolved','dismissed')),
  created_at    timestamptz not null default now()
);

-- Speeds up "list recent incidents" and future "incidents near me" queries
create index if not exists incidents_created_at_idx on incidents (created_at desc);
create index if not exists incidents_lat_lng_idx on incidents (lat, lng);

-- Row Level Security: allow anonymous read + insert (this is a public reporting tool),
-- but not update/delete from the client — only your backend's service_role key can do that.
alter table incidents enable row level security;

create policy "Public can read incidents"
  on incidents for select
  using (true);

create policy "Public can report incidents"
  on incidents for insert
  with check (true);

-- No update/delete policy is created here, so only requests using the
-- service_role key (server-side, never exposed to the browser) can modify
-- or remove rows. This keeps the public API report-only and tamper-resistant.