import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Search, Loader2, Shield, User, MonitorSmartphone, X, CheckCircle, XCircle, Pencil, Trash2, Users } from 'lucide-react';
import AdminLayout from './AdminLayout';

const API_URL = '/api/admin';

export default function AdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({ 
    name: '', 
    dni: '', 
    password: '', 
    work_start_time: '08:00', 
    work_end_time: '17:00',
    tolerance_minutes: 15,
    is_active: true
  });
  const [editData, setEditData] = useState({ 
    id: null, 
    name: '', 
    dni: '', 
    password: '', 
    work_start_time: '08:00', 
    work_end_time: '17:00',
    tolerance_minutes: 15,
    is_active: true
  });
  
  const [toast, setToast] = useState({ show: false, type: '', message: '' });

  // Estados para consulta de DNI ($0 / RENIEC)
  const [dniSearching, setDniSearching] = useState(false);
  const [dniFoundInfo, setDniFoundInfo] = useState(null);
  const [dniErrorMsg, setDniErrorMsg] = useState(null);
  const [editDniSuccess, setEditDniSuccess] = useState(null);
  const [editDniError, setEditDniError] = useState(null);

  const handleLookupDNI = async (dniToSearch) => {
    const cleanDni = (dniToSearch !== undefined ? dniToSearch : formData.dni || '').trim();
    if (cleanDni.length !== 8) {
      setDniErrorMsg('El DNI debe tener 8 dígitos numéricos.');
      setDniFoundInfo(null);
      return;
    }

    setDniSearching(true);
    setDniErrorMsg(null);
    setDniFoundInfo(null);

    try {
      const response = await axios.get(`${API_URL}/lookup-dni/${cleanDni}`);
      if (response.data?.success && response.data?.full_name) {
        setFormData(prev => ({ ...prev, name: response.data.full_name }));
        setDniFoundInfo(`✓ ${response.data.full_name} (RENIEC)`);
        setDniErrorMsg(null);
      } else {
        setDniErrorMsg(response.data?.message || 'No se pudo autocompletar. Puedes escribir el nombre manualmente.');
        setDniFoundInfo(null);
      }
    } catch (err) {
      setDniErrorMsg('No se pudo conectar con el servicio de consulta. Escribe el nombre manualmente.');
      setDniFoundInfo(null);
    } finally {
      setDniSearching(false);
    }
  };

  const handleDniChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 8);
    setFormData(prev => ({ ...prev, dni: val }));
    setDniFoundInfo(null);
    setDniErrorMsg(null);
    if (val.length === 8) {
      handleLookupDNI(val);
    }
  };

  const handleLookupEditDNI = async (dniToSearch) => {
    const cleanDni = (dniToSearch !== undefined ? dniToSearch : editData.dni || '').trim();
    if (cleanDni.length !== 8) return;

    setDniSearching(true);
    setEditDniError(null);
    setEditDniSuccess(null);

    try {
      const response = await axios.get(`${API_URL}/lookup-dni/${cleanDni}`);
      if (response.data?.success && response.data?.full_name) {
        setEditData(prev => ({ ...prev, name: response.data.full_name }));
        setEditDniSuccess(`✓ ${response.data.full_name} (RENIEC)`);
      } else {
        setEditDniError(response.data?.message || 'No se pudo autocompletar.');
      }
    } catch (err) {
      setEditDniError('No se pudo conectar con el servicio.');
    } finally {
      setDniSearching(false);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/employees`);
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
      showToast('error', 'Error al cargar la lista de empleados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEmployees(); }, []);

  const toastTimeout = React.useRef(null);
  const showToast = (type, message) => {
    setToast({ show: true, type, message });
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast({ show: false, type: '', message: '' }), 4000);
  };

  const validateEmployee = (data, isEdit = false) => {
    const name = (data.name || '').trim();
    const dni = (data.dni || '').trim();

    if (!name || name.length < 3) {
      return 'El nombre completo debe tener al menos 3 caracteres.';
    }
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'\-\.]+$/.test(name)) {
      return 'El nombre contiene caracteres no permitidos.';
    }
    if (!/^\d{8}$/.test(dni)) {
      return 'El DNI debe tener exactamente 8 dígitos numéricos.';
    }
    if (!isEdit && (!data.password || data.password.length < 6)) {
      return 'La contraseña debe tener al menos 6 caracteres.';
    }
    if (isEdit && data.password && data.password.length > 0 && data.password.length < 6) {
      return 'La nueva contraseña debe tener al menos 6 caracteres.';
    }
    if (data.tolerance_minutes === '' || data.tolerance_minutes === undefined || data.tolerance_minutes < 0 || data.tolerance_minutes > 60) {
      return 'La tolerancia debe ser entre 0 y 60 minutos.';
    }
    if (!data.work_start_time) {
      return 'Debes seleccionar una hora de entrada.';
    }
    return null;
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();

    const validationError = validateEmployee(formData, false);
    if (validationError) {
      showToast('error', validationError);
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/employees`, {
        name: formData.name.trim(), 
        dni: formData.dni.trim(), 
        password: formData.password,
        work_start_time: formData.work_start_time,
        work_end_time: formData.work_end_time,
        tolerance_minutes: formData.tolerance_minutes,
        is_active: formData.is_active
      });
      showToast('success', 'Empleado registrado exitosamente.');
      setModalOpen(false);
      setFormData({ name: '', dni: '', password: '', work_start_time: '08:00', work_end_time: '17:00', tolerance_minutes: 15, is_active: true });
      fetchEmployees();
    } catch (error) {
      const detail = error.response?.data?.detail;
      const errorMsg = Array.isArray(detail) ? detail.map(d => d.msg || d).join(', ') : (detail || 'Error al registrar.');
      showToast('error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditEmployee = async (e) => {
    e.preventDefault();

    const validationError = validateEmployee(editData, true);
    if (validationError) {
      showToast('error', validationError);
      return;
    }

    setSubmitting(true);
    try {
      const payload = { 
        name: editData.name.trim(), 
        dni: editData.dni.trim(),
        work_start_time: editData.work_start_time,
        work_end_time: editData.work_end_time,
        tolerance_minutes: editData.tolerance_minutes,
        is_active: editData.is_active
      };
      if (editData.password && editData.password.trim() !== '') {
        payload.password = editData.password;
      }
      await axios.put(`${API_URL}/employees/${editData.id}`, payload);
      showToast('success', 'Empleado actualizado exitosamente.');
      setEditModal(false);
      fetchEmployees();
    } catch (error) {
      const detail = error.response?.data?.detail;
      const errorMsg = Array.isArray(detail) ? detail.map(d => d.msg || d).join(', ') : (detail || 'Error al actualizar.');
      showToast('error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (id) => {
    try {
      await axios.delete(`${API_URL}/employees/${id}`);
      showToast('success', 'Empleado eliminado exitosamente.');
      setDeleteConfirm(null);
      fetchEmployees();
    } catch (error) {
      showToast('error', error.response?.data?.detail || 'Error al eliminar.');
    }
  };

  const openEditModal = (emp) => {
    setEditData({ 
      id: emp.id, 
      name: emp.name, 
      dni: emp.dni, 
      email: emp.email || '',
      is_admin: emp.is_admin,
      password: '',
      work_start_time: emp.work_start_time || '08:00',
      work_end_time: emp.work_end_time || '17:00',
      tolerance_minutes: emp.tolerance_minutes !== undefined ? emp.tolerance_minutes : 15,
      is_active: emp.is_active !== undefined ? emp.is_active : true
    });
    setEditDniSuccess(null);
    setEditDniError(null);
    setEditModal(true);
  };

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(search.toLowerCase()) || 
    emp.dni.toLowerCase().includes(search.toLowerCase()) ||
    (emp.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout title="Gestión de Empleados">
      {/* Toast */}
      {toast.show && (
        <div className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-4 max-w-md mx-auto sm:mx-0 z-50 flex items-center px-4 py-3 rounded-lg shadow-lg text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 mr-2" /> : <XCircle className="w-5 h-5 mr-2" />}
          {toast.message}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="relative w-full md:w-1/3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o DNI..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => { 
            setFormData({ name: '', dni: '', password: '', work_start_time: '08:00', work_end_time: '17:00', tolerance_minutes: 15, is_active: true }); 
            setDniFoundInfo(null);
            setDniErrorMsg(null);
            setModalOpen(true); 
          }}
          className="w-full md:w-auto flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Registrar Nuevo Empleado
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-600" />
            <p>Cargando empleados...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-sm font-medium border-b border-slate-200">
                  <th className="px-3 sm:px-6 py-3">ID</th>
                  <th className="px-3 sm:px-6 py-3">Nombre</th>
                  <th className="px-3 sm:px-6 py-3">DNI / Correo</th>
                  <th className="px-3 sm:px-6 py-3">Horario Entrada</th>
                  <th className="px-3 sm:px-6 py-3">Tolerancia</th>
                  <th className="px-3 sm:px-6 py-3 text-center">Estado</th>
                  <th className="px-3 sm:px-6 py-3">Rol</th>
                  <th className="px-3 sm:px-6 py-3 text-center">Dispositivos</th>
                  <th className="px-3 sm:px-6 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50 transition-colors duration-150">
                      <td className="px-3 sm:px-6 py-4 font-mono text-sm text-slate-500">{emp.id}</td>
                      <td className="px-3 sm:px-6 py-4 font-medium">{emp.name}</td>
                      <td className="px-3 sm:px-6 py-4">{emp.is_admin ? (emp.email || emp.dni) : emp.dni}</td>
                      <td className="px-3 sm:px-6 py-4">
                        <span className="font-semibold text-slate-800">{emp.work_start_time || '08:00'}</span>
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-slate-600">
                        {emp.tolerance_minutes !== undefined ? emp.tolerance_minutes : 15} min
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-center">
                        {emp.is_active ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md border border-emerald-200 text-xs font-semibold bg-emerald-50 text-emerald-700">
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md border border-red-200 text-xs font-semibold bg-red-50 text-red-700">
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-4">
                        {emp.is_admin ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md border border-blue-200 text-xs font-semibold bg-blue-50 text-blue-700">
                            <Shield className="w-3.5 h-3.5 mr-1" /> Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md border border-slate-200 text-xs font-semibold bg-slate-50 text-slate-700">
                            <User className="w-3.5 h-3.5 mr-1" /> Empleado
                          </span>
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-center">
                        <div className="flex items-center justify-center text-slate-500">
                          <MonitorSmartphone className="w-4 h-4 mr-1.5" />
                          <span className="font-semibold">{emp.devices_count || 0}</span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(emp)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {!emp.is_admin && (
                            <button
                              onClick={() => setDeleteConfirm(emp)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title={emp.is_active ? "Inactivar" : "Eliminar"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                          <Users className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-base font-medium text-slate-600">
                          No se encontraron empleados
                        </p>
                        <p className="text-sm text-slate-400 max-w-sm">
                          Intenta con otro término de búsqueda o registra un nuevo empleado.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Crear */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Registrar Nuevo Empleado</h3>
              <button onClick={() => setModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateEmployee} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {/* DNI primero con botón Buscar RENIEC */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-slate-700">DNI (8 dígitos)</label>
                  <span className={`text-xs font-mono ${formData.dni.length === 8 ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                    {formData.dni.length}/8 dígitos
                  </span>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    inputMode="numeric"
                    maxLength={8}
                    pattern="[0-9]{8}"
                    required 
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 font-mono tracking-wider text-base" 
                    placeholder="12345678" 
                    value={formData.dni} 
                    onChange={handleDniChange} 
                  />
                  <button
                    type="button"
                    onClick={() => handleLookupDNI(formData.dni)}
                    disabled={formData.dni.length !== 8 || dniSearching}
                    className="px-3.5 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-xs flex items-center gap-1.5 border border-blue-200 transition-colors shrink-0"
                    title="Consultar nombres en RENIEC/SUNAT"
                  >
                    {dniSearching ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                        <span>Buscando...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5" />
                        <span>Buscar RENIEC</span>
                      </>
                    )}
                  </button>
                </div>
                
                {dniFoundInfo && (
                  <p className="mt-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1 font-medium flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                    <span>{dniFoundInfo}</span>
                  </p>
                )}
                {dniErrorMsg && (
                  <p className="mt-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1 font-normal">
                    ⚠️ {dniErrorMsg}
                  </p>
                )}
              </div>

              {/* Nombre completo (autocompletado o editable) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nombre completo
                </label>
                <input 
                  type="text" 
                  required 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600" 
                  placeholder="Ej. Juan Carlos Pérez" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hora Entrada</label>
                  <input 
                    type="time" 
                    required 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600" 
                    value={formData.work_start_time} 
                    onChange={(e) => setFormData({...formData, work_start_time: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hora Salida</label>
                  <input 
                    type="time" 
                    required 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600" 
                    value={formData.work_end_time} 
                    onChange={(e) => setFormData({...formData, work_end_time: e.target.value})} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tolerancia (min)</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="60" 
                    required 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600" 
                    value={formData.tolerance_minutes} 
                    onChange={(e) => setFormData({...formData, tolerance_minutes: e.target.value === '' ? '' : parseInt(e.target.value) || 0})} 
                  />
                </div>
                <div className="flex items-center mt-6">
                  <input 
                    type="checkbox" 
                    id="is_active_create"
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2" 
                    checked={formData.is_active} 
                    onChange={(e) => setFormData({...formData, is_active: e.target.checked})} 
                  />
                  <label htmlFor="is_active_create" className="ml-2 text-sm font-medium text-slate-700">Cuenta Activa</label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña inicial <span className="text-slate-400 font-normal">(mínimo 6 caracteres)</span></label>
                <input 
                  type="password" 
                  minLength={6}
                  required 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600" 
                  placeholder="Mínimo 6 caracteres" 
                  value={formData.password} 
                  onChange={(e) => setFormData({...formData, password: e.target.value})} 
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 font-medium">Cancelar</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-70">
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin inline" />Registrando...</> : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Editar Empleado</h3>
              <button onClick={() => setEditModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleEditEmployee} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {/* Identificador: Correo para Admin, DNI para Empleado */}
              {editData.is_admin ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Correo del Administrador</label>
                  <input 
                    type="email" 
                    disabled
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed" 
                    value={editData.email} 
                  />
                  <p className="mt-1 text-xs text-slate-400">El correo se gestiona desde Google o la configuración del sistema.</p>
                </div>
              ) : (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-slate-700">DNI (8 dígitos)</label>
                  <span className={`text-xs font-mono ${editData.dni.length === 8 ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                    {editData.dni.length}/8 dígitos
                  </span>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    inputMode="numeric"
                    maxLength={8}
                    pattern="[0-9]{8}"
                    required 
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 font-mono tracking-wider text-base" 
                    value={editData.dni} 
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                      setEditData({...editData, dni: val});
                      setEditDniSuccess(null);
                      setEditDniError(null);
                    }} 
                  />
                  <button
                    type="button"
                    onClick={() => handleLookupEditDNI(editData.dni)}
                    disabled={editData.dni.length !== 8 || dniSearching}
                    className="px-3.5 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-xs flex items-center gap-1.5 border border-blue-200 transition-colors shrink-0"
                    title="Actualizar nombre desde RENIEC"
                  >
                    {dniSearching ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                        <span>Buscando...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5" />
                        <span>Buscar RENIEC</span>
                      </>
                    )}
                  </button>
                </div>
                {editDniSuccess && (
                  <p className="mt-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1 font-medium flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                    <span>{editDniSuccess}</span>
                  </p>
                )}
                {editDniError && (
                  <p className="mt-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1 font-normal">
                    ⚠️ {editDniError}
                  </p>
                )}
              </div>
              )}

              {/* Nombre completo */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre completo</label>
                <input 
                  type="text" 
                  required 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600" 
                  value={editData.name} 
                  onChange={(e) => setEditData({...editData, name: e.target.value})} 
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hora Entrada</label>
                  <input 
                    type="time" 
                    required 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600" 
                    value={editData.work_start_time} 
                    onChange={(e) => setEditData({...editData, work_start_time: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hora Salida</label>
                  <input 
                    type="time" 
                    required 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600" 
                    value={editData.work_end_time} 
                    onChange={(e) => setEditData({...editData, work_end_time: e.target.value})} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tolerancia (min)</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="60" 
                    required 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600" 
                    value={editData.tolerance_minutes} 
                    onChange={(e) => setEditData({...editData, tolerance_minutes: e.target.value === '' ? '' : parseInt(e.target.value) || 0})} 
                  />
                </div>
                <div className="flex items-center mt-6">
                  <input 
                    type="checkbox" 
                    id="is_active_edit"
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2" 
                    checked={editData.is_active} 
                    onChange={(e) => setEditData({...editData, is_active: e.target.checked})} 
                  />
                  <label htmlFor="is_active_edit" className="ml-2 text-sm font-medium text-slate-700">Cuenta Activa</label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nueva contraseña <span className="text-slate-400 font-normal">(dejar vacío para no cambiar, mín. 6)</span></label>
                <input 
                  type="password" 
                  minLength={6}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600" 
                  placeholder="••••••••" 
                  value={editData.password} 
                  onChange={(e) => setEditData({...editData, password: e.target.value})} 
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setEditModal(false)} className="px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 font-medium">Cancelar</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-70">
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin inline" />Guardando...</> : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminar */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-center mb-2">¿Eliminar empleado?</h3>
            <p className="text-slate-500 text-sm text-center mb-6">
              Se eliminará a <strong>{deleteConfirm.name}</strong> (DNI: {deleteConfirm.dni}) junto con todos sus dispositivos y registros de asistencia. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 font-medium">Cancelar</button>
              <button onClick={() => handleDeleteEmployee(deleteConfirm.id)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
