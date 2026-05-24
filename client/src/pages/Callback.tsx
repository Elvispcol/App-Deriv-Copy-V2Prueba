import React, { useEffect, useState } from 'react';
import { authApi } from '../api';

export default function Callback() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function processCallback() {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');

        // CSRF check
        if (!state || state !== sessionStorage.getItem('oauth_state')) {
          throw new Error('Invalid state parameter — possible CSRF attack');
        }

        if (!code) {
          throw new Error('No authorization code received from Deriv');
        }

        const codeVerifier = sessionStorage.getItem('pkce_verifier');
        if (!codeVerifier) {
          throw new Error('Missing PKCE verifier — please try again');
        }

        const redirectUri = `${window.location.origin}/callback`;

        // Exchange code for session
        const data = await authApi.callback(code, codeVerifier, redirectUri);

        localStorage.setItem('session_id', data.session_id);
        sessionStorage.clear();

        setStatus('success');

        // Redirect to dashboard after short delay
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
      } catch (err: any) {
        setStatus('error');
        setErrorMsg(err.message || 'Authentication failed');
      }
    }

    processCallback();
  }, []);

  return (
    <div className="min-h-screen bg-deriv-dark flex items-center justify-center">
      <div className="bg-deriv-card rounded-2xl p-10 border border-gray-700 text-center max-w-md">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-deriv-primary mx-auto mb-4"></div>
            <h2 className="text-xl font-bold text-white mb-2">Procesando autenticación...</h2>
            <p className="text-gray-400">Intercambiando código de autorización por token de acceso.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-white mb-2">Autenticación exitosa</h2>
            <p className="text-gray-400">Redirigiendo al dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-xl font-bold text-red-400 mb-2">Error de autenticación</h2>
            <p className="text-gray-400 mb-4">{errorMsg}</p>
            <a
              href="/"
              className="inline-block bg-deriv-primary hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Volver al inicio
            </a>
          </>
        )}
      </div>
    </div>
  );
}
