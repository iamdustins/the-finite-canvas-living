# The Finite Canvas · Living Time Sanctuary (Full-Stack Edition)

> *“Keep your peace in the time, and the time in your peace.”*

The full-stack **Living Time Journal & Contemplative Sanctuary** edition of **The Finite Canvas**, built with **React**, **TypeScript**, **Express**, **Gemini 3.8 Flash (`@google/genai`)**, **Recharts**, and **Tailwind CSS**.

## Three Sanctuary Chambers (Built on the 3 · 6 · 9 Architecture)

1. **I · The Living Time Journal & AI Soul Mirror**
   - Inscribe daily reflections or choose from contemplative seeds.
   - Powered by **Gemini 3.8 Flash** (`client.interactions.create`), the Soul Mirror reflects on your entry, provides a tailored breathing cue, identifies which of your **9 Soul Postures** are being pulled into shadow, and offers a 1-click **"Apply to Canvas"** button to shift your sliders and reclaim luminous hours.
2. **II · Stillpoint Breath & Daily Peace Interjections**
   - Interactive geometric breathing mandala supporting **3 sacred cadences** (*Box Stillness 4·4·4·4*, *Vagal Release 4·7·8*, *Heart Coherence 5·5*).
   - **Guardian Peace Interjections**: Watches your 3 heaviest inward postures and delivers context-aware reminders (on-demand or every 15 / 30 minutes with browser notifications) so you don't trade finite hours for frustration.
3. **III · The Living Trajectory & Sanctuary Ledger**
   - Tracks your day-over-day **Luminous Hours %**, **Reflections Inscribed**, **Hours Reclaimed into Grace**, and **Stillpoint Breath Minutes** in a persistent Express backend (`server/data/sanctuary.db.json`) with seamless browser hybrid fallback.

## Running Full-Stack Locally (Express Server + Vite Client)

```bash
npm install
# Optional: set GEMINI_API_KEY in your environment or paste it in the UI header
npm run dev
```
- **Frontend UI:** `http://localhost:5173/the-finite-canvas-living/`
- **Backend API:** `http://localhost:3001/api/sanctuary`
