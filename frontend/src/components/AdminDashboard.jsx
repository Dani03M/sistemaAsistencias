import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Users, 
  UserCheck, 
  UserX, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import AdminLayout from './AdminLayout';

const API_URL = '/api/admin';

const AdminDashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    punctualToday: 0,
    tardyToday: 0,
    pendingDevices: 0,
    recentRecords: []
  });
  
  const [weeklyData, setWeeklyData] = useState([]);
  const [weeklyDetailData, setWeeklyDetailData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchDashboardData = async () => {
    try {
      const [dashRes, weeklyRes, detailRes] = await Promise.all([
        axios.get(`${API_URL}/dashboard`),
        axios.get(`${API_URL}/reports/weekly`),
        axios.get(`${API_URL}/reports/weekly-detail`)
      ]);
      
      setDashboardData({
        totalEmployees: dashRes.data.total_employees || 0,
        presentToday: dashRes.data.present_today || 0,
        absentToday: dashRes.data.absent_today || 0,
        punctualToday: dashRes.data.punctual_today || 0,
        tardyToday: dashRes.data.tardy_today || 0,
        pendingDevices: dashRes.data.pending_devices || 0,
        recentRecords: dashRes.data.recent_records || []
      });
      
      setWeeklyData(weeklyRes.data || []);
      setWeeklyDetailData(detailRes.data || []);
      setLoading(false);
      setErrorMsg(null);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setErrorMsg('No se pudo cargar la información del panel. Reintentando...');
      setLoading(false);
    }
  };

  const parseSafeDate = (isoString) => {
    if (!isoString) return null;
    const hasTimezone = isoString.endsWith('Z') || isoString.includes('+') || (isoString.lastIndexOf('-') > 10);
    return new Date(hasTimezone ? isoString : isoString + 'Z');
  };

  useEffect(() => {
    fetchDashboardData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const kpiCards = [
    {
      title: 'Total Empleados',
      value: dashboardData.totalEmployees,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Presentes Hoy',
      value: dashboardData.presentToday,
      icon: UserCheck,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100'
    },
    {
      title: 'Puntuales Hoy',
      value: dashboardData.punctualToday,
      icon: CheckCircle2,
      color: 'text-teal-600',
      bgColor: 'bg-teal-100'
    },
    {
      title: 'Tardanzas Hoy',
      value: dashboardData.tardyToday,
      icon: AlertTriangle,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100'
    },
    {
      title: 'Ausentes Hoy',
      value: dashboardData.absentToday,
      icon: UserX,
      color: 'text-red-600',
      bgColor: 'bg-red-100'
    },
    {
      title: 'Dispositivos Pendientes',
      value: dashboardData.pendingDevices,
      icon: ShieldAlert,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    }
  ];

  return (
    <AdminLayout title="Panel de Control">
      <div className="space-y-6">
        {errorMsg && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200 text-sm">
            {errorMsg}
          </div>
        )}

        {/* KPI Cards Grid (6 tarjetas) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {kpiCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <div 
                key={index} 
                className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md border border-slate-100 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-500">{card.title}</span>
                  <div className={`p-2 rounded-lg ${card.bgColor} ${card.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {loading ? '...' : card.value}
                </p>
              </div>
            );
          })}
        </div>

        {/* Charts Section - 2 gráficos lado a lado */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Gráfico 1: Pie Chart del día */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Resumen de Hoy</h3>
            <div className="h-64 w-full">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400">Cargando...</div>
              ) : (dashboardData.presentToday === 0 && dashboardData.absentToday === 0) ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">Sin datos del día de hoy</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Puntuales', value: dashboardData.punctualToday },
                        { name: 'Tardanzas', value: dashboardData.tardyToday },
                        { name: 'Ausentes', value: dashboardData.absentToday },
                      ].filter(d => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                      label={false}
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Gráfico 2: Puntualidad vs Tardanzas (últimos 7 días) */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Puntualidad vs Tardanzas (7 días)</h3>
            <div className="h-64 w-full">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400">Cargando...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyDetailData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="day" stroke="#64748b" tickLine={false} fontSize={12} />
                    <YAxis stroke="#64748b" tickLine={false} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#ffffff', 
                        borderRadius: '8px', 
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        border: '1px solid #e2e8f0' 
                      }} 
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Bar dataKey="puntuales" fill="#10b981" name="Puntuales" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="tardanzas" fill="#f59e0b" name="Tardanzas" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Gráfico 3: Entradas y Salidas semanal (ya existente) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Entradas y Salidas (Últimos 7 Días)</h3>
          <div className="h-72 w-full">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400">
                Cargando datos...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="day" stroke="#64748b" tickLine={false} />
                  <YAxis stroke="#64748b" tickLine={false} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#ffffff', 
                      borderRadius: '8px', 
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      border: '1px solid #e2e8f0' 
                    }} 
                  />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar dataKey="entradas" fill="#3b82f6" name="Entradas" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="salidas" fill="#10b981" name="Salidas" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent Activity Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">Actividad Reciente</h3>
            <span className="text-xs text-slate-400 font-mono">Últimas 10 marcaciones</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="px-3 sm:px-6 py-3 font-medium">Empleado</th>
                  <th className="px-3 sm:px-6 py-3 font-medium">Tipo</th>
                  <th className="px-3 sm:px-6 py-3 font-medium">Puntualidad</th>
                  <th className="px-3 sm:px-6 py-3 font-medium">Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-slate-400">
                      Cargando registros...
                    </td>
                  </tr>
                ) : dashboardData.recentRecords.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-slate-400">
                      No hay actividad reciente.
                    </td>
                  </tr>
                ) : (
                  dashboardData.recentRecords.map((record, index) => (
                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">{record.employee_name}</div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          record.record_type === 'ENTRADA' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {record.record_type}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        {record.status === 'TARDANZA' ? (
                          <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            Tardanza (+{record.tardiness_minutes}m)
                          </span>
                        ) : record.status === 'PUNTUAL' ? (
                          <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            Puntual
                          </span>
                        ) : (
                          <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                            Completada
                          </span>
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                        {record.timestamp ? parseSafeDate(record.timestamp).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
