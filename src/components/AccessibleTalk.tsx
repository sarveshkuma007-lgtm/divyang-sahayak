
import React, { useEffect, useRef, useState } from 'react';

type Message = {
  id: number;
  sender: 'visitor' | 'divyang';
  text: string;
};

type RecognitionResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
};

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export default function AccessibleTalk() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [speaker, setSpeaker] = useState<'visitor' | 'divyang'>('visitor');
  const [language, setLanguage] = useState('en-IN');
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('Type a message or use the microphone.');

  const recognitionRef = useRef<Recognition | null>(null);
  const nextIdRef = useRef(1);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  function speak(text: string) {
    if (!('speechSynthesis' in window)) {
      setStatus('Speech output is unavailable in this browser.');
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }

  function send(text: string, sender: 'visitor' | 'divyang') {
    const clean = text.trim();
    if (!clean) return;

    setMessages(previous => [
      ...previous,
      { id: nextIdRef.current++, sender, text: clean },
    ]);
    setDraft('');
    setStatus('Message added to this conversation.');

    // Read the typed reply aloud to the visitor.
    if (sender === 'divyang') speak(clean);
  }

  function startListening() {
    const speechWindow = window as SpeechWindow;
    const SpeechRecognition =
      speechWindow.SpeechRecognition ??
      speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setStatus('Speech recognition is unsupported here. Please type instead.');
      return;
    }

    recognitionRef.current?.stop();

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = event => {
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript;
        } else {
          interimText += event.results[i][0].transcript;
        }
      }

      if (interimText) setDraft(interimText);

      if (finalText.trim()) {
        send(finalText, 'visitor');
      }
    };

    recognition.onerror = event => {
      setListening(false);
      setStatus(
        event.error === 'not-allowed'
          ? 'Microphone access denied. Allow microphone permission.'
          : `Speech recognition error: ${event.error}`,
      );
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setListening(true);
      setStatus('Listening. Speak now.');
    } catch {
      setListening(false);
      setStatus('Could not start the microphone. Please try again.');
    }
  }

  return (
    <section className="rounded-2xl border border-cyan-500/40 bg-slate-950 p-5 text-white space-y-4">
      <div>
        <h2 className="text-xl font-bold text-cyan-300">
          Talk to a Divyang
        </h2>
        <p className="mt-1 text-sm text-slate-300">
          Speak or type a message. No sign-language knowledge required.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          Replying as:
          <select
            value={speaker}
            onChange={event =>
              setSpeaker(event.target.value as 'visitor' | 'divyang')
            }
            className="ml-2 rounded-lg bg-slate-800 p-2"
          >
            <option value="visitor">Visitor</option>
            <option value="divyang">Divyang</option>
          </select>
        </label>

        <label className="text-sm">
          Language:
          <select
            value={language}
            onChange={event => setLanguage(event.target.value)}
            className="ml-2 rounded-lg bg-slate-800 p-2"
          >
            <option value="en-IN">English</option>
            <option value="hi-IN">Hindi</option>
          </select>
        </label>
      </div>

      <div
        className="min-h-32 space-y-3 rounded-xl bg-slate-900 p-3"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <p className="py-8 text-center text-slate-400">
            Your messages will appear here.
          </p>
        )}

        {messages.map(message => (
          <div
            key={message.id}
            className={`rounded-xl p-3 ${
              message.sender === 'visitor'
                ? 'mr-5 bg-slate-700'
                : 'ml-5 bg-cyan-900'
            }`}
          >
            <p className="text-xs font-semibold text-cyan-200">
              {message.sender === 'visitor' ? 'Visitor' : 'Divyang reply'}
            </p>
            <p className="mt-1 break-words">{message.text}</p>
            <button
              type="button"
              onClick={() => speak(message.text)}
              className="mt-2 text-sm underline"
            >
              🔊 Read aloud
            </button>
          </div>
        ))}
      </div>

      <label htmlFor="talk-message" className="block text-sm font-medium">
        Message
      </label>
      <textarea
        id="talk-message"
        value={draft}
        onChange={event => setDraft(event.target.value)}
        rows={3}
        placeholder="Type here, or use the microphone..."
        className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!draft.trim()}
          onClick={() => send(draft, speaker)}
          className="rounded-xl bg-cyan-600 px-4 py-3 font-semibold disabled:opacity-40"
        >
          Send
        </button>

        {!listening ? (
          <button
            type="button"
            onClick={startListening}
            className="rounded-xl bg-emerald-700 px-4 py-3 font-semibold"
          >
            🎙️ Speak to text
          </button>
        ) : (
          <button
            type="button"
            onClick={() => recognitionRef.current?.stop()}
            className="rounded-xl bg-red-700 px-4 py-3 font-semibold"
          >
            Stop microphone
          </button>
        )}
      </div>

      <p className="text-sm text-slate-300" role="status">{status}</p>
      <p className="text-xs text-amber-200">
        This is a conversation on the same device, not remote messaging between two phones.
      </p>
    </section>
  );
}
