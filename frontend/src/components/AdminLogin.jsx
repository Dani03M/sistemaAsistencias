import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, ShieldCheck, User, Lock, Loader2, AlertTriangle, ArrowRight, ArrowLeft } from 'lucide-react';

const API_URL = '/api/admin';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showManualLogin, setShowManualLogin] = useState(false);
  const navigate = useNavigate();

  // Redirección si ya es admin
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [navigate]);

  // Inicializar Google Identity Services (una sola vez)
  const gsiInitialized = React.useRef(false);
  const navigateRef = React.useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (gsiInitialized.current) return;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const onGoogleResponse = async (response) => {
      setGoogleLoading(true);
      setError(null);
      try {
        const res = await axios.post(`${API_URL}/google-login`, {
          credential: response.credential,
        });
        if (res.data.access_token) {
          localStorage.setItem('admin_token', res.data.access_token);
          navigateRef.current('/admin/dashboard', { replace: true });
        }
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.detail || 'Error al iniciar sesión con Google.');
      } finally {
        setGoogleLoading(false);
      }
    };

    const initGsi = () => {
      if (gsiInitialized.current || !window.google?.accounts?.id) return;
      gsiInitialized.current = true;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: onGoogleResponse,
        auto_select: false,
      });

      const btnContainer = document.getElementById('googleSignInBtn');
      if (btnContainer) {
        btnContainer.innerHTML = '';
        const btnWidth = Math.min(320, Math.max(240, window.innerWidth - 72));
        window.google.accounts.id.renderButton(btnContainer, {
          theme: 'filled_black',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: btnWidth,
        });
      }
    };

    if (window.google?.accounts?.id) {
      initGsi();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          initGsi();
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_URL}/login`, { email, password });
      if (response.data.access_token) {
        localStorage.setItem('admin_token', response.data.access_token);
        navigate('/admin/dashboard', { replace: true });
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#070b14] p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-15%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] bg-rose-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md mb-6 flex items-center justify-between relative z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-indigo-300/70 hover:text-white text-sm font-medium transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Volver al Menú Principal</span>
        </Link>
      </div>

      <div className="w-full max-w-md bg-[#0B1120]/80 backdrop-blur-2xl rounded-[2rem] shadow-2xl border border-white/5 relative z-10">
        <div className="p-5 sm:p-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mb-5 border border-rose-500/20 shadow-inner -rotate-3">
              <ShieldCheck className="w-8 h-8 text-rose-500" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-2 text-center">
              Acceso Restringido
            </h2>
            <p className="text-indigo-200/70 text-sm mt-2 text-center font-medium">
              Acceso exclusivo para RRHH
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl flex items-start text-sm border shadow-inner bg-red-500/10 text-red-300 border-red-500/20">
              <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Botón de Google Sign-in */}
          <div className="flex flex-col items-center mb-6 w-full">
            <div className="w-full flex justify-center py-1">
              <div id="googleSignInBtn" className="min-h-[44px] flex items-center justify-center"></div>
            </div>
            {googleLoading && (
              <p className="text-xs text-indigo-300 mt-3 flex items-center gap-1.5 animate-pulse font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" /> Verificando cuenta de Google...
              </p>
            )}
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-[#0B1120] text-slate-500 font-medium">o con credenciales locales</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Correo Electrónico</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-indigo-400/70" />
                </div>
                <input
                  type="email"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-slate-700/60 rounded-xl bg-slate-900/50 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 placeholder-slate-600 transition-colors shadow-inner"
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-indigo-400/70" />
                </div>
                <input
                  type="password"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-slate-700/60 rounded-xl bg-slate-900/50 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 placeholder-slate-600 transition-colors shadow-inner"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/25 mt-8 group"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  Entrar al Panel
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="px-8 py-5 bg-slate-900/40 border-t border-white/5 text-center">
          <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            Acceso restringido · Solo personal autorizado
          </p>
        </div>
      </div>
    </div>
  );
}
