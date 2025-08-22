import React, { useEffect, useRef, useState } from 'react';
import { db, doc, getDoc, onSnapshot, setDoc } from '../firebase';

const RATING_LABELS = ['Not useful', 'Slightly useful', 'Useful', 'Very useful', 'Most useful']; // 5-level labels

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
        return;
      }

      const qSnap = await getDoc(doc(db, 'questions', id));
      if (!qSnap.exists()) {
        setQuestion(null);
        setRatings([]);
        setSubmitted(false);
        return;
      }

      const q = { id: qSnap.id, ...qSnap.data() };
      setQuestion(q);
      setRatings(new Array(q.options.length).fill(0));

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
  };

  const handleSubmit = async () => {
    if (!question || submitted) return;
    // require every option to have a rating
    if (ratings.length === 0 || ratings.some((r) => r < 1 || r > 5)) {
      return alert('Please rate all options before submitting.');
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
    } catch (err) {
      console.error('failed to save response', err);
    }
  };

  if (!question) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center text-gray-600">No active question right now.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lg p-4 sm:p-6">
        {submitted ? (
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold mb-2 text-gray-900">Thank you!</h2>
            <p className="text-sm text-gray-700 mb-2">Your response has been recorded.</p>
            <p className="text-sm text-gray-600">Please wait for the next question to be activated.</p>
          </div>
        ) : (
          <>
            <header className="flex items-start justify-between gap-2 mb-4">
              <div>
                <div className="text-xs text-gray-500">{question.domain}</div>
                <h1 className="text-xl font-semibold text-gray-900 leading-tight">Live Poll</h1>
              </div>
            </header>

            <section className="mb-4">
              <p className="text-base font-medium text-gray-800">{question.text}</p>
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
                    className="p-3 border rounded-lg shadow-sm bg-white sm:min-h-[100px] min-h-0"
                    aria-labelledby={`opt-${idx}-label`}
                  >
                    <div className="mb-2">
                      <div id={`opt-${idx}-label`} className="font-medium text-gray-900">
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
                                className={`flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium border transition cursor-pointer flex-shrink-0 ${
                                  selected
                                    ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                                    : 'bg-white text-gray-700 border-gray-200 hover:shadow-sm'
                                }`}
                              >
                                <input
                                  id={inputId}
                                  name={`opt-${idx}`}
                                  type="radio"
                                  value={markerVal}
                                  checked={selected}
                                  onChange={() => setRatingForOption(idx, markerVal)}
                                  className="w-3 h-3 accent-blue-600"
                                />
                                {/* show full text on small+ screens, show number badge on mobile */}
                                <span className="hidden sm:inline truncate text-xs">{label}</span>
                                <span className="inline sm:hidden px-1 py-0.5 rounded-full bg-gray-100 text-gray-800 text-xs font-medium">{markerVal}</span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>

                      {/* helper / instructions */}
                      <div className="mt-2 text-xs text-gray-500 flex justify-between items-center">
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
                    </div>
                  </div>
                );
              })}
            </form>

            <div className="mt-4 flex flex-col sm:flex-row justify-end items-center gap-2">
              <div className="text-xs text-gray-500 mr-auto hidden sm:block">
                {ratings.length > 0 && ratings.some((r) => r < 1) ? 'Please rate all options' : 'All set — ready to submit'}
              </div>
              <button
                onClick={handleSubmit}
                disabled={ratings.length === 0 || ratings.some((r) => r < 1) || submitted}
                className={`px-4 py-1.5 rounded-md text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 transition ${
                  ratings.length > 0 && !ratings.some((r) => r < 1) ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-300/60 cursor-not-allowed'
                }`}
                aria-disabled={ratings.length === 0 || ratings.some((r) => r < 1) || submitted}
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
