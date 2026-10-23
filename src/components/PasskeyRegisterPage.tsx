import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

const EMAIL = 'sarveshkuma007@gmail.com';

function toBuffer(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

function toBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = '';

  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export default function PasskeyRegisterPage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function registerPasskey() {
    setBusy(true);
    setMessage('');
    setError('');

    try {
      // This page intentionally does not contain the enrollment token.
      // A protected server-side enrollment helper must provide access.
      const optionsResponse = await fetch(
        '/api/auth/webauthn/register/options',
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: EMAIL }),
        }
      );

      const optionsData = await optionsResponse.json();

      if (!optionsResponse.ok) {
        throw new Error(
          optionsData.error ||
            'The server rejected passkey registration.'
        );
      }

      const options = optionsData.publicKey;

      if (!options?.challenge) {
        throw new Error('The server returned invalid registration options.');
      }

      const credential = (await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge: toBuffer(options.challenge),
          user: {
            ...options.user,
            id: toBuffer(options.user.id),
          },
          excludeCredentials: (options.excludeCredentials || []).map(
            (item: { id: string; type: PublicKeyCredentialType; transports?: AuthenticatorTransport[] }) => ({
              ...item,
              id: toBuffer(item.id),
            })
          ),
        },
      })) as PublicKeyCredential | null;

      if (!credential) {
        throw new Error('Passkey registration was cancelled.');
      }

      const attestation =
        credential.response as AuthenticatorAttestationResponse;

      const verifyResponse = await fetch(
        '/api/auth/webauthn/register/verify',
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: EMAIL,
            id: credential.id,
            rawId: toBase64Url(credential.rawId),
            type: credential.type,
            response: {
              clientDataJSON: toBase64Url(attestation.clientDataJSON),
              attestationObject: toBase64Url(attestation.attestationObject),
              transports: attestation.getTransports?.() || [],
            },
            clientExtensionResults: credential.getClientExtensionResults(),
          }),
        }
      );

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok || verifyData.verified !== true) {
        throw new Error(
          verifyData.error || 'The server could not verify the passkey.'
        );
      }

      setMessage(
        'Passkey registered successfully. Return to the login page to test it.'
      );
    } catch (err) {
      console.error('Passkey enrollment failed:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Could not register your passkey.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white flex items-center justify-center">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8">
        <div className="mb-5 flex justify-center text-cyan-300">
          <ShieldCheck size={42} />
        </div>

        <h1 className="text-center text-2xl font-bold">
          Register Passkey
        </h1>

        <p className="mt-3 text-center text-sm text-slate-400">
          Register a passkey for {EMAIL}. Your browser will open the
          available device authentication prompt.
        </p>

        <button
          type="button"
          onClick={() => void registerPasskey()}
          disabled={busy}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <ShieldCheck size={20} />
          )}
          {busy ? 'Registering…' : 'Register with Windows Hello'}
        </button>

        {message && (
          <p className="mt-5 flex gap-2 rounded-lg bg-emerald-950 p-3 text-sm text-emerald-200">
            <CheckCircle2 size={20} className="shrink-0" />
            {message}
          </p>
        )}

        {error && (
          <p className="mt-5 flex gap-2 rounded-lg bg-rose-950 p-3 text-sm text-rose-200">
            <AlertCircle size={20} className="shrink-0" />
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
