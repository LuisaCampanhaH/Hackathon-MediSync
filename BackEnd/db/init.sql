-- ============================================================
-- SETUP COMPLETO: SCHEMA + DADOS DE TESTE
-- Pode ser rodado direto contra o banco do Render:
--   psql "postgresql://usuario:senha@host-do-render/banco" -f setup_completo.sql
-- Idempotente: usa IF NOT EXISTS / ON CONFLICT, então pode rodar
-- de novo sem quebrar nem duplicar dados.
-- ============================================================

-- ------------------------------------------------------------
-- PARTE 1: SCHEMA (tabelas)
-- ------------------------------------------------------------

-- 1. TABELA DE PACIENTES / DISPOSITIVOS
CREATE TABLE IF NOT EXISTS dispositivos (
    id_dispositivo VARCHAR(50) PRIMARY KEY, -- ID único (ex: endereço MAC do ESP32)
    nome_paciente VARCHAR(100) NOT NULL,
    nome_cuidador VARCHAR(100) NOT NULL,
    telefone VARCHAR(20),                   -- telefone do cuidador
    telefone_paciente VARCHAR(20),          -- telefone do paciente
    token_notificacao TEXT                  -- ID do telemóvel para enviar a notificação Push
);

-- 2. TABELA DE HORÁRIOS (AGENDA DE MEDICAMENTOS)
CREATE TABLE IF NOT EXISTS horarios_medicamentos (
    id SERIAL PRIMARY KEY,
    id_dispositivo VARCHAR(50) REFERENCES dispositivos(id_dispositivo) ON DELETE CASCADE,
    nome_remedio VARCHAR(100) NOT NULL,
    dosagem VARCHAR(50),                     -- Ex: "1 comprimido", "10ml"
    horario TIME NOT NULL,                   -- Ex: "08:00:00"
    estoque INTEGER DEFAULT 0,               -- comprimidos restantes na caixa

    -- Dias da semana
    segunda BOOLEAN DEFAULT TRUE,
    terca BOOLEAN DEFAULT TRUE,
    quarta BOOLEAN DEFAULT TRUE,
    quinta BOOLEAN DEFAULT TRUE,
    sexta BOOLEAN DEFAULT TRUE,
    sabado BOOLEAN DEFAULT TRUE,
    domingo BOOLEAN DEFAULT TRUE
);

-- 3. TABELA DE HISTÓRICO (LOG DE DOSES)
CREATE TABLE IF NOT EXISTS historico_doses (
    id SERIAL PRIMARY KEY,
    id_dispositivo VARCHAR(50) REFERENCES dispositivos(id_dispositivo) ON DELETE CASCADE,
    nome_remedio VARCHAR(100) NOT NULL,
    horario_programado TIMESTAMP NOT NULL,   -- Data e Hora em que DEVERIA tomar
    horario_tomado TIMESTAMP,                -- Data e Hora em que EFETIVAMENTE tomou
    status VARCHAR(20) NOT NULL              -- "No Prazo", "Atrasado", "Nao Tomado"
);

-- 4. TABELA DE UTILIZADORES / CUIDADORES (SUPORTE A MÚLTIPLOS CUIDADORES)
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    telefone VARCHAR(20)
);

-- 5. TABELA DE VINCULAÇÃO (DISPOSITIVO <-> CUIDADORES)
CREATE TABLE IF NOT EXISTS dispositivo_cuidadores (
    id SERIAL PRIMARY KEY,
    id_dispositivo VARCHAR(50) REFERENCES dispositivos(id_dispositivo) ON DELETE CASCADE,
    id_usuario INT REFERENCES usuarios(id) ON DELETE CASCADE,
    papel VARCHAR(30) DEFAULT 'familiar'
);

-- Garante que a coluna exista mesmo em bancos onde a tabela "dispositivos" já
-- tinha sido criada ANTES dessa coluna existir (CREATE TABLE IF NOT EXISTS não
-- altera tabelas já existentes, só cria as que faltam).
ALTER TABLE dispositivos ADD COLUMN IF NOT EXISTS telefone_paciente VARCHAR(20);

-- ------------------------------------------------------------
-- PARTE 2: DADOS DE TESTE INICIAIS (originais do schema)
-- ------------------------------------------------------------

INSERT INTO dispositivos (id_dispositivo, nome_paciente, nome_cuidador, telefone, telefone_paciente)
VALUES ('ESP32-TESTE-01', 'Maria Oliveira', 'Luan Oliveira', '+5511999998888', '+5511999998888')
ON CONFLICT DO NOTHING;

INSERT INTO dispositivos (id_dispositivo, nome_paciente, nome_cuidador, telefone, telefone_paciente)
VALUES ('1', 'Dona Maria', 'João Cuidador', '31999999999', '31999999999')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- PARTE 3: DADOS DE TESTE ADICIONAIS (população extra)
-- ------------------------------------------------------------

-- 3.1 DISPOSITIVOS
INSERT INTO dispositivos (id_dispositivo, nome_paciente, nome_cuidador, telefone, telefone_paciente, token_notificacao)
VALUES
    ('ESP32-A1B2C3', 'José Ferreira',  'Ana Ferreira',   '+5531988887777', '+5531977776666', NULL),
    ('ESP32-D4E5F6', 'Antônia Souza',  'Carlos Souza',   '+5511955554444', '+5511944443333', NULL),
    ('2',            'Sr. Antônio',    'Patrícia Lima',  '31988776655',    '31988776600',    NULL)
ON CONFLICT DO NOTHING;

-- 3.2 USUÁRIOS (cuidadores cadastrados no app)
INSERT INTO usuarios (nome, email, telefone)
VALUES
    ('Luan Oliveira',   'luan.oliveira@example.com',   '+5511999998888'),
    ('João Cuidador',   'joao.cuidador@example.com',   '31999999999'),
    ('Ana Ferreira',    'ana.ferreira@example.com',    '+5531988887777'),
    ('Carlos Souza',    'carlos.souza@example.com',    '+5511955554444'),
    ('Patrícia Lima',   'patricia.lima@example.com',   '31988776655')
ON CONFLICT (email) DO NOTHING;

-- 3.3 VÍNCULOS DISPOSITIVO <-> CUIDADORES
INSERT INTO dispositivo_cuidadores (id_dispositivo, id_usuario, papel)
SELECT d.id_dispositivo, u.id, v.papel
FROM (VALUES
    ('ESP32-TESTE-01', 'luan.oliveira@example.com',   'principal'),
    ('1',              'joao.cuidador@example.com',   'principal'),
    ('ESP32-A1B2C3',   'ana.ferreira@example.com',    'principal'),
    ('ESP32-D4E5F6',   'carlos.souza@example.com',    'principal'),
    ('2',              'patricia.lima@example.com',   'principal')
) AS v(id_dispositivo, email, papel)
JOIN dispositivos d ON d.id_dispositivo = v.id_dispositivo
JOIN usuarios u ON u.email = v.email
WHERE NOT EXISTS (
    SELECT 1 FROM dispositivo_cuidadores dc
    WHERE dc.id_dispositivo = v.id_dispositivo AND dc.id_usuario = u.id
);

-- 3.4 HORÁRIOS DE MEDICAMENTOS
INSERT INTO horarios_medicamentos
    (id_dispositivo, nome_remedio, dosagem, horario, estoque,
     segunda, terca, quarta, quinta, sexta, sabado, domingo)
SELECT v.id_dispositivo, v.nome_remedio, v.dosagem, v.horario::time, v.estoque,
       v.segunda, v.terca, v.quarta, v.quinta, v.sexta, v.sabado, v.domingo
FROM (VALUES
    ('ESP32-TESTE-01', 'Losartana',      '1 comprimido', '08:00:00', 28, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
    ('ESP32-TESTE-01', 'Metformina',     '1 comprimido', '13:00:00', 20, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
    ('ESP32-TESTE-01', 'Sinvastatina',   '1 comprimido', '21:00:00', 15, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
    ('1',              'AAS',            '1 comprimido', '09:00:00', 30, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
    ('1',              'Vitamina D',     '1 gota',       '09:00:00', 60, TRUE, FALSE, TRUE, FALSE, TRUE, FALSE, FALSE),
    ('ESP32-A1B2C3',   'Insulina NPH',   '10ml',         '07:30:00', 10, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
    ('ESP32-A1B2C3',   'Insulina NPH',   '10ml',         '19:30:00', 10, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
    ('ESP32-D4E5F6',   'Levotiroxina',   '1 comprimido', '06:30:00', 25, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
    ('2',              'Omeprazol',      '1 cápsula',    '07:00:00', 14, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE)
) AS v(id_dispositivo, nome_remedio, dosagem, horario, estoque,
       segunda, terca, quarta, quinta, sexta, sabado, domingo)
WHERE NOT EXISTS (
    SELECT 1 FROM horarios_medicamentos h
    WHERE h.id_dispositivo = v.id_dispositivo
      AND h.nome_remedio = v.nome_remedio
      AND h.horario = v.horario::time
);

-- 3.5 HISTÓRICO DE DOSES (últimos dias, alguns status variados)
INSERT INTO historico_doses (id_dispositivo, nome_remedio, horario_programado, horario_tomado, status)
VALUES
    ('ESP32-TESTE-01', 'Losartana',    NOW() - INTERVAL '2 day' + TIME '08:00:00', NOW() - INTERVAL '2 day' + TIME '08:03:00', 'No Prazo'),
    ('ESP32-TESTE-01', 'Metformina',   NOW() - INTERVAL '2 day' + TIME '13:00:00', NOW() - INTERVAL '2 day' + TIME '13:40:00', 'Atrasado'),
    ('ESP32-TESTE-01', 'Sinvastatina', NOW() - INTERVAL '2 day' + TIME '21:00:00', NULL,                                     'Nao Tomado'),
    ('ESP32-TESTE-01', 'Losartana',    NOW() - INTERVAL '1 day' + TIME '08:00:00', NOW() - INTERVAL '1 day' + TIME '07:58:00', 'No Prazo'),
    ('ESP32-TESTE-01', 'Metformina',   NOW() - INTERVAL '1 day' + TIME '13:00:00', NOW() - INTERVAL '1 day' + TIME '13:05:00', 'No Prazo'),
    ('1',              'AAS',          NOW() - INTERVAL '1 day' + TIME '09:00:00', NOW() - INTERVAL '1 day' + TIME '09:10:00', 'No Prazo'),
    ('1',              'Vitamina D',   NOW() - INTERVAL '1 day' + TIME '09:00:00', NULL,                                     'Nao Tomado'),
    ('ESP32-A1B2C3',   'Insulina NPH', NOW() - INTERVAL '1 day' + TIME '07:30:00', NOW() - INTERVAL '1 day' + TIME '07:33:00', 'No Prazo'),
    ('ESP32-A1B2C3',   'Insulina NPH', NOW() - INTERVAL '1 day' + TIME '19:30:00', NOW() - INTERVAL '1 day' + TIME '20:15:00', 'Atrasado'),
    ('ESP32-D4E5F6',   'Levotiroxina', NOW() - INTERVAL '1 day' + TIME '06:30:00', NOW() - INTERVAL '1 day' + TIME '06:31:00', 'No Prazo'),
    ('2',              'Omeprazol',    NOW() - INTERVAL '1 day' + TIME '07:00:00', NULL,                                     'Nao Tomado')
ON CONFLICT DO NOTHING;

-- Dose de hoje ainda pendente (útil pra testar lógica de notificação/atraso)
INSERT INTO historico_doses (id_dispositivo, nome_remedio, horario_programado, horario_tomado, status)
VALUES
    ('ESP32-TESTE-01', 'Losartana', CURRENT_DATE + TIME '08:00:00', NULL, 'Nao Tomado')
ON CONFLICT DO NOTHING;