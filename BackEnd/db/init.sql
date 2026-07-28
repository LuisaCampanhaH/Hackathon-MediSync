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
    telefone VARCHAR(20),                   -- telefone do cuidador/paciente, botão "ligar" na tela de alerta
    token_notificacao TEXT                  -- ID do celular para mandar o Push
);

-- 2. TABELA DE HORÁRIOS (AGENDA DE REMÉDIOS)
CREATE TABLE IF NOT EXISTS horarios_medicamentos (
    id SERIAL PRIMARY KEY,
    id_dispositivo VARCHAR(50) REFERENCES dispositivos(id_dispositivo) ON DELETE CASCADE,
    nome_remedio VARCHAR(100) NOT NULL,
    dosagem VARCHAR(50),                     -- Ex: "1 comprimido", "10ml"
    horario TIME NOT NULL,                   -- Ex: "08:00:00"
    estoque INTEGER DEFAULT 0,               -- comprimidos restantes na caixinha

    -- Dias da semana: por padrão (DEFAULT), nasce como TRUE (todos os dias)
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
    horario_programado TIMESTAMP NOT NULL,   -- Data e Hora que DEVERIA tomar (Ex: 18/07/2026 08:00)
    horario_tomado TIMESTAMP,                -- Data e Hora que EFETIVAMENTE tomou
    status VARCHAR(20) NOT NULL              -- "Tomado" ou "Atrasado", "Não Tomado"
);

-- Dispositivo de exemplo para testar as rotas localmente.
INSERT INTO dispositivos (id_dispositivo, nome_paciente, nome_cuidador, telefone)
VALUES ('ESP32-TESTE-01', 'Maria Oliveira', 'Luan Oliveira', '+5511999998888')
ON CONFLICT DO NOTHING;
