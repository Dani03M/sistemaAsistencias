import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, User, Lock, Loader2, CheckCircle, AlertTriangle, XCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import getFingerprint from '../utils/fingerprint';

const API_URL = '/api';

export default function Login() {
  const [dni, setDNI] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Status to manage feedback messages: null, or { type: 'success' | 'warning' | 'error', message: string }
  const [status, setStatus] = useState(null);
  const navigate = useNavigate();

  // Redirección automática si ya hay token
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      navigate('/scanner', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);

    const cleanDNI = dni.trim();
    if (!/^\d{8}$/.test(cleanDNI)) {
      setStatus({
        type: 'error',
        message: 'El DNI debe tener exactamente 8 dígitos numéricos.'
      });
      return;
    }

    if (!password || password.trim().length === 0) {
      setStatus({
        type: 'error',
        message: 'Por favor ingresa tu contraseña.'
      });
      return;
    }

    setLoading(true);

    try {
      const deviceId = await getFingerprint();
      
      // Detectar modelo real del dispositivo
      let deviceName = 'Dispositivo desconocido';
      try {
        // Chrome/Edge en Android expone el modelo real del teléfono
        if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
          const hints = await navigator.userAgentData.getHighEntropyValues(['model', 'platform', 'platformVersion']);
          const model = hints.model || '';
          const platform = hints.platform || '';
          if (model) {
            deviceName = `${model} (${platform})`;
          } else if (platform) {
            deviceName = platform;
          }
        } else {
          // Fallback parsing de userAgent estándar
          const ua = navigator.userAgent;
          if (/Android/i.test(ua)) {
            const match = ua.match(/Android[^;]+;\s*([^;)]+)\s*[;)]/);
            deviceName = match && match[1] ? match[1].trim() : 'Android Device';
          } else if (/iPhone|iPad/i.test(ua)) {
            deviceName = 'Apple iOS Device';
          } else if (/Windows/i.test(ua)) {
            deviceName = 'Windows PC';
          } else if (/Mac/i.test(ua)) {
            deviceName = 'Mac';
          }
        }
      } catch {
        deviceName = 'Dispositivo Web';
      }

      // Sending login request.
      const response = await axios.post(`${API_URL}/auth/login`, {
        dni,
        password,
        device_fingerprint: deviceId,
        device_name: deviceName
      });

      const data = response.data;

      if (data.device_approved) {
        // Solo guardar token si el dispositivo está aprobado
        if (data.access_token) {
          localStorage.setItem('access_token', data.access_token);
        }
        setStatus({
          type: 'success',
          message: 'Dispositivo aprobado. Entrando al escáner...'
        });
        setTimeout(() => {
          navigate('/scanner', { replace: true });
        }, 1000);
      } else {
        setStatus({
          type: 'warning',
          message: 'Dispositivo pendiente de aprobación por RRHH.'
        });
      }
      
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Error en el servidor.';
      
      if (error.response) {
        if (error.response.data && error.response.data.detail) {
          const detail = error.response.data.detail;
          errorMessage = Array.isArray(detail) ? detail.map(e => e.msg).join(', ') : detail;
        } else if (error.response.status === 401) {
          errorMessage = 'DNI o contraseña incorrectos.';
        } else if (error.response.status === 403) {
          errorMessage = 'Usuario deshabilitado o no autorizado.';
        }
      } else if (error.request) {
        errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión.';
      }
      
      setStatus({
        type: 'error',
        message: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#070b14] p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>

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
        <div className="p-8 sm:p-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-5 border border-indigo-500/20 shadow-inner rotate-3">
              <Shield className="w-8 h-8 text-indigo-400 -rotate-3" />
            </div>
            <h1 className="text-2xl font-bold text-white text-center tracking-tight">Portal del Empleado</h1>
            <p className="text-indigo-200/70 text-sm mt-2 text-center font-medium">
              Ingresa tus datos para registrar asistencia
            </p>
          </div>

          {status && (
            <div className={`mb-6 p-4 rounded-xl flex items-start text-sm border shadow-inner ${
              status.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 
              status.type === 'warning' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 
              'bg-red-500/10 text-red-300 border-red-500/20'
            }`}>
              {status.type === 'success' && <CheckCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5 text-emerald-400" />}
              {status.type === 'warning' && <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5 text-amber-400" />}
              {status.type === 'error' && <XCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5 text-red-400" />}
              <span>{status.message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">DNI</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-indigo-400/70" />
                </div>
                <input
                  type="text"
                  maxLength="8"
                  value={dni}
                  onChange={(e) => setDNI(e.target.value.replace(/\D/g, ''))}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-700/60 rounded-xl bg-slate-900/50 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 placeholder-slate-600 transition-colors shadow-inner"
                  placeholder="Número de DNI"
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-700/60 rounded-xl bg-slate-900/50 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 placeholder-slate-600 transition-colors shadow-inner"
                  placeholder="Tu contraseña"
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
                  Iniciando sesión...
                </>
              ) : (
                <>
                  Ingresar a Marcar
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
            Acceso seguro y protegido
          </p>
        </div>
      </div>
    </div>
  );
}
