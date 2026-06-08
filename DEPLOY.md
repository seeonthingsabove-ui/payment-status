# Deploying to Vercel (free, no Emergent dependency)

## What changed from the original Emergent version

| Before | After |
|--------|-------|
| Emergent object storage | Vercel Blob (free 500 MB) |
| Motor (async MongoDB) | pymongo (sync — more reliable on serverless) |
| Emergent-hosted backend | Vercel serverless Python function (`api/index.py`) |
| Emergent-specific `vercel.json` | Standard Vercel config |

---

## Step 1 — MongoDB Atlas (free database)

1. Go to https://cloud.mongodb.com → **Create a free account** (or sign in)
2. Create a **free M0 cluster** (choose any region)
3. Under **Database Access**, create a database user with a password
4. Under **Network Access**, add `0.0.0.0/0` to allow connections from Vercel
5. Click **Connect → Drivers** → copy the connection string:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `<user>` and `<password>` with your credentials.

---

## Step 2 — Vercel account & project

1. Go to https://vercel.com → sign up with GitHub (free Hobby plan)
2. Click **Add New → Project**
3. Import your GitHub repo (push this code to GitHub first if you haven't)
4. Set **Root Directory** to `.` (repo root — not `frontend/`)
5. Vercel will auto-detect the `vercel.json` build config — click **Deploy**

---

## Step 3 — Vercel Blob storage

1. In your Vercel project dashboard, go to **Storage → Create Database → Blob**
2. Name it anything (e.g. `payment-screenshots`) and click **Create**
3. On the next screen, click **Connect to Project** and select your project
4. Vercel automatically adds `BLOB_READ_WRITE_TOKEN` to your project's environment variables

---

## Step 4 — Set environment variables in Vercel

Go to your project → **Settings → Environment Variables** and add:

| Variable | Value |
|----------|-------|
| `MONGO_URL` | Your MongoDB Atlas connection string from Step 1 |
| `DB_NAME` | `payment_tracker` (or any name you like) |
| `REACT_APP_BACKEND_URL` | *(leave empty — frontend and backend share the same domain)* |

`BLOB_READ_WRITE_TOKEN` is added automatically in Step 3.

---

## Step 5 — Redeploy

After setting env vars, trigger a new deployment:
- Push any commit to your repo, **or**
- Go to Vercel dashboard → **Deployments → Redeploy**

Your app will be live at `https://your-project.vercel.app`.

---

## Local development

1. Create `backend/.env`:
   ```
   MONGO_URL=mongodb+srv://...
   DB_NAME=payment_tracker
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
   ```

2. Create `frontend/.env.local`:
   ```
   REACT_APP_BACKEND_URL=http://localhost:8000
   ```

3. Install backend deps and run:
   ```bash
   cd backend
   pip install fastapi uvicorn pymongo pydantic python-dotenv python-multipart requests mangum
   uvicorn index:app --reload --app-dir ../api
   ```
   Or run the legacy server directly:
   ```bash
   uvicorn server:app --reload
   ```

4. In a second terminal, run the frontend:
   ```bash
   cd frontend
   npm install
   npm start
   ```

---

## Note on existing screenshots

Screenshots stored in the original Emergent object storage will no longer be accessible after migration (Emergent's storage is tied to their platform). You'll need to re-upload those screenshots to any affected payment records.

New screenshots uploaded after deployment will be stored in Vercel Blob and will work automatically.
