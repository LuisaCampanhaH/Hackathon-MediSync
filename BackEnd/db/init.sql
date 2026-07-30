-- Schema real, como fornecido pelo time do backend. Reproduzido aqui (com
-- IF NOT EXISTS + o INSERT de teste no final) só pra o Postgres do
-- docker-compose já subir com a estrutura certa — nenhuma coluna/tipo foi
-- alterado em relação ao script original.
--
-- Rodado automaticamente pelo container do docker-compose no primeiro boot
-- (Postgres executa tudo em /docker-entrypoint-initdb.d na criação do volume).

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

-- DADOS DE TESTE INICIAIS
INSERT INTO dispositivos (id_dispositivo, nome_paciente, nome_cuidador, telefone, telefone_paciente)
VALUES ('ESP32-TESTE-01', 'Maria Oliveira', 'Luan Oliveira', '+5511999998888', '+5511999998888')
ON CONFLICT DO NOTHING;

INSERT INTO dispositivos (id_dispositivo, nome_paciente, nome_cuidador, telefone, telefone_paciente)
VALUES ('1', 'Dona Maria', 'João Cuidador', '31999999999', '31999999999')
ON CONFLICT DO NOTHING;