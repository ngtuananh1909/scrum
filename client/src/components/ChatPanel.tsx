'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useGameStore } from '@/store/gameStore';

interface ChatPanelProps {
  roomId: string;
}

export function ChatPanel({ roomId }: ChatPanelProps) {
  const messages = useGameStore((s) => s.messages);
  const sendMessage = useGameStore((s) => s.sendMessage);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new message.
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    await sendMessage(text);
    setDraft('');
    setSending(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Chat</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          ref={listRef}
          className="h-48 overflow-y-auto bg-slate-900/40 rounded p-2 space-y-1"
        >
          {messages.length === 0 && (
            <p className="text-slate-500 text-sm text-center italic">No messages yet</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className="text-sm">
              <span className="font-medium text-slate-300">{m.player_name}:</span>{' '}
              <span className="text-slate-100">{m.text}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder={`Message room ${roomId}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            maxLength={500}
            disabled={sending}
          />
          <Button onClick={handleSend} disabled={!draft.trim() || sending}>
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
