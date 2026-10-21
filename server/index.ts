import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'sanctuary.db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface SoulPostures {
  empathy: number;
  acceptance: number;
  forgiveness: number;
  surrender: number;
  gratitude: number;
  presence: number;
  humility: number;
  communion: number;
  purpose: number;
}

export interface PostureAdjustment {
  key: keyof SoulPostures;
  title: string;
  recommendedDelta: number; // e.g., +15 toward Grace
  reason: string;
}

export interface JournalEntry {
  id: string;
  createdAt: string;
  text: string;
  moodTag: 'Shadow & Friction' | 'Seeking Stillpoint' | 'Luminous Grace';
  aiReflection: string;
  breathingCue: string;
  postureAdjustments: PostureAdjustment[];
  hoursReclaimed: number;
  applied: boolean;
}

export interface ResonanceSnapshot {
  date: string;
  luminousPct: number;
  openCanvasYears: number;
  soulIndex: number;
  breathMinutes: number;
}

interface SanctuaryDatabase {
  state: Record<string, unknown> | null;
  journalEntries: JournalEntry[];
  snapshots: ResonanceSnapshot[];
  totalBreathMinutes: number;
  totalHoursReclaimed: number;
}

function loadDb(): SanctuaryDatabase {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to read DB file:', e);
  }
  return {
    state: null,
    journalEntries: [
      {
        id: 'seed-1',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        text: 'Felt rushed between obligations today and caught myself getting frustrated that others did not immediately see how much weight I was carrying.',
        moodTag: 'Shadow & Friction',
        aiReflection:
          'When the day is overdrawn, the heart naturally armors itself and demands to be understood. Yet demanding understanding is a second weight added to the first. Notice how setting down the need to be seen immediately returns the evening hour to your own keeping.',
        breathingCue: 'Inhale for 4 seconds to gather the scattered hour · Hold for 7 · Exhale for 8 to release the need to be understood.',
        postureAdjustments: [
          {
            key: 'empathy',
            title: 'The Mirror of Understanding',
            recommendedDelta: 15,
            reason: 'Releasing unspoken grievance and turning toward quiet curiosity.',
          },
          {
            key: 'presence',
            title: 'The Inhabited Hour',
            recommendedDelta: 15,
            reason: 'Stepping out of the rushed residue of the workday into the living evening.',
          },
        ],
        hoursReclaimed: 1420,
        applied: true,
      },
    ],
    snapshots: [
      { date: 'Day -6', luminousPct: 48, openCanvasYears: 11.2, soulIndex: 5, breathMinutes: 5 },
      { date: 'Day -5', luminousPct: 51, openCanvasYears: 11.4, soulIndex: 12, breathMinutes: 10 },
      { date: 'Day -4', luminousPct: 49, openCanvasYears: 11.3, soulIndex: 10, breathMinutes: 10 },
      { date: 'Day -3', luminousPct: 55, openCanvasYears: 11.8, soulIndex: 18, breathMinutes: 18 },
      { date: 'Day -2', luminousPct: 58, openCanvasYears: 12.1, soulIndex: 22, breathMinutes: 25 },
      { date: 'Yesterday', luminousPct: 62, openCanvasYears: 12.5, soulIndex: 26, breathMinutes: 32 },
    ],
    totalBreathMinutes: 32,
    totalHoursReclaimed: 1420,
  };
}

function saveDb(db: SanctuaryDatabase) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write DB file:', e);
  }
}

const app = express();
app.use(cors());
app.use(express.json());

// GET /api/sanctuary — Load complete sanctuary state, journal & trajectory
app.get('/api/sanctuary', (_req, res) => {
  const db = loadDb();
  res.json({
    ...db,
    serverConnected: true,
    hasServerApiKey: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
  });
});

// POST /api/state — Save current canvas state & update today's trajectory snapshot
app.post('/api/state', (req, res) => {
  const { state, luminousPct, openCanvasYears, soulIndex } = req.body;
  const db = loadDb();
  db.state = state;

  const todayLabel = 'Today';
  const existingIdx = db.snapshots.findIndex((s) => s.date === todayLabel);
  const snapshot: ResonanceSnapshot = {
    date: todayLabel,
    luminousPct: Math.round(luminousPct ?? 55),
    openCanvasYears: +(openCanvasYears ?? 12).toFixed(1),
    soulIndex: Math.round(soulIndex ?? 20),
    breathMinutes: db.totalBreathMinutes,
  };

  if (existingIdx >= 0) {
    db.snapshots[existingIdx] = snapshot;
  } else {
    db.snapshots.push(snapshot);
  }

  saveDb(db);
  res.json({ ok: true, snapshots: db.snapshots });
});

// POST /api/breath/log — Record completed mindful breathing session
app.post('/api/breath/log', (req, res) => {
  const { minutes, hoursReclaimedBonus } = req.body;
  const db = loadDb();
  db.totalBreathMinutes += Number(minutes) || 2;
  db.totalHoursReclaimed += Number(hoursReclaimedBonus) || 120;
  saveDb(db);
  res.json({
    ok: true,
    totalBreathMinutes: db.totalBreathMinutes,
    totalHoursReclaimed: db.totalHoursReclaimed,
  });
});

// POST /api/journal/reflect — Analyze journal entry using Gemini 3.8 Flash (Interactions API)
app.post('/api/journal/reflect', async (req, res) => {
  const { text, moodTag, psyche, wakingHoursRemaining, apiKey } = req.body;
  const effectiveKey = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const db = loadDb();

  let aiResult: {
    aiReflection: string;
    breathingCue: string;
    postureAdjustments: PostureAdjustment[];
    hoursReclaimed: number;
  } | null = null;

  if (effectiveKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: effectiveKey });
      const prompt = `You are the contemplative guide of "The Finite Canvas" — a living time journal that helps a human keep their peace in the time, and time in the peace.
The user wrote this reflection:
"""
${text}
"""
Mood tag: ${moodTag}
Current Soul Postures (-100 is Shadow/Contraction, +100 is Grace/Expansion):
${JSON.stringify(psyche)}
Remaining Waking Hours: ${wakingHoursRemaining}

Respond strictly with valid JSON matching this structure:
{
  "aiReflection": "A deeply poetic, grounded, compassionate 2-3 sentence reflection that honors their finite mortal time and gently dissolves their frustration or affirms their grace.",
  "breathingCue": "A 1-sentence breathing instruction tailored to their emotional state (e.g., Inhale 4s... Hold 7s... Exhale 8s...).",
  "postureAdjustments": [
    {
      "key": "one of: empathy | acceptance | forgiveness | surrender | gratitude | presence | humility | communion | purpose",
      "title": "Poetic axis name",
      "recommendedDelta": 15,
      "reason": "1 short sentence explaining why shifting this posture reclaims their peace"
    }
  ],
  "hoursReclaimed": 1250
}`;

      const interaction = await ai.interactions.create({
        model: 'gemini-3.8-flash',
        input: prompt,
      });

      const rawText = interaction.output_text || '';
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResult = JSON.parse(jsonMatch[0]);
      }
    } catch (err) {
      console.warn('Gemini API reflection fallback triggered:', err);
    }
  }

  // Fallback contemplative synthesis if offline or no key provided
  if (!aiResult) {
    const lower = String(text || '').toLowerCase();
    const adjustments: PostureAdjustment[] = [];

    if (lower.includes('understand') || lower.includes('heard') || lower.includes('argue') || lower.includes('listen')) {
      adjustments.push({
        key: 'empathy',
        title: 'The Mirror of Understanding',
        recommendedDelta: 15,
        reason: 'Softening the demand to be understood restores immediate relational stillness.',
      });
    }
    if (lower.includes('angry') || lower.includes('why') || lower.includes('unfair') || lower.includes('frustrat')) {
      adjustments.push({
        key: 'acceptance',
        title: 'The Weight of What Happened',
        recommendedDelta: 15,
        reason: 'Making peace with unchangeable events halts the erosion of your waking hours.',
      });
    }
    if (lower.includes('worry') || lower.includes('anxious') || lower.includes('control') || lower.includes('rush')) {
      adjustments.push({
        key: 'surrender',
        title: 'The Horizon of Uncertainty',
        recommendedDelta: 15,
        reason: 'Loosening clenched control lowers allostatic load and lengthens your vital span.',
      });
    }
    if (adjustments.length === 0) {
      adjustments.push(
        {
          key: 'presence',
          title: 'The Inhabited Hour',
          recommendedDelta: 15,
          reason: 'Returning attention to the immediate breath sanctifies the open canvas.',
        },
        {
          key: 'gratitude',
          title: 'The Measure of Enough',
          recommendedDelta: 10,
          reason: 'Recognizing sufficiency turns ordinary hours into luminous time.',
        }
      );
    }

    const hoursReclaimed = Math.round((wakingHoursRemaining || 300000) * 0.0045 * adjustments.length);
    aiResult = {
      aiReflection:
        'Every hour spent wrestling with what has already occurred is paid for out of your remaining open canvas. By naming this weight and choosing to set it down, you keep your peace inside the time—and return the time to your peace.',
      breathingCue:
        'Inhale slowly for 4 seconds through the nose · Hold in quiet stillness for 7 seconds · Exhale gently for 8 seconds, letting the clenched hour unclench.',
      postureAdjustments: adjustments.slice(0, 3),
      hoursReclaimed,
    };
  }

  const newEntry: JournalEntry = {
    id: `entry-${Date.now()}`,
    createdAt: new Date().toISOString(),
    text,
    moodTag: moodTag || 'Seeking Stillpoint',
    aiReflection: aiResult.aiReflection,
    breathingCue: aiResult.breathingCue,
    postureAdjustments: aiResult.postureAdjustments,
    hoursReclaimed: aiResult.hoursReclaimed,
    applied: false,
  };

  db.journalEntries.unshift(newEntry);
  db.totalHoursReclaimed += newEntry.hoursReclaimed;
  saveDb(db);

  res.json({ entry: newEntry, totalHoursReclaimed: db.totalHoursReclaimed });
});

// POST /api/peace/interjection — Generate a context-aware Peace & Breath Reminder
app.post('/api/peace/interjection', async (req, res) => {
  const { heaviestPostures, workdayMarginHrs, yearsRemaining, apiKey } = req.body;
  const effectiveKey = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (effectiveKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: effectiveKey });
      const interaction = await ai.interactions.create({
        model: 'gemini-3.8-flash',
        input: `You are the quiet guardian of "The Finite Canvas".
The user has ${yearsRemaining} years remaining on their mortal canvas, a daily workday margin of ${workdayMarginHrs} hours, and their heaviest inward shadow postures right now are: ${JSON.stringify(heaviestPostures)}.
Write a 2-sentence poetic, piercing "Stillpoint Interjection" that gently interrupts their day, reminds them not to surrender this hour to frustration, and invites them to take one conscious breath. Return plain text only.`,
      });
      if (interaction.output_text) {
        res.json({ interjection: interaction.output_text.trim() });
        return;
      }
    } catch (err) {
      console.warn('Gemini interjection fallback triggered:', err);
    }
  }

  const topShadow = heaviestPostures?.[0]?.title || 'The Mirror of Understanding';
  res.json({
    interjection: `Pause for a single breath: with ${yearsRemaining} solar years remaining on your canvas, this present hour is too rare to trade for ${topShadow.toLowerCase()}. Unclench your jaw, drop your shoulders, and let the need to force the outcome pass through you.`,
  });
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`[The Finite Canvas · Sanctuary Server] Listening on http://localhost:${PORT}`);
});
