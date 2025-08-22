import React, { useEffect, useRef, useState } from 'react';
import { db, doc, getDoc, onSnapshot, setDoc } from '../firebase';

const RATING_LABELS = ['Not useful', 'Slightly', 'Useful', 'Very', 'Most useful']; // 5-level labels

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white p-6">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lg p-6 sm:p-8">
        {submitted ? (
          <div className="text-center py-10">
            <h2 className="text-2xl font-semibold mb-3 text-gray-900">Thank you!</h2>
            <p className="text-gray-700 mb-4">Your response has been recorded.</p>
            <p className="text-gray-600">Please wait for the next question to be activated.</p>
          </div>
        ) : (
          <>
            <header className="flex items-start justify-between gap-4 mb-6">
              <div>
                <div className="text-xs text-gray-500">{question.domain}</div>
                <h1 className="text-2xl font-semibold text-gray-900 leading-tight">Live Poll</h1>
              </div>
              <div className="hidden sm:flex items-center text-sm text-gray-500 space-x-3">
                <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M3 12h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 6h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div>Tap a label to choose — keyboard accessible</div>
              </div>
            </header>

            <section className="mb-6">
              <p className="text-lg font-medium text-gray-800">{question.text}</p>
            </section>

            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
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
                    className="p-4 border rounded-lg shadow-sm bg-white"
                    style={{ minHeight: 120 }}
                    aria-labelledby={`opt-${idx}-label`}
                  >
                    <div className="mb-3">
                      <div id={`opt-${idx}-label`} className="font-medium text-gray-900">
                        {opt}
                      </div>
                    </div>

                    {/* container for progress + overlay labels */}
                    <div className="relative" style={{ height: 64 }}>
                      {/* full-width clickable bar (visual) */}
                      <div
                        className="absolute inset-x-0 top-1/2 transform -translate-y-1/2 h-3 rounded-full bg-gradient-to-r from-gray-200 to-gray-200 overflow-hidden"
                        role="presentation"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const ratio = Math.max(0, Math.min(1, x / rect.width));
                          const newVal = Math.ceil(ratio * 5) || 1;
                          setRatingForOption(idx, newVal);
                        }}
                        onTouchStart={(e) => {
                          // support touch: take first touch
                          const touch = e.touches?.[0];
                          if (!touch) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = touch.clientX - rect.left;
                          const ratio = Math.max(0, Math.min(1, x / rect.width));
                          const newVal = Math.ceil(ratio * 5) || 1;
                          setRatingForOption(idx, newVal);
                        }}
                        aria-hidden="true"
                      >
                        <div
                          className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {/* overlay labels (centered vertically on bar). pointer-events enabled on buttons only */}
                      <div
                        className="absolute inset-x-0 top-1/2 transform -translate-y-1/2"
                        style={{ pointerEvents: 'none' }}
                      >
                        <div className="relative" style={{ height: 0 }}>
                          {RATING_LABELS.map((label, rIdx) => {
                            const markerVal = rIdx + 1;
                            const leftPercent = (rIdx / (5 - 1)) * 100;
                            const selected = val === markerVal;
                            return (
                              <button
                                key={rIdx}
                                onClick={() => setRatingForOption(idx, markerVal)}
                                onKeyDown={onKey}
                                aria-pressed={selected}
                                aria-label={`${opt} — ${label}`}
                                type="button"
                                style={{
                                  position: 'absolute',
                                  left: `${leftPercent}%`,
                                  transform: 'translate(-50%, -50%)',
                                  top: '50%',
                                  pointerEvents: 'auto', // allow clicks/taps only on label buttons
                                  minWidth: 92,
                                }}
                                className={`flex items-center justify-center px-3 py-1 rounded-md text-sm font-medium border transition-shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 ${
                                  selected
                                    ? 'bg-blue-600 text-white border-blue-700 shadow'
                                    : 'bg-white text-gray-700 border-gray-200 hover:shadow-sm'
                                }`}
                              >
                                <span className="truncate" style={{ maxWidth: 200 }}>
                                  {label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* visually hidden instructions for screen readers */}
                      <div className="sr-only" id={`opt-${idx}-instructions`}>
                        Use left and right arrow keys to change rating. Home to choose first, End to choose last.
                      </div>
                    </div>
                  </div>
                );
              })}
            </form>

            <div className="mt-6 flex flex-col sm:flex-row justify-end items-center gap-3">
              <div className="text-sm text-gray-500 mr-auto hidden sm:block">
                {ratings.length > 0 && ratings.some((r) => r < 1) ? 'Please rate all options' : 'All set — ready to submit'}
              </div>
              <button
                onClick={handleSubmit}
                disabled={ratings.length === 0 || ratings.some((r) => r < 1) || submitted}
                className={`px-5 py-2 rounded-lg text-white font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 transition ${
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
