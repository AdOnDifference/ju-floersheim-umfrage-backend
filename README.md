# JU Flörsheim – Umfrage (Backend/API)

Express + PostgreSQL API for storing survey responses.

## Quick start
```bash
npm i
npm run dev
```
Create `.env` (see `.env.example`) and set:
- `DATABASE_URL` (Neon connection string)
- `PORT=8080`
- `CORS_ORIGIN=https://your-domain.tld,https://your-vercel-project.vercel.app`
- `IP_HASH_SALT=<random-long-string>`

## Deploy
Ideal target: Railway. It will run `npm run build` then `npm start`.
