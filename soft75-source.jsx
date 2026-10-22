import { useState, useEffect, useRef } from "react";

// ---------- date helpers ----------
const toISO = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleDateString("en-CA");
};
const todayISO = () => toISO(new Date());
const addDays = (iso, n) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toISO(d);
};
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const dayOfYear = (iso) => {
  const d = new Date(iso + "T00:00:00");
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
};
const fmtShort = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

// ---------- defaults ----------
const defaultStreakHabits = [
  { id: "write", name: "Write", emoji: "✍️", minimum: 5, unit: "min", hardMinimum: 2, prior: 0, priorActive: false },
  { id: "instrument", name: "Play instrument", emoji: "🎸", minimum: 5, unit: "min", hardMinimum: 2, prior: 0, priorActive: false },
  { id: "bible", name: "Bible meditation", emoji: "🕊️", minimum: 5, unit: "min", hardMinimum: 2, prior: 0, priorActive: false },
  { id: "french", name: "French", emoji: "🇫🇷", minimum: 5, unit: "min", hardMinimum: 2, prior: 0, priorActive: false },
  { id: "reading", name: "Reading", emoji: "📚", minimum: 15, unit: "min", altMinimum: 10, altUnit: "pages", hardMinimum: 5, hardAltMinimum: 3, prior: 0, priorActive: false },
];

const practiceHabits = [
  { id: "move", name: "Move my body", emoji: "🏃‍♀️", unit: "min", hasMinutes: true, hasBonus: true },
  { id: "ww", name: "Track food, honestly", emoji: "🥗", hasPoints: true, minLabel: "log it honestly" },
  { id: "vitamins", name: "Vitamins", emoji: "💊", minLabel: "today's dose" },
];

const connectPrompts = [
  "Notice one bid for connection today.",
  "Tell your child something you genuinely admire about them.",
  "Ask them about the best part of their day.",
  "Ask them whether anything felt difficult today.",
  "Give them an intentional hug.",
  "Spend ten minutes entering their world through play.",
  "Pray over your children today.",
  "Tell them something you loved about them today.",
];

const connectForms = [
  { id: "notice", label: "Notice", desc: "Catch a bid for connection; stop and pay attention" },
  { id: "affirm", label: "Affirm", desc: "Praise, encourage and affirm them" },
  { id: "listen", label: "Listen", desc: "Ask about their highlights, challenges and feelings" },
  { id: "play", label: "Play", desc: "Enter their world and play with them" },
  { id: "hug", label: "Hug", desc: "Offer intentional physical affection" },
  { id: "pray", label: "Pray", desc: "Pray over them or with them" },
];

const ritual = [
  { label: "Highlight", line: "What was your favourite part of today?" },
  { label: "Challenge", line: "Was there anything difficult today?" },
  { label: "Affirmation", line: "Something I loved or noticed about you today was…" },
  { label: "Affection", line: "A deliberate hug or moment of physical closeness." },
  { label: "Prayer", line: "Pray with or over them." },
];

// Modes are stored as "periods" (start date, optional end date, a rule per habit).
// Only holiday is offered today; other types (illness, a hard week) can be added here later.
const PERIOD_TYPES = {
  holiday: { emoji: "🌴", label: "Holiday", defaultName: "Holiday" },
};
const LANDING_DAYS = 3;

const defaultState = {
  version: 4,
  startDate: todayISO(),
  streakHabits: defaultStreakHabits,
  move: { minimum: 15, hardMinimum: 5 },
  ww: { dailyTarget: 23, weeklyPoints: 35 },
  completions: {},
  periods: [],
};

const STORAGE_KEY = "soft75:state";

// ---------- small components ----------
function Dots({ history, color }) {
  return (
    <div className="dots" aria-hidden="true">
      {history.map((s, i) => (
        <span key={i} className={`dot dot-${s}`} style={s === "done" ? { background: color } : undefined} />
      ))}
    </div>
  );
}

function Check({ checked, onClick, color }) {
  return (
    <button
      className={`check ${checked ? "check-on" : ""}`}
      style={checked ? { background: color, borderColor: color } : { borderColor: color }}
      onClick={onClick}
      aria-pressed={checked}
      aria-label={checked ? "Mark not done" : "Mark done"}
    >
      {checked && (
        <svg viewBox="0 0 20 20" width="13" height="13">
          <path d="M4 10.5L8 14.5L16 6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

export default function Soft75() {
  const [state, setState] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [hardDay, setHardDay] = useState(false);
  const [view, setView] = useState("today"); // today | settings | holiday
  const [expanded, setExpanded] = useState(null);
  const [ritualOpen, setRitualOpen] = useState(false);
  const [err, setErr] = useState("");
  const saveTimer = useRef(null);

  const today = todayISO();

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setState({
            ...defaultState,
            ...parsed,
            ww: { ...defaultState.ww, ...(parsed.ww || {}) },
            move: { ...defaultState.move, ...(parsed.move || {}) },
            periods: Array.isArray(parsed.periods) ? parsed.periods : [],
          });
        } else {
          setState(defaultState);
        }
      } catch (e) {
        setState(defaultState);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded || !state) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const result = await window.storage.set(STORAGE_KEY, JSON.stringify(state), false);
        setErr(result ? "" : "Couldn't save just now — your changes may not persist.");
      } catch (e) {
        setErr("Couldn't save just now — your changes may not persist.");
      }
    }, 350);
    return () => clearTimeout(saveTimer.current);
  }, [state, loaded]);

  if (!loaded || !state) {
    return (
      <div className="soft75-root">
        <Style />
        <div className="loading">Opening today's page…</div>
      </div>
    );
  }

  const dayOfDate = (iso) => state.completions[iso] || {};
  const setDay = (iso, patch) => {
    setState((s) => ({
      ...s,
      completions: { ...s.completions, [iso]: { ...(s.completions[iso] || {}), ...patch } },
    }));
  };

  const toggleStreak = (habitId) => {
    const cur = dayOfDate(today)[habitId]?.done || false;
    setDay(today, { [habitId]: { ...(dayOfDate(today)[habitId] || {}), done: !cur } });
  };
  const toggleBonus = (habitId) => {
    const cur = dayOfDate(today)[habitId]?.bonus || false;
    setDay(today, { [habitId]: { ...(dayOfDate(today)[habitId] || {}), bonus: !cur } });
  };
  const togglePractice = (habitId) => {
    const cur = dayOfDate(today)[habitId]?.done || false;
    setDay(today, { [habitId]: { ...(dayOfDate(today)[habitId] || {}), done: !cur } });
  };
  const setPracticeField = (habitId, field, value) => {
    setDay(today, { [habitId]: { ...(dayOfDate(today)[habitId] || {}), [field]: value } });
  };
  const toggleConnectBonus = () => {
    const cur = dayOfDate(today).connect?.bonus || false;
    setDay(today, { connect: { ...(dayOfDate(today).connect || {}), bonus: !cur } });
  };
  const toggleConnectDone = () => {
    const cur = dayOfDate(today).connect?.done || false;
    setDay(today, { connect: { ...(dayOfDate(today).connect || {}), done: !cur } });
  };

  // ---------- modes (periods) ----------
  const periods = state.periods || [];
  const byNewest = [...periods].sort((a, b) => b.start.localeCompare(a.start));
  // A period applies from its start. If it has been closed ("I'm home") it stops at its end date;
  // otherwise it keeps applying until the user closes it, even if the planned end has passed.
  const periodOn = (iso) => byNewest.find((p) => iso >= p.start && (p.closed ? iso <= p.end : true)) || null;
  const landingPeriodOn = (iso) =>
    periods.find((p) => p.closed && !p.continued && !p.noLanding && p.end && iso > p.end && iso <= addDays(p.end, LANDING_DAYS)) || null;

  // What applies to a habit on a given day: normal | adapted | paused | landing
  const infoFor = (iso, hid) => {
    const p = periodOn(iso);
    if (p) {
      const r = (p.rules || {})[hid];
      if (!r || r.mode === "keep") return { state: "normal" };
      if (r.mode === "pause") return { state: "paused" };
      return { state: "adapted", rule: r };
    }
    if (landingPeriodOn(iso)) return { state: "landing" };
    return { state: "normal" };
  };

  const activePeriod = byNewest.find((p) => !p.closed && p.start <= today) || null;
  const upcomingPeriod = byNewest.find((p) => !p.closed && p.start > today) || null;
  const pastPlannedEnd = !!(activePeriod && activePeriod.end && activePeriod.end < today);
  const landingPeriod = !activePeriod ? landingPeriodOn(today) : null;

  const newId = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const savePeriod = (form, existing) => {
    setState((s) => {
      let list = [...(s.periods || [])];
      const base = { type: "holiday", name: form.name, rules: form.rules, end: form.end, closed: false };
      if (existing && existing.start >= today) {
        list = list.map((p) => (p.id === existing.id ? { ...p, ...base, start: form.start } : p));
      } else if (existing) {
        // Started earlier: earlier days keep the rules they were under; new rules apply from today.
        list = list.map((p) => (p.id === existing.id ? { ...p, closed: true, end: addDays(today, -1), continued: true } : p));
        list.push({ ...base, id: newId(), start: today });
      } else {
        list.push({ ...base, id: newId(), start: form.start });
      }
      return { ...s, periods: list };
    });
    setView("today");
  };

  const removeUpcoming = (p) => {
    setState((s) => ({ ...s, periods: (s.periods || []).filter((x) => x.id !== p.id) }));
    setView("today");
  };

  const imHome = (p) => {
    const yesterday = addDays(today, -1);
    setState((s) => {
      if (p.start > yesterday) return { ...s, periods: (s.periods || []).filter((x) => x.id !== p.id) };
      return {
        ...s,
        periods: (s.periods || []).map((x) => (x.id === p.id ? { ...x, closed: true, end: yesterday } : x)),
      };
    });
  };

  const setPeriodEnd = (p, end) => {
    setState((s) => ({ ...s, periods: (s.periods || []).map((x) => (x.id === p.id ? { ...x, end } : x)) }));
  };

  const skipLanding = (p) => {
    setState((s) => ({ ...s, periods: (s.periods || []).map((x) => (x.id === p.id ? { ...x, noLanding: true } : x)) }));
  };

  // ---------- streak math ----------
  const isDone = (habitId, iso) => !!state.completions[iso]?.[habitId]?.done;

  // Paused days are skipped: they neither add to a streak nor break it.
  // A day that is done always counts, even if the habit was paused.
  const computeStreak = (habit) => {
    let count = 0;
    let cursor = today;
    let guard = 0;
    while (guard++ < 5000) {
      if (isDone(habit.id, cursor)) count++;
      else if (cursor === today) {
        // today not ticked yet: doesn't break anything
      } else if (infoFor(cursor, habit.id).state === "paused") {
        // resting: skip
      } else break;
      cursor = addDays(cursor, -1);
    }
    const reachedStart = cursor < state.startDate;
    return count + (habit.priorActive && reachedStart ? habit.prior : 0);
  };

  const dotsFor = (habitId) => {
    const arr = [];
    for (let i = 9; i >= 0; i--) {
      const iso = addDays(today, -i);
      if (iso < state.startDate) arr.push("before");
      else if (isDone(habitId, iso)) arr.push("done");
      else if (i === 0) arr.push("today");
      else if (infoFor(iso, habitId).state === "paused") arr.push("paused");
      else arr.push("missed");
    }
    return arr;
  };

  // ---------- 75 day + consistency ----------
  // Calendar-based: depends only on the start date, never on what was completed.
  const dayNumber = Math.min(75, Math.max(1, daysBetween(state.startDate, today) + 1));
  const allDailyHabits = [...state.streakHabits.map((h) => h.id), ...practiceHabits.map((h) => h.id), "connect"];
  let possible = 0;
  let done = 0;
  for (let i = 0; i < daysBetween(state.startDate, today) + 1; i++) {
    const iso = addDays(state.startDate, i);
    allDailyHabits.forEach((hid) => {
      const d = isDone(hid, iso);
      if (!d && infoFor(iso, hid).state === "paused") return; // paused days aren't commitments
      possible++;
      if (d) done++;
    });
  }
  const consistency = possible > 0 ? Math.round((done / possible) * 100) : 0;

  const wwDay = dayOfDate(today).ww || {};
  const pointsConsumed = wwDay.points ?? "";
  const connectDay = dayOfDate(today).connect || {};
  const connectStreak = computeStreak({ id: "connect", priorActive: false, prior: 0 });
  const connectInfo = infoFor(today, "connect");
  const todaysPrompt = connectPrompts[dayOfYear(today) % connectPrompts.length];

  const updateHabit = (id, patch) => {
    setState((s) => ({ ...s, streakHabits: s.streakHabits.map((h) => (h.id === id ? { ...h, ...patch } : h)) }));
  };
  const resetAll = async () => {
    setState(defaultState);
    setView("today");
  };

  const doneToday = allDailyHabits.filter((hid) => isDone(hid, today)).length;
  const commitments = allDailyHabits.filter((hid) => isDone(hid, today) || infoFor(today, hid).state !== "paused").length;

  const streakColors = ["#FF4D8D", "#F72585", "#FF8FAB", "#C77DFF", "#FFB627"];

  // ---------- what's the target today? ----------
  const streakTarget = (h) => {
    const info = infoFor(today, h.id);
    if (info.state === "paused") return { paused: true };
    let min = h.minimum;
    let alt = h.altMinimum;
    let tag = null;
    if (info.state === "adapted") {
      min = info.rule.minimum ?? h.hardMinimum;
      if (alt !== undefined) alt = info.rule.altMinimum ?? h.hardAltMinimum;
      tag = "holiday";
    } else if (info.state === "landing") {
      min = h.hardMinimum;
      if (alt !== undefined) alt = h.hardAltMinimum;
      tag = "easing back";
    }
    if (hardDay) {
      min = Math.min(min, h.hardMinimum);
      if (alt !== undefined) alt = Math.min(alt, h.hardAltMinimum ?? alt);
      tag = "hard day";
    }
    return { min, alt, tag };
  };

  const moveTarget = () => {
    const info = infoFor(today, "move");
    if (info.state === "paused") return { paused: true };
    let min = state.move.minimum;
    let tag = null;
    if (info.state === "adapted") {
      min = info.rule.minimum ?? state.move.hardMinimum;
      tag = "holiday";
    } else if (info.state === "landing") {
      min = state.move.hardMinimum;
      tag = "easing back";
    }
    if (hardDay) {
      min = Math.min(min, state.move.hardMinimum);
      tag = "hard day";
    }
    return { min, tag };
  };

  const typeInfo = PERIOD_TYPES[(activePeriod || upcomingPeriod)?.type] || PERIOD_TYPES.holiday;

  return (
    <div className="soft75-root">
      <Style />
      <div className="sheet">
        <div className="rainbowBar" />
        <header className="header">
          <div>
            <h1>Soft 75</h1>
            <p className="tagline">You just have to keep returning.</p>
          </div>
          <button className="gear" onClick={() => setView((v) => (v === "settings" ? "today" : "settings"))} aria-label="Settings">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
              <path
                d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.55 1.55M7.15 16.85l-1.55 1.55M18.4 18.4l-1.55-1.55M7.15 7.15L5.6 5.6"
                stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="metaRow">
          <span className="metaPill">Day {dayNumber} of 75</span>
          <span className="metaPill mint">{consistency}% kept</span>
          {activePeriod && <span className="metaPill lilac">{typeInfo.emoji} {typeInfo.label} Mode</span>}
        </div>

        {view === "holiday" && (
          <HolidaySetup
            state={state}
            today={today}
            existing={activePeriod || upcomingPeriod}
            onSave={savePeriod}
            onCancel={() => setView("today")}
            onRemove={removeUpcoming}
          />
        )}

        {view === "settings" && (
          <Settings state={state} updateHabit={updateHabit} setState={setState} resetAll={resetAll} close={() => setView("today")} />
        )}

        {view === "today" && (
          <>
            {activePeriod && !pastPlannedEnd && (
              <div className="holidayBanner">
                <div className="bannerTitle">{typeInfo.emoji} {activePeriod.name || typeInfo.label} Mode</div>
                <div className="bannerSub">
                  {activePeriod.end ? `Until ${fmtShort(activePeriod.end)}` : "Until you switch it off"} · your streaks and your 75 days are safe.
                </div>
                <div className="bannerBtns">
                  <button className="bannerBtn" onClick={() => setView("holiday")}>Edit</button>
                  <button className="bannerBtn solid" onClick={() => imHome(activePeriod)}>I'm home</button>
                </div>
              </div>
            )}

            {activePeriod && pastPlannedEnd && (
              <div className="holidayBanner">
                <div className="bannerTitle">{typeInfo.emoji} Still away?</div>
                <div className="bannerSub">
                  You planned to be back by {fmtShort(activePeriod.end)}. No rush — nothing has been marked as missed, and you can return whenever you're ready.
                </div>
                <div className="bannerBtns">
                  <button className="bannerBtn" onClick={() => setPeriodEnd(activePeriod, addDays(today, 7))}>Extend a week</button>
                  <button className="bannerBtn" onClick={() => setPeriodEnd(activePeriod, null)}>Keep going</button>
                  <button className="bannerBtn solid" onClick={() => imHome(activePeriod)}>I'm home</button>
                </div>
              </div>
            )}

            {!activePeriod && upcomingPeriod && (
              <div className="holidayBanner upcoming">
                <div className="bannerTitle">{typeInfo.emoji} {upcomingPeriod.name || typeInfo.label} starts {fmtShort(upcomingPeriod.start)}</div>
                <div className="bannerBtns">
                  <button className="bannerBtn" onClick={() => setView("holiday")}>Edit</button>
                </div>
              </div>
            )}

            {landingPeriod && (
              <div className="landingCard">
                <div className="bannerTitle">🏡 Welcome back</div>
                <div className="bannerSub">
                  Day {daysBetween(landingPeriod.end, today)} of {LANDING_DAYS} easing back. Your streaks are all still here, targets are a little gentler for now, and there's nothing to catch up on.
                </div>
                <div className="bannerBtns">
                  <button className="bannerBtn" onClick={() => skipLanding(landingPeriod)}>Back to full targets</button>
                </div>
              </div>
            )}

            <button className={`hardDayToggle ${hardDay ? "on" : ""}`} onClick={() => setHardDay((v) => !v)}>
              {hardDay ? "Leave hard day mode" : "🌥️ This is a hard day"}
            </button>

            {!activePeriod && !upcomingPeriod && (
              <button className="holidayToggle" onClick={() => setView("holiday")}>
                🌴 Going away? Set up Holiday Mode
              </button>
            )}

            {hardDay && (
              <div className="hardDayBanner">
                Today doesn't need to be a great day. It just needs to count — everything below is showing its hard-day minimum.
              </div>
            )}

            <section className="section">
              <h2 className="coral">Streaks</h2>
              {state.streakHabits.map((h, idx) => {
                const isD = isDone(h.id, today);
                const bonus = dayOfDate(today)[h.id]?.bonus;
                const streak = computeStreak(h);
                const color = streakColors[idx % streakColors.length];
                const t = streakTarget(h);
                return (
                  <div className={`row ${t.paused ? "paused" : ""}`} key={h.id}>
                    <Check checked={isD} onClick={() => toggleStreak(h.id)} color={color} />
                    <div className="rowMain">
                      <div className="rowTop">
                        <span className="rowName">{h.emoji} {h.name}</span>
                        <span className="rowMin" style={{ color }}>
                          {t.paused ? (
                            "🌙 resting"
                          ) : (
                            <>
                              {t.min} {h.unit}
                              {t.alt !== undefined ? ` · ${t.alt} ${h.altUnit}` : ""}
                              {t.tag ? ` (${t.tag})` : ""}
                            </>
                          )}
                        </span>
                      </div>
                      <div className="rowBottom">
                        <span className="streak" style={{ color }}>🔥 {streak} {streak === 1 ? "day" : "days"}</span>
                        <Dots history={dotsFor(h.id)} color={color} />
                      </div>
                    </div>
                    {!hardDay && !t.paused && (
                      <button className={`star ${bonus ? "on" : ""}`} onClick={() => toggleBonus(h.id)} title="Went beyond the minimum today">★</button>
                    )}
                  </div>
                );
              })}
            </section>

            <section className="section">
              <h2 className="mint">Practices</h2>
              {practiceHabits.map((h) => {
                const val = dayOfDate(today)[h.id] || {};
                const isExpanded = expanded === h.id;
                const isMove = h.id === "move";
                const info = infoFor(today, h.id);
                const paused = info.state === "paused";
                const mt = isMove ? moveTarget() : null;
                const bonus = val.bonus;
                return (
                  <div key={h.id}>
                    <div className={`row ${paused ? "paused" : ""}`}>
                      <Check checked={!!val.done} onClick={() => togglePractice(h.id)} color="#2FBF9F" />
                      <div className="rowMain clickable" onClick={() => (h.hasMinutes || h.hasPoints) && !hardDay && !paused && setExpanded(isExpanded ? null : h.id)}>
                        <div className="rowTop">
                          <span className="rowName">{h.emoji} {h.name}</span>
                          {paused && <span className="rowMin mintText">🌙 resting</span>}
                          {!paused && isMove && (
                            <span className="rowMin mintText">
                              {mt.min} {h.unit}
                              {mt.tag ? ` (${mt.tag})` : ""}
                            </span>
                          )}
                          {!paused && h.id === "ww" && (
                            <span className="rowMin mintText">
                              {info.state === "adapted" ? "min: a rough log (holiday)" : `min: ${h.minLabel}`}
                            </span>
                          )}
                          {!paused && h.id === "vitamins" && <span className="rowMin mintText">min: {h.minLabel}</span>}
                        </div>
                        {h.hasPoints && !hardDay && !paused && (
                          <div className="rowBottom subtle">{pointsConsumed !== "" ? `${pointsConsumed} pts logged` : "tap to log points"}</div>
                        )}
                        {h.hasMinutes && !hardDay && !paused && val.minutes && <div className="rowBottom subtle">{val.minutes} min</div>}
                      </div>
                      {isMove && h.hasBonus && !hardDay && !paused && (
                        <button className={`star ${bonus ? "on" : ""}`} onClick={() => setPracticeField(h.id, "bonus", !bonus)} title="Went beyond the minimum today">★</button>
                      )}
                    </div>
                    {isExpanded && h.hasMinutes && !hardDay && !paused && (
                      <div className="expand">
                        <label>Minutes moved today
                          <input type="number" min="0" inputMode="numeric" value={val.minutes ?? ""} onChange={(e) => setPracticeField(h.id, "minutes", e.target.value)} placeholder={String(mt.min)} />
                        </label>
                      </div>
                    )}
                    {isExpanded && h.hasPoints && !hardDay && !paused && (
                      <div className="expand">
                        <label>Points consumed today
                          <input type="number" min="0" inputMode="numeric" value={pointsConsumed} onChange={(e) => setPracticeField(h.id, "points", e.target.value)} placeholder={String(state.ww.dailyTarget)} />
                        </label>
                        <p className="hint">Target is {state.ww.dailyTarget}. Tracking honestly counts — going over doesn't undo it.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>

            <section className="section connectSection">
              <div className={`connectHead ${connectInfo.state === "paused" ? "paused" : ""}`}>
                <Check checked={!!connectDay.done} onClick={toggleConnectDone} color="#F72585" />
                <div className="rowMain">
                  <div className="rowTop">
                    <span className="rowName connectTitle">❤️ Connect</span>
                    <span className="streak" style={{ color: "#F72585" }}>{connectStreak} {connectStreak === 1 ? "day" : "days"}</span>
                  </div>
                  <p className="connectQuestion">Did I intentionally connect with my children today?</p>
                  <p className="connectMin">
                    {connectInfo.state === "paused"
                      ? "🌙 resting — you can still tick it if it happens"
                      : `min: one deliberate moment${hardDay ? " (hard day)" : ""}`}
                  </p>
                </div>
                {!hardDay && connectInfo.state !== "paused" && (
                  <button className={`star ${connectDay.bonus ? "on" : ""}`} onClick={toggleConnectBonus} title="More than one moment of connection today">★</button>
                )}
              </div>

              {!hardDay && connectInfo.state !== "paused" && (
                <>
                  <p className="connectPrompt">💡 {todaysPrompt}</p>
                  <div className="connectBody">
                    <p className="hint">Different ways connection can look today — not a list to get through, just here to jog your memory.</p>
                    <div className="formsList">
                      {connectForms.map((f) => (
                        <div key={f.id} className="formRow">
                          <span className="formLabel">{f.label}</span>
                          <span className="formDesc">{f.desc}</span>
                        </div>
                      ))}
                    </div>
                    <button className="ritualToggle" onClick={() => setRitualOpen((v) => !v)}>
                      {ritualOpen ? "Hide tonight's rhythm" : "Show tonight's rhythm ›"}
                    </button>
                    {ritualOpen && (
                      <div className="ritual">
                        <p className="hint">A possible rhythm for the end of the day — not a checklist.</p>
                        {ritual.map((r) => (
                          <div className="ritualRow" key={r.label}>
                            <span className="ritualLabel">{r.label}</span>
                            <span className="ritualLine">{r.line}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>

            <section className="footer">
              <div className="progressLabel">
                <span>75-day journey</span>
                <span>{dayNumber} / 75</span>
              </div>
              <div className="progressBar"><div className="progressFill" style={{ width: `${(dayNumber / 75) * 100}%` }} /></div>
              <p className="footerNote">You've kept {consistency}% of your commitments so far — {doneToday} of {commitments} today.</p>
              <p className="footerNote2">Missing a day doesn't send you back to Day 1 — these 75 days keep counting either way.</p>
            </section>
          </>
        )}

        {err && <div className="err">{err}</div>}
      </div>
    </div>
  );
}

function HolidaySetup({ state, today, existing, onSave, onCancel, onRemove }) {
  const others = (state.periods || []).filter((p) => !existing || p.id !== existing.id);
  const last = [...others].sort((a, b) => b.start.localeCompare(a.start))[0];

  const [name, setName] = useState(existing?.name || PERIOD_TYPES.holiday.defaultName);
  const [start, setStart] = useState(existing?.start || today);
  const [openEnded, setOpenEnded] = useState(existing ? !existing.end : false);
  const [end, setEnd] = useState(existing?.end || addDays(today, 6));
  const [rules, setRules] = useState(existing?.rules || {});

  const startLocked = !!existing && existing.start < today;
  const effStart = startLocked ? today : start;
  const endError = !openEnded && (!end || end < effStart);

  const items = [
    ...state.streakHabits.map((h) => ({
      id: h.id, label: `${h.emoji} ${h.name}`, kind: "num", unit: h.unit,
      base: h.minimum, baseAlt: h.altMinimum, altUnit: h.altUnit, defMin: h.hardMinimum, defAlt: h.hardAltMinimum,
    })),
    { id: "move", label: "🏃‍♀️ Move my body", kind: "num", unit: "min", base: state.move.minimum, defMin: state.move.hardMinimum },
    { id: "ww", label: "🥗 Track food, honestly", kind: "light" },
    { id: "vitamins", label: "💊 Vitamins", kind: "toggle" },
    { id: "connect", label: "❤️ Connect", kind: "toggle" },
  ];

  const setMode = (item, mode) => {
    setRules((r) => {
      const n = { ...r };
      if (mode === "keep") delete n[item.id];
      else if (mode === "pause") n[item.id] = { mode: "pause" };
      else {
        const rule = { mode: "smaller" };
        if (item.kind === "num") {
          rule.minimum = item.defMin;
          if (item.baseAlt !== undefined) rule.altMinimum = item.defAlt;
        }
        n[item.id] = rule;
      }
      return n;
    });
  };
  const setNum = (id, field, value) => {
    setRules((r) => ({ ...r, [id]: { ...r[id], [field]: Math.max(1, Number(value) || 1) } }));
  };

  const optionsFor = (item) => {
    if (item.kind === "toggle") return [["keep", "Keep"], ["pause", "Pause"]];
    return [["keep", "Keep"], ["smaller", item.kind === "light" ? "Rough log" : "Smaller"], ["pause", "Pause"]];
  };

  const keptCount = items.filter((i) => !rules[i.id]).length;

  return (
    <div className="settings">
      <div className="settingsHead">
        <h2>{existing ? "Edit Holiday Mode" : "🌴 Holiday Mode"}</h2>
        <button className="linkBtn" onClick={onCancel}>Back</button>
      </div>
      <p className="hint">
        Choose how each habit looks while you're away. Your streaks and your 75 days carry on — paused days don't break anything, and a smaller version counts in full.
      </p>

      <div className="settingRow">
        <span className="settingName">Name</span>
        <div className="settingFields">
          <label>
            <input className="wide" type="text" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="settingRow">
        <span className="settingName">Dates</span>
        <div className="settingFields">
          {startLocked ? (
            <p className="hint tight">Changes apply from today. Earlier days keep the rules they were under.</p>
          ) : (
            <label>Starts
              <input type="date" value={start} onChange={(e) => setStart(e.target.value || start)} />
            </label>
          )}
          {!openEnded && (
            <label>Back by
              <input type="date" value={end} min={effStart} onChange={(e) => setEnd(e.target.value)} />
            </label>
          )}
        </div>
        <label className="checkLine">
          <input type="checkbox" checked={openEnded} onChange={(e) => setOpenEnded(e.target.checked)} />
          I'll switch it off myself
        </label>
        {endError && <p className="hint tight warn">Pick a return date on or after the start.</p>}
      </div>

      <div className="settingRow noBorder">
        <div className="rulesHead">
          <span className="settingName">Each habit while away</span>
          {last && (
            <button className="linkBtn" onClick={() => setRules(JSON.parse(JSON.stringify(last.rules || {})))}>
              Same as last time
            </button>
          )}
        </div>
      </div>

      {items.map((item) => {
        const r = rules[item.id];
        const mode = r?.mode || "keep";
        return (
          <div className="ruleRow" key={item.id}>
            <div className="ruleName">{item.label}</div>
            <div className="seg" role="group" aria-label={item.label}>
              {optionsFor(item).map(([m, label]) => (
                <button key={m} className={`segBtn ${mode === m ? "on " + m : ""}`} onClick={() => setMode(item, m)}>
                  {label}
                </button>
              ))}
            </div>
            {mode === "smaller" && item.kind === "num" && (
              <div className="settingFields ruleFields">
                <label>Minimum
                  <input type="number" min="1" inputMode="numeric" value={r.minimum} onChange={(e) => setNum(item.id, "minimum", e.target.value)} />
                  <span className="unit">{item.unit}</span>
                </label>
                {item.baseAlt !== undefined && (
                  <label>Or
                    <input type="number" min="1" inputMode="numeric" value={r.altMinimum} onChange={(e) => setNum(item.id, "altMinimum", e.target.value)} />
                    <span className="unit">{item.altUnit}</span>
                  </label>
                )}
              </div>
            )}
            {mode === "smaller" && item.kind === "light" && <p className="hint tight">A quick, rough log is enough while you're away.</p>}
            {mode === "pause" && <p className="hint tight">🌙 Resting — doesn't break the streak. You can still tick it if you do it.</p>}
          </div>
        );
      })}

      <p className="hint">{keptCount} of {items.length} habits stay as normal.</p>

      <div className="formActions">
        <button
          className="primaryBtn"
          disabled={endError}
          onClick={() => onSave({ name: name.trim() || PERIOD_TYPES.holiday.defaultName, start: effStart, end: openEnded ? null : end, rules }, existing)}
        >
          {existing ? "Save changes" : "Start Holiday Mode"}
        </button>
        {existing && existing.start >= today && (
          <button className="linkBtn" onClick={() => onRemove(existing)}>Cancel this holiday</button>
        )}
      </div>
    </div>
  );
}

function Settings({ state, updateHabit, setState, resetAll, close }) {
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <div className="settings">
      <div className="settingsHead">
        <h2>Settings</h2>
        <button className="linkBtn" onClick={close}>Done</button>
      </div>
      <p className="hint">Minimums only ever change when you choose to change them. Nothing here increases on its own.</p>

      {state.streakHabits.map((h) => (
        <div className="settingRow" key={h.id}>
          <span className="settingName">{h.emoji} {h.name}</span>
          <div className="settingFields">
            <label>Minimum
              <input type="number" min="1" value={h.minimum} onChange={(e) => updateHabit(h.id, { minimum: Number(e.target.value) || h.minimum })} />
              <span className="unit">{h.unit}</span>
            </label>
            {h.altMinimum !== undefined && (
              <label>Or
                <input type="number" min="1" value={h.altMinimum} onChange={(e) => updateHabit(h.id, { altMinimum: Number(e.target.value) || h.altMinimum })} />
                <span className="unit">{h.altUnit}</span>
              </label>
            )}
            <label>Hard-day minimum
              <input type="number" min="1" value={h.hardMinimum} onChange={(e) => updateHabit(h.id, { hardMinimum: Number(e.target.value) || h.hardMinimum })} />
              <span className="unit">{h.unit}</span>
            </label>
            {h.hardAltMinimum !== undefined && (
              <label>Or (hard day)
                <input type="number" min="1" value={h.hardAltMinimum} onChange={(e) => updateHabit(h.id, { hardAltMinimum: Number(e.target.value) || h.hardAltMinimum })} />
                <span className="unit">{h.altUnit}</span>
              </label>
            )}
            <label>Streak carried in
              <input type="number" min="0" value={h.prior} onChange={(e) => updateHabit(h.id, { prior: Number(e.target.value) || 0, priorActive: true })} />
              <span className="unit">days</span>
            </label>
          </div>
        </div>
      ))}

      <div className="settingRow">
        <span className="settingName">🏃‍♀️ Move my body</span>
        <div className="settingFields">
          <label>Minimum
            <input type="number" min="1" value={state.move.minimum} onChange={(e) => setState((s) => ({ ...s, move: { ...s.move, minimum: Number(e.target.value) || s.move.minimum } }))} />
            <span className="unit">min</span>
          </label>
          <label>Hard-day minimum
            <input type="number" min="1" value={state.move.hardMinimum} onChange={(e) => setState((s) => ({ ...s, move: { ...s.move, hardMinimum: Number(e.target.value) || s.move.hardMinimum } }))} />
            <span className="unit">min</span>
          </label>
        </div>
      </div>

      <div className="settingRow">
        <span className="settingName">🥗 WW daily points target</span>
        <div className="settingFields">
          <label>Target
            <input type="number" min="0" value={state.ww.dailyTarget} onChange={(e) => setState((s) => ({ ...s, ww: { ...s.ww, dailyTarget: Number(e.target.value) || 0 } }))} />
            <span className="unit">pts</span>
          </label>
        </div>
      </div>

      <div className="settingRow">
        <span className="settingName">Journey start date</span>
        <div className="settingFields">
          <label>Start
            <input type="date" value={state.startDate} onChange={(e) => setState((s) => ({ ...s, startDate: e.target.value || s.startDate }))} />
          </label>
        </div>
      </div>

      <div className="dangerZone">
        {!confirmReset ? (
          <button className="dangerBtn" onClick={() => setConfirmReset(true)}>Start over</button>
        ) : (
          <div className="confirmRow">
            <span>Clear all history? This can't be undone.</span>
            <div>
              <button className="linkBtn" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button className="dangerBtn" onClick={resetAll}>Yes, clear it</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Style() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Nunito:wght@400;600;700;800&display=swap');

      .soft75-root {
        --ink: #3A2733;
        --ink-muted: #8B7480;
        --ink-faint: #CBA9BC;
        --line: rgba(58,39,51,0.09);
        --coral: #FF4D8D;
        --coral-soft: #FFE0EE;
        --mint: #2FBF9F;
        --mint-soft: #DCF6EE;
        --pink: #F72585;
        --pink-soft: #FFDCEE;
        --sun: #FFB627;
        --lilac: #7B3FC4;
        --lilac-soft: #F1E6FF;

        min-height: 100%;
        width: 100%;
        background: linear-gradient(160deg, #FFEAF4 0%, #FFDCEF 55%, #FCE9F9 100%);
        display: flex;
        justify-content: center;
        padding: 28px 16px 48px;
        box-sizing: border-box;
        font-family: 'Nunito', sans-serif;
        color: var(--ink);
      }
      .soft75-root * { box-sizing: border-box; }
      .loading { color: var(--ink-muted); padding-top: 40px; }

      .sheet {
        width: 100%;
        max-width: 440px;
        background: #FFFFFF;
        border-radius: 26px;
        box-shadow: 0 18px 40px -20px rgba(247,37,133,0.24), 0 4px 14px -6px rgba(255,77,141,0.16);
        overflow: hidden;
        padding: 0 20px 26px;
      }
      .rainbowBar { height: 7px; background: linear-gradient(90deg, #FF4D8D, #F72585, #FFB627, #C77DFF, #FF4D8D); margin: 0 -20px 20px; }

      .header { display: flex; justify-content: space-between; align-items: flex-start; padding-top: 4px; }
      .header h1 { font-family: 'Fraunces', serif; font-weight: 650; font-size: 28px; margin: 0 0 3px; color: var(--ink); }
      .tagline { margin: 0; color: var(--ink-muted); font-size: 13.5px; font-style: italic; font-family: 'Fraunces', serif; }

      .gear { background: var(--coral-soft); border: none; color: var(--coral); width: 36px; height: 36px; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
      .gear:hover { background: #FFC9E1; }

      .metaRow { margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap; }
      .metaPill { font-size: 12.5px; font-weight: 700; color: var(--coral); background: var(--coral-soft); padding: 5px 12px; border-radius: 999px; }
      .metaPill.mint { color: #1E9A80; background: var(--mint-soft); }
      .metaPill.lilac { color: var(--lilac); background: var(--lilac-soft); }

      .hardDayToggle { margin-top: 14px; width: 100%; padding: 11px 12px; background: #FBF7F2; border: 1.5px dashed #E4D9CE; color: var(--ink-muted); border-radius: 14px; font-family: 'Nunito', sans-serif; font-weight: 700; font-size: 13px; cursor: pointer; }
      .hardDayToggle.on { background: var(--mint-soft); border: 1.5px solid var(--mint); color: #1E9A80; }
      .holidayToggle { margin-top: 8px; width: 100%; padding: 11px 12px; background: #FBF7FF; border: 1.5px dashed #DCC8F2; color: var(--lilac); border-radius: 14px; font-family: 'Nunito', sans-serif; font-weight: 700; font-size: 13px; cursor: pointer; }
      .hardDayBanner { margin-top: 10px; padding: 13px 14px; border-radius: 14px; background: var(--mint-soft); color: #1E9A80; font-family: 'Fraunces', serif; font-size: 14.5px; font-style: italic; text-align: center; }

      .holidayBanner, .landingCard { margin-top: 14px; padding: 13px 14px; border-radius: 16px; background: var(--lilac-soft); border: 1.5px solid #DCC8F2; }
      .holidayBanner.upcoming { background: #FBF7FF; border-style: dashed; }
      .landingCard { background: var(--mint-soft); border-color: #B5E8D9; }
      .bannerTitle { font-family: 'Fraunces', serif; font-weight: 650; font-size: 15px; color: var(--lilac); }
      .landingCard .bannerTitle { color: #1E9A80; }
      .bannerSub { margin-top: 4px; font-size: 12.5px; color: var(--ink-muted); font-weight: 600; line-height: 1.45; }
      .bannerBtns { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; }
      .bannerBtn { background: #fff; border: 1.5px solid #DCC8F2; color: var(--lilac); font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 12.5px; padding: 8px 14px; border-radius: 999px; cursor: pointer; min-height: 36px; }
      .bannerBtn.solid { background: var(--lilac); border-color: var(--lilac); color: #fff; }
      .landingCard .bannerBtn { border-color: #B5E8D9; color: #1E9A80; }

      .section { margin-top: 22px; }
      .section h2 { font-family: 'Fraunces', serif; font-weight: 650; font-size: 15px; margin: 0 0 10px; letter-spacing: 0.2px; }
      .section h2.coral { color: var(--coral); }
      .section h2.mint { color: #1E9A80; }

      .row { display: flex; align-items: flex-start; gap: 12px; padding: 11px 0; border-top: 1px solid var(--line); }
      .row.paused { opacity: 0.62; }
      .connectHead.paused { opacity: 0.7; }

      .rowMain { flex: 1; min-width: 0; }
      .rowMain.clickable { cursor: pointer; }
      .rowTop { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
      .rowName { font-size: 14.5px; color: var(--ink); font-weight: 700; }
      .rowMin { font-size: 12px; font-weight: 700; white-space: nowrap; }
      .rowMin.mintText { color: #1E9A80; }
      .rowBottom { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; }
      .rowBottom.subtle { font-size: 12px; color: var(--ink-faint); margin-top: 4px; font-weight: 600; }
      .streak { font-size: 12.5px; font-weight: 800; }

      .check { width: 28px; height: 28px; border-radius: 9px; border: 2px solid; background: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; margin-top: 1px; transition: transform 0.15s ease; }
      .check-on { transform: scale(1.06); }
      .check:active { transform: scale(0.9); }

      .star { background: transparent; border: none; color: #EDE1D8; font-size: 20px; cursor: pointer; line-height: 1; padding: 6px; margin: -6px -6px -6px 0; flex-shrink: 0; }
      .star.on { color: var(--sun); }

      .dots { display: flex; gap: 3px; align-items: center; }
      .dot { width: 5px; height: 5px; border-radius: 50%; background: #F1E9E4; }
      .dot-today { background: transparent; border: 1.5px solid var(--ink-faint); width: 4px; height: 4px; }
      .dot-before { background: transparent; }
      .dot-paused { width: 7px; height: 3px; border-radius: 2px; background: #DCC8F2; }

      .expand { padding: 4px 0 12px 36px; }
      .expand label { display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: var(--ink-muted); font-weight: 700; max-width: 200px; }
      .expand input { background: #FBF7F2; border: 1.5px solid var(--line); color: var(--ink); border-radius: 10px; padding: 7px 9px; font-family: 'Nunito', sans-serif; font-size: 13.5px; font-weight: 600; }
      .expand .hint { margin: 8px 0 0; font-size: 11.5px; color: var(--ink-faint); font-weight: 600; }

      .connectSection { background: linear-gradient(160deg, #FFEAF4, #FFF6FB); margin: 22px -20px 0; padding: 18px 20px; }
      .connectHead { display: flex; gap: 12px; align-items: flex-start; }
      .connectTitle { font-family: 'Fraunces', serif; font-size: 16px; color: var(--pink); }
      .connectQuestion { margin: 5px 0 0; font-size: 13px; color: var(--ink-muted); font-weight: 600; }
      .connectPrompt { margin: 12px 0 0 36px; font-size: 12.5px; color: #C2447E; background: var(--pink-soft); display: inline-block; padding: 6px 12px; border-radius: 999px; font-weight: 700; }
      .connectBody { margin-top: 14px; padding-left: 36px; }
      .connectMin { margin: 4px 0 0; font-size: 11.5px; font-weight: 700; color: var(--pink); }
      .formsList { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
      .formRow { display: flex; align-items: baseline; gap: 8px; text-align: left; border: 1.5px solid #FBD3E6; background: #fff; padding: 9px 13px; border-radius: 13px; font-family: 'Nunito', sans-serif; }
      .formLabel { font-weight: 800; font-size: 12.5px; color: var(--pink); flex-shrink: 0; width: 52px; }
      .formDesc { font-size: 12px; color: var(--ink-muted); font-weight: 600; line-height: 1.35; }
      .ritualToggle { margin-top: 14px; background: none; border: none; color: var(--pink); font-weight: 800; font-size: 12.5px; cursor: pointer; padding: 0; font-family: 'Nunito', sans-serif; }
      .ritual { margin-top: 10px; background: #fff; border-radius: 14px; padding: 12px 14px; }
      .ritualRow { display: flex; gap: 10px; padding: 6px 0; border-top: 1px solid var(--line); }
      .ritualRow:first-of-type { border-top: none; }
      .ritualLabel { font-weight: 800; font-size: 12px; color: var(--pink); width: 78px; flex-shrink: 0; }
      .ritualLine { font-size: 12.5px; color: var(--ink-muted); }

      .footer { margin-top: 24px; }
      .progressLabel { display: flex; justify-content: space-between; font-size: 12px; color: var(--ink-muted); font-weight: 700; margin-bottom: 6px; }
      .progressBar { height: 9px; border-radius: 6px; background: #F4ECE6; overflow: hidden; }
      .progressFill { height: 100%; background: linear-gradient(90deg, #FF4D8D, #F72585, #FFB627); border-radius: 6px; }
      .footerNote { margin: 10px 0 0; font-size: 12.5px; color: var(--ink-muted); font-family: 'Fraunces', serif; font-style: italic; }
      .footerNote2 { margin: 6px 0 0; font-size: 11.5px; color: var(--ink-faint); font-weight: 600; }

      .err { margin-top: 14px; font-size: 11.5px; color: var(--coral); }

      .settings { margin-top: 20px; }
      .settingsHead { display: flex; justify-content: space-between; align-items: center; }
      .settingsHead h2 { font-family: 'Fraunces', serif; font-size: 18px; font-weight: 650; margin: 0; }
      .linkBtn { background: none; border: none; color: var(--coral); font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Nunito', sans-serif; padding: 8px 4px; }
      .hint { font-size: 12px; color: var(--ink-faint); margin: 10px 0 16px; line-height: 1.5; font-weight: 600; }
      .hint.tight { margin: 8px 0 0; }
      .hint.warn { color: var(--coral); }
      .settingRow { padding: 13px 0; border-top: 1px solid var(--line); }
      .settingRow.noBorder { border-top: none; padding-bottom: 4px; }
      .settingName { font-size: 13.5px; color: var(--ink); font-weight: 700; }
      .settingFields { display: flex; gap: 16px; margin-top: 8px; flex-wrap: wrap; }
      .settingFields label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--ink-muted); font-weight: 700; }
      .settingFields input { background: #FBF7F2; border: 1.5px solid var(--line); color: var(--ink); border-radius: 10px; padding: 8px; font-family: 'Nunito', sans-serif; font-size: 16px; font-weight: 600; width: 90px; }
      .settingFields input[type=date] { width: 150px; }
      .settingFields input.wide { width: 100%; min-width: 220px; }
      .unit { font-size: 10px; color: var(--ink-faint); margin-left: 4px; }

      .checkLine { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 12.5px; font-weight: 700; color: var(--ink-muted); }
      .checkLine input { width: 20px; height: 20px; accent-color: var(--lilac); }

      .rulesHead { display: flex; justify-content: space-between; align-items: center; }
      .ruleRow { padding: 12px 0; border-top: 1px solid var(--line); }
      .ruleName { font-size: 14px; font-weight: 700; margin-bottom: 8px; }
      .seg { display: flex; gap: 6px; }
      .segBtn { flex: 1; padding: 9px 6px; min-height: 40px; border-radius: 12px; border: 1.5px solid var(--line); background: #FBF7F2; color: var(--ink-muted); font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 12.5px; cursor: pointer; }
      .segBtn.on.keep { background: var(--mint-soft); border-color: var(--mint); color: #1E9A80; }
      .segBtn.on.smaller { background: var(--pink-soft); border-color: var(--pink); color: var(--pink); }
      .segBtn.on.pause { background: var(--lilac-soft); border-color: #C9A8EE; color: var(--lilac); }
      .ruleFields { margin-top: 10px; }

      .formActions { margin-top: 18px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
      .primaryBtn { background: linear-gradient(90deg, #FF4D8D, #F72585); color: #fff; border: none; border-radius: 14px; padding: 12px 20px; font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 14px; cursor: pointer; min-height: 44px; }
      .primaryBtn:disabled { opacity: 0.4; cursor: default; }

      .dangerZone { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--line); }
      .dangerBtn { background: #FFF0EE; border: 1.5px solid #FFC9C2; color: #E24B3A; padding: 8px 14px; border-radius: 12px; font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: 'Nunito', sans-serif; }
      .confirmRow { display: flex; flex-direction: column; gap: 10px; font-size: 12.5px; color: var(--ink-muted); font-weight: 600; }
      .confirmRow > div { display: flex; gap: 10px; align-items: center; }

      @media (prefers-reduced-motion: reduce) {
        .check, .star, .hardDayToggle { transition: none; }
      }
    `}</style>
  );
}
