import React, { useEffect, useState } from 'react';
import { db, doc, getDoc, onSnapshot, collection } from '../firebase';
import { Link } from 'react-router-dom';
import bgImage from './assets/Background.png'; // <- adjust filename if different
import logoLeft from './assets/IU logo New.png'; // added: left logo
import logoRight from './assets/Vyom logo.png'; // added: right logo
import logoRightbottom from './assets/GA logo new.png'; // added: right logo

const RATING_LABELS = ['Not useful', 'Slightly useful', 'Useful', 'Very useful', 'Most useful']; // 5-level labels

export default function Result() {
  const [question, setQuestion] = useState(null);
  const [optionRatingCounts, setOptionRatingCounts] = useState([]); // for each option: [count1,count2,...,count5]
  const [totalResponses, setTotalResponses] = useState(0);

  // map percentage -> descriptive label (left of percentage)
  const pctLabelFor = (pct) => {
    if (pct <= 20) return RATING_LABELS[0];    // Not useful
    if (pct <= 40) return RATING_LABELS[1];    // Slightly
    if (pct <= 60) return RATING_LABELS[2];    // Useful
    if (pct <= 80) return RATING_LABELS[3];    // Very
    return RATING_LABELS[4];                   // Most useful
  };

  useEffect(() => {
    const activeRef = doc(db, 'active', 'question');
    const unsubActive = onSnapshot(activeRef, async (snap) => {
      const data = snap.exists() ? snap.data() : null;
      const id = data?.questionId || null;
      if (!id) {
        setQuestion(null);
        setOptionRatingCounts([]);
        setTotalResponses(0);
        return;
      }
      const qSnap = await getDoc(doc(db, 'questions', id));
      if (qSnap.exists()) {
        const q = { id: qSnap.id, ...qSnap.data() };
        setQuestion(q);
        setOptionRatingCounts(new Array(q.options?.length || 0).fill(0).map(() => new Array(5).fill(0)));
      } else {
        setQuestion(null);
        setOptionRatingCounts([]);
      }
    });

    const unsubResponses = onSnapshot(collection(db, 'responses'), (snap) => {
      (async () => {
        const aSnap = await getDoc(activeRef);
        const activeId = aSnap.exists() ? aSnap.data().questionId : null;
        if (!activeId) {
          setOptionRatingCounts([]);
          setTotalResponses(0);
          return;
        }
        const qSnap = await getDoc(doc(db, 'questions', activeId));
        const optsLen = qSnap.exists() ? (qSnap.data().options?.length || 0) : 0;
        const counts = new Array(optsLen).fill(0).map(() => new Array(5).fill(0));
        let tot = 0;
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.questionId === activeId && Array.isArray(data.ratings)) {
            tot += 1;
            data.ratings.forEach((rVal, i) => {
              const rIdx = typeof rVal === 'number' ? rVal - 1 : -1;
              if (rIdx >= 0 && rIdx < 5 && i < optsLen) counts[i][rIdx] += 1;
            });
          }
        });
        setOptionRatingCounts(counts);
        setTotalResponses(tot);
      })();
    });

    return () => {
      unsubActive();
      unsubResponses();
    };
  }, []);

  return (
    <div
      className="min-h-screen relative flex items-center justify-center p-1" // changed items-start -> items-center
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        backgroundColor: '#f8fafc',
      }}
    >
      {/* single semi-transparent black overlay over the background image */}
      <div aria-hidden className="absolute inset-0 bg-black/40 pointer-events-none" />

      {/* logos positioned relative to viewport (won't affect container centering) */}
      <img
        src={logoLeft}
        alt="Left logo"
        className="fixed top-4 left-4 w-56 sm:w-64 h-auto max-h-[calc(100vh-3rem)] object-contain z-30 pointer-events-none"
      />
      <img
        src={logoRight}
        alt="Right logo"
        className="fixed top-4 right-4 w-32 sm:w-40 h-auto max-h-[calc(100vh-3rem)] object-contain z-30 pointer-events-none"
      />
      <img
        src={logoRightbottom}
        alt="Right bottom logo"
        className="fixed bottom-4 right-4 w-40 sm:w-44 h-auto max-h-[calc(100vh-3rem)] object-contain z-30 pointer-events-none"
      />

      <div
        className="w-full max-w-4xl relative overflow-hidden p-4
                   bg-gradient-to-r from-black/60 via-black/50 to-black/40
                   backdrop-blur-xl backdrop-saturate-150
                   shadow-lg ring-1 ring-white/5 ring-inset text-white"
        style={{
          border: '1px solid transparent',
          borderImage:
            'linear-gradient(90deg, rgba(99,102,241,0.75), rgba(59,130,246,0.5), rgba(6,182,212,0.45)) 1',
          boxShadow: '0 10px 30px rgba(2,6,23,0.6), inset 0 1px 0 rgba(255,255,255,0.02)',
        }}
      >
        {/* subtle dark frosted overlay for deeper "black glass" look */}
        <div aria-hidden className="absolute inset-0 pointer-events-none"
             style={{background: 'linear-gradient(180deg, rgba(0,0,0,0.45), rgba(255,255,255,0.02))'}} />

        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold drop-shadow">Poll Results</h2>
            <div className="text-sm text-white">{question?.domain}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm">{totalResponses} response{totalResponses !== 1 ? 's' : ''}</div>

          </div>
        </div>

        {!question ? (
          <div className="text-center py-12">No active question right now.</div>
        ) : (
          <>
            <div className="mb-1">
              <p className="text-xl font-medium !text-white drop-shadow">{question.text}</p> {/* changed: force white and add drop-shadow */}
            </div>

            <div className="space-y-1">
              {question.options.map((opt, i) => {
                const counts = optionRatingCounts[i] || new Array(5).fill(0);
                const total = totalResponses || counts.reduce((a, b) => a + b, 0) || 0;
                const sum = counts.reduce((acc, c, idx) => acc + c * (idx + 1), 0);
                const avg = total ? sum / total : 0; // average rating in range 0..5
                const avgPct = Math.round((avg / 5) * 100);

                // compact card
                return (
                  <div
                    key={i}
                    className="p-3 bg-black/40 backdrop-blur-sm rounded-lg shadow-sm"
                    style={{
                      border: '1px solid transparent',
                      borderImage:
                        'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(99,102,241,0.08)) 1',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02), 0 6px 18px rgba(2,6,23,0.45)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{opt}</div>
                        <div className="text-xs mt-1">
                           {total ? `${avg.toFixed(2)} / 5` : 'No responses yet'}
                         </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* descriptive label on the left of the percentage */}
                        <div className="text-sm whitespace-nowrap">{pctLabelFor(avgPct)}</div>

                        <div className="text-sm font-semibold tabular-nums">{avgPct}%</div>

                      
                      </div>
                    </div>

                    {/* single progress bar showing average */}
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={avgPct}
                      aria-label={`${opt} average rating ${avg.toFixed(2)} out of 5`}
                      className="w-full h-3 bg-white/10 rounded-full overflow-hidden"
                    >
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${avgPct}%`,
                          background: 'linear-gradient(90deg,#06b6d4,#3b82f6)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}