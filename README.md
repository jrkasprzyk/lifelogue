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

## Deploy to Vercel (optional)

```bash
npm install -g vercel
vercel
```

Add your two env vars in the Vercel project settings and you're live.
