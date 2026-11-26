import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Mail, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { JorqLogo } from '../components/JorqLogo';

type AuthMode = 'login' | 'register' | 'reset';

export function AuthPage({ onSuccess }: { onSuccess?: () => void }) {
  const { t } = useLanguage();
  const a = t.auth;
  const {
    firebaseUser,
    emailVerified,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    resetPassword,
    resendVerification,
    refreshSession,
    logout,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  // Email verification gate when user signed up with email/password
  if (firebaseUser && !emailVerified) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16">
        <div className="bg-white border border-slate-200 rounded-xl p-8">
          <div className="w-11 h-11 rounded-lg bg-blue-50 text-[#1E40AF] flex items-center justify-center mb-4">
            <Mail className="w-5 h-5" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[#0F172A]">{a.verifyTitle}</h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            {a.verifySentTo} <strong className="text-slate-900">{firebaseUser.email}</strong>.{' '}
            {a.verifyReason}
          </p>

          {errorMsg && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {errorMsg}
            </div>
          )}
          {infoMsg && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
              {infoMsg}
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setErrorMsg('');
                setInfoMsg('');
                try {
                  await refreshSession();
                  setInfoMsg(a.verifyRefreshed);
                } catch (err) {
                  setErrorMsg(err instanceof Error ? err.message : a.verifyCheckErr);
                } finally {
                  setBusy(false);
                }
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{a.verifyCheckedBtn}</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setErrorMsg('');
                setInfoMsg('');
                try {
                  await resendVerification();
                  setInfoMsg(a.verifyResent);
                } catch (err) {
                  setErrorMsg(err instanceof Error ? err.message : a.verifyWaitErr);
                } finally {
                  setBusy(false);
                }
              }}
              className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              {a.verifyResendBtn}
            </button>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="mt-5 text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            {t.common.logout}
          </button>
        </div>
      </div>
    );
  }

  const formatFirebaseAuthError = (err: unknown): string => {
    const code = (err as { code?: string })?.code || '';
    switch (code) {
      case 'auth/operation-not-allowed':
        return a.errOpNotAllowed;
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return a.errInvalidCred;
      case 'auth/email-already-in-use':
        return a.errEmailInUse;
      case 'auth/weak-password':
        return a.errWeakPass;
      case 'auth/popup-closed-by-user':
        return a.errPopupClosed;
      default:
        return err instanceof Error ? err.message : a.errGeneric;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg('');
    setInfoMsg('');
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
        onSuccess?.();
      } else if (mode === 'register') {
        if (name.trim().length < 2) {
          setErrorMsg(a.nameError);
          setBusy(false);
          return;
        }
        await registerWithEmail(name, email, password);
        setInfoMsg(a.registerSuccess);
      } else {
        await resetPassword(email);
        setInfoMsg(a.resetSuccess);
      }
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    setErrorMsg('');
    setInfoMsg('');
    try {
      await signInWithGoogle();
      onSuccess?.();
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-14">
      <div className="bg-white border border-slate-200 rounded-xl p-8">
        <div className="mb-6">
          <JorqLogo showFullTitle />
          <h1 className="mt-4 font-display text-2xl font-bold text-[#0F172A]">
            {mode === 'login' ? a.loginTitle : mode === 'register' ? a.registerTitle : a.resetTitle}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {mode === 'login'
              ? a.loginSubtitle
              : mode === 'register'
              ? a.registerSubtitle
              : a.resetSubtitle}
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg('');
              setInfoMsg('');
            }}
            className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {a.tabLogin}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMsg('');
              setInfoMsg('');
            }}
            className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {a.tabRegister}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('reset');
              setErrorMsg('');
              setInfoMsg('');
            }}
            className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              mode === 'reset' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {a.tabReset}
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
        {infoMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2 text-xs text-emerald-700">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{infoMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {a.fullNameLabel}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={a.fullNamePlaceholder}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E40AF]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {a.emailLabel}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={a.emailPlaceholder}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E40AF]"
            />
          </div>

          {mode !== 'reset' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {a.passwordLabel}
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={a.passwordPlaceholder}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E40AF]"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {busy
              ? a.processing
              : mode === 'login'
              ? a.submitLogin
              : mode === 'register'
              ? a.submitRegister
              : a.submitReset}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400">{a.orSeparator}</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={handleGoogle}
          className="w-full py-2.5 px-4 text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
            />
          </svg>
          <span>{a.googleBtn}</span>
        </button>
      </div>
    </div>
  );
}
