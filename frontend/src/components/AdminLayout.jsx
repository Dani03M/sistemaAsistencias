import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Smartphone, 
  Users, 
  CalendarDays,
  Menu, 
  LogOut
} from 'lucide-react';

const AdminLayout = ({ title, children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navItems = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/attendance', icon: ClipboardList, label: 'Asistencias' },
    { to: '/admin/justifications', icon: CalendarDays, label: 'Permisos' },
    { to: '/admin/devices', icon: Smartphone, label: 'Dispositivos' },
    { to: '/admin/employees', icon: Users, label: 'Empleados' }
  ];

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    sessionStorage.clear();
    window.location.replace('/admin');
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-[#0B1120] border-r border-slate-800 text-slate-300 transform transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none lg:relative lg:translate-x-0 flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-center h-20 border-b border-slate-800/60 px-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-[17px] font-bold text-white tracking-tight">Asistencia<span className="text-blue-500">Pro</span></h1>
          </div>
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/admin/dashboard'}
                onClick={() => setIsSidebarOpen(false)}
                className={({ isActive }) => 
                  `flex items-center px-4 py-3 rounded-xl transition-all duration-300 group relative ${
                    isActive 
                      ? 'bg-blue-600/10 text-blue-400 font-semibold shadow-[inset_0px_1px_1px_rgba(255,255,255,0.02)]' 
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full shadow-[0_0_12px_rgba(99,102,241,0.6)]" />
                    )}
                    <Icon className={`w-5 h-5 mr-3 flex-shrink-0 transition-transform duration-300 ${isActive ? 'scale-110 text-blue-400' : 'group-hover:scale-110 text-slate-500 group-hover:text-slate-300'}`} />
                    <span className="text-sm tracking-wide">{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-5 border-t border-slate-800/60 bg-[#070b14]">
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/20 border border-transparent rounded-xl transition-all duration-300 w-full px-4 py-2.5 text-sm font-medium group"
          >
            <LogOut className="w-4 h-4 mr-2 text-slate-500 group-hover:text-red-400 transition-colors" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50/50">
        <header className="bg-white border-b border-slate-200 z-10">
          <div className="flex items-center justify-between px-4 h-16 sm:h-20 sm:px-8">
            <div className="flex items-center min-w-0 mr-2">
              <button
                onClick={toggleSidebar}
                className="text-slate-500 hover:text-slate-900 focus:outline-none lg:hidden mr-4 transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
              <h2 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight truncate">{title}</h2>
            </div>

            <div className="flex items-center gap-4">
              <span className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                Administrador (RRHH)
              </span>
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-600/20 ring-2 ring-white">
                A
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
