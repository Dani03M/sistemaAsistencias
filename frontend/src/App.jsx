import React from 'react';

import axios from 'axios';

axios.interceptors.request.use((config) => {
  // Solo aplicar token de admin a las rutas de /api/admin (excepto logins)
  if (config.url.includes('/api/admin') && !config.url.includes('/api/admin/login') && !config.url.includes('/api/admin/google-login')) {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } else if (config.url.includes('/api/employee') || config.url.includes('/api/attendance')) {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (error.config?.url?.includes('/api/admin')) {
        localStorage.removeItem('admin_token');
        sessionStorage.clear();
        if (!window.location.pathname.includes('/admin')) return Promise.reject(error);
        window.location.replace('/admin');
      } else if (error.config?.url?.includes('/api/employee') || error.config?.url?.includes('/api/attendance')) {
        localStorage.removeItem('access_token');
        sessionStorage.clear();
        if (window.location.pathname !== '/login') {
          window.location.replace('/login');
        }
      }
    }

    // Parsear errores de validación de FastAPI (422 Unprocessable Entity) globalmente
    if (error.response?.status === 422 && error.response?.data?.detail) {
      const detail = error.response.data.detail;
      if (Array.isArray(detail)) {
        error.response.data.detail = detail.map(e => e.msg).join(' | ');
      }
    }

    return Promise.reject(error);
  }
);

import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import Kiosk from './components/Kiosk';
import Scanner from './components/Scanner';
import Login from './components/Login';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import AdminDevices from './components/AdminDevices';
import AdminAttendance from './components/AdminAttendance';
import AdminEmployees from './components/AdminEmployees';
import AdminJustifications from './components/AdminJustifications';
import ErrorBoundary from './components/ErrorBoundary';

// Componente para proteger las rutas de admin (Anti-retroceso y Anti-BFCache)
const AdminRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = React.useState(!!localStorage.getItem('admin_token'));

  React.useEffect(() => {
    const handleAuthCheck = () => {
      setIsAuthenticated(!!localStorage.getItem('admin_token'));
    };

    window.addEventListener('pageshow', handleAuthCheck);
    window.addEventListener('popstate', handleAuthCheck);

    return () => {
      window.removeEventListener('pageshow', handleAuthCheck);
      window.removeEventListener('popstate', handleAuthCheck);
    };
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }
  return children;
};

// Componente para proteger la ruta del escáner (empleado autenticado)
const EmployeeRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = React.useState(!!localStorage.getItem('access_token'));

  React.useEffect(() => {
    const handleAuthCheck = () => {
      setIsAuthenticated(!!localStorage.getItem('access_token'));
    };

    window.addEventListener('pageshow', handleAuthCheck);
    window.addEventListener('popstate', handleAuthCheck);

    return () => {
      window.removeEventListener('pageshow', handleAuthCheck);
      window.removeEventListener('popstate', handleAuthCheck);
    };
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
        <Route path="/kiosk" element={<Kiosk />} />
        <Route path="/scanner" element={<EmployeeRoute><Scanner /></EmployeeRoute>} />
        <Route path="/login" element={<Login />} />
        
        {/* Rutas de Admin */}
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/devices" element={<AdminRoute><AdminDevices /></AdminRoute>} />
        <Route path="/admin/attendance" element={<AdminRoute><AdminAttendance /></AdminRoute>} />
        <Route path="/admin/employees" element={<AdminRoute><AdminEmployees /></AdminRoute>} />
        <Route path="/admin/justifications" element={<AdminRoute><AdminJustifications /></AdminRoute>} />

        {/* Menú principal */}
        <Route path="/" element={
          <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background decorations */}
            <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] bg-blue-600/8 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="max-w-lg w-full relative z-10">
              {/* Logo */}
              <div className="text-center mb-12">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-500/10 rounded-3xl mb-5 shadow-inner border border-indigo-500/20 rotate-3">
                  <svg className="w-10 h-10 text-indigo-400 -rotate-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Sistema de Asistencia</h1>
                <p className="text-indigo-200/60 mt-3 font-medium text-sm">Selecciona el módulo que deseas abrir</p>
              </div>

              {/* Cards */}
              <div className="space-y-4">
                <Link to="/kiosk" className="group flex items-center gap-4 bg-[#0B1120]/60 hover:bg-[#0B1120] backdrop-blur-xl border border-white/5 hover:border-indigo-500/30 rounded-2xl p-5 transition-all duration-300 shadow-lg hover:shadow-indigo-500/5">
                  <div className="flex-shrink-0 w-12 h-12 bg-indigo-500/10 group-hover:bg-indigo-500/20 rounded-xl flex items-center justify-center transition-colors border border-indigo-500/10">
                    <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm tracking-tight">Pantalla Kiosco</p>
                    <p className="text-slate-500 text-xs mt-0.5">Monitor de la empresa con QR dinámico</p>
                  </div>
                  <svg className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 transition-colors ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </Link>

                <Link to="/login" className="group flex items-center gap-4 bg-[#0B1120]/60 hover:bg-[#0B1120] backdrop-blur-xl border border-white/5 hover:border-emerald-500/30 rounded-2xl p-5 transition-all duration-300 shadow-lg hover:shadow-emerald-500/5">
                  <div className="flex-shrink-0 w-12 h-12 bg-emerald-500/10 group-hover:bg-emerald-500/20 rounded-xl flex items-center justify-center transition-colors border border-emerald-500/10">
                    <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm tracking-tight">Portal del Empleado</p>
                    <p className="text-slate-500 text-xs mt-0.5">Ingresa y marca tu asistencia</p>
                  </div>
                  <svg className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 transition-colors ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </Link>

                <Link to="/admin" className="group flex items-center gap-4 bg-[#0B1120]/60 hover:bg-[#0B1120] backdrop-blur-xl border border-white/5 hover:border-rose-500/30 rounded-2xl p-5 transition-all duration-300 shadow-lg hover:shadow-rose-500/5">
                  <div className="flex-shrink-0 w-12 h-12 bg-rose-500/10 group-hover:bg-rose-500/20 rounded-xl flex items-center justify-center transition-colors border border-rose-500/10">
                    <svg className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm tracking-tight">Panel de Administración</p>
                    <p className="text-slate-500 text-xs mt-0.5">Dashboard, reportes, empleados y dispositivos</p>
                  </div>
                  <svg className="w-5 h-5 text-slate-600 group-hover:text-rose-400 transition-colors ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </Link>
              </div>

              <p className="text-center text-slate-700 text-[11px] mt-10 font-medium tracking-wide">v1.0.0 · Sistema de Control de Asistencia</p>
            </div>
          </div>
        } />
        
        {/* Ruta 404 / Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  </ErrorBoundary>
);
}

export default App;
