import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Loader2, CalendarDays, FileText, Briefcase, HeartPulse, Palmtree, Star, X } from 'lucide-react';
import AdminLayout from './AdminLayout';

const API_URL = '/api/admin';

const TYPE_CONFIG = {
  VACACIONES:      { label: 'Vacaciones',       color: 'bg-blue-50 border-blue-200 text-blue-700',    icon: Palmtree },
  DESCANSO_MEDICO: { label: 'Descanso Médico',  color: 'bg-rose-50 border-rose-200 text-rose-700',    icon: HeartPulse },
  PERMISO:         { label: 'Permiso Personal',  color: 'bg-amber-50 border-amber-200 text-amber-700', icon: Briefcase },
  FERIADO:         { label: 'Feriado',           color: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: Star },
  OTRO:            { label: 'Otro',              color: 'bg-slate-50 border-slate-200 text-slate-700', icon: FileText },
};

export default function AdminJustifications() {
  const [justifications, setJustifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [form, setForm] = useState({
    employee_id: '',
    justification_type: 'VACACIONES',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    reason: ''
  });

  const fetchJustifications = async () => {
    try {
      const res = await axios.get(`${API_URL}/justifications`);
      setJustifications(res.data);
    } catch (e) {
      console.error('Error fetching justifications:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API_URL}/employees`);
      setEmployees(res.data.filter(e => e.is_active));
    } catch (e) {
      console.error('Error fetching employees:', e);
    }
  };

  useEffect(() => {
    fetchJustifications();
  }, []);

  const openModal = () => {
    setErrorMsg('');
    setModalOpen(true);
    if (employees.length === 0) fetchEmployees();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    try {
      await axios.post(`${API_URL}/justifications`, {
        employee_id: parseInt(form.employee_id),
        justification_type: form.justification_type,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason || null
      });
      setModalOpen(false);
      setForm({ ...form, employee_id: '', reason: '' });
      fetchJustifications();
    } catch (error) {
      setErrorMsg(error.response?.data?.detail || 'Error al registrar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_URL}/justifications/${id}`);
      setDeleteConfirm(null);
      fetchJustifications();
    } catch (e) {
      alert('Error al eliminar');
    }
  };

  return (
    <AdminLayout title="Permisos y Justificaciones">
      <div className="space-y-6">
        {/* Header con botón */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <p className="text-sm text-slate-500">
            Registra vacaciones, descansos médicos, permisos y feriados para justificar las ausencias de tus empleados.
          </p>
          <button
            onClick={openModal}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-blue-700 flex items-center w-full sm:w-auto justify-center gap-2 shadow-sm flex-shrink-0 sm:ml-4"
          >
            <Plus className="w-4 h-4" />
            Nueva Justificación
          </button>
        </div>

        {/* Tabla de Justificaciones */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Empleado</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Desde</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Hasta</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Días</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Motivo</th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Cargando...
                    </td>
                  </tr>
                ) : justifications.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                          <CalendarDays className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-base font-medium text-slate-600">No hay justificaciones registradas</p>
                        <p className="text-sm text-slate-400">Haz clic en "Nueva Justificación" para registrar una.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  justifications.map((j) => {
                    const typeConf = TYPE_CONFIG[j.justification_type] || TYPE_CONFIG.OTRO;
                    const TypeIcon = typeConf.icon;
                    return (
                      <tr key={j.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900">{j.employee_name}</div>
                          <div className="text-xs text-slate-400">{j.employee_dni}</div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${typeConf.color}`}>
                            <TypeIcon className="w-3.5 h-3.5" />
                            {j.type_label}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-slate-600">{j.start_date}</td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-slate-600">{j.end_date}</td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-700">{j.days}</td>
                        <td className="px-3 sm:px-6 py-4 text-sm text-slate-500 max-w-[200px] truncate">{j.reason || '-'}</td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right">
                          {deleteConfirm === j.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => handleDelete(j.id)} className="text-xs bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700">Eliminar</button>
                              <button onClick={() => setDeleteConfirm(null)} className="text-xs bg-slate-200 text-slate-700 px-3 py-1 rounded-md hover:bg-slate-300">No</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirm(j.id)} className="text-slate-400 hover:text-red-600 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">Nueva Justificación</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            

              <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {errorMsg && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg border border-red-200 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    {errorMsg}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Empleado</label>
                  <select 
                    required
                    value={form.employee_id}
                    onChange={e => setForm({...form, employee_id: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Seleccione un empleado...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.dni})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                  <select 
                    required
                    value={form.justification_type}
                    onChange={e => setForm({...form, justification_type: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="VACACIONES">🌴 Vacaciones</option>
                    <option value="DESCANSO_MEDICO">🏥 Descanso Médico</option>
                    <option value="PERMISO">💼 Permiso Personal</option>
                    <option value="FERIADO">⭐ Feriado</option>
                    <option value="OTRO">📄 Otro</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Desde</label>
                    <input 
                      type="date" required
                      value={form.start_date}
                      onChange={e => setForm({...form, start_date: e.target.value})}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Hasta</label>
                    <input 
                      type="date" required
                      value={form.end_date}
                      onChange={e => setForm({...form, end_date: e.target.value})}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Motivo (Opcional)</label>
                  <textarea 
                    value={form.reason}
                    onChange={e => setForm({...form, reason: e.target.value})}
                    placeholder="Ej: Viaje familiar, cita médica programada..."
                    rows={2}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                    Cancelar
                </button>
                <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center disabled:opacity-70">
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</> : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
