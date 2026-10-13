'use client';

import { useState, useEffect } from 'react';
import { Card } from './ui/Card.jsx';
import { Button } from './ui/Button.jsx';

export function HabitCirclesCard({ lang = 'bn' }) {
  const [circles, setCircles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [circleName, setCircleName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);

  const isBn = lang === 'bn';
  const copy = {
    title: isBn ? '👥 ফ্রেন্ডস হ্যাবিট সার্কেল ও লিডারবোর্ড' : '👥 Friends Habit Circle & Leaderboard',
    noCircles: isBn ? 'এখনো কোনো ফ্রেন্ডস সার্কেলে যুক্ত নেই। বন্ধুদের সাথে সার্কেল বানিয়ে একসাথে অভ্যাস গড়ুন!' : 'No habit circles yet. Form a circle with friends to build habits together!',
    createBtn: isBn ? '+ নতুন সার্কেল' : '+ Create Circle',
    joinBtn: isBn ? 'কোড দিয়ে জয়েন করুন' : 'Join with Code',
    createTitle: isBn ? 'নতুন সার্কেল তৈরি করুন' : 'Create Habit Circle',
    joinTitle: isBn ? 'সার্কেল কোড দিন' : 'Enter Circle Code',
    namePlaceholder: isBn ? 'সার্কেলের নাম (যেমন: ফোকাস গ্যাং)' : 'Circle Name (e.g. Focus Squad)',
    codePlaceholder: isBn ? '৬ অক্ষরের কোড (যেমন: 4F2A9B)' : '6-character code',
    save: isBn ? 'সংরক্ষণ' : 'Save',
    join: isBn ? 'যুক্ত হোন' : 'Join',
    cancel: isBn ? 'বাতিল' : 'Cancel',
    todayDone: isBn ? 'আজ সম্পন্ন:' : 'Done Today:',
    streak: isBn ? 'স্ট্রিক:' : 'Streak:',
    copyCode: isBn ? 'কোড কপি' : 'Copy Code',
    copied: isBn ? 'কপি হয়েছে!' : 'Copied!',
  };

  const loadCircles = () => {
    fetch('/api/circles/my')
      .then((res) => res.json())
      .then((data) => {
        if (data?.circles) setCircles(data.circles);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadCircles();
  }, []);

  const handleCreate = async () => {
    if (!circleName.trim()) return;
    setError('');
    try {
      const res = await fetch('/api/circles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: circleName }),
      });
      if (res.ok) {
        setCircleName('');
        setShowCreate(false);
        loadCircles();
      } else {
        setError('Failed to create circle');
      }
    } catch {
      setError('Connection error');
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setError('');
    try {
      const res = await fetch('/api/circles/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode }),
      });
      if (res.ok) {
        setJoinCode('');
        setShowJoin(false);
        loadCircles();
      } else {
        setError(isBn ? 'ভুল কোড' : 'Invalid code');
      }
    } catch {
      setError('Connection error');
    }
  };

  const copyInvite = (code) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2500);
    }
  };

  return (
    <Card className="surface-card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <h3 className="section-heading text-base flex items-center gap-2">
          <span>👥</span> {copy.title}
        </h3>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => { setShowJoin(true); setShowCreate(false); }}>
            {copy.joinBtn}
          </Button>
          <Button size="sm" onClick={() => { setShowCreate(true); setShowJoin(false); }}>
            {copy.createBtn}
          </Button>
        </div>
      </div>

      {showCreate && (
        <div className="routine-tile space-y-2 p-3.5">
          <h4 className="text-xs font-bold text-sapphire">{copy.createTitle}</h4>
          <input
            type="text"
            value={circleName}
            onChange={(e) => setCircleName(e.target.value)}
            placeholder={copy.namePlaceholder}
            className="w-full rounded-lg border border-gold/25 p-2 text-sm"
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>{copy.cancel}</Button>
            <Button size="sm" onClick={handleCreate}>{copy.save}</Button>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="routine-tile space-y-2 p-3.5">
          <h4 className="text-xs font-bold text-gold-soft">{copy.joinTitle}</h4>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder={copy.codePlaceholder}
            className="w-full rounded-lg border border-gold/25 p-2 text-sm uppercase font-mono"
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => setShowJoin(false)}>{copy.cancel}</Button>
            <Button size="sm" onClick={handleJoin}>{copy.join}</Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {loading ? (
        <div className="h-16 animate-pulse rounded bg-ink/10" />
      ) : circles.length === 0 ? (
        <p className="py-2 text-sm italic text-ink/75">{copy.noCircles}</p>
      ) : (
        <div className="space-y-4">
          {circles.map((c) => (
            <div key={c.id} className="routine-tile p-4">
              <div className="flex items-center justify-between border-b border-gold/20 pb-2">
                <div>
                  <h4 className="font-bold text-ink text-sm">{c.name}</h4>
                  <p className="text-xs text-ink/70">{c.memberCount} members</p>
                </div>
                <button
                  type="button"
                  onClick={() => copyInvite(c.code)}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-mono font-bold text-gray-700 hover:bg-gray-100"
                >
                  {copiedCode === c.code ? copy.copied : `Code: ${c.code}`}
                </button>
              </div>

              <div className="mt-3 space-y-1.5">
                {c.leaderboard.map((m, idx) => (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between rounded-xl p-2 text-xs ${
                      m.isMe ? 'bg-sapphire/10 font-bold text-sapphire' : 'bg-paper/60 text-ink/85'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-ink/50">#{idx + 1}</span>
                      <span>{m.name} {m.isMe ? '(You)' : ''}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span>{copy.todayDone} <strong>{m.doneToday}</strong></span>
                      <span>🔥 {m.streak}d</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
