'use client';

import { useState } from 'react';

export default function DoctorSetupPage() {
  const [specialty, setSpecialty] = useState('');
  const [crm, setCrm] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:3000/profile/doctor/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ specialty, crm }),
    });

    if (res.ok) {
      window.location.href = '/dashboard/doctor';
    } else {
      setError('Erro ao configurar perfil. Tente novamente.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-4 p-8 bg-white shadow-md rounded-lg">
        <h1 className="text-2xl font-bold text-center text-blue-600">Configuração de Perfil Médico</h1>
        <p className="text-gray-600 text-center">Complete seus dados para começar a atender.</p>
        {error && (
          <div className="p-3 bg-red-100 text-red-700 text-sm rounded border border-red-200">
            {error}
          </div>
        )}
        <input
          type="text"
          placeholder="Especialidade (ex: Psiquiatria Infantil)"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <input
          type="text"
          placeholder="CRM"
          value={crm}
          onChange={(e) => setCrm(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <button
          type="button"
          onClick={handleSubmit}
          className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Finalizar Setup
        </button>
      </div>
    </div>
  );
}
