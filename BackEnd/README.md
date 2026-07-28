# BackEnd — API do Dispenser de Remédios

API em Node + Express que serve a agenda de medicamentos, recebe confirmações
de dose do ESP32 e devolve o histórico usado nos gráficos do app.

## Pré-requisitos

- Node.js 20+
- Docker + Docker Compose (para subir o Postgres local)

## Rodando localmente

```bash
cd BackEnd
cp .env.example .env      # ajuste se necessário, os defaults já batem com o docker-compose

docker compose up -d      # sobe o Postgres em localhost:5432 e cria as tabelas
                           # (ver db/init.sql) — inclui um dispositivo de teste
                           # com id_dispositivo = 'ESP32-TESTE-01'

npm install
npm run dev                # nodemon, reinicia sozinho a cada alteração
# ou: npm start
```

A API sobe em `http://localhost:3000` (ou a porta definida em `PORT` no `.env`).

Para derrubar o banco: `docker compose down` (os dados persistem no volume
`remedios_db_data`; use `docker compose down -v` para apagar tudo e recomeçar
do zero).

## Schema

As tabelas (`dispositivos`, `horarios_medicamentos`, `historico_doses`) são
criadas automaticamente pelo `db/init.sql` na primeira subida do container,
reproduzindo o script original passado pelo time do backend (não havia
migration versionada no repo até então) mais os campos combinados na reunião
com o time de hardware: `dispositivos.telefone` e
`horarios_medicamentos.estoque`. `id_dispositivo` é `VARCHAR(50)` (o endereço
MAC do ESP32, por exemplo) — não é auto-incremento.

Sem suporte a múltiplos pacientes por usuário: 1 usuário = 1 dispositivo,
cadastrado direto no banco (sem tela de cadastro no app).

## Rotas

| Método | Rota | Body / Params | Descrição |
|---|---|---|---|
| GET | `/` | — | health check |
| GET | `/api/dispositivo/:id` | — | dados do dispositivo (nome do paciente/cuidador, telefone) |
| GET | `/api/dispositivo/:id/agenda` | — | lista os horários cadastrados para o dispositivo |
| POST | `/api/medicamentos/agendar` | `id_dispositivo, nome_remedio, dosagem, horario, segunda..domingo` | cria um horário de medicamento |
| PATCH | `/api/medicamentos/:id` | `nome_remedio, dosagem, horario, estoque, segunda..domingo` | atualiza um horário existente |
| POST | `/api/dispositivo/confirmacao` | `id_dispositivo, nome_remedio, horario_programado` | confirma que uma dose foi tomada (calcula No Prazo/Atrasado e loga a notificação simulada) |
| GET | `/api/dispositivo/:id/historico` | — | lista as doses já confirmadas |
| DELETE | `/api/medicamentos/:id` | — | remove um horário específico |

Rotas em falta pro fluxo definido com o time de hardware (não fazem parte
desse repo — implementadas por quem cuida do back/firmware):
- Evento de dose **não tomada** disparado pela caixinha quando o botão não é
  apertado a tempo (grava em `historico_doses` com `horario_tomado = NULL`,
  `status = 'Não Tomado'` — a coluna já é nullable, propositalmente).
- Push real usando `dispositivos.token_notificacao` (hoje só simulado via
  `console.log` em `enviarNotificacaoPush`).
- Notificação de estoque baixo via WebSocket.

Ver `plan.md` na raiz do repo para o mapeamento completo com as telas do app
mobile e os gaps identificados na integração.

## Testando rápido

```bash
curl http://localhost:3000/api/dispositivo/ESP32-TESTE-01/agenda

curl -X POST http://localhost:3000/api/medicamentos/agendar \
  -H "Content-Type: application/json" \
  -d '{"id_dispositivo":"ESP32-TESTE-01","nome_remedio":"Losartana","dosagem":"50mg","horario":"08:00"}'
```
