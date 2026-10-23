
import React, { useState } from 'react';
import {
  MessageCircle,
  Phone,
  Video,
  Send,
  Languages,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
} from 'lucide-react';

type SignImage = {
  gloss: string;
  imageDataUrl: string;
  note?: string;
};

type ChatMessage = {
  id: string;
  text: string;
  sender: 'you' | 'contact';
  images?: SignImage[];
};

export default function ConnectMessagesCalls() {
  const [message, setMessage] = useState('');
  const [language, setLanguage] = useState('ISL');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTranslation, setShowTranslation] = useState(true);

  async function translateAndSend() {
    const sentence = message.trim();
    if (!sentence || loading) return;

    setLoading(true);
    setError('');

    try {
      // Ask the existing Gemini translation endpoint for gloss tokens.
      const translationResponse = await fetch('/api/gemini/sign-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sentence,
          targetDialect: language,
        }),
      });

      const translationData = await translationResponse.json();

      if (!translationResponse.ok) {
        throw new Error(
          translationData.error || 'Could not translate the sentence.'
        );
      }

      const rawGloss = translationData.signGloss;
      const glosses: string[] = Array.isArray(rawGloss)
        ? rawGloss
        : typeof rawGloss === 'string'
          ? rawGloss.split(/\s+/)
          : [];

      const gestureDetails = Array.isArray(translationData.gestureDetails)
        ? translationData.gestureDetails
        : [];

      if (!glosses.length) {
        throw new Error('Translation returned no sign gloss tokens.');
      }

      // Generate a separate illustrative image for each gloss.
      // Sequential requests reduce the chance of hitting API rate limits.
      const images: SignImage[] = [];

      for (const gloss of glosses.slice(0, 8)) {
        const details = gestureDetails.find(
          (item: { gloss?: string }) =>
            item.gloss?.toUpperCase() === gloss.toUpperCase()
        );

        const imageResponse = await fetch(
          '/api/gemini/generate-sign-image',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sentence,
              gloss,
              signDescription: details
                ? [
                    details.handshape,
                    details.movement,
                    details.facialExpression,
                  ]
                    .filter(Boolean)
                    .join('. ')
                : '',
            }),
          }
        );

        const imageData = await imageResponse.json();

        if (!imageResponse.ok) {
          throw new Error(
            imageData.error ||
              `Could not generate an image for ${gloss}.`
          );
        }

        if (typeof imageData.imageDataUrl === 'string') {
          images.push({
            gloss,
            imageDataUrl: imageData.imageDataUrl,
            note: imageData.note,
          });
        }
      }

      setMessages((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          text: sentence,
          sender: 'you',
          images,
        },
      ]);

      setMessage('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Translation or image generation failed.'
      );
    } finally {
      setLoading(false);
    }
  }

  function startVoiceCall() {
    window.dispatchEvent(
      new CustomEvent('divyang:start-call', { detail: { mode: 'audio' } })
    );
    setError(
      'Open the existing WebRTC calling section to start or join a voice call.'
    );
  }

  function startVideoCall() {
    window.dispatchEvent(
      new CustomEvent('divyang:start-call', { detail: { mode: 'video' } })
    );
    setError(
      'Open the existing WebRTC calling section to start or join a video call.'
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-cyan-950 p-3 text-cyan-300">
            <MessageCircle size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold">
              Connect — Messages &amp; Calls
            </h1>
            <p className="text-sm text-slate-400">
              Accessible communication with sign translation
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={startVoiceCall}
            className="flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-3 hover:bg-slate-800"
          >
            <Phone size={18} /> Voice
          </button>
          <button
            type="button"
            onClick={startVideoCall}
            className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-400"
          >
            <Video size={18} /> Video
          </button>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-700 p-4">
          <div className="flex items-center gap-2 font-semibold">
            <MessageCircle className="text-cyan-300" size={20} />
            Accessible chat
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <Languages size={18} />
            Sign language
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-800 p-2"
            >
              <option value="ISL">Indian Sign Language</option>
              <option value="ASL">American Sign Language</option>
            </select>
          </label>
        </div>

        <div className="min-h-64 space-y-4 bg-slate-950/50 p-4">
          {messages.length === 0 && (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center text-slate-400">
              <MessageCircle size={38} className="text-cyan-300" />
              <p className="font-medium text-slate-200">
                Start an accessible conversation
              </p>
              <p className="max-w-md text-sm">
                Type a sentence below to translate it into sign gloss and
                generate illustrative images for its tokens.
              </p>
            </div>
          )}

          {messages.map((item) => (
            <article
              key={item.id}
              className="ml-auto max-w-3xl rounded-2xl border border-cyan-900 bg-cyan-950/40 p-4"
            >
              <p className="mb-1 text-xs font-semibold text-cyan-300">
                You · Message
              </p>
              <p className="whitespace-pre-wrap">{item.text}</p>

              {showTranslation && item.images && (
                <div className="mt-4 space-y-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <ImageIcon size={17} className="text-cyan-300" />
                    Generated sign illustrations
                  </h2>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {item.images.map((image, index) => (
                      <figure
                        key={`${item.id}-${image.gloss}-${index}`}
                        className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950"
                      >
                        <img
                          src={image.imageDataUrl}
                          alt={`AI-generated illustrative hand gesture for ${image.gloss}`}
                          className="aspect-square w-full object-contain"
                          loading="lazy"
                        />
                        <figcaption className="p-3">
                          <span className="font-mono font-bold text-cyan-300">
                            {image.gloss}
                          </span>
                          {image.note && (
                            <p className="mt-1 text-xs text-slate-400">
                              {image.note}
                            </p>
                          )}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>

        <div className="space-y-3 border-t border-slate-700 p-4">
          <label htmlFor="message-input" className="text-sm font-semibold">
            Your message
          </label>

          <textarea
            id="message-input"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !loading
              ) {
                event.preventDefault();
                void translateAndSend();
              }
            }}
            placeholder="Type a complete sentence..."
            maxLength={500}
            rows={3}
            className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-4 outline-none focus:border-cyan-400"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={showTranslation}
                onChange={(event) =>
                  setShowTranslation(event.target.checked)
                }
                className="accent-cyan-400"
              />
              Show sign illustrations
            </label>

            <button
              type="button"
              onClick={() => void translateAndSend()}
              disabled={loading || !message.trim()}
              className="flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Translating and generating...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Translate &amp; Generate Signs
                </>
              )}
            </button>
          </div>

          {loading && (
            <p role="status" className="text-sm text-cyan-200">
              Generating images one token at a time. Longer sentences may take
              longer.
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}

          <p className="text-xs leading-relaxed text-amber-200/80">
            AI-generated illustrations are not verified ISL demonstrations.
            Do not rely on them as authoritative sign-language instruction.
            This chat is a local UI demonstration; real-time message delivery
            and live call captions require integration with your existing
            messaging and WebRTC signaling code.
          </p>
        </div>
      </section>
    </main>
  );
}
