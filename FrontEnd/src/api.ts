// Cliente HTTP fino pra API do BackEnd (ver BackEnd/README.md pras rotas).
// Sem lib nova — fetch já resolve.

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface HorarioMedicamento {
  id: number;
  id_dispositivo: string;
  nome_remedio: string;
  dosagem: string | null;
  horario: string; // "HH:mm:ss"
  estoque: number;
  segunda: boolean;
  terca: boolean;
  quarta: boolean;
  quinta: boolean;
  sexta: boolean;
  sabado: boolean;
  domingo: boolean;
}

export interface HistoricoDose {
  id: number;
  nome_remedio: string;
  horario_programado: string; // ISO datetime
  horario_tomado: string | null; // ISO datetime — null quando o evento é "Não Tomado"
  status: string; // 'Tomado' | 'Atrasado' | 'Não Tomado'
}

export interface Dispositivo {
  id_dispositivo: string;
  nome_paciente: string;
  nome_cuidador: string;
  telefone: string | null;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.erro ?? `Erro ${res.status} ao acessar ${path}`);
  }
  return res.json();
}

export function fetchAgenda(deviceId: string) {
  return request<HorarioMedicamento[]>(`/api/dispositivo/${deviceId}/agenda`);
}

export function fetchHistorico(deviceId: string) {
  return request<HistoricoDose[]>(`/api/dispositivo/${deviceId}/historico`);
}

export function fetchDispositivo(deviceId: string) {
  return request<Dispositivo>(`/api/dispositivo/${deviceId}`);
}

export function createHorario(input: {
  id_dispositivo: string;
  nome_remedio: string;
  dosagem: string;
  horario: string;
}) {
  return request<{ mensagem: string; dados: HorarioMedicamento }>('/api/medicamentos/agendar', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((r) => r.dados);
}

export function deleteHorario(id: number) {
  return request<{ mensagem: string }>(`/api/medicamentos/${id}`, { method: 'DELETE' });
}

export function updateHorario(
  id: number,
  input: { nome_remedio: string; dosagem: string; horario: string; estoque: number }
) {
  return request<{ mensagem: string; dados: HorarioMedicamento }>(`/api/medicamentos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }).then((r) => r.dados);
}

export function confirmarDose(input: {
  id_dispositivo: string;
  nome_remedio: string;
  horario_programado: string;
}) {
  return request<{ mensagem: string; dados: HistoricoDose }>('/api/dispositivo/confirmacao', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((r) => r.dados);
}
