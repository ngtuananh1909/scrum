'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { Faction, GamePhase, SprintOutcome } from '@/game';

const SOUND_PREFERENCE_KEY = 'agile-game-sounds';
let sessionSoundPreference = false;

function readSoundPreference() {
  try {
    return window.localStorage.getItem(SOUND_PREFERENCE_KEY) === 'on';
  } catch {
    return sessionSoundPreference;
  }
}

function subscribeToSoundPreference(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener('agile-game-sounds-change', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('agile-game-sounds-change', onChange);
  };
}

type Cue = 'phase' | 'countdown' | 'vote' | 'reveal' | 'success' | 'fail' | 'skill' | 'win';

const CUE_FREQUENCIES: Record<Cue, [number, number]> = {
  phase: [660, 880], countdown: [520, 520], vote: [740, 980], reveal: [330, 760],
  success: [523, 1046], fail: [440, 220], skill: [880, 587], win: [523, 1318],
};

function playCue(cue: Cue) {
  try {
    const context = new window.AudioContext();
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    const [start, end] = CUE_FREQUENCIES[cue];
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(start, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(end, context.currentTime + 0.08);
    volume.gain.setValueAtTime(0.0001, context.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.035, context.currentTime + 0.015);
    volume.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.12);
    oscillator.connect(volume);
    volume.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.13);
    oscillator.addEventListener('ended', () => void context.close(), { once: true });
  } catch {
    // Audio is optional; some browsers disable it until the user interacts.
  }
}

export interface GameSoundSignals {
  phaseVersion: number | null;
  phase?: GamePhase | 'lobby' | null;
  remainingMs?: number | null;
  voteAck?: { at: number } | null;
  revealOutcome?: SprintOutcome | null;
  winner?: Faction | null;
  latestSkill?: string | null;
}

export function GameSoundToggle({
  phaseVersion, phase = null, remainingMs = null, voteAck = null,
  revealOutcome = null, winner = null, latestSkill = null,
}: GameSoundSignals) {
  const enabled = useSyncExternalStore(subscribeToSoundPreference, readSoundPreference, () => false);
  const previousVersion = useRef<number | null>(null);
  const previousAck = useRef<number | null>(null);
  const previousReveal = useRef<string | null>(null);
  const previousWinner = useRef<Faction | null>(null);
  const previousSkill = useRef<string | null>(null);
  const previousSecond = useRef<number | null>(null);

  useEffect(() => {
    if (phaseVersion == null) return;
    if (previousVersion.current == null) {
      previousVersion.current = phaseVersion;
      return;
    }
    if (previousVersion.current !== phaseVersion) {
      previousVersion.current = phaseVersion;
      if (enabled) playCue(phase === 'teamVoteReveal' || phase === 'executionReveal' ? 'reveal' : 'phase');
    }
  }, [enabled, phase, phaseVersion]);

  useEffect(() => {
    const at = voteAck?.at ?? null;
    if (at && previousAck.current !== at && enabled) playCue('vote');
    previousAck.current = at;
  }, [enabled, voteAck]);

  useEffect(() => {
    const signal = revealOutcome && phase === 'executionReveal' ? `${phaseVersion}:${revealOutcome}` : null;
    if (signal && previousReveal.current !== signal && enabled) playCue(revealOutcome === 'success' ? 'success' : 'fail');
    previousReveal.current = signal;
  }, [enabled, phase, phaseVersion, revealOutcome]);

  useEffect(() => {
    if (winner && previousWinner.current !== winner && enabled) playCue('win');
    previousWinner.current = winner;
  }, [enabled, winner]);

  useEffect(() => {
    if (latestSkill && previousSkill.current !== latestSkill && enabled) playCue('skill');
    previousSkill.current = latestSkill;
  }, [enabled, latestSkill]);

  useEffect(() => {
    const seconds = remainingMs == null ? null : Math.ceil(remainingMs / 1000);
    if (seconds != null && seconds > 0 && seconds <= 5 && previousSecond.current !== seconds && enabled) playCue('countdown');
    previousSecond.current = seconds;
  }, [enabled, remainingMs]);

  const toggle = () => {
    const next = !enabled;
    sessionSoundPreference = next;
    try {
      window.localStorage.setItem(SOUND_PREFERENCE_KEY, next ? 'on' : 'off');
    } catch {
      // Keep the choice for this page session when persistent storage is blocked.
    }
    window.dispatchEvent(new Event('agile-game-sounds-change'));
    if (next) playCue('phase');
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? 'Tắt âm thanh thông báo' : 'Bật âm thanh thông báo'}
      title={enabled ? 'Tắt âm thanh thông báo' : 'Bật âm thanh thông báo'}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container/60 px-3 text-xs text-foreground transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="material-symbols-outlined text-base" aria-hidden="true">{enabled ? 'volume_up' : 'volume_off'}</span>
      <span className="hidden sm:inline">Âm thanh {enabled ? 'bật' : 'tắt'}</span>
    </button>
  );
}
