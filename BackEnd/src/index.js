const express = require('express');
const cors = require('cors'); // Importa o pacote para liberar o acesso ao Frontend
const db = require('./config/db'); 

const app = express();

app.use(cors()); // Ativa o CORS para evitar bloqueios no navegador do Frontend
app.use(express.json()); 

const PORT = process.env.PORT || 3000;


// FUNÇÃO AUXILIAR: SIMULADOR DE PUSH NOTIFICATION

function enviarNotificacaoPush(nomeCuidador, nomePaciente, nomeRemedio, status) {
  console.log('\n==================================================');
  console.log(`📱 [PUSH NOTIFICATION] Enviando alerta para: ${nomeCuidador}`);
  if (status === 'Atrasado') {
    console.log(`⚠️ ALERTA DE EMERGÊNCIA: ${nomePaciente} está atrasado(a) com o remédio: ${nomeRemedio}!`);
  } else {
    console.log(`✅ AVISO: ${nomePaciente} tomou o remédio: ${nomeRemedio} no prazo.`);
  }
  console.log('==================================================\n');
}


// ROTAS DA API


// 1. ROTA PRINCIPAL DE TESTE
app.get('/', (req, res) => {
  res.send('API do Dispenser de Remédios Rodando! 💊');
});

// 2. ROTA: BUSCAR DADOS DO DISPOSITIVO (GET)
// Sem suporte a múltiplos pacientes por enquanto (1 usuário = 1 dispositivo,
// cadastrado direto no banco) — por isso não existe rota de listagem, só de
// detalhe de um id específico.
app.get('/api/dispositivo/:id', async (req, res) => {
  const idDispositivo = req.params.id;
  try {
    const querySQL = 'SELECT id_dispositivo, nome_paciente, nome_cuidador, telefone FROM dispositivos WHERE id_dispositivo = $1';
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

// 3. ROTA: BUSCAR AGENDA DO DISPOSITIVO (GET)
app.get('/api/dispositivo/:id/agenda', async (req, res) => {
  const idDispositivo = req.params.id; 
  try {
    const querySQL = 'SELECT * FROM horarios_medicamentos WHERE id_dispositivo = $1';
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
    id_dispositivo, nome_remedio, dosagem, horario,
    segunda, terca, quarta, quinta, sexta, sabado, domingo
  } = req.body;

  if (!id_dispositivo || !nome_remedio || !horario) {
    return res.status(400).json({ erro: 'id_dispositivo, nome_remedio e horario são obrigatórios!' });
  }

  try {
    const querySQL = `
      INSERT INTO horarios_medicamentos 
      (id_dispositivo, nome_remedio, dosagem, horario, segunda, terca, quarta, quinta, sexta, sabado, domingo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *; 
    `;

    const valores = [
      id_dispositivo, nome_remedio, dosagem, horario,
      segunda ?? true, terca ?? true, quarta ?? true, quinta ?? true, sexta ?? true, sabado ?? true, domingo ?? true
    ];

    const resultado = await db.query(querySQL, valores);
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
      nome_remedio, dosagem, horario, estoque ?? 0,
      segunda ?? true, terca ?? true, quarta ?? true, quinta ?? true, sexta ?? true, sabado ?? true, domingo ?? true,
      idMedicamento
    ];

    const resultado = await db.query(querySQL, valores);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Medicamento não encontrado no banco.' });
    }

    return res.status(200).json({
      mensagem: 'Medicamento atualizado com sucesso! ✏️',
      dados: resultado.rows[0]
    });
  } catch (error) {
    console.error('Erro ao atualizar medicamento:', error);
    return res.status(500).json({ erro: 'Erro interno ao atualizar no banco de dados.' });
  }
});

// 6. ROTA: CONFIRMAÇÃO DO ESP32 (REMEDIO TOMADO - POST)
app.post('/api/dispositivo/confirmacao', async (req, res) => {
  const { id_dispositivo, nome_remedio, horario_programado } = req.body;

  if (!id_dispositivo || !nome_remedio || !horario_programado) {
    return res.status(400).json({ erro: 'id_dispositivo, nome_remedio e horario_programado são obrigatórios!' });
  }

  try {
    const agora = new Date(); 
    const programado = new Date(horario_programado); 
    const diferencaEmMinutos = Math.abs(agora - programado) / (1000 * 60);

    let status = 'No Prazo';
    if (diferencaEmMinutos > 15) {
      status = 'Atrasado';
    }

    // 1. Salva a dose no histórico
    const querySQL = `
      INSERT INTO historico_doses (id_dispositivo, nome_remedio, horario_programado, horario_tomado, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    
    const valores = [id_dispositivo, nome_remedio, programado, agora, status];
    const resultado = await db.query(querySQL, valores);

    // 2. Busca o nome do paciente e do cuidador no banco para personalizar a notificação
    const queryDispositivo = 'SELECT nome_paciente, nome_cuidador FROM dispositivos WHERE id_dispositivo = $1';
    const dadosDispositivo = await db.query(queryDispositivo, [id_dispositivo]);
    
    if (dadosDispositivo.rows.length > 0) {
      const { nome_cuidador, nome_paciente } = dadosDispositivo.rows[0];
      enviarNotificacaoPush(nome_cuidador, nome_paciente, nome_remedio, status);
    }

    return res.status(201).json({
      mensagem: 'Histórico registrado e cuidador notificado!',
      dados: resultado.rows[0]
    });
  } catch (error) {
    console.error('Erro ao confirmar dose:', error);
    return res.status(500).json({ erro: 'Erro interno ao salvar histórico.' });
  }
});

// 7. ROTA: BUSCAR HISTÓRICO DE DOSES PARA OS GRÁFICOS
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

// 8. ROTA: DELETAR UM MEDICAMENTO DA AGENDA
app.delete('/api/medicamentos/:id', async (req, res) => {
  const idMedicamento = req.params.id;

  try {
    const querySQL = 'DELETE FROM horarios_medicamentos WHERE id = $1 RETURNING *;';
    const resultado = await db.query(querySQL, [idMedicamento]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Medicamento não encontrado no banco.' });
    }

    return res.status(200).json({
      mensagem: 'Medicamento removido com sucesso! 🗑️',
      dadosDeletados: resultado.rows[0]
    });

  } catch (error) {
    console.error('Erro ao deletar medicamento:', error);
    return res.status(500).json({ erro: 'Erro interno ao deletar no banco de dados.' });
  }
});


app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});