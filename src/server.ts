import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import requestIp from "request-ip";
import crypto from "crypto";
import { z } from "zod";
import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());
app.use(helmet());
app.use(cors({
  origin: (process.env.CORS_ORIGIN?.split(",") || ["*"]),
  methods: ["POST","GET","OPTIONS"],
}));
app.set("trust proxy", true);

const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
app.use(limiter);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const schema = z.object({
  age_group: z.enum(["u18","18_24","25_34","35_49","50_64","65_plus"]),
  district:  z.enum(["floersheim_mitte","wicker","weilbach","keramag_falkenberg"]),
  topics:    z.array(z.enum([
    "verkehr_infrastruktur","oeffentlicher_nahverkehr","wohnen_bau","umwelt_gruen",
    "sport_freizeit","kultur_veranstaltungen","digitalisierung_internet",
    "sicherheit_ordnung","wirtschaft_einzelhandel","sonstiges"
  ])).min(0),
  other_topic: z.string().optional(),
  comment:     z.string().max(1200).optional(),
  wants_updates: z.boolean().default(false),
  email: z.union([z.string().email(), z.literal(""), z.undefined()])
}).refine(d => d.topics.includes("sonstiges") ? Boolean(d.other_topic) : true,
          { path:["other_topic"], message:"Bitte 'Sonstiges' konkretisieren." })
  .refine(d => d.wants_updates ? Boolean(d.email && d.email.length > 3) : true,
          { path:["email"], message:"Bitte E-Mail angeben oder Updates abwählen." });

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.IP_HASH_SALT || "change-me";
  return crypto.createHash("sha256").update(ip + salt).digest("hex");
}

app.get("/v1/health", (_req, res) => res.json({ ok: true }));

app.post("/v1/survey", async (req, res) => {
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.flatten() });

  const data = parse.data;
  const clientIp = requestIp.getClientIp(req);
  try {
    await pool.query(
      `INSERT INTO survey_response
       (age_group, district, topics, other_topic, comment, wants_updates, email, user_agent, ip_hash)
       VALUES ($1,$2,$3,$4,$5,$6, NULLIF($7,''), $8, $9)`,
      [
        data.age_group,
        data.district,
        data.topics,
        data.other_topic || null,
        data.comment || null,
        data.wants_updates,
        data.email || null,
        req.headers["user-agent"] || null,
        hashIp(clientIp)
      ]
    );
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`API running on :${port}`));
