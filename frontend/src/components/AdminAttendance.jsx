import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, Search, Loader2, FileSpreadsheet } from 'lucide-react';
import AdminLayout from './AdminLayout';

const API_URL = '/api/admin';

export default function AdminAttendance() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  
  // Modal de registro manual
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [manualForm, setManualForm] = useState({
    employee_id: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().substring(0, 5),
    record_type: 'ENTRADA'
  });
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState('');

  const openManualModal = async () => {
    setManualError('');
    setManualModalOpen(true);
    if (employees.length === 0) {
      try {
        const res = await axios.get(`${API_URL}/employees`);
        setEmployees(res.data.filter(e => e.is_active));
      } catch (e) {
        console.error('Error fetching employees:', e);
      }
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setManualSubmitting(true);
    try {
      const timestamp = `${manualForm.date}T${manualForm.time}:00`;
      await axios.post(`${API_URL}/attendance/manual`, {
        employee_id: parseInt(manualForm.employee_id),
        timestamp: timestamp,
        record_type: manualForm.record_type,
        admin_password: manualForm.admin_password
      });
      setManualModalOpen(false);
      setManualForm({ ...manualForm, employee_id: '', admin_password: '' });
      fetchAttendance(1);
    } catch (error) {
      console.error('Error manual attendance:', error);
      setManualError(error.response?.data?.detail || 'Error al registrar la asistencia');
    } finally {
      setManualSubmitting(false);
    }
  };

  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    employee_id: ''
  });

  const fetchAttendance = async (targetPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.employee_id) params.append('employee_id', filters.employee_id);
      params.append('page', targetPage.toString());
      params.append('limit', '25');

      const response = await axios.get(`${API_URL}/attendance?${params.toString()}`);
      if (response.data && response.data.data) {
        setRecords(response.data.data);
        setTotalPages(response.data.pages || 1);
        setTotalRecords(response.data.total || 0);
        setPage(response.data.page || targetPage);
      } else {
        setRecords(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error) {
      console.error('Error fetching attendance records:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchAttendance(1);
  };

  const parseSafeDate = (isoString) => {
    if (!isoString) return null;
    // Si la BD guardó el ISO sin timezone (ej. 2026-09-15T12:00:00), asumimos que es UTC agregando 'Z'
    const hasTimezone = isoString.endsWith('Z') || isoString.includes('+') || (isoString.lastIndexOf('-') > 10);
    return new Date(hasTimezone ? isoString : isoString + 'Z');
  };

  const handleDownloadCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.employee_id) params.append('employee_id', filters.employee_id);

      const response = await axios.get(`${API_URL}/reports/export-csv?${params.toString()}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'reporte_asistencia.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading CSV:', error);
    }
  };

  const handleDownloadPayrollCSV = async () => {
    try {
      const response = await axios.get(`${API_URL}/reports/export-payroll-csv`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'reporte_planilla_mensual.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading payroll CSV:', error);
    }
  };

  return (
    <AdminLayout title="Historial de Asistencias">
      <div className="space-y-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3 sm:gap-4 md:items-end">
            <div className="w-full md:flex-1">
              <label htmlFor="start_date" className="block text-sm font-medium text-slate-700 mb-1">Fecha Inicio</label>
              <input
                type="date"
                id="start_date"
                name="start_date"
                value={filters.start_date}
                onChange={handleFilterChange}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="w-full md:flex-1">
              <label htmlFor="end_date" className="block text-sm font-medium text-slate-700 mb-1">Fecha Fin</label>
              <input
                type="date"
                id="end_date"
                name="end_date"
                value={filters.end_date}
                onChange={handleFilterChange}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="w-full md:flex-1">
              <label htmlFor="employee_id" className="block text-sm font-medium text-slate-700 mb-1">ID Empleado</label>
              <input
                type="number"
                id="employee_id"
                name="employee_id"
                placeholder="Ej. 2"
                value={filters.employee_id}
                onChange={handleFilterChange}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full md:w-auto">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center justify-center min-w-[90px] w-full sm:w-auto"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4 mr-2" /> Buscar</>}
              </button>
              <button
                type="button"
                onClick={openManualModal}
                className="bg-amber-600 text-white px-3 py-2 rounded-md font-medium text-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 flex items-center justify-center w-full sm:w-auto"
                title="Registrar asistencia manualmente"
              >
                + Registro Manual
              </button>
              <button
                type="button"
                onClick={handleDownloadCSV}
                className="bg-emerald-600 text-white px-3 py-2 rounded-md font-medium text-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 flex items-center justify-center w-full sm:w-auto"
                title="Descargar historial con los filtros actuales"
              >
                <Download className="w-4 h-4 mr-1.5" />
                Excel
              </button>
              <button
                type="button"
                onClick={handleDownloadPayrollCSV}
                className="bg-indigo-600 text-white px-3 py-2 rounded-md font-medium text-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center justify-center w-full sm:w-auto col-span-2 sm:col-span-1"
                title="Descargar resumen consolidado para cálculo de planilla"
              >
                <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                Planilla (Mes)
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full min-w-[800px] divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Empleado</th>
                  <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">DNI</th>
                  <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</th>
                  <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Estado / Puntualidad</th>
                  <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Jornada</th>
                  <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Fecha</th>
                  <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Hora</th>
                  <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Dispositivo</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {records.length > 0 ? (
                  records.map((record, index) => (
                    <tr key={record.id || index} className="hover:bg-slate-50 transition-colors duration-150">
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{record.employee_name}</td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-slate-500">{record.employee_dni}</td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
                          record.record_type === 'ENTRADA' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-blue-50 border border-blue-200 text-blue-700'
                        }`}>
                          {record.record_type === 'ENTRADA' ? (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                          )}
                          {record.record_type}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm">
                        {record.status === 'TARDANZA' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md border border-amber-200 text-xs font-semibold bg-amber-50 text-amber-700">
                            Tardanza (+{record.tardiness_minutes} min)
                          </span>
                        ) : record.status === 'PUNTUAL' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md border border-emerald-200 text-xs font-semibold bg-emerald-50 text-emerald-700">
                            Puntual
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md border border-slate-200 text-xs font-semibold bg-slate-50 text-slate-600">
                            {record.status || 'Salida'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                        {record.hours_worked !== null && record.hours_worked !== undefined 
                          ? `${record.hours_worked} hrs` 
                          : '-'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {record.timestamp ? parseSafeDate(record.timestamp).toLocaleDateString('es-ES') : ''}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {record.timestamp ? parseSafeDate(record.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-slate-500">{record.device_name || 'N/A'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                          <FileSpreadsheet className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-base font-medium text-slate-600">
                          {loading ? 'Buscando registros...' : 'No se encontraron registros de asistencia'}
                        </p>
                        <p className="text-sm text-slate-400 max-w-sm">
                          Intenta ajustar los filtros de fecha o el DNI del empleado para obtener resultados.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className="bg-white px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 sm:px-6">
            <div className="flex-1 flex flex-col sm:flex-row items-center justify-between w-full">
              <div className="mb-4 sm:mb-0">
                <p className="text-sm text-slate-700">
                  Mostrando página <span className="font-medium">{page}</span> de <span className="font-medium">{totalPages}</span> ({totalRecords} registros en total)
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => {
                      if (page > 1) {
                        const newPage = page - 1;
                        setPage(newPage);
                        fetchAttendance(newPage);
                      }
                    }}
                    disabled={page <= 1 || loading}
                    className="relative inline-flex items-center px-3 py-2 rounded-l-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <span className="relative inline-flex items-center px-4 py-2 border border-slate-300 bg-slate-50 text-sm font-medium text-slate-700">
                    {page}
                  </span>
                  <button
                    onClick={() => {
                      if (page < totalPages) {
                        const newPage = page + 1;
                        setPage(newPage);
                        fetchAttendance(newPage);
                      }
                    }}
                    disabled={page >= totalPages || loading}
                    className="relative inline-flex items-center px-3 py-2 rounded-r-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Siguiente
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>

      {manualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">Registro Manual de Asistencia</h3>
              <button onClick={() => setManualModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            

              <form onSubmit={handleManualSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {manualError && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg border border-red-200 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    {manualError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Empleado</label>
                  <select 
                    required
                    value={manualForm.employee_id}
                    onChange={e => setManualForm({...manualForm, employee_id: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Seleccione un empleado...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.dni})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                    <input 
                      type="date" required
                      value={manualForm.date}
                      onChange={e => setManualForm({...manualForm, date: e.target.value})}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Hora</label>
                    <input 
                      type="time" required
                      value={manualForm.time}
                      onChange={e => setManualForm({...manualForm, time: e.target.value})}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Registro</label>
                  <select 
                    required
                    value={manualForm.record_type}
                    onChange={e => setManualForm({...manualForm, record_type: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="ENTRADA">Entrada</option>
                    <option value="SALIDA">Salida</option>
                  </select>
                </div>

                <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setManualModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={manualSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center disabled:opacity-70">
                    {manualSubmitting ? 'Guardando...' : 'Registrar'}
                  </button>
                </div>
              </form>

          </div>
        </div>
      )}
    </AdminLayout>
  );
}
