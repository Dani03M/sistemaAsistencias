import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Home, Maximize2, Minimize2 } from 'lucide-react';

const API_URL = '/api';

const Kiosk = () => {
  const [totpCode, setTotpCode] = useState(null);
  const [timeLeft, setTimeLeft] = useState(10);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [error, setError] = useState(false);

  const fetchQrData = async () => {
    try {
      let apiKey = localStorage.getItem('kiosk_api_key');
      if (!apiKey) {
        apiKey = prompt("Ingrese la API Key del Kiosco para autorizar este dispositivo:");
        if (apiKey) {
            localStorage.setItem('kiosk_api_key', apiKey);
        } else {
            throw new Error("API Key requerida");
        }
      }
      const response = await axios.get(`${API_URL}/kiosk/qr-data`, {
        headers: {
          'X-Kiosk-Key': apiKey
        }
      });
      setTotpCode(response.data.totp_code);
      setTimeLeft(response.data.refresh_interval_seconds);
      setError(false);
    } catch (err) {
      console.error("Error obteniendo el código QR del servidor", err);
      if (err.response && err.response.status === 403) {
        localStorage.removeItem('kiosk_api_key');
      }
      setError(true);
      setTimeLeft(5); // Retry after 5 seconds on error
    }
  };

  useEffect(() => {
    fetchQrData();

    // Reloj en tiempo real
    const clock = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) {
      fetchQrData();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const progress = Math.max(0, (timeLeft / (error ? 5 : 10)) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-between p-6 select-none relative overflow-hidden">
      {/* Botón de Pantalla Completa y Menú */}
      <div className="w-full max-w-5xl flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h2 className="text-white font-bold text-base leading-tight tracking-wide">Terminal de Asistencia</h2>
            <p className="text-xs text-slate-400">Escaneo Seguro con QR Dinámico</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="text-xs text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            title="Volver al Menú Principal"
          >
            <Home className="w-3.5 h-3.5 text-blue-400" />
            <span>Menú Principal</span>
          </Link>

          <button
            onClick={toggleFullscreen}
            className="text-xs text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            title="Pantalla Completa"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Salir</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Pantalla Completa</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Reloj Gigante Principal */}
      {/* Reloj Gigante Principal */}
      <div className="flex flex-col items-center justify-center my-6 z-10 w-full">
        <p className="text-[5rem] md:text-[8rem] font-bold text-white tracking-tighter drop-shadow-2xl leading-none font-sans">
          {currentTime.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
          <span className="text-[2.5rem] md:text-[4rem] text-indigo-400 font-medium ml-2 tracking-normal">
            {currentTime.toLocaleTimeString('es-PE', { second: '2-digit' })}
          </span>
        </p>
        <p className="text-indigo-200 text-lg md:text-2xl capitalize mt-3 font-medium tracking-wide">
          {currentTime.toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* QR Container */}
      <div className="relative mt-4">
        {/* Radar Pulse Effect */}
        <div className="absolute -inset-8 bg-indigo-500/20 rounded-full blur-2xl animate-pulse"></div>
        <div className={`absolute -inset-1 rounded-[2rem] bg-gradient-to-br from-indigo-500 to-blue-500 opacity-30 blur-lg transition-opacity duration-500 ${timeLeft <= 3 ? 'animate-pulse opacity-80 from-red-500 to-orange-500' : ''}`}></div>
        
        <div className="relative bg-white/10 backdrop-blur-2xl rounded-[2rem] p-6 shadow-2xl border border-white/20">
          <div className="bg-white rounded-2xl p-4 shadow-inner">
            {error ? (
              <div className="w-64 h-64 md:w-80 md:h-80 flex flex-col items-center justify-center bg-slate-50 rounded-xl">
                <svg className="w-16 h-16 text-red-500 mb-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-slate-800 text-lg font-bold">Error de Conexión</p>
                <p className="text-slate-500 text-sm mt-1">Reconectando al servidor...</p>
              </div>
            ) : !totpCode ? (
              <div className="w-64 h-64 md:w-80 md:h-80 flex flex-col items-center justify-center bg-slate-50 rounded-xl">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <QRCodeSVG 
                value={totpCode} 
                size={300} 
                level="H" 
                includeMargin={false}
                fgColor="#0f172a" 
              />
            )}
          </div>
        </div>
      </div>

      {/* Timer bar */}
      <div className="w-80 max-w-full mt-10 z-10">
        <div className="flex justify-between items-center mb-2">
          <span className="text-indigo-200 text-sm font-medium tracking-wide uppercase">Tiempo restante del QR</span>
          <span className={`text-xl font-bold ${timeLeft <= 3 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
            {timeLeft}s
          </span>
        </div>
        <div className="w-full bg-slate-800/80 backdrop-blur-sm rounded-full h-2.5 overflow-hidden ring-1 ring-white/10">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ease-linear ${timeLeft <= 3 ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-indigo-500 to-blue-500'}`}
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Instrucción inferior */}
      <div className="text-center z-10 pb-4 mt-6">
        <p className="text-indigo-200 text-base font-medium tracking-wide">
          Abre la app en tu celular y escanea este código para registrar tu asistencia
        </p>
      </div>
    </div>
  );
};

export default Kiosk;
