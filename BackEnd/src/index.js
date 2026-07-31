const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./config/db'); 

const app = express();
app.use(cors());
app.use(express.json());

// Servidor HTTP integrado ao Socket.IO (WebSockets)
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE"]
  }
});

const PORT = process.env.PORT || 3000;

// ==================================================
// GERENCIADOR DE CONEXÕES WEBSOCKET
// ==================================================
io.on('connection', (socket) => {
  console.log(`🔌 [WEBSOCKET] Novo cliente conectado no App! ID: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`❌ [WEBSOCKET] Cliente desconectado: ${socket.id}`);
  });
});

// FUNÇÃO AUXILIAR: SIMULADOR DE PUSH NOTIFICATION
function enviarNotificacaoPush(nomeCuidador, nomePaciente, nomeRemedio, status, estoque) {
  console.log('\n==================================================');
  console.log(`📱 [PUSH NOTIFICATION] Enviando alerta para: ${nomeCuidador}`);
  if (status === 'Atrasado') {
    console.log(`⚠️ ALERTA DE EMERGÊNCIA: ${nomePaciente} está atrasado(a) com o remédio: ${nomeRemedio}!`);
  } else if (status === 'Nao Tomado') {
    console.log(`🚫 ALERTA: ${nomePaciente} NÃO tomou o remédio: ${nomeRemedio}!`);
  } else {
    console.log(`✅ AVISO: ${nomePaciente} tomou o remédio: ${nomeRemedio} no prazo.`);
  }

  if (estoque !== null && estoque <= 3) {
    console.log(`📦 ALERTA DE ESTOQUE: Restam apenas ${estoque} comprimidos de ${nomeRemedio}!`);
  }
  console.log('==================================================\n');
}

// ==================================================
// ROTAS DA API
// ==================================================

// 1. ROTA PRINCIPAL DE TESTE
app.get('/', (req, res) => {
  res.send('API do Dispenser com WebSockets e Controle de Estoque Rodando! 💊⚡');
});

// 2. ROTA: BUSCAR DADOS DO DISPOSITIVO (GET)
app.get('/api/dispositivo/:id', async (req, res) => {
  const idDispositivo = req.params.id;
  try {
    const querySQL = `
      SELECT id_dispositivo, nome_paciente, nome_cuidador, 
             COALESCE(telefone_paciente, telefone) AS telefone 
      FROM dispositivos 
      WHERE id_dispositivo = $1
    `;
    const resultado = await db.query(querySQL, [idDispositivo]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Dispositivo não encontrado.' });
    }

    return res.status(200).json(resultado.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar dispositivo:', error);
    return res.status(500).json({ erro: 'Erro interno ao buscar dispositivo no banco.' });
  }
});

// 2.1 ROTA: CADASTRAR (OU ATUALIZAR) UM DISPOSITIVO / PACIENTE (POST)
app.post('/api/dispositivo/cadastrar', async (req, res) => {
  const {
    id_dispositivo, nome_paciente, nome_cuidador,
    telefone, telefone_paciente, token_notificacao
  } = req.body;

  if (!id_dispositivo || !nome_paciente || !nome_cuidador) {
    return res.status(400).json({
      erro: 'id_dispositivo, nome_paciente e nome_cuidador são obrigatórios!'
    });
  }

  try {
    const querySQL = `
      INSERT INTO dispositivos
        (id_dispositivo, nome_paciente, nome_cuidador, telefone, telefone_paciente, token_notificacao)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id_dispositivo) DO UPDATE SET
        nome_paciente = EXCLUDED.nome_paciente,
        nome_cuidador = EXCLUDED.nome_cuidador,
        telefone = EXCLUDED.telefone,
        telefone_paciente = EXCLUDED.telefone_paciente,
        token_notificacao = COALESCE(EXCLUDED.token_notificacao, dispositivos.token_notificacao)
      RETURNING *;
    `;

    const valores = [
      id_dispositivo, nome_paciente, nome_cuidador,
      telefone ?? null, telefone_paciente ?? telefone ?? null, token_notificacao ?? null
    ];

    const resultado = await db.query(querySQL, valores);

    return res.status(201).json({
      mensagem: 'Dispositivo cadastrado/vinculado com sucesso! 📟',
      dados: resultado.rows[0]
    });
  } catch (error) {
    console.error('Erro ao cadastrar dispositivo:', error);
    return res.status(500).json({ erro: 'Erro interno ao salvar dispositivo no banco.' });
  }
});

// 2.2 ROTA: VINCULAR NOVO CUIDADOR/FAMILIAR AO DISPOSITIVO (POST)
app.post('/api/dispositivo/vincular-cuidador', async (req, res) => {
  const { id_dispositivo, nome, email, telefone, papel } = req.body;

  if (!id_dispositivo || !nome || !email) {
    return res.status(400).json({ erro: 'id_dispositivo, nome e email são obrigatórios!' });
  }

  try {
    // A. Cria ou busca o usuário pelo e-mail
    let userRes = await db.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    let usuarioId;

    if (userRes.rows.length === 0) {
      const novoUser = await db.query(
        'INSERT INTO usuarios (nome, email, telefone) VALUES ($1, $2, $3) RETURNING id',
        [nome, email, telefone || null]
      );
      usuarioId = novoUser.rows[0].id;
    } else {
      usuarioId = userRes.rows[0].id;
    }

    // B. Vincula o usuário à caixa na tabela intermediária
    await db.query(
      'INSERT INTO dispositivo_cuidadores (id_dispositivo, id_usuario, papel) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [id_dispositivo, usuarioId, papel || 'familiar']
    );

    return res.status(201).json({ 
      mensagem: 'Cuidador/Familiar vinculado com sucesso! 👥',
      id_usuario: usuarioId 
    });
  } catch (error) {
    console.error('Erro ao vincular cuidador:', error);
    return res.status(500).json({ erro: 'Erro interno ao vincular cuidador.' });
  }
});

// 3. ROTA: BUSCAR AGENDA DO DISPOSITIVO (GET)
app.get('/api/dispositivo/:id/agenda', async (req, res) => {
  const idDispositivo = req.params.id; 
  try {
    const querySQL = 'SELECT * FROM horarios_medicamentos WHERE id_dispositivo = $1 ORDER BY horario ASC';
    const resultado = await db.query(querySQL, [idDispositivo]);
    return res.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Erro ao buscar agenda:', error);
    return res.status(500).json({ erro: 'Erro interno ao buscar dados no banco.' });
  }
});

// 4. ROTA: CADASTRAR UM NOVO HORÁRIO DE MEDICAMENTO (POST)
app.post('/api/medicamentos/agendar', async (req, res) => {
  const {
    id_dispositivo, nome_remedio, dosagem, horario, estoque,
    segunda, terca, quarta, quinta, sexta, sabado, domingo
  } = req.body;

  if (!id_dispositivo || !nome_remedio || !horario) {
    return res.status(400).json({ erro: 'id_dispositivo, nome_remedio e horario são obrigatórios!' });
  }

  try {
    const querySQL = `
      INSERT INTO horarios_medicamentos 
      (id_dispositivo, nome_remedio, dosagem, horario, estoque, segunda, terca, quarta, quinta, sexta, sabado, domingo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *; 
    `;

    const valores = [
      id_dispositivo, nome_remedio, dosagem, horario, estoque ?? 30,
      segunda ?? true, terca ?? true, quarta ?? true, quinta ?? true, sexta ?? true, sabado ?? true, domingo ?? true
    ];

    const resultado = await db.query(querySQL, valores);

    io.emit('agenda_atualizada', resultado.rows[0]);

    return res.status(201).json({
      mensagem: 'Medicamento cadastrado com sucesso! 💊',
      dados: resultado.rows[0]
    });
  } catch (error) {
    console.error('Erro ao cadastrar medicamento:', error);
    return res.status(500).json({ erro: 'Erro interno ao salvar no banco de dados.' });
  }
});

// 5. ROTA: ATUALIZAR UM HORÁRIO DE MEDICAMENTO (PATCH)
app.patch('/api/medicamentos/:id', async (req, res) => {
  const idMedicamento = req.params.id;
  const {
    nome_remedio, dosagem, horario, estoque,
    segunda, terca, quarta, quinta, sexta, sabado, domingo
  } = req.body;

  if (!nome_remedio || !horario) {
    return res.status(400).json({ erro: 'nome_remedio e horario são obrigatórios!' });
  }

  try {
    const querySQL = `
      UPDATE horarios_medicamentos
      SET nome_remedio = $1, dosagem = $2, horario = $3, estoque = $4,
          segunda = $5, terca = $6, quarta = $7, quinta = $8, sexta = $9, sabado = $10, domingo = $11
      WHERE id = $12
      RETURNING *;
    `;

    const valores = [
      nome_remedio, dosagem, horario, estoque ?? 30,
      segunda ?? true, terca ?? true, quarta ?? true, quinta ?? true, sexta ?? true, sabado ?? true, domingo ?? true,
      idMedicamento
    ];

    const resultado = await db.query(querySQL, valores);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Medicamento não encontrado no banco.' });
    }

    io.emit('agenda_atualizada', resultado.rows[0]);

    return res.status(200).json({
      mensagem: 'Medicamento atualizado com sucesso! ✏️',
      dados: resultado.rows[0]
    });
  } catch (error) {
    console.error('Erro ao atualizar medicamento:', error);
    return res.status(500).json({ erro: 'Erro interno ao atualizar no banco de dados.' });
  }
});

// 6. ROTA: CONFIRMAÇÃO DO ESP32 OU DO APP (POST)
app.post('/api/dispositivo/confirmacao', async (req, res) => {
  const { id_dispositivo, nome_remedio, horario_programado, status_manual } = req.body;

  if (!id_dispositivo || !nome_remedio || !horario_programado) {
    return res.status(400).json({ erro: 'id_dispositivo, nome_remedio e horario_programado são obrigatórios!' });
  }

  try {
    const agora = new Date(); 
    const programado = new Date(horario_programado); 
    const diferencaEmMinutos = Math.abs(agora - programado) / (1000 * 60);

    // Ajuste: Permite receber um status enviado manualmente ou calcula automaticamente
    let status = status_manual || 'No Prazo';
    if (!status_manual && diferencaEmMinutos > 15) {
      status = 'Atrasado';
    }

    // A. Salva a dose no histórico
    const querySQL = `
      INSERT INTO historico_doses (id_dispositivo, nome_remedio, horario_programado, horario_tomado, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const valores = [id_dispositivo, nome_remedio, programado, status === 'Nao Tomado' ? null : agora, status];
    const resultado = await db.query(querySQL, valores);

    // B. Subtrai 1 do estoque (apenas se tiver tomado o remédio)
    let estoqueAtual = null;
    if (status !== 'Nao Tomado') {
      const queryEstoque = `
        UPDATE horarios_medicamentos 
        SET estoque = GREATEST(0, estoque - 1)
        WHERE id_dispositivo = $1 AND nome_remedio = $2
        RETURNING estoque;
      `;
      const resEstoque = await db.query(queryEstoque, [id_dispositivo, nome_remedio]);
      estoqueAtual = resEstoque.rows.length > 0 ? resEstoque.rows[0].estoque : null;
    }

    // C. Busca dados do dispositivo e telefone do paciente
    const queryDispositivo = `
      SELECT nome_paciente, nome_cuidador, 
             COALESCE(telefone_paciente, telefone) AS telefone_paciente 
      FROM dispositivos 
      WHERE id_dispositivo = $1
    `;
    const dadosDispositivo = await db.query(queryDispositivo, [id_dispositivo]);
    
    let telefonePaciente = null;
    let nomeCuidador = 'Cuidador';
    let nomePaciente = 'Paciente';

    if (dadosDispositivo.rows.length > 0) {
      nomeCuidador = dadosDispositivo.rows[0].nome_cuidador;
      nomePaciente = dadosDispositivo.rows[0].nome_paciente;
      telefonePaciente = dadosDispositivo.rows[0].telefone_paciente;

      enviarNotificacaoPush(nomeCuidador, nomePaciente, nome_remedio, status, estoqueAtual);
    }

    // Dispara alerta via WebSockets
    io.emit('nova_dose_registrada', {
      dose: resultado.rows[0],
      estoque_atual: estoqueAtual,
      telefone_paciente: telefonePaciente,
      alerta_atraso: status === 'Atrasado',
      mensagem: status === 'Atrasado'
        ? `⚠️ ATENÇÃO: ${nomePaciente} atrasou o remédio ${nome_remedio}! Ligue para o paciente.`
        : status === 'Nao Tomado'
        ? `🚫 ATENÇÃO: ${nomePaciente} NÃO tomou a dose de ${nome_remedio}.`
        : `✅ ${nomePaciente} tomou ${nome_remedio} no prazo.`
    });

    return res.status(201).json({
      mensagem: 'Histórico registrado com sucesso!',
      dados: resultado.rows[0],
      estoque_restante: estoqueAtual
    });
  } catch (error) {
    console.error('Erro ao confirmar dose:', error);
    return res.status(500).json({ erro: 'Erro interno ao salvar histórico.' });
  }
});

// 7. ROTA: BUSCAR HISTÓRICO DE DOSES PARA OS GRÁFICOS (GET)
app.get('/api/dispositivo/:id/historico', async (req, res) => {
  const idDispositivo = req.params.id;
  try {
    const querySQL = `
      SELECT id, nome_remedio, horario_programado, horario_tomado, status 
      FROM historico_doses 
      WHERE id_dispositivo = $1 
      ORDER BY horario_programado DESC;
    `;
    const resultado = await db.query(querySQL, [idDispositivo]);
    return res.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    return res.status(500).json({ erro: 'Erro interno ao buscar histórico no banco.' });
  }
});

// 8. ROTA: DELETAR UM MEDICAMENTO DA AGENDA (DELETE)
app.delete('/api/medicamentos/:id', async (req, res) => {
  const idMedicamento = req.params.id;

  try {
    const querySQL = 'DELETE FROM horarios_medicamentos WHERE id = $1 RETURNING *;';
    const resultado = await db.query(querySQL, [idMedicamento]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Medicamento não encontrado no banco.' });
    }

    io.emit('medicamento_deletado', { id: idMedicamento });

    return res.status(200).json({
      mensagem: 'Medicamento removido com sucesso! 🗑️',
      dadosDeletados: resultado.rows[0]
    });

  } catch (error) {
    console.error('Erro ao deletar medicamento:', error);
    return res.status(500).json({ erro: 'Erro interno ao deletar no banco de dados.' });
  }
});

// ATENÇÃO: Servidor HTTP + WebSockets ativo na porta 3000
server.listen(PORT, () => {
  console.log(`🚀 Servidor HTTP + WebSockets rodando na porta ${PORT}`);
});