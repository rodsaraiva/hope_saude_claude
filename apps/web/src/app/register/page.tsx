'use client';

import { useState } from 'react';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('PATIENT');
  const [error, setError] = useState('');

  const handleRegister = async () => {
    setError('');
    const res = await fetch('http://localhost:3000/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role }),
    });
    const data = await res.json();
    if (data.id) {
      window.location.href = '/login';
    } else {
      setError('Falha ao cadastrar. Tente outro e-mail.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-4 p-8 bg-white shadow-md rounded-lg">
        <h1 className="text-2xl font-bold text-center text-blue-600">Hope Saúde - Cadastro</h1>
        {error && (
          <div className="p-3 bg-red-100 text-red-700 text-sm rounded border border-red-200">
            {error}
          </div>
        )}
        <input
          type="text"
          placeholder="Nome Completo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <div className="flex space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              value="PATIENT"
              checked={role === 'PATIENT'}
              onChange={(e) => setRole(e.target.value)}
            />
            <span>Paciente</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              value="DOCTOR"
              checked={role === 'DOCTOR'}
              onChange={(e) => setRole(e.target.value)}
            />
            <span>Médico</span>
          </label>
        </div>
        <button
          type="button"
          onClick={handleRegister}
          className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Cadastrar
        </button>
      </div>
    </div>
  );
}
