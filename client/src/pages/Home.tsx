import React from 'react';

const DERIV_CLIENT_ID = '33mgrWPTeAQXoB8hjy8HE';

async function connectWithDeriv() {
  // Step 1: Generate PKCE code_verifier
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  const codeVerifier = Array.from(array)
    .map((v) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[v % 66])
    .join('');

  // Step 2: Generate code_challenge (SHA-256 + base64url)
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Step 3: Generate state for CSRF protection
  const state = crypto.randomUUID();

  // Step 4: Store in sessionStorage
  sessionStorage.setItem('pkce_verifier', codeVerifier);
  sessionStorage.setItem('oauth_state', state);

  // Step 5: Redirect to Deriv OAuth
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: DERIV_CLIENT_ID,
    redirect_uri: `${window.location.origin}/callback`,
    scope: 'trade account_manage',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `https://auth.deriv.com/oauth2/auth?${params}`;
}

export default function Home() {
  return (
    <div className="min-h-screen bg-deriv-dark flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📈</span>
            <h1 className="text-2xl font-bold text-white">
              Por<span className="text-deriv-primary">Ciento</span>
            </h1>
          </div>
          <span className="text-gray-400 text-sm">Copy Trading for Deriv</span>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl text-center">
          <div className="mb-8">
            <h2 className="text-5xl font-extrabold text-white mb-4">
              Replica operaciones <br />
              <span className="text-deriv-primary">automáticamente</span>
            </h2>
            <p className="text-xl text-gray-400 leading-relaxed">
              Conecta tu cuenta de Deriv, configura tu ratio de replicación y deja que el
              motor de copy trading haga el trabajo por ti. Sin complicaciones, sin demoras.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            <div className="bg-deriv-card rounded-xl p-5 border border-gray-700">
              <div className="text-3xl mb-2">🔗</div>
              <h3 className="text-white font-semibold mb-1">OAuth Seguro</h3>
              <p className="text-gray-400 text-sm">
                Autenticación PKCE sin secretos expuestos. Tu token nunca sale del servidor.
              </p>
            </div>
            <div className="bg-deriv-card rounded-xl p-5 border border-gray-700">
              <div className="text-3xl mb-2">⚡</div>
              <h3 className="text-white font-semibold mb-1">Tiempo Real</h3>
              <p className="text-gray-400 text-sm">
                WebSocket directo a Deriv. Las operaciones se replican en milisegundos.
              </p>
            </div>
            <div className="bg-deriv-card rounded-xl p-5 border border-gray-700">
              <div className="text-3xl mb-2">🎯</div>
              <h3 className="text-white font-semibold mb-1">Ratio Configurable</h3>
              <p className="text-gray-400 text-sm">
                Define cuánto replicar: de 10% a 100% del tamaño de la operación maestra.
              </p>
            </div>
          </div>

          {/* Connect Button */}
          <button
            onClick={connectWithDeriv}
            className="bg-deriv-primary hover:bg-blue-600 text-white font-bold py-4 px-10 rounded-xl text-lg transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105"
          >
            Conectar con Deriv
          </button>

          <p className="text-gray-500 text-sm mt-4">
            Serás redirigido a Deriv para autorizar el acceso a tu cuenta de trading.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-4 text-center text-gray-500 text-sm">
        PorCiento Copy Trading &copy; {new Date().getFullYear()} — No es un consejo financiero. Opera bajo tu propio riesgo.
      </footer>
    </div>
  );
}
