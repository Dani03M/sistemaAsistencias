import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import getFingerprint from '../utils/fingerprint';
import { 
  QrCode, 
  History, 
  LogOut, 
  Clock, 
  User, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  ShieldCheck, 
  Calendar, 
  Sparkles,
  RefreshCw,
  WifiOff
} from 'lucide-react';

const API_URL = '/api';
const SESSION_MINUTES = 30;

export default function Scanner() {
  const [activeTab, setActiveTab] = useState('scan'); // 'scan' | 'history'
  const [profile, setProfile] = useState(null);
  const [todayStatus, setTodayStatus] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [minutesLeft, setMinutesLeft] = useState(SESSION_MINUTES);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  
  const navigate = useNavigate();
  const scannerRef = useRef(null);

  // Sincronizar cooldown cuando todayStatus se actualice
  useEffect(() => {
    if (todayStatus?.cooldown_seconds_remaining > 0) {
      setCooldownRemaining(todayStatus.cooldown_seconds_remaining);
    } else {
      setCooldownRemaining(0);
    }
  }, [todayStatus]);

  // Intervalo de decremento del cooldown por segundo
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  // Logout
  const handleLogout = useCallback(() => {
    localStorage.removeItem('access_token');
    sessionStorage.clear();
    window.location.replace('/login');
  }, []);

  // Temporizador de sesión (JWT)
  useEffect(() => {
    const checkExpiry = () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        navigate('/login');
        return;
      }
      try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        const expMs = payload.exp * 1000;
        const remaining = expMs - Date.now();
        if (remaining <= 0) {
          handleLogout();
        } else {
          setMinutesLeft(Math.ceil(remaining / 60000));
        }
      } catch {
        handleLogout();
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 15000);
    return () => clearInterval(interval);
  }, [handleLogout, navigate]);

  // Cargar perfil y estado de hoy
  const fetchEmployeeData = useCallback(async () => {
    try {
      const [meRes, statusRes] = await Promise.all([
        axios.get(`${API_URL}/employee/me`),
        axios.get(`${API_URL}/employee/today-status`)
      ]);
      setProfile(meRes.data);
      setTodayStatus(statusRes.data);
    } catch (err) {
      console.error('Error cargando datos del empleado:', err);
      if (err.response?.status === 401) {
        handleLogout();
      }
    }
  }, [handleLogout]);

  // Cargar historial
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await axios.get(`${API_URL}/employee/my-attendance`);
      setAttendanceHistory(res.data || []);
    } catch (err) {
      console.error('Error cargando historial:', err);
      if (err.response?.status === 401) {
        handleLogout();
      }
    } finally {
      setHistoryLoading(false);
    }
  }, [handleLogout]);

  useEffect(() => {
    fetchEmployeeData();
  }, [fetchEmployeeData]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  const shouldRunCamera = activeTab === 'scan' && !todayStatus?.is_shift_completed && cooldownRemaining === 0;

  // Iniciar / Detener cámara según pestaña y estado de cooldown
  useEffect(() => {
    let html5QrCode = null;
    let isMounted = true;
    let isScanningLocal = false;

    const startCamera = async () => {
      if (!shouldRunCamera) return;

      try {
        const el = document.getElementById('qr-reader');
        if (!el) return;

        html5QrCode = new Html5Qrcode('qr-reader');
        scannerRef.current = html5QrCode;

        const cameras = await Html5Qrcode.getCameras();
        if (!isMounted) return;

        if (cameras && cameras.length > 0) {
          await html5QrCode.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
            async (decodedText) => {
              if (isScanningLocal) return;
              isScanningLocal = true;
              setIsProcessing(true);
              setScanResult(null);
              setError(null);

              try {
                html5QrCode.pause(true);
              } catch (e) {
                console.warn(e);
              }

              try {
                const deviceFingerprint = await getFingerprint();
                const response = await axios.post(`${API_URL}/attendance/scan`, {
                  totp_code: decodedText,
                  device_fingerprint: deviceFingerprint
                });
                setScanResult(response.data);
                setIsProcessing(false);

                // Detener cámara de inmediato para impedir cualquier re-escaneo involuntario
                try {
                  if (html5QrCode && html5QrCode.isScanning) {
                    await html5QrCode.stop();
                    html5QrCode.clear();
                  }
                } catch (e) {
                  console.warn(e);
                }

                // Actualizar estado de hoy (activará cooldown o jornada finalizada)
                await fetchEmployeeData();
              } catch (err) {
                console.error(err);
                setScanResult(null);
                setIsProcessing(false);
                const detail = err.response?.data?.detail || 'Error al procesar la asistencia';
                setError(detail);

                // Si fue error de cooldown o jornada finalizada, actualizar estado y no reanudar
                if (detail.includes('esperar') || detail.includes('finalizada') || detail.includes('Jornada')) {
                  fetchEmployeeData();
                } else {
                  // Si fue error temporal (ej. QR no enfocado o expirado), permitir reintento tras 3 segundos
                  setTimeout(() => {
                    isScanningLocal = false;
                    try {
                      if (scannerRef.current && scannerRef.current.isScanning) {
                        scannerRef.current.resume();
                      }
                    } catch (e) {
                      console.warn(e);
                    }
                  }, 3000);
                }
              }
            },
            () => {} // Frame error ignore
          );
          
          if (!isMounted && html5QrCode.isScanning) {
            await html5QrCode.stop();
            html5QrCode.clear();
          }
        }
      } catch (err) {
        if (isMounted) setError('No se pudo iniciar la cámara.');
      }
    };

    if (shouldRunCamera) {
      startCamera();
    }

    return () => {
      isMounted = false;
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error);
      }
    };
  }, [shouldRunCamera, fetchEmployeeData]);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col items-center pb-20">
      {/* Barra superior de perfil */}
      <header className="w-full bg-[#0B1120]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-30 px-4 py-4 shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold text-lg shadow-inner">
              {profile?.name ? profile.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight leading-tight">
                {profile?.name || 'Empleado'}
              </h1>
              <p className="text-[11px] text-indigo-200/70 mt-0.5">DNI: {profile?.dni || '...'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full ${minutesLeft <= 5 ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse' : 'bg-slate-800/80 text-slate-400 border border-white/5'}`}>
              {minutesLeft} min
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center w-9 h-9 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-full transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Contenedor principal móvil */}
      <main className="w-full max-w-md p-4 space-y-4">
        {/* Tarjeta de Estado de Hoy */}
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700/70 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              Hoy ({todayStatus?.today_date || '...'})
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
              todayStatus?.is_currently_working
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : todayStatus?.has_exit
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
            }`}>
              {todayStatus?.is_currently_working 
                ? 'En Jornada' 
                : todayStatus?.has_exit 
                ? 'Jornada Finalizada' 
                : 'Pendiente de Entrada'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-700/50">
            <div>
              <p className="text-[11px] text-slate-400">Hora Entrada</p>
              <p className="text-base font-bold text-white">
                {todayStatus?.entry_time ? `${todayStatus.entry_time}` : '--:--'}
              </p>
              {todayStatus?.entry_status && (
                <span className={`text-[10px] font-semibold ${todayStatus.entry_status === 'PUNTUAL' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {todayStatus.entry_status === 'PUNTUAL' ? 'Puntual' : `Tardanza (+${todayStatus.tardiness_minutes}m)`}
                </span>
              )}
            </div>

            <div>
              <p className="text-[11px] text-slate-400">Hora Salida</p>
              <p className="text-base font-bold text-white">
                {todayStatus?.exit_time ? `${todayStatus.exit_time}` : '--:--'}
              </p>
              {todayStatus?.total_hours_today > 0 && (
                <span className="text-[10px] text-blue-400 font-semibold">
                  {todayStatus.total_hours_today} hrs laboradas
                </span>
              )}
            </div>
          </div>

          {profile?.work_start_time && (
            <div className="mt-3 pt-2.5 border-t border-slate-700/40 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Turno: {profile.work_start_time} - {profile.work_end_time}
              </span>
              <span>Tol: {profile.tolerance_minutes}m</span>
            </div>
          )}
        </div>

        {/* PESTAÑA 1: ESCÁNER */}
        {activeTab === 'scan' && (
          <div className="space-y-4">
            {/* Caso 1: Jornada de hoy completada (Entrada y Salida registradas) */}
            {todayStatus?.is_shift_completed ? (
              <div className="bg-slate-800/90 border border-emerald-500/40 rounded-2xl p-6 text-center space-y-4 shadow-xl animate-fade-in">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">¡Jornada de Hoy Finalizada!</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Has completado tus registros de Entrada y Salida el día de hoy.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 bg-slate-900/70 rounded-xl p-3 border border-slate-700/40 text-left">
                  <div>
                    <span className="text-[11px] text-slate-400">Entrada</span>
                    <p className="text-sm font-bold text-white">{todayStatus.entry_time}</p>
                    <span className="text-[10px] text-emerald-400 font-medium">{todayStatus.entry_status}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Salida</span>
                    <p className="text-sm font-bold text-white">{todayStatus.exit_time}</p>
                    <span className="text-[10px] text-blue-400 font-medium">{todayStatus.total_hours_today} hrs laboradas</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  El escáner estará disponible nuevamente para tu próxima jornada laboral.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  Ver Mi Historial de Asistencias
                </button>
              </div>
            ) : cooldownRemaining > 0 ? (
              /* Caso 2: Cooldown activo (Anti-Doble Marcación Involuntaria) */
              <div className="space-y-4 animate-fade-in w-full max-w-sm mx-auto">
                {scanResult ? (
                  <div className={`p-8 rounded-[2rem] border text-center shadow-2xl relative overflow-hidden ${
                    scanResult.attendance_status === 'TARDANZA'
                      ? 'bg-amber-500/10 border-amber-500/30 backdrop-blur-xl'
                      : scanResult.record_type === 'SALIDA'
                      ? 'bg-blue-500/10 border-blue-500/30 backdrop-blur-xl'
                      : 'bg-emerald-500/10 border-emerald-500/30 backdrop-blur-xl'
                  }`}>
                    {/* Animated background glow */}
                    <div className={`absolute -inset-12 blur-3xl opacity-20 animate-pulse ${
                      scanResult.attendance_status === 'TARDANZA' ? 'bg-amber-500' : scanResult.record_type === 'SALIDA' ? 'bg-blue-500' : 'bg-emerald-500'
                    }`}></div>
                    
                    <div className="relative z-10">
                      <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-5 border-4 shadow-lg ${
                        scanResult.attendance_status === 'TARDANZA'
                          ? 'bg-amber-900/50 border-amber-500/50 text-amber-400'
                          : scanResult.record_type === 'SALIDA'
                          ? 'bg-blue-900/50 border-blue-500/50 text-blue-400'
                          : 'bg-emerald-900/50 border-emerald-500/50 text-emerald-400'
                      }`}>
                        {scanResult.attendance_status === 'TARDANZA' ? <AlertTriangle className="w-10 h-10" /> : <CheckCircle className="w-10 h-10" />}
                      </div>
                      <h3 className={`text-2xl font-black tracking-tight mb-2 ${
                        scanResult.attendance_status === 'TARDANZA' ? 'text-amber-300' : scanResult.record_type === 'SALIDA' ? 'text-blue-300' : 'text-emerald-300'
                      }`}>
                        {scanResult.record_type === 'SALIDA' ? 'Salida Registrada' : '¡Entrada Registrada!'}
                      </h3>
                      <p className="text-slate-300 text-sm font-medium">{scanResult.message}</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 rounded-[2rem] p-8 text-center space-y-4 shadow-2xl">
                    <div className="w-16 h-16 bg-slate-900/50 text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-500/20 shadow-inner">
                      <Clock className="w-8 h-8 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-white tracking-tight">Cámara en Pausa</h4>
                      <p className="text-xs text-slate-400 mt-2 max-w-xs mx-auto leading-relaxed">
                        Tu marcación ya fue registrada. Para evitar registros dobles por accidente, la cámara está pausada.
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 px-5 py-3 bg-slate-900/80 rounded-xl border border-slate-700 font-mono text-amber-400 text-lg font-bold shadow-inner w-full justify-center">
                      <span className="text-xs text-slate-500 uppercase tracking-wider font-sans font-medium mr-2">Espera:</span>
                      <span>
                        {Math.floor(cooldownRemaining / 60)}:{String(cooldownRemaining % 60).padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Caso 3: Cámara lista para escanear */
              <div className="relative max-w-sm mx-auto w-full animate-fade-in">
                {/* Decorative border / scanning frame */}
                <div className="absolute -inset-2 bg-indigo-500/20 rounded-[2rem] blur-xl animate-pulse"></div>
                <div className="absolute -inset-0.5 bg-gradient-to-tr from-indigo-500 to-blue-400 rounded-[2rem] opacity-30"></div>
                
                <div className="relative bg-[#070b14] rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl">
                  {/* Overlay text */}
                  <div className="absolute top-5 left-0 right-0 z-10 flex justify-center">
                    <span className="bg-black/60 backdrop-blur-md text-white text-xs font-semibold px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 shadow-lg">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      Enfoca el código QR del Kiosco
                    </span>
                  </div>
                  
                  {isProcessing ? (
                    <div className="h-80 flex flex-col items-center justify-center bg-[#070b14]/90 text-center p-6 backdrop-blur-sm">
                      <div className="w-14 h-14 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                      <p className="text-white font-bold text-lg">Procesando código...</p>
                      <p className="text-xs text-indigo-300 mt-2">Registrando asistencia de forma segura</p>
                    </div>
                  ) : (
                    <div id="qr-reader" className="w-full min-h-[320px] [&>video]:object-cover [&>video]:w-full [&>video]:h-full"></div>
                  )}
                </div>

                {error && !isProcessing && (
                  <div className={`p-4 rounded-xl border flex items-start gap-3 mt-4 ${
                    error.toLowerCase().includes('wi-fi') || error.toLowerCase().includes('red no autorizada')
                      ? 'bg-amber-950/50 border-amber-500/60 text-amber-200'
                      : 'bg-red-950/40 border-red-500/50 text-red-200'
                  }`}>
                    {error.toLowerCase().includes('wi-fi') || error.toLowerCase().includes('red no autorizada') ? (
                      <WifiOff className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h3 className="font-bold text-sm">
                        {error.toLowerCase().includes('wi-fi') || error.toLowerCase().includes('red no autorizada')
                          ? 'Conexión a Wi-Fi requerida'
                          : 'No se pudo marcar'}
                      </h3>
                      <p className="text-xs mt-0.5 opacity-90">{error}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 2: MIS ASISTENCIAS */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-indigo-500/20 flex items-center justify-center">
                  <History className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                Mis Marcaciones Recientes
              </h2>
              <button
                onClick={fetchHistory}
                disabled={historyLoading}
                className="text-[11px] font-medium text-indigo-300 hover:text-white flex items-center gap-1.5 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${historyLoading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>

            {historyLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-indigo-300/50">
                <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-3"></div>
                <span className="text-xs font-medium">Cargando tu historial...</span>
              </div>
            ) : attendanceHistory.length === 0 ? (
              <div className="bg-[#0B1120]/60 rounded-3xl p-10 text-center border border-white/5 shadow-inner mt-4">
                <Calendar className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-medium">Aún no tienes asistencias registradas.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {attendanceHistory.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#0B1120] rounded-2xl p-4 border border-white/5 flex items-center justify-between shadow-lg relative overflow-hidden group hover:border-indigo-500/30 transition-colors"
                  >
                    {/* Decorative glow side */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                      item.record_type === 'ENTRADA' ? (item.status === 'TARDANZA' ? 'bg-amber-500/50' : 'bg-emerald-500/50') : 'bg-blue-500/50'
                    }`}></div>

                    <div className="flex items-center gap-4 pl-2">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] tracking-wider shadow-inner ${
                        item.record_type === 'ENTRADA'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}>
                        {item.record_type === 'ENTRADA' ? 'ENT' : 'SAL'}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-200">{item.date}</p>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          Hora: <span className="text-slate-300 font-bold font-mono">{item.time}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      {item.record_type === 'ENTRADA' ? (
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          item.status === 'TARDANZA'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {item.status === 'TARDANZA' ? `Tardanza (+${item.tardiness_minutes}m)` : 'Puntual'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {item.hours_worked !== null && item.hours_worked !== undefined 
                            ? `${item.hours_worked} hrs` 
                            : 'Completada'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Barra de navegación inferior móvil (Bottom Navigation) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0B1120]/95 backdrop-blur-xl border-t border-white/5 z-30 px-6 py-2 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
        <div className="max-w-md mx-auto flex items-center justify-around">
          <button
            onClick={() => setActiveTab('scan')}
            className={`flex flex-col items-center py-2 px-6 rounded-2xl transition-all duration-300 ${
              activeTab === 'scan' ? 'bg-indigo-500/10 text-indigo-400 font-bold shadow-inner' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
            }`}
          >
            <QrCode className={`w-6 h-6 mb-1 transition-transform ${activeTab === 'scan' ? 'scale-110' : ''}`} />
            <span className="text-[11px] tracking-wide">Marcar</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center py-2 px-6 rounded-2xl transition-all duration-300 ${
              activeTab === 'history' ? 'bg-indigo-500/10 text-indigo-400 font-bold shadow-inner' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
            }`}
          >
            <History className={`w-6 h-6 mb-1 transition-transform ${activeTab === 'history' ? 'scale-110' : ''}`} />
            <span className="text-[11px] tracking-wide">Mi Historial</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
