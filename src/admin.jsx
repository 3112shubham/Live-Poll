import React, { useEffect, useState } from 'react';
import {
  db,
  collection,
  addDoc,
  doc,
  setDoc,
  onSnapshot,
  getDocs,
  query,
  orderBy,
} from '../firebase';
import { deleteDoc } from 'firebase/firestore';

export default function Admin() {
  const [domain, setDomain] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [questions, setQuestions] = useState([]);
  const [activeId, setActiveId] = useState(null);

  // editing state
  const [editingId, setEditingId] = useState(null);
  const [editDomain, setEditDomain] = useState('');
  const [editQuestionText, setEditQuestionText] = useState('');
  const [editOptions, setEditOptions] = useState([]);

  useEffect(() => {
    const activeRef = doc(db, 'active', 'question');
    const unsubActive = onSnapshot(activeRef, (snap) => {
      if (snap.exists()) setActiveId(snap.data().questionId || null);
      else setActiveId(null);
    });

    fetchQuestions();

    return () => {
      unsubActive();
    };
  }, []);

  async function fetchQuestions() {
    const q = query(collection(db, 'questions'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    setQuestions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  const handleOptionChange = (i, v) => {
    const copy = [...options];
    copy[i] = v;
    setOptions(copy);
  };

  const handleCreateAndActivate = async () => {
    if (!domain.trim()) return alert('Domain is required.');
    if (!questionText.trim()) return alert('Question text required.');
    const cleanedOptions = options.map((o) => o.trim()).filter((o) => o !== '');
    if (cleanedOptions.length < 2) return alert('Provide at least 2 options.');
    const payload = {
      domain: domain.trim(),
      text: questionText.trim(),
      options: cleanedOptions,
      createdAt: new Date(),
    };
    const colRef = collection(db, 'questions');
    const docRef = await addDoc(colRef, payload);
    await setDoc(doc(db, 'active', 'question'), { questionId: docRef.id });
    setDomain('');
    setQuestionText('');
    setOptions(['', '', '', '']);
    await fetchQuestions();
  };

  const handleActivateExisting = async (id) => {
    await setDoc(doc(db, 'active', 'question'), { questionId: id });
  };

  const handleDeactivate = async () => {
    await setDoc(doc(db, 'active', 'question'), { questionId: null });
  };

  // delete question (and deactivate if it was active)
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this question? This will remove the question and its responses.')) return;
    if (activeId === id) {
      await setDoc(doc(db, 'active', 'question'), { questionId: null });
    }
    await deleteDoc(doc(db, 'questions', id));
    await fetchQuestions();
  };

  // start editing
  const handleEditClick = (q) => {
    setEditingId(q.id);
    setEditDomain(q.domain || '');
    setEditQuestionText(q.text || '');
    setEditOptions(Array.isArray(q.options) ? [...q.options] : ['', '']);
  };

  const handleEditOptionChange = (i, v) => {
    const copy = [...editOptions];
    copy[i] = v;
    setEditOptions(copy);
  };

  const handleAddOption = () => setOptions((s) => [...s, '']);
  const handleAddEditOption = () => setEditOptions((s) => [...s, '']);

  const handleRemoveEditOption = (i) => setEditOptions((s) => s.filter((_, idx) => idx !== i));
  const handleRemoveOption = (i) => setOptions((s) => s.filter((_, idx) => idx !== i));

  const handleSaveEdit = async () => {
    if (!editDomain.trim()) return alert('Domain required.');
    if (!editQuestionText.trim()) return alert('Question text required.');
    const cleaned = editOptions.map((o) => o.trim()).filter((o) => o !== '');
    if (cleaned.length < 2) return alert('At least 2 options required.');
    const payload = {
      domain: editDomain.trim(),
      text: editQuestionText.trim(),
      options: cleaned,
      updatedAt: new Date(),
    };
    await setDoc(doc(db, 'questions', editingId), payload, { merge: true });
    setEditingId(null);
    await fetchQuestions();
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded shadow">
        <h1 className="text-xl font-semibold mb-4">Admin — Live Poll</h1>

        <section className="mb-6">
          <h2 className="font-medium mb-2">Create & activate question</h2>

          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="Domain (e.g., Finance, Hiring)"
            className="w-full p-2 border rounded mb-2"
          />

          <input
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Question text (e.g., For finance, what skill is most important?)"
            className="w-full p-2 border rounded mb-2"
          />

          <div className="mb-2 text-sm text-gray-600">Options (each will be rated on a 5-point scale):</div>

          {options.map((opt, i) => (
            <div key={i} className="flex gap-2 items-center mb-2">
              <input
                value={opt}
                onChange={(e) => handleOptionChange(i, e.target.value)}
                placeholder={`Option ${i + 1} (e.g. Communication)`}
                className="flex-1 p-2 border rounded"
              />
              <button onClick={() => handleRemoveOption(i)} className="px-2 py-1 text-sm bg-red-100 rounded">
                Remove
              </button>
            </div>
          ))}

          <div className="flex gap-2 mb-2">
            <button onClick={handleAddOption} className="px-3 py-1 bg-gray-100 rounded text-sm">
              + Add option
            </button>
            <button onClick={() => setOptions(['', '', '', ''])} className="px-3 py-1 bg-gray-100 rounded text-sm">
              Reset
            </button>
          </div>

          <div className="flex gap-2 mt-3">
            <button onClick={handleCreateAndActivate} className="px-4 py-2 bg-blue-600 text-white rounded">
              Create + Activate
            </button>
            <button onClick={handleDeactivate} className="px-4 py-2 bg-gray-300 rounded">
              Deactivate
            </button>
          </div>
        </section>

        <section>
          <h2 className="font-medium mb-2">Existing questions</h2>
          <div className="space-y-3">
            {questions.length === 0 && <div className="text-sm text-gray-500">No questions yet</div>}
            {questions.map((q) => (
              <div key={q.id} className="p-3 border rounded flex justify-between items-start">
                <div className="flex-1">
                  {editingId === q.id ? (
                    <div>
                      <input
                        value={editDomain}
                        onChange={(e) => setEditDomain(e.target.value)}
                        className="w-full p-2 border rounded mb-2"
                        placeholder="Domain"
                      />
                      <input
                        value={editQuestionText}
                        onChange={(e) => setEditQuestionText(e.target.value)}
                        className="w-full p-2 border rounded mb-2"
                        placeholder="Question text"
                      />
                      <div className="text-sm text-gray-600 mb-2">
                        {editOptions.map((o, i) => (
                          <div key={i} className="flex gap-2 items-center mb-1">
                            <input
                              value={o}
                              onChange={(e) => handleEditOptionChange(i, e.target.value)}
                              className="flex-1 p-2 border rounded"
                              placeholder={`Option ${i + 1}`}
                            />
                            <button onClick={() => handleRemoveEditOption(i)} className="px-2 py-1 text-sm bg-red-100 rounded">
                              Remove
                            </button>
                          </div>
                        ))}
                        <div>
                          <button onClick={handleAddEditOption} className="px-3 py-1 bg-gray-100 rounded text-sm">
                            + Add option
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button onClick={handleSaveEdit} className="px-3 py-1 bg-green-600 text-white rounded text-sm">
                          Save
                        </button>
                        <button onClick={handleCancelEdit} className="px-3 py-1 bg-gray-200 rounded text-sm">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-xs text-gray-500 mb-1">{q.domain}</div>
                      <div className="font-semibold">{q.text}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        {Array.isArray(q.options) &&
                          q.options.map((o, i) => (
                            <div key={i} className="text-sm">
                              {i + 1}. {o}
                            </div>
                          ))}
                      </div>
                    </>
                  )}
                </div>

                {editingId !== q.id && (
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex flex-col gap-2">
                      <button onClick={() => handleEditClick(q)} className="px-3 py-1 bg-yellow-400 text-white rounded text-sm">
                        Edit
                      </button>
                      <button onClick={() => handleActivateExisting(q.id)} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">
                        Activate
                      </button>
                      <button onClick={() => handleDelete(q.id)} className="px-3 py-1 bg-red-600 text-white rounded text-sm">
                        Delete
                      </button>
                    </div>
                    {activeId === q.id && <span className="text-xs text-green-600">Active</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}