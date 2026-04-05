# Lifelogue

A personal journal for anything worth tracking — races, films, albums, books, or whatever you invent.

---

## Supabase Setup

### 1. Create a Supabase project

- Go to [supabase.com](https://supabase.com) and sign in
- Click **New Project**, give it a name (e.g. `lifelogue`), set a database password, pick a region close to you
- Wait ~2 minutes for it to provision

---

### 2. Create the database tables

Go to the **SQL Editor** in your Supabase dashboard and run this:

```sql
-- Collections: user-defined schemas (name, emoji, field definitions)
create table collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  description text,
  emoji text default '📓',
  fields jsonb not null default '[]',
  created_at timestamptz default now()
);

-- Entries: individual log items with dynamic data stored as JSON
create table entries (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid references collections(id) on delete cascade not null,
  user_id uuid references auth.users not null,
  title text not null,
  data jsonb not null default '{}',
  created_at timestamptz default now()
);

-- Row Level Security: users can only see and touch their own rows
alter table collections enable row level security;
alter table entries enable row level security;

create policy "Users manage own collections"
  on collections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own entries"
  on entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

---

### 3. Get your API credentials

- In your Supabase project go to **Settings → API**
- Copy your **Project URL** and **anon public** key

---

### 4. Configure the app

In the project root, copy `.env.example` to `.env`:

```
cp .env.example .env
```

Then fill in your values:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

### 5. Run the app

```bash
npm install
npm run dev
```

Visit `http://localhost:5173`. Create an account, make a collection, start logging.

---

## How it works (the interesting part)

**The schema problem:** You can't know ahead of time what fields a user will want. The solution here is a "meta-schema" approach:

- `collections.fields` stores the field *definitions* as JSON — e.g. `[{"name": "Hot Take", "type": "textarea"}, {"name": "Rating", "type": "stars"}]`
- `entries.data` stores the actual *values* as JSON — e.g. `{"Hot Take": "Verstappen coasted", "Rating": 3}`

This means one flexible table handles every collection type instead of needing a new table per category.

**Auth:** Supabase handles the full auth flow. `supabase.auth.signInWithPassword()` returns a session with a JWT. That JWT is automatically attached to every subsequent request, so Supabase knows who's asking.

**Row Level Security (RLS):** The SQL policies above live *in the database*, not in the app. Even if someone got your anon key and queried the API directly, they'd only ever get back their own rows. The app code can't accidentally expose other users' data.

---

## Enable Shared Collections (multi-user)

If you want multiple users to access the same collection, run this migration in Supabase SQL Editor.

```sql
-- 1) Add invite code on collections (used for share links)
alter table collections
  add column if not exists share_code text unique;

-- 2) Membership table: users who joined shared collections
create table if not exists collection_memberships (
  collection_id uuid references collections(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  invite_code text not null,
  created_at timestamptz not null default now(),
  primary key (collection_id, user_id)
);

alter table collection_memberships enable row level security;

-- 3) Replace old collection policy (owner-only) with shared read policy
drop policy if exists "Users manage own collections" on collections;

create policy "Owners create collections"
  on collections for insert
  with check (auth.uid() = user_id);

create policy "Owners update collections"
  on collections for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Owners delete collections"
  on collections for delete
  using (auth.uid() = user_id);

create policy "Owners and members read collections"
  on collections for select
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from collection_memberships m
      where m.collection_id = collections.id
        and m.user_id = auth.uid()
    )
  );

-- 4) Replace old entry policy with shared-access policy
drop policy if exists "Users manage own entries" on entries;

create policy "Owners and members read entries"
  on entries for select
  using (
    exists (
      select 1
      from collections c
      left join collection_memberships m
        on m.collection_id = c.id and m.user_id = auth.uid()
      where c.id = entries.collection_id
        and (c.user_id = auth.uid() or m.user_id is not null)
    )
  );

create policy "Owners and members create entries"
  on entries for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from collections c
      left join collection_memberships m
        on m.collection_id = c.id and m.user_id = auth.uid()
      where c.id = entries.collection_id
        and (c.user_id = auth.uid() or m.user_id is not null)
    )
  );

create policy "Owners and members update entries"
  on entries for update
  using (
    exists (
      select 1
      from collections c
      left join collection_memberships m
        on m.collection_id = c.id and m.user_id = auth.uid()
      where c.id = entries.collection_id
        and (c.user_id = auth.uid() or m.user_id is not null)
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from collections c
      left join collection_memberships m
        on m.collection_id = c.id and m.user_id = auth.uid()
      where c.id = entries.collection_id
        and (c.user_id = auth.uid() or m.user_id is not null)
    )
  );

create policy "Owners and members delete entries"
  on entries for delete
  using (
    exists (
      select 1
      from collections c
      left join collection_memberships m
        on m.collection_id = c.id and m.user_id = auth.uid()
      where c.id = entries.collection_id
        and (c.user_id = auth.uid() or m.user_id is not null)
    )
  );

-- 5) Membership policies
create policy "Read memberships for involved users"
  on collection_memberships for select
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from collections c
      where c.id = collection_memberships.collection_id
        and c.user_id = auth.uid()
    )
  );

create policy "Join by invite code"
  on collection_memberships for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from collections c
      where c.id = collection_memberships.collection_id
        and c.share_code = collection_memberships.invite_code
    )
  );

create policy "Leave or owner removes membership"
  on collection_memberships for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from collections c
      where c.id = collection_memberships.collection_id
        and c.user_id = auth.uid()
    )
  );
```

After this migration, owners can share links from the collection page and other users can join through that link.

---

## Deploy to Vercel (optional)

```bash
npm install -g vercel
vercel
```

Add your two env vars in the Vercel project settings and you're live.
