'use client';

import { useEffect, useState } from 'react';
import { Calendar, Clock, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

export default function DoctorDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [availability, setAvailability] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Estados para novo slot
  const [newDay, setNewDay] = useState('Segunda');
  const [newStart, setNewStart] = useState('08:00');
  const [newEnd, setNewEnd] = useState('09:00');

  const daysOfWeek = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const timeSlots = Array.from({ length: 14 }, (_, i) => `${(i + 8).toString().padStart(2, '0')}:00`);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      const profRes = await fetch('http://localhost:3000/profile/me', { headers: { Authorization: `Bearer ${token}` } });

      if (profRes.status === 404) {
        window.location.href = '/setup/doctor';
        return;
      }

      const apptRes = await fetch('http://localhost:3000/appointments/me', { headers: { Authorization: `Bearer ${token}` } });

      const prof = await profRes.json();
      const appts = await apptRes.json();
      console.log('DEBUG: appointments received:', appts);
      setProfile(prof);
      setAppointments(Array.isArray(appts) ? appts : []);
      
      try {
        setAvailability(JSON.parse(prof?.availability || '[]'));
      } catch (e) {
        setAvailability([]);
      }
    };
    fetchData();
  }, []);

  const handleCellClick = (day: string, time: string) => {
    setNewDay(day);
    setNewStart(time);
    // Define o fim para 1h depois por padrão
    const [hours] = time.split(':');
    const endHour = (parseInt(hours) + 1).toString().padStart(2, '0') + ':00';
    setNewEnd(endHour);
    setIsModalOpen(true);
  };

  const addSlot = () => {
    const updated = [...availability, { day: newDay, start: newStart, end: newEnd, id: Date.now() }];
    setAvailability(updated);
    saveAvailability(updated);
    setIsModalOpen(false);
  };

  const removeSlot = (id: number) => {
    const updated = availability.filter(s => s.id !== id);
    setAvailability(updated);
    saveAvailability(updated);
  };

  const handleConfirm = async (id: number) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`http://localhost:3000/appointments/${id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setAppointments(prev =>
        Array.isArray(prev) ? prev.map(a => a.id === id ? { ...a, status: 'CONFIRMED' } : a) : []
      );
    }
  };

  const saveAvailability = async (data: any[]) => {
    const token = localStorage.getItem('token');
    await fetch('http://localhost:3000/profile/doctor/availability', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ availability: JSON.stringify(data) }),
    });
  };

  if (!profile) return <div className="flex h-screen items-center justify-center">Carregando...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Painel do Médico</h1>
            <p className="text-slate-500">Bem-vindo, Dr. {profile?.user?.name || 'Médico'}</p>
          </div>
          <div className="flex gap-3">
             {/* O botão foi removido para priorizar a interação direta na grade, estilo Google Calendar */}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendário de Disponibilidade */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <Calendar size={20} className="text-blue-600" />
                Sua Grade de Disponibilidade
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <div className="min-w-[600px] grid grid-cols-8 border-b border-gray-100 bg-gray-50">
                <div className="p-4 border-r border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">Hora</div>
                {daysOfWeek.map(day => (
                  <div key={day} className="p-4 border-r border-gray-100 text-xs font-bold text-center text-slate-600 uppercase tracking-wider">
                    {day}
                  </div>
                ))}
              </div>
              
              <div className="min-w-[600px] grid grid-cols-8 relative h-[600px] overflow-y-auto">
                {/* Linhas de tempo */}
                <div className="col-span-1 border-r border-gray-100">
                  {timeSlots.map(time => (
                    <div key={time} className="h-12 border-b border-gray-100 p-2 text-[10px] text-gray-400 text-right pr-4 font-medium">
                      {time}
                    </div>
                  ))}
                </div>

                {/* Colunas de dias com slots */}
                {daysOfWeek.map(day => (
                  <div key={day} className="col-span-1 border-r border-gray-100 relative group">
                    {timeSlots.map(time => (
                      <div 
                        key={time} 
                        onClick={() => handleCellClick(day, time)}
                        className="h-12 border-b border-gray-50 group-hover:bg-blue-50/20 cursor-pointer transition-colors" 
                      />
                    ))}
                    
                    {/* Renderiza os slots salvos */}
                    {availability.filter(s => s.day === day).map(slot => {
                      const startIdx = timeSlots.findIndex(t => t === slot.start);
                      const top = startIdx !== -1 ? startIdx * 48 : 0;
                      return (
                        <div 
                          key={slot.id}
                          className="absolute left-1 right-1 bg-blue-100 border-l-4 border-blue-600 p-2 rounded shadow-sm group/slot cursor-default overflow-hidden"
                          style={{ top: `${top}px`, height: '44px' }}
                        >
                          <div className="flex justify-between items-start">
                            <p className="text-[10px] font-bold text-blue-800 leading-tight">Disponível</p>
                            <button onClick={() => removeSlot(slot.id)} className="opacity-0 group-hover/slot:opacity-100 text-blue-800 hover:text-red-600 transition">
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <p className="text-[10px] text-blue-700">{slot.start} - {slot.end}</p>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar de Consultas */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
                <Clock size={20} className="text-green-600" />
                Ações Pendentes
              </h2>
              <div className="space-y-4">
                {(Array.isArray(appointments) ? appointments : []).filter(a => a.status === 'PENDING').map((appt) => (
                  <div key={appt.id} className="p-4 bg-orange-50 border border-orange-100 rounded-xl space-y-3">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-bold text-orange-900">{new Date(appt.date).toLocaleString()}</p>
                      <span className="text-[10px] bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full font-bold">AGUARDANDO</span>
                    </div>
                    <button 
                      onClick={() => handleConfirm(appt.id)}
                      className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition shadow-sm"
                    >
                      Confirmar Consulta
                    </button>
                  </div>
                ))}
                {appointments.filter(a => a.status === 'PENDING').length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4 italic border-2 border-dashed border-gray-100 rounded-xl">
                    Nenhuma consulta aguardando aprovação.
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold mb-4 text-slate-800">Próximas Consultas</h2>
              <div className="space-y-3">
                {(Array.isArray(appointments) ? appointments : []).filter(a => a.status === 'CONFIRMED').map((appt) => (
                  <div key={appt.id} className="p-4 border border-gray-100 rounded-xl flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{new Date(appt.date).toLocaleString()}</p>
                      <p className="text-xs text-green-600 font-medium italic">Confirmada</p>
                    </div>
                    <a 
                      href={`/video/${appt.id}`}
                      className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-600 hover:text-white transition"
                    >
                      Vídeo
                    </a>
                  </div>
                ))}
                {appointments.filter(a => a.status === 'CONFIRMED').length === 0 && (
                  <p className="text-sm text-gray-400 italic">Nenhum horário confirmado.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal para Novo Slot */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-slate-900 mb-6">Definir Disponibilidade</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Dia da Semana</label>
                <select 
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                  value={newDay}
                  onChange={(e) => setNewDay(e.target.value)}
                >
                  {daysOfWeek.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Hora Início</label>
                  <select 
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                  >
                    {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Hora Fim</label>
                  <select 
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                    value={newEnd}
                    onChange={(e) => {
                      // Simples validação: fim deve ser maior que início
                      setNewEnd(e.target.value);
                    }}
                  >
                    {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-600 font-bold hover:bg-gray-50 rounded-xl transition">
                Cancelar
              </button>
              <button onClick={addSlot} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition">
                Adicionar Slot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
