'use client';

import { useState } from 'react';

export default function PatientSetupPage() {
  const [phone, setPhone] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:3000/profile/patient/setup', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ phone, medicalHistory }),
    });

    if (res.ok) {
      alert('Perfil configurado com sucesso!');
      window.location.href = '/dashboard/patient';
    } else {
      alert('Erro ao configurar perfil.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 p-8 bg-white shadow-md rounded-lg">
        <h1 className="text-2xl font-bold text-center text-blue-600">Configuração de Perfil Paciente</h1>
        <p className="text-gray-600 text-center">Complete seus dados para agendar sua primeira consulta.</p>
        <input
          type="text"
          placeholder="Telefone de contato"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />
        <textarea
          placeholder="Breve histórico médico (opcional)"
          value={medicalHistory}
          onChange={(e) => setMedicalHistory(e.target.value)}
          className="w-full p-2 border rounded"
          rows={3}
        />
        <button type="submit" className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Finalizar Setup
        </button>
      </form>
    </div>
  );
}
