import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Smartphone, CheckCircle, XCircle, AlertCircle, Loader2, Trash2, Wifi, WifiOff, ShieldCheck, Save } from 'lucide-react';
import AdminLayout from './AdminLayout';

const API_URL = '/api/admin';

export default function AdminDevices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // Estados para Seguridad de Red Wi-Fi
  const [networkSettings, setNetworkSettings] = useState({
    wifi_validation_enabled: false,
    allowed_ips: '',
    client_detected_ip: ''
  });
  const [savingNetwork, setSavingNetwork] = useState(false);
  const [networkToast, setNetworkToast] = useState({ show: false, message: '', type: 'success' });

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/devices`);
      setDevices(response.data || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNetworkSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/network-settings`);
      if (response.data) {
        setNetworkSettings(response.data);
      }
    } catch (err) {
      console.error('Error fetching network settings:', err);
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchNetworkSettings();
  }, []);

  const showNetworkToast = (message, type = 'success') => {
    setNetworkToast({ show: true, message, type });
    setTimeout(() => setNetworkToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const handleSaveNetworkSettings = async () => {
    try {
      setSavingNetwork(true);
      const res = await axios.post(`${API_URL}/network-settings`, {
        wifi_validation_enabled: networkSettings.wifi_validation_enabled,
        allowed_ips: networkSettings.allowed_ips
      });
      showNetworkToast(res.data?.message || 'Configuración guardada exitosamente.');
      fetchNetworkSettings();
    } catch (err) {
      showNetworkToast('Error al guardar configuración de red.', 'error');
    } finally {
      setSavingNetwork(false);
    }
  };

  const handleQuickAddCurrentIp = () => {
    const currentIp = networkSettings.client_detected_ip;
    if (!currentIp) return;

    let existing = networkSettings.allowed_ips
      ? networkSettings.allowed_ips.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    if (!existing.includes(currentIp)) {
      existing.push(currentIp);
    }

    setNetworkSettings(prev => ({
      ...prev,
      wifi_validation_enabled: true,
      allowed_ips: existing.join(', ')
    }));
    showNetworkToast(`IP ${currentIp} agregada. Haz clic en 'Guardar' para aplicar los cambios.`);
  };

  const handleApprove = async (id) => {
    try {
      setActionLoading(id);
      await axios.put(`${API_URL}/devices/${id}/approve`);
      fetchDevices();
    } catch (error) {
      console.error('Error approving device:', error);
      showNetworkToast(error.response?.data?.detail || 'Error al aprobar', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlock = async (id) => {
    try {
      setActionLoading(id);
      await axios.put(`${API_URL}/devices/${id}/block`);
      fetchDevices();
    } catch (error) {
      console.error('Error blocking device:', error);
      showNetworkToast(error.response?.data?.detail || 'Error al bloquear', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Seguro que deseas desvincular y eliminar este dispositivo? El empleado podrá vincular un nuevo teléfono.')) {
      return;
    }
    try {
      setActionLoading(id);
      await axios.delete(`${API_URL}/devices/${id}`);
      fetchDevices();
    } catch (error) {
      console.error('Error deleting device:', error);
      showNetworkToast(error.response?.data?.detail || 'Error al eliminar', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const pendingDevices = devices.filter(d => !d.is_approved);
  const approvedDevices = devices.filter(d => d.is_approved);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <AdminLayout title="Gestión de Dispositivos">
      {/* Toast Notificación */}
      {networkToast.show && (
        <div className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-4 max-w-md mx-auto sm:mx-0 z-50 flex items-center px-4 py-3 rounded-lg shadow-lg text-white ${networkToast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {networkToast.type === 'success' ? <CheckCircle className="w-5 h-5 mr-2" /> : <XCircle className="w-5 h-5 mr-2" />}
          {networkToast.message}
        </div>
      )}

      <div className="space-y-8">
        {/* Tarjeta de Seguridad de Red y Wi-Fi de la Empresa */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${networkSettings.wifi_validation_enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                {networkSettings.wifi_validation_enabled ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-800">
                  Seguridad de Red: Validación de Wi-Fi de la Empresa
                </h3>
                <p className="text-xs text-slate-500">
                  Obliga a los empleados a estar conectados al Wi-Fi de la oficina para poder escanear y marcar asistencia.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                networkSettings.wifi_validation_enabled
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {networkSettings.wifi_validation_enabled ? '● Protección Wi-Fi Activa' : '○ Desactivada (Red Libre)'}
              </span>
              
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={networkSettings.wifi_validation_enabled} 
                  onChange={(e) => setNetworkSettings(prev => ({ ...prev, wifi_validation_enabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-blue-900">
                  Tu IP actual detectada en este momento:
                </p>
                <p className="font-mono text-base font-bold text-blue-700 mt-0.5">
                  {networkSettings.client_detected_ip || 'Detectando...'}
                </p>
                <p className="text-[11px] text-blue-600 mt-0.5">
                  Esta es la dirección pública o local desde la que navegas ahora en la oficina.
                </p>
              </div>

              <button
                type="button"
                onClick={handleQuickAddCurrentIp}
                disabled={!networkSettings.client_detected_ip}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center w-full sm:w-auto justify-center gap-1.5 transition-colors shadow-sm shrink-0"
              >
                <ShieldCheck className="w-4 h-4" />
                Registrar mi Wi-Fi actual con 1 clic
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                IPs autorizadas de la oficina (separadas por comas)
              </label>
              <input
                type="text"
                value={networkSettings.allowed_ips}
                onChange={(e) => setNetworkSettings(prev => ({ ...prev, allowed_ips: e.target.value }))}
                placeholder="Ej. 190.238.12.34, 192.168.1.0/24"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 font-mono text-sm"
              />
              <p className="text-xs text-slate-400 mt-1">
                Ingresa la IP pública del router de tu oficina o la subred local (ej. 192.168.1.0/24). Si tienes varias sedes o routers, sepáralos con comas.
              </p>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleSaveNetworkSettings}
                disabled={savingNetwork}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium text-sm flex items-center w-full sm:w-auto justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {savingNetwork ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar Configuración de Red
              </button>
            </div>
          </div>
        </div>

        {/* Pending Devices Alert Banner */}
        {pendingDevices.length > 0 && (
          <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-md shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-amber-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-amber-800 font-medium">
                  Hay {pendingDevices.length} {pendingDevices.length === 1 ? 'dispositivo pendiente' : 'dispositivos pendientes'} de aprobación.
                </p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
            <span className="ml-2 text-slate-500">Cargando dispositivos...</span>
          </div>
        ) : (
          <>
            {/* Pending Devices Section */}
            {pendingDevices.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Dispositivos Pendientes</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {pendingDevices.map(device => (
                    <div key={device.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col h-full hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                      <div className="flex items-start mb-4">
                        <div className="bg-slate-100 p-3 rounded-full mr-4">
                          <Smartphone className="h-6 w-6 text-slate-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-md font-bold text-slate-900">{device.employee_name}</h3>
                          <p className="text-sm text-slate-500">{device.employee_dni}</p>
                        </div>
                      </div>
                      
                      <div className="mb-6 flex-1 space-y-2">
                        <div>
                          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Dispositivo</p>
                          <p className="text-sm text-slate-800">{device.device_name || 'Desconocido'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Fecha de solicitud</p>
                          <p className="text-sm text-slate-800">{formatDate(device.created_at)}</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(device.id)}
                          disabled={actionLoading === device.id}
                          className="flex-1 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3 rounded-md font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                        >
                          {actionLoading === device.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-1" />
                          )}
                          Aprobar
                        </button>
                        <button
                          onClick={() => handleDelete(device.id)}
                          disabled={actionLoading === device.id}
                          className="flex-1 flex justify-center items-center p-2 border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Desvincular / Rechazar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Approved Devices Section */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Dispositivos Aprobados</h2>
              {approvedDevices.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {approvedDevices.map(device => (
                    <div key={device.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col h-full hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                      <div className="flex items-start mb-4">
                        <div className="bg-slate-50 p-3 rounded-full mr-4 border border-slate-100">
                          <Smartphone className="h-6 w-6 text-slate-500" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-md font-bold text-slate-900">{device.employee_name}</h3>
                          <p className="text-sm text-slate-500">{device.employee_dni}</p>
                        </div>
                      </div>
                      
                      <div className="mb-6 flex-1 space-y-2">
                        <div>
                          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Dispositivo</p>
                          <p className="text-sm text-slate-800">{device.device_name || 'Desconocido'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Fecha de registro</p>
                          <p className="text-sm text-slate-800">{formatDate(device.created_at)}</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleBlock(device.id)}
                          disabled={actionLoading === device.id}
                          className="flex-1 flex items-center justify-center bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 py-2 px-3 rounded-md font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                        >
                          {actionLoading === device.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <XCircle className="h-4 w-4 mr-1" />
                          )}
                          Bloquear
                        </button>
                        <button
                          onClick={() => handleDelete(device.id)}
                          disabled={actionLoading === device.id}
                          className="flex-1 flex items-center justify-center px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-md font-medium text-sm transition-colors"
                          title="Desvincular para que registre nuevo celular"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Desvincular
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
                  <p className="text-slate-500 text-sm">No hay dispositivos aprobados.</p>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
