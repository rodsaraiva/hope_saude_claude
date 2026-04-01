'use client';

import { useEffect, useState } from 'react';

export default function PatientDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      const profRes = await fetch('http://localhost:3000/profile/me', { headers: { Authorization: `Bearer ${token}` } });
      
      if (profRes.status === 404) {
        // Se não existir, tratamos localmente ou esperamos a auto-criação futura
        // Removido o redirecionamento para o setup de perfil obrigatório (onboarding)
        return;
      }

      const [docRes, apptRes] = await Promise.all([
        fetch('http://localhost:3000/profile/doctors', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('http://localhost:3000/appointments/me', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const [prof, docs, appts] = await Promise.all([profRes.json(), docRes.json(), apptRes.json()]);
      setProfile(prof);
      setDoctors(docs);
      setAppointments(appts);
    };
    fetchData();
  }, []);

  const daysMap: Record<string, number> = {
    'Domingo': 0,
    'Segunda': 1,
    'Terça': 2,
    'Quarta': 3,
    'Quinta': 4,
    'Sexta': 5,
    'Sábado': 6,
  };

  const getSlotDate = (dayName: string, time: string) => {
    const targetDay = daysMap[dayName];
    if (targetDay === undefined) return new Date().toISOString();
    
    const today = new Date();
    const currentDay = today.getDay();
    let diff = targetDay - currentDay;
    if (diff <= 0) diff += 7; 
    
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + diff);
    const [hours, minutes] = time.split(':').map(Number);
    targetDate.setHours(hours, minutes, 0, 0);
    return targetDate.toISOString();
  };

  const handleBook = async (doctorId: number, date: string) => {
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:3000/appointments', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ doctorId, date }),
    });

    if (res.ok) {
      const newAppt = await res.json();
      setAppointments(prev => [...prev, newAppt]);
      setIsModalOpen(false);
    }
  };

  if (!profile) return <div>Carregando...</div>;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-600">Olá, {profile?.user?.name || 'Paciente'}</h1>
      <p className="mt-2 text-gray-600">Bem-vindo ao seu painel de saúde mental.</p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 bg-white shadow rounded-lg">
          <h2 className="text-xl font-semibold">Minhas Consultas</h2>
          <div className="mt-4 space-y-2">
            {appointments.map((appt) => (
              <div key={appt.id} className="p-3 border rounded text-sm flex justify-between items-center">
                <span>{new Date(appt.date).toLocaleString('pt-BR')}</span>
                <div className="flex space-x-2 items-center">
                  <span className={`font-bold ${appt.status === 'CONFIRMED' ? 'text-green-600' : 'text-orange-600'}`}>
                    {appt.status}
                  </span>
                  {appt.status === 'CONFIRMED' && (
                    <a 
                      href={`/video/${appt.id}`}
                      className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
                    >
                      Entrar na Consulta
                    </a>
                  )}
                </div>
              </div>
            ))}
            {appointments.length === 0 && <p className="text-gray-400">Nenhuma consulta agendada.</p>}
          </div>
        </div>
        <div className="p-6 bg-white shadow rounded-lg">
          <h2 className="text-xl font-semibold">Encontrar Especialista</h2>
          <div className="mt-4 space-y-4">
            {doctors.map((doctor) => (
              <div key={doctor.id} className="p-4 border rounded flex justify-between items-center">
                <div>
                  <p className="font-bold">Dr. {doctor?.user?.name || 'Médico'}</p>
                  <p className="text-sm text-gray-500">{doctor.specialty}</p>
                </div>
                <button 
                  onClick={() => {
                    setSelectedDoctor(doctor);
                    setIsModalOpen(true);
                  }}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                >
                  Ver Disponibilidade
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isModalOpen && selectedDoctor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Agenda de Dr. {selectedDoctor?.user?.name || 'Médico'}</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {(() => {
                const slots = selectedDoctor.availability ? JSON.parse(selectedDoctor.availability) : [];
                if (slots.length === 0) return <p className="text-gray-500 text-center py-4">Nenhum horário disponível no momento.</p>;
                
                return slots.map((slot: any, idx: number) => {
                  const dateStr = getSlotDate(slot.day, slot.start);
                  return (
                    <div key={idx} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-blue-50 transition-colors">
                      <div>
                        <p className="font-medium text-gray-900">{slot.day}</p>
                        <p className="text-sm text-gray-500">{slot.start} - {slot.end}</p>
                        <p className="text-xs text-blue-600 mt-1">Próximo disponível: {new Date(dateStr).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <button
                        onClick={() => handleBook(selectedDoctor.userId, dateStr)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-sm transition-all"
                      >
                        Agendar
                      </button>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
