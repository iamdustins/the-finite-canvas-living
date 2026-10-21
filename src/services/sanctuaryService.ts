import { GoogleGenAI } from '@google/genai';

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
  recommendedDelta: number;
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

const LOCAL_DB_KEY = 'finite_canvas_living_sanctuary_db_v1';

interface LocalSanctuaryDb {
  journalEntries: JournalEntry[];
  snapshots: ResonanceSnapshot[];
  totalBreathMinutes: number;
  totalHoursReclaimed: number;
}

const DEFAULT_LOCAL_DB: LocalSanctuaryDb = {
  journalEntries: [
    {
      id: 'seed-1',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      text: 'Felt rushed between obligations today and caught myself getting frustrated that others did not immediately see how much weight I was carrying.',
      moodTag: 'Shadow & Friction',
      aiReflection:
        'When the day is overdrawn, the heart naturally armors itself and demands to be understood. Yet demanding understanding is a second weight added to the first. Notice how setting down the need to be seen immediately returns the evening hour to your own keeping.',
      breathingCue:
        'Inhale for 4 seconds to gather the scattered hour · Hold for 7 · Exhale for 8 to release the need to be understood.',
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

function getLocalDb(): LocalSanctuaryDb {
  try {
    const raw = localStorage.getItem(LOCAL_DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return DEFAULT_LOCAL_DB;
}

function saveLocalDb(db: LocalSanctuaryDb) {
  try {
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
  } catch {
    // ignore
  }
}

export async function fetchSanctuaryData() {
  try {
    const res = await fetch('/api/sanctuary');
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback to local browser storage when running serverless
  }
  const local = getLocalDb();
  return {
    ...local,
    serverConnected: false,
    hasServerApiKey: false,
  };
}

export async function syncCanvasSnapshot(payload: {
  state: unknown;
  luminousPct: number;
  openCanvasYears: number;
  soulIndex: number;
}) {
  try {
    const res = await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback to local
  }
  const db = getLocalDb();
  const snapshot: ResonanceSnapshot = {
    date: 'Today',
    luminousPct: Math.round(payload.luminousPct),
    openCanvasYears: +payload.openCanvasYears.toFixed(1),
    soulIndex: Math.round(payload.soulIndex),
    breathMinutes: db.totalBreathMinutes,
  };
  const idx = db.snapshots.findIndex((s) => s.date === 'Today');
  if (idx >= 0) db.snapshots[idx] = snapshot;
  else db.snapshots.push(snapshot);
  saveLocalDb(db);
  return { ok: true, snapshots: db.snapshots };
}

export async function logBreathSession(minutes: number, hoursReclaimedBonus: number) {
  try {
    const res = await fetch('/api/breath/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes, hoursReclaimedBonus }),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local
  }
  const db = getLocalDb();
  db.totalBreathMinutes += minutes;
  db.totalHoursReclaimed += hoursReclaimedBonus;
  saveLocalDb(db);
  return {
    ok: true,
    totalBreathMinutes: db.totalBreathMinutes,
    totalHoursReclaimed: db.totalHoursReclaimed,
  };
}

export async function analyzeJournalReflection(params: {
  text: string;
  moodTag: 'Shadow & Friction' | 'Seeking Stillpoint' | 'Luminous Grace';
  psyche: SoulPostures;
  wakingHoursRemaining: number;
  apiKey?: string;
}): Promise<{ entry: JournalEntry; totalHoursReclaimed: number }> {
  try {
    const res = await fetch('/api/journal/reflect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) return await res.json();
  } catch {
    // Serverless browser mode: try direct @google/genai if apiKey is provided, otherwise heuristic synthesis
  }

  let aiResult: {
    aiReflection: string;
    breathingCue: string;
    postureAdjustments: PostureAdjustment[];
    hoursReclaimed: number;
  } | null = null;

  if (params.apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: params.apiKey });
      const prompt = `You are the contemplative guide of "The Finite Canvas" — a living time journal that helps a human keep their peace in the time, and time in the peace.
The user wrote this reflection:
"""
${params.text}
"""
Mood tag: ${params.moodTag}
Current Soul Postures (-100 is Shadow/Contraction, +100 is Grace/Expansion):
${JSON.stringify(params.psyche)}
Remaining Waking Hours: ${params.wakingHoursRemaining}

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
    } catch (e) {
      console.warn('Browser Gemini reflection fallback:', e);
    }
  }

  if (!aiResult) {
    const lower = params.text.toLowerCase();
    const adjustments: PostureAdjustment[] = [];
    if (lower.includes('understand') || lower.includes('heard') || lower.includes('listen') || lower.includes('argue')) {
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
    if (lower.includes('grudge') || lower.includes('forgive') || lower.includes('hurt') || lower.includes('bitter')) {
      adjustments.push({
        key: 'forgiveness',
        title: 'The Ledger of Memory',
        recommendedDelta: 15,
        reason: 'Setting down old debts unburdens the nervous system and reclaims the present hour.',
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

    const hoursReclaimed = Math.round(params.wakingHoursRemaining * 0.0045 * adjustments.length);
    aiResult = {
      aiReflection:
        'Every hour spent wrestling with what has already occurred is paid for out of your remaining open canvas. By naming this weight and choosing to set it down, you keep your peace inside the time—and return the time to your peace.',
      breathingCue:
        'Inhale slowly for 4 seconds through the nose · Hold in quiet stillness for 7 seconds · Exhale gently for 8 seconds, letting the clenched hour unclench.',
      postureAdjustments: adjustments.slice(0, 3),
      hoursReclaimed,
    };
  }

  const db = getLocalDb();
  const entry: JournalEntry = {
    id: `entry-${Date.now()}`,
    createdAt: new Date().toISOString(),
    text: params.text,
    moodTag: params.moodTag,
    aiReflection: aiResult.aiReflection,
    breathingCue: aiResult.breathingCue,
    postureAdjustments: aiResult.postureAdjustments,
    hoursReclaimed: aiResult.hoursReclaimed,
    applied: false,
  };
  db.journalEntries.unshift(entry);
  db.totalHoursReclaimed += entry.hoursReclaimed;
  saveLocalDb(db);

  return { entry, totalHoursReclaimed: db.totalHoursReclaimed };
}

export async function generatePeaceInterjection(params: {
  heaviestPostures: Array<{ title: string; value: number }>;
  workdayMarginHrs: number;
  yearsRemaining: number;
  apiKey?: string;
}): Promise<string> {
  try {
    const res = await fetch('/api/peace/interjection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      return data.interjection;
    }
  } catch {
    // Fallback to browser mode
  }

  if (params.apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: params.apiKey });
      const interaction = await ai.interactions.create({
        model: 'gemini-3.8-flash',
        input: `You are the quiet guardian of "The Finite Canvas".
The user has ${params.yearsRemaining} years remaining on their mortal canvas, a daily workday margin of ${params.workdayMarginHrs.toFixed(1)} hours, and their heaviest inward shadow postures right now are: ${JSON.stringify(params.heaviestPostures)}.
Write a 2-sentence poetic, piercing "Stillpoint Interjection" that gently interrupts their day, reminds them not to surrender this hour to frustration, and invites them to take one conscious breath. Return plain text only.`,
      });
      if (interaction.output_text) {
        return interaction.output_text.trim();
      }
    } catch {
      // ignore
    }
  }

  const topShadow = params.heaviestPostures?.[0]?.title || 'The Mirror of Understanding';
  return `Pause for a single breath: with ${params.yearsRemaining} solar years remaining on your canvas, this present hour is too rare to trade for tension along "${topShadow}". Unclench your jaw, drop your shoulders, and keep your peace inside the time.`;
}
