import React, { useEffect, useRef, useState } from 'react';
import { db, doc, getDoc, onSnapshot, setDoc } from '../firebase';

const RATING_LABELS = ['Not useful', 'Slightly useful', 'Useful', 'Very useful', 'Most useful']; // 5-level labels

const ERROR_MESSAGES = {
  missing_selection: 'Please select at least one rating for each option.',
};

function getOrCreateClientId() {
  try {
    let id = localStorage.getItem('pollClientId');
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'cid_' + Math.random().toString(36).slice(2, 9);
      localStorage.setItem('pollClientId', id);
    }
    return id;
  } catch {
    return 'cid_' + Math.random().toString(36).slice(2, 9);
  }
}

export default function LivePoll() {
  const [question, setQuestion] = useState(null);
  const [ratings, setRatings] = useState([]); // one rating per option (1..5), 0 = unselected
  const [submitted, setSubmitted] = useState(false);
  const [errorKey, setErrorKey] = useState(''); // common key for error messages
  const [missingIndices, setMissingIndices] = useState([]); // indices of options missing a rating
  const clientId = useRef(getOrCreateClientId());

  useEffect(() => {
    const activeRef = doc(db, 'active', 'question');
    const unsub = onSnapshot(activeRef, async (snap) => {
      const data = snap.exists() ? snap.data() : null;
      const id = data?.questionId || null;
      if (!id) {
        setQuestion(null);
        setRatings([]);
        setSubmitted(false);
        setErrorKey('');
        return;
      }

      const qSnap = await getDoc(doc(db, 'questions', id));
      if (!qSnap.exists()) {
        setQuestion(null);
        setRatings([]);
        setSubmitted(false);
        setErrorKey('');
        return;
      }

      const q = { id: qSnap.id, ...qSnap.data() };
      setQuestion(q);
      setRatings(new Array(q.options.length).fill(0));
      setMissingIndices([]);

      // check if this client already submitted (server-side)
      const respDocId = `${q.id}_${clientId.current}`;
      const respSnap = await getDoc(doc(db, 'responses', respDocId));
      setSubmitted(!!(respSnap && respSnap.exists()));
    });

    return () => unsub();
  }, []);

  const setRatingForOption = (optIndex, ratingValue) => {
    setRatings((prev) => {
      const copy = [...prev];
      copy[optIndex] = ratingValue; // ratingValue 1..5
      return copy;
    });
    // clear per-option missing marker when user selects
    setMissingIndices((prev) => prev.filter((i) => i !== optIndex));
  };

  const handleSubmit = async () => {
    if (!question || submitted) return;
    // require every option to have a rating; mark specific missing options
    const missing = ratings
      .map((r, i) => (r < 1 || r > 5 ? i : -1))
      .filter((i) => i >= 0);
    if (ratings.length === 0 || missing.length > 0) {
      setMissingIndices(missing);
      return;
    }

    const respDocId = `${question.id}_${clientId.current}`;
    const payload = {
      questionId: question.id,
      ratings, // array of numbers 1..5
      clientId: clientId.current,
      createdAt: new Date(),
    };

    try {
      await setDoc(doc(db, 'responses', respDocId), payload);
      setSubmitted(true);
      setMissingIndices([]);
    } catch (err) {
      console.error('failed to save response', err);
      // optionally set a generic error key here
    }
  };

  if (!question) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{
          backgroundColor: '#214663',
        }}
      >
        {/* changed container: glassy/frosted look */}
        <div
          className="w-full max-w-3xl relative overflow-hidden rounded-2xl p-8
                     bg-gradient-to-r from-black/35 via-black/25 to-black/15
                     backdrop-blur-xl backdrop-saturate-150 shadow-lg ring-1 ring-white/5 ring-inset text-white"
          style={{
            border: '1px solid transparent',
            borderImage:
              'linear-gradient(90deg, rgba(99,102,241,0.18), rgba(59,130,246,0.12), rgba(6,182,212,0.08)) 1',
            boxShadow: '0 10px 30px rgba(2,6,23,0.45), inset 0 1px 0 rgba(255,255,255,0.02)',
            backgroundColor: 'rgba(255,255,255,0.02)',
          }}
        >
          <div aria-hidden className="absolute inset-0 pointer-events-none" style={{background: 'linear-gradient(180deg, rgba(0,0,0,0.25), rgba(255,255,255,0.02))'}} />
          <div className="text-center text-white">No active question right now.</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundColor: '#214663',
      }}
    >
      {/* changed container: glassy/frosted look (matches Result) */}
      <div
        className="w-full max-w-3xl relative overflow-hidden p-4 sm:p-6 rounded-2xl
                   bg-gradient-to-r from-black/35 via-black/25 to-black/15
                   backdrop-blur-xl backdrop-saturate-150 shadow-lg ring-1 ring-white/5 ring-inset text-white"
        style={{
          border: '1px solid transparent',
          borderImage:
            'linear-gradient(90deg, rgba(99,102,241,0.18), rgba(59,130,246,0.12), rgba(6,182,212,0.08)) 1',
          boxShadow: '0 10px 30px rgba(2,6,23,0.45), inset 0 1px 0 rgba(255,255,255,0.02)',
          backgroundColor: 'rgba(255,255,255,0.02)',
        }}
      >
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{background: 'linear-gradient(180deg, rgba(0,0,0,0.25), rgba(255,255,255,0.02))'}} />

        {submitted ? (
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold mb-2">Thank you!</h2>
            <p className="text-sm mb-2">Your response has been recorded.</p>
            <p className="text-sm">Please wait for the next question to be activated.</p>
          </div>
        ) : (
          <>
            <header className="flex items-start justify-between gap-2 mb-4">
              <div>
                <div className="text-xs text-white/70">{question.domain}</div>
                <h1 className="text-xl font-semibold leading-tight">Live Poll</h1>
              </div>
            </header>

            <section className="mb-4">
              <p className="text-2xl sm:text-3xl font-semibold !text-white">{question.text}</p> {/* changed: larger font + force white */}
              {/* error message shown below question */} 
             {missingIndices.length > 1 ? (
               <div className="mt-2 text-sm text-red-400" role="alert" aria-live="assertive">
                 Please select a rating for each missing option.
               </div>
             ) : null}
            </section>

            <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
              {question.options.map((opt, idx) => {
                const val = ratings[idx] || 0;
                const pct = Math.round((val / 5) * 100);

                // keyboard support for option: left/right to adjust
                const onKey = (e) => {
                  if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    setRatingForOption(idx, Math.max(1, val - 1));
                  } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    setRatingForOption(idx, Math.min(5, val + 1));
                  } else if (e.key === 'Home') {
                    e.preventDefault();
                    setRatingForOption(idx, 1);
                  } else if (e.key === 'End') {
                    e.preventDefault();
                    setRatingForOption(idx, 5);
                  }
                };

                return (
                  <div
                    key={idx}
                    className="p-3 border rounded-lg shadow-sm bg-white/5 sm:min-h-[100px] min-h-0"
                    aria-labelledby={`opt-${idx}-label`}
                  >
                    <div className="mb-2">
                      <div id={`opt-${idx}-label`} className="font-medium">
                        {opt}
                      </div>
                    </div>

                    <div className="relative">
                      {/* Radio buttons (visible on all sizes) */}
                      <fieldset className="mb-2" onKeyDown={onKey} aria-labelledby={`opt-${idx}-label`}>
                        <legend className="sr-only">{`Rate ${opt}`}</legend>
                        <div className="flex flex-row flex-nowrap items-center gap-1 overflow-x-auto -mx-1 px-1">
                          {RATING_LABELS.map((label, rIdx) => {
                            const markerVal = rIdx + 1;
                            const selected = val === markerVal;
                            const inputId = `opt-${idx}-r-${markerVal}`;
                            return (
                              <label
                                key={markerVal}
                                htmlFor={inputId}
                                className={`flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium border transition transform duration-150 ease-out cursor-pointer flex-shrink-0 ${
                                  selected
                                    ? 'bg-gradient-to-r from-[#0ea5a4] to-[#0597a6] text-white border-[#056d73] shadow-lg ring-2 ring-white/10 scale-105'
                                    : 'bg-white/5 text-white/90 border-white/10 hover:bg-white/6'
                                }`}
                              >
                                <input
                                  id={inputId}
                                  name={`opt-${idx}`}
                                  type="radio"
                                  value={markerVal}
                                  checked={selected}
                                  onChange={() => setRatingForOption(idx, markerVal)}
                                  className="w-3 h-3 accent-[#214663]"
                                />
                                {/* show full text on small+ screens, show number badge on mobile */}
                                <span className="hidden sm:inline truncate text-xs">{label}</span>
                                <span className="inline sm:hidden px-1 py-0.5 rounded-full bg-[#214663]/70 text-white text-xs font-medium">{markerVal}</span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>

                      {/* helper / instructions */}
                      <div className="mt-2 text-xs text-white/70 flex justify-between items-center">
                        <div>
                          {val
                            ? (
                                <>
                                  <span className="hidden sm:inline text-xs">{RATING_LABELS[val - 1]}</span>
                                  <span className="inline sm:hidden font-semibold text-xs">{val}</span>
                                </>
                              )
                            : 'Choose a rating'}
                        </div>
                        <div className="tabular-nums text-xs">
                          {/* desktop: show percent; mobile: show label */}
                          <span className="hidden sm:inline">{val ? `${pct}%` : '—'}</span>
                          <span className="inline sm:hidden">{val ? RATING_LABELS[val - 1] : '—'}</span>
                        </div>
                      </div>

                      {/* per-option error shown directly under that option card */}
                      {missingIndices.includes(idx) ? (
                        <div className="mt-2 text-sm text-red-400" role="alert" aria-live="assertive">
                          Please select a rating for this option.
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </form>

            <div className="mt-4 flex flex-col sm:flex-row justify-end items-center gap-2">
              <div className="text-xs text-white/70 mr-auto hidden sm:block">
                {ratings.length > 0 && ratings.some((r) => r < 1) ? 'Please rate all options' : 'All set — ready to submit'}
              </div>
              <button
                onClick={handleSubmit}
                // always active per request; validation handled inside handleSubmit
                className={`px-4 py-1.5 rounded-md text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 transition shadow-lg transform-gpu duration-150 ease-out bg-gradient-to-r from-[#0ea5a4] to-[#0597a6] hover:from-[#09a8a4] hover:to-[#048f9a] ring-2 ring-white/10`}
                aria-disabled={submitted}
              >
                Submit
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
