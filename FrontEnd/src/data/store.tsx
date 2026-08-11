// Fonte de dados do app: substitui o antigo mockData.ts por chamadas reais
// ao BackEnd. 1 usuário = 1 dispositivo (decidido na reunião com o time de
// hardware) — sem seletor de pacientes, sem status online/offline (o
// dispositivo não reporta isso). pending/late e as estatísticas de aderência
// continuam calculadas no cliente.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  API_URL,
  confirmarDose,
  createHorario,
  deleteHorario,
  fetchAgenda,
  fetchDispositivo,
  fetchHistorico,
  updateHorario,
  type HistoricoDose,
  type HorarioMedicamento,
} from '../api';
import {
  cancelDoseNotifications,
  LATE_REMINDER_MINUTES,
  notifyNow,
  scheduleDoseNotifications,
  type DoseNotificationIds,
} from '../notifications';

// Precisa bater com o id_dispositivo semeado em BackEnd/db/init.sql — 1
// usuário = 1 dispositivo, cadastrado direto no banco (sem tela de cadastro).
const DEVICE_ID = process.env.EXPO_PUBLIC_DEVICE_ID ?? 'ESP32-TESTE-01';
const FALLBACK_PATIENT_NAME = process.env.EXPO_PUBLIC_PATIENT_NAME ?? 'Paciente';

// ✨ NOVO: Constante para delay seguro
const CONFIRMACAO_DELAY_MS = 500;

export type DoseStatus = 'pending' | 'taken' | 'late';

interface WeekdayFlags {
  domingo: boolean;
  segunda: boolean;
  terca: boolean;
  quarta: boolean;
  quinta: boolean;
  sexta: boolean;
  sabado: boolean;
}

export interface MedicationSlot extends WeekdayFlags {
  horarioId: number;
  time: string; // "HH:mm"
}

export interface Medication {
  // chave sintética nome+dosagem — não existe id de "medicamento" no back,
  // só de "horário" (ver plan.md). Colide se dois remédios do mesmo
  // paciente tiverem nome e dosagem idênticos.
  id: string;
  name: string;
  dosage: string;
  stock: number; // estoque vive por horário no back; usamos o do primeiro slot como o do grupo
  times: string[]; // "HH:mm", ordenado
  slots: MedicationSlot[];
}

export interface DoseLogEntry {
  id: string;
  medicationId: string;
  horarioId: number;
  scheduledTime: string; // "HH:mm"
  scheduledAt: string; // ISO datetime de hoje, usado pra confirmar a dose
  status: DoseStatus;
  takenAt?: string; // "HH:mm"
}

export interface Patient {
  id: string;
  name: string;
  phone: string | null;
  initials: string;
  medications: Medication[];
  doseLog: DoseLogEntry[];
}

export interface AdherenceDay {
  label: string;
  taken: number;
  missed: number;
}

export function getMedication(patient: Patient, medicationId: string) {
  return patient.medications.find((m) => m.id === medicationId);
}

const WEEKDAY_FIELDS: (keyof WeekdayFlags)[] = [
  'domingo',
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
  'sabado',
]; // indexado por Date.getDay()

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function medicationKey(nome: string, dosagem: string) {
  return `${nome}__${dosagem}`;
}

function groupMedications(horarios: HorarioMedicamento[]): Medication[] {
  const groups = new Map<string, Medication>();
  horarios.forEach((h) => {
    const dosage = h.dosagem ?? '';
    const key = medicationKey(h.nome_remedio, dosage);
    const time = h.horario.slice(0, 5);
    const slot: MedicationSlot = {
      horarioId: h.id,
      time,
      domingo: h.domingo,
      segunda: h.segunda,
      terca: h.terca,
      quarta: h.quarta,
      quinta: h.quinta,
      sexta: h.sexta,
      sabado: h.sabado,
    };
    const existing = groups.get(key);
    if (existing) {
      existing.slots.push(slot);
      existing.times = [...existing.times, time].sort();
    } else {
      groups.set(key, {
        id: key,
        name: h.nome_remedio,
        dosage,
        stock: h.estoque,
        times: [time],
        slots: [slot],
      });
    }
  });
  return [...groups.values()];
}

// Compara um timestamp vindo do back com uma data/hora local.
//
// BUG DE FUSO HORÁRIO (era o motivo de o botão do hardware não atualizar o
// app): a coluna horario_programado/horario_tomado no Postgres é
// TIMESTAMP SEM TIMEZONE. O ESP32 manda a hora local de Brasília "nua"
// (ex: "08:00:00", sem offset). O Postgres grava esse valor literalmente,
// mas o driver node-postgres, ao ler essa coluna de volta, relabela esses
// mesmos dígitos como se fossem UTC. Se a gente usasse getHours()/getMinutes()
// aqui, o JS converteria esse "UTC" pro fuso local do celular, deslocando o
// horário (ex: 08:00 vira 05:00 num celular em UTC-3) — daí a dose nunca
// batia com o horário agendado e o app continuava mostrando "pending" mesmo
// com a confirmação já salva no banco. Usar os getters *UTC* aqui desfaz
// esse relabel e recupera os dígitos originais que o ESP32 enviou.
function sameSlot(iso: string, scheduled: Date) {
  const a = new Date(iso);
  return (
    a.getUTCFullYear() === scheduled.getFullYear() &&
    a.getUTCMonth() === scheduled.getMonth() &&
    a.getUTCDate() === scheduled.getDate() &&
    a.getUTCHours() === scheduled.getHours() &&
    a.getUTCMinutes() === scheduled.getMinutes()
  );
}

function toHHMM(iso: string) {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function scheduledAtFor(day: Date, time: string) {
  const [h, m] = time.split(':').map(Number);
  const result = new Date(day);
  result.setHours(h, m, 0, 0);
  return result;
}

// horario_tomado nulo = a caixinha já avisou "Não Tomado" pra essa dose, mas
// ninguém confirmou de fato — não conta como tomada, mesmo já tendo uma
// linha no histórico.
function findConfirmedMatch(historico: HistoricoDose[], nomeRemedio: string, scheduled: Date) {
  return historico.find(
    (d) => d.nome_remedio === nomeRemedio && d.horario_tomado && sameSlot(d.horario_programado, scheduled)
  );
}

// Doses de UM dia específico (não necessariamente hoje — usado tanto pra
// hoje quanto pro preenchimento com dias futuros abaixo).
function computeDoseLogForDay(
  medications: Medication[],
  historico: HistoricoDose[],
  day: Date
): DoseLogEntry[] {
  const now = new Date();
  const weekdayField = WEEKDAY_FIELDS[day.getDay()];
  const entries: DoseLogEntry[] = [];

  medications.forEach((med) => {
    med.slots.forEach((slot) => {
      if (!slot[weekdayField]) return;

      const scheduled = scheduledAtFor(day, slot.time);
      const match = findConfirmedMatch(historico, med.name, scheduled);

      let status: DoseStatus = 'pending';
      let takenAt: string | undefined;
      if (match) {
        status = 'taken';
        takenAt = toHHMM(match.horario_tomado!);
      } else if (now.getTime() > scheduled.getTime() + LATE_REMINDER_MINUTES * 60000) {
        status = 'late';
      }

      entries.push({
        id: `${slot.horarioId}-${scheduled.toDateString()}`,
        medicationId: med.id,
        horarioId: slot.horarioId,
        scheduledTime: slot.time,
        scheduledAt: scheduled.toISOString(),
        status,
        takenAt,
      });
    });
  });

  return entries.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
}

const MIN_DOSE_LOG_ENTRIES = 4;
const MAX_LOOKAHEAD_DAYS = 14; // evita loop longo quando tem pouco (ou nenhum) medicamento cadastrado

// Doses de hoje + preenchimento com os próximos dias, caso hoje sozinho não
// tenha pelo menos MIN_DOSE_LOG_ENTRIES doses (pedido do time pra sempre
// mostrar uma lista com corpo na Dashboard, mesmo em dias mais vazios).
function computeTodayDoseLog(medications: Medication[], historico: HistoricoDose[]): DoseLogEntry[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const entries = computeDoseLogForDay(medications, historico, today);

  for (let offset = 1; entries.length < MIN_DOSE_LOG_ENTRIES && offset <= MAX_LOOKAHEAD_DAYS; offset++) {
    const day = new Date(today);
    day.setDate(day.getDate() + offset);
    entries.push(...computeDoseLogForDay(medications, historico, day));
  }

  return entries.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

function computeAdherence(medications: Medication[], historico: HistoricoDose[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let scheduled = 0;
  let onTime = 0;

  // Conta as doses completadas (horario_tomado !== null) nos últimos 7 dias
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const dosesNasSeteAmostras = computeDoseLogForDay(medications, historico, today).length;
  const expectedInSevenDays = dosesNasSeteAmostras * 7;

  for (const d of historico) {
    const doseDate = new Date(d.horario_programado);
    doseDate.setHours(0, 0, 0, 0);
    if (doseDate < sevenDaysAgo) continue;
    scheduled++;
    if (d.horario_tomado) onTime++;
  }

  const proximas7Dias = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(today);
    day.setDate(day.getDate() - 6 + i);
    const dosesForDay = computeDoseLogForDay(medications, historico, day);
    const takenToday = dosesForDay.filter((d) => d.status === 'taken').length;
    return {
      label: DAY_LABELS[day.getDay()],
      taken: takenToday,
      missed: dosesForDay.length - takenToday,
    };
  });

  // Streak: dias consecutivos (terminando hoje/ontem) sem doses atrasadas/perdidas.
  // 'pending' (ainda não venceu, ex: dose de hoje à noite) não quebra a
  // sequência — só 'late' (perdida/atrasada) conta como falha.
  let streakDays = 0;
  for (let offset = 0; offset <= MAX_LOOKAHEAD_DAYS; offset++) {
    const day = new Date(today);
    day.setDate(day.getDate() - offset);
    const dosesForDay = computeDoseLogForDay(medications, historico, day);
    if (dosesForDay.length === 0) continue;
    const hasMissed = dosesForDay.some((d) => d.status === 'late');
    if (hasMissed) break;
    streakDays++;
  }

  return {
    percentualAderencia: scheduled === 0 ? 0 : Math.round((onTime / scheduled) * 100),
    dosagemHoje: dosesNasSeteAmostras,
    aderenciaProximosDias: expectedInSevenDays,
    proximas7Dias,
    adherenceStats: {
      scheduled,
      onTime,
      late: scheduled - onTime,
    },
    weeklyAdherence: proximas7Dias,
    streakDays,
  };
}

interface StoreValue {
  patient: Patient;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addMedication: (input: { name: string; dosage: string; stock: number; times: string[] }) => Promise<void>;
  updateMedication: (
    medicationId: string,
    input: { name: string; dosage: string; stock: number; times: string[] }
  ) => Promise<void>;
  deleteMedication: (medicationId: string) => Promise<void>;
  markDoseTaken: (doseId: string) => Promise<void>;
  percentualAderencia: number;
  dosagemHoje: number;
  proximas7Dias: AdherenceDay[];
  aderenciaProximosDias: number;
  adherenceStats: { scheduled: number; onTime: number; late: number };
  weeklyAdherence: AdherenceDay[];
  streakDays: number;
}

const StoreContext = createContext<StoreValue | null>(null);

export function PatientDataProvider({ children }: { children: React.ReactNode }) {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [historico, setHistorico] = useState<HistoricoDose[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patientName, setPatientName] = useState(FALLBACK_PATIENT_NAME);
  const [patientPhone, setPatientPhone] = useState<string | null>(null);
  const notifIds = useRef(new Map<string, DoseNotificationIds>());

  const load = useCallback(async () => {
    try {
      const [agenda, hist, dispositivo] = await Promise.all([
        fetchAgenda(DEVICE_ID),
        fetchHistorico(DEVICE_ID),
        fetchDispositivo(DEVICE_ID),
      ]);
      setMedications(groupMedications(agenda));
      setHistorico(hist);
      setPatientName(dispositivo.nome_paciente);
      setPatientPhone(dispositivo.telefone);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar dados do servidor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // O backend avisa por WebSocket sempre que a agenda, o histórico de doses
  // ou os medicamentos mudam — inclusive quando é o ESP32 quem confirma (ou
  // não) uma dose. Recarrega os dados pra refletir isso sem precisar de
  // polling, e dispara uma notificação local pro cuidador ver na hora.
  useEffect(() => {
    const socket = io(API_URL);

    // Reconexão (ex: backend no Render hibernou e voltou, wifi caiu e
    // voltou) — qualquer evento perdido durante a desconexão nunca vai
    // chegar via socket, já que ninguém tava ouvindo. Sem isso o app fica
    // travado nos dados de antes da queda até o usuário fechar e reabrir.
    let isFirstConnect = true;
    socket.on('connect', () => {
      if (isFirstConnect) {
        isFirstConnect = false;
        return;
      }
      load();
    });

    function refreshIfOurDevice(payload: { id_dispositivo?: string }) {
      if (!payload.id_dispositivo || payload.id_dispositivo === DEVICE_ID) load();
    }

    socket.on('agenda_atualizada', refreshIfOurDevice);

    socket.on(
      'nova_dose_registrada',
      (payload: {
        id_dispositivo?: string; // ✨ NOVO: Pode vir no root do payload
        dose?: { id_dispositivo?: string; nome_remedio?: string; status?: string };
        estoque_atual?: number | null;
        mensagem?: string;
      }) => {
        // ✨ MELHORADO: Verifica id_dispositivo em dois lugares
        const idDispositivo = payload.id_dispositivo || payload.dose?.id_dispositivo;

        // Se vem de outro dispositivo, ignora
        if (idDispositivo && idDispositivo !== DEVICE_ID) {
          return;
        }

        // Se é nosso dispositivo (ou não conseguiu identificar), recarrega
        load();

        // Se temos estoque baixo, avisa
        if (payload.estoque_atual != null && payload.estoque_atual <= 3) {
          notifyNow(
            'MediSync — Estoque baixo',
            `Restam apenas ${payload.estoque_atual} comprimidos de ${payload.dose?.nome_remedio ?? 'um medicamento'}!`
          ).catch(() => {});
        }

        // Se tem mensagem, mostra notificação
        const title =
          payload.dose?.status === 'Atrasado'
            ? 'MediSync — Atraso na medicação'
            : payload.dose?.status === 'Nao Tomado'
              ? 'MediSync — Dose não tomada'
              : 'MediSync';
        if (payload.mensagem) notifyNow(title, payload.mensagem).catch(() => {});
      }
    );

    socket.on('medicamento_deletado', () => load());

    return () => {
      socket.disconnect();
    };
  }, [load]);

  const doseLog = useMemo(() => computeTodayDoseLog(medications, historico), [medications, historico]);
  const adherence = useMemo(() => computeAdherence(medications, historico), [medications, historico]);

  // Agenda notificação local pra cada dose de HOJE ainda pendente que a
  // gente ainda não tinha visto (evita duplicar a cada refresh). doseLog às
  // vezes inclui dias futuros só pra preencher a lista da Dashboard (ver
  // computeTodayDoseLog) — esses não entram aqui, senão duplicaria o
  // lembrete do mesmo horário (ele já se repete todo dia sozinho).
  useEffect(() => {
    const todayStr = new Date().toDateString();
    doseLog
      .filter((dose) => new Date(dose.scheduledAt).toDateString() === todayStr)
      .forEach((dose) => {
        if (dose.status === 'taken' || notifIds.current.has(dose.id)) return;
        const med = medications.find((m) => m.id === dose.medicationId);
        if (!med) return;
        scheduleDoseNotifications(patientName, med.name, med.dosage, dose.scheduledTime)
          .then((ids) => {
            notifIds.current.set(dose.id, ids);
          })
          .catch(() => {});
      });
  }, [doseLog, medications, patientName]);

  function cancelNotificationsForMedication(medicationId: string) {
    doseLog
      .filter((d) => d.medicationId === medicationId)
      .forEach((dose) => {
        const ids = notifIds.current.get(dose.id);
        if (ids) {
          cancelDoseNotifications(ids);
          notifIds.current.delete(dose.id);
        }
      });
  }

  // O POST de agendar não aceita estoque (rota que não é nossa — ver
  // plan.md), então cria o horário e, na sequência, usa o PATCH (nosso) pra
  // gravar o estoque no registro recém-criado.
  async function createHorarioComEstoque(input: {
    name: string;
    dosage: string;
    time: string;
    stock: number;
  }) {
    const created = await createHorario({
      id_dispositivo: DEVICE_ID,
      nome_remedio: input.name,
      dosagem: input.dosage,
      horario: input.time,
    });
    await updateHorario(created.id, {
      nome_remedio: input.name,
      dosagem: input.dosage,
      horario: input.time,
      estoque: input.stock,
    });
  }

  async function addMedication(input: { name: string; dosage: string; stock: number; times: string[] }) {
    await Promise.all(
      input.times.map((time) =>
        createHorarioComEstoque({ name: input.name, dosage: input.dosage, time, stock: input.stock })
      )
    );
    await load();
  }

  async function updateMedication(
    medicationId: string,
    input: { name: string; dosage: string; stock: number; times: string[] }
  ) {
    const med = medications.find((m) => m.id === medicationId);
    if (!med) return;
    cancelNotificationsForMedication(medicationId);

    // Pareia os horários antigos com os novos um a um: reaproveita o id do
    // horário (PATCH) enquanto os dois lados tiverem posição correspondente,
    // apaga o excedente antigo e cria o excedente novo.
    const oldSlots = med.slots;
    const updates: Promise<unknown>[] = [];
    const shared = Math.min(oldSlots.length, input.times.length);
    for (let i = 0; i < shared; i++) {
      updates.push(
        updateHorario(oldSlots[i].horarioId, {
          nome_remedio: input.name,
          dosagem: input.dosage,
          horario: input.times[i],
          estoque: input.stock,
        })
      );
    }
    for (let i = shared; i < oldSlots.length; i++) {
      updates.push(deleteHorario(oldSlots[i].horarioId));
    }
    for (let i = shared; i < input.times.length; i++) {
      updates.push(
        createHorarioComEstoque({ name: input.name, dosage: input.dosage, time: input.times[i], stock: input.stock })
      );
    }
    await Promise.all(updates);
    await load();
  }

  async function deleteMedication(medicationId: string) {
    const med = medications.find((m) => m.id === medicationId);
    if (!med) return;
    cancelNotificationsForMedication(medicationId);
    await Promise.all(med.slots.map((s) => deleteHorario(s.horarioId)));
    await load();
  }

  // ✨ CORRIGIDO: Adicionar delay seguro antes de recarregar
  async function markDoseTaken(doseId: string) {
    const dose = doseLog.find((d) => d.id === doseId);
    const med = dose && medications.find((m) => m.id === dose.medicationId);
    if (!dose || !med) return;

    const ids = notifIds.current.get(dose.id);
    if (ids) {
      await cancelDoseNotifications(ids);
      notifIds.current.delete(dose.id);
    }

    // Envia a confirmação ao backend
    await confirmarDose({
      id_dispositivo: DEVICE_ID,
      nome_remedio: med.name,
      horario_programado: dose.scheduledAt,
    });

    // ✨ NOVO: Aguarda um delay seguro para garantir que o backend
    // finalizou a escrita no banco de dados antes de recarregar
    await new Promise(resolve => setTimeout(resolve, CONFIRMACAO_DELAY_MS));

    // Agora recarrega os dados
    await load();
  }

  const patient: Patient = useMemo(
    () => ({
      id: DEVICE_ID,
      name: patientName,
      phone: patientPhone,
      initials: getInitials(patientName),
      medications,
      doseLog,
    }),
    [medications, doseLog, patientName, patientPhone]
  );

  const value: StoreValue = {
    patient,
    loading,
    error,
    refresh: load,
    addMedication,
    updateMedication,
    deleteMedication,
    markDoseTaken,
    ...adherence,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function usePatientData() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('usePatientData must be used within PatientDataProvider');
  return ctx;
}
