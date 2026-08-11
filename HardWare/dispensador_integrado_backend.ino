/*
  DISPENSADOR DE REMÉDIOS - Código Final (MVP Hackathon)
*/
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <time.h>

// ================== CREDENCIAIS E CONFIGURAÇÕES ==================
const char* WIFI_SSID = "ALEXANDRECUNHA";
const char* WIFI_SENHA = "Alexmiriamluisa@"; // <--- SUA SENHA AQUI
const char* SERVIDOR_BASE = "https://hackathon-medisync.onrender.com"; // <--- EX: http://192.168.0.15:3000
const char* ID_DISPOSITIVO = "ESP32-TESTE-01"; // <--- ID REAL DO BANCO DE DADOS

// ================== PINOS ==================
const int PINO_SERVO    = 13;
const int PINO_BUZZER   = 25;
const int PINO_LED_VERDE    = 26;
const int PINO_LED_VERMELHO = 27;
const int PINO_BOTAO1   = 32;

Servo meuServo;

// ================== VALORES DE CALIBRAÇÃO (SERVO) ==================
const int PULSO_SAIDA = 1900; 
const int PULSO_A     = 1550; 
const int PULSO_B     = 2400; 

// ================== ESTRUTURA DA AGENDA ==================
struct ItemAgenda {
  String nomeRemedio;
  String horario;     
  bool jaDispensadoHoje;
};

ItemAgenda agenda[20]; 
int qtdItensAgenda = 0;
unsigned long ultimaAtualizacaoAgenda = 0;
const unsigned long INTERVALO_ATUALIZACAO_AGENDA = 60000; 

// ================== SETUP ==================
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  meuServo.attach(PINO_SERVO, 500, 2400);
  meuServo.writeMicroseconds(PULSO_SAIDA);
  
  pinMode(PINO_BUZZER, OUTPUT);
  pinMode(PINO_LED_VERDE, OUTPUT);
  pinMode(PINO_LED_VERMELHO, OUTPUT);
  pinMode(PINO_BOTAO1, INPUT_PULLUP);
  
  conectarWiFi();
  
  Serial.println("Sincronizando relogio...");
  configTime(-10800, 0, "pool.ntp.org", "time.google.com", "a.st1.ntp.br"); 
  
  buscarAgenda(); 
  
  Serial.println("\nSistema pronto e rodando!");
}

// ================== LOOP PRINCIPAL ==================
void loop() {
  if (millis() - ultimaAtualizacaoAgenda > INTERVALO_ATUALIZACAO_AGENDA) {
    buscarAgenda();
    ultimaAtualizacaoAgenda = millis();
  }
  verificarHorarios();
  delay(1000);
}

// ================== CONECTAR WI-FI ==================
void conectarWiFi() {
  Serial.print("Conectando ao Wi-Fi");
  WiFi.begin(WIFI_SSID, WIFI_SENHA);
  int tentativas = 0;
  
  while (WiFi.status() != WL_CONNECTED && tentativas < 30) {
    delay(500);
    Serial.print(".");
    tentativas++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWi-Fi conectado! IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nFalha ao conectar Wi-Fi.");
  }
}

// ================== BUSCAR AGENDA NO SERVIDOR ==================
void buscarAgenda() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  String url = String(SERVIDOR_BASE) + "/api/dispositivo/" + ID_DISPOSITIVO + "/agenda";
  
  http.begin(url); 
  
  int codigoResposta = http.GET();
  if (codigoResposta == 200) {
    String resposta = http.getString();
    
    DynamicJsonDocument doc(4096);
    DeserializationError erro = deserializeJson(doc, resposta);
    
    if (!erro) {
      // SALVA O HISTÓRICO PARA NÃO REPETIR O REMÉDIO
      ItemAgenda agendaAntiga[20];
      int qtdAntiga = qtdItensAgenda;
      for(int i = 0; i < qtdAntiga; i++) {
        agendaAntiga[i] = agenda[i];
      }

      qtdItensAgenda = 0;
      JsonArray lista = doc.as<JsonArray>();
      for (JsonObject item : lista) {
        if (qtdItensAgenda >= 20) break;
        
        agenda[qtdItensAgenda].nomeRemedio = item["nome_remedio"].as<String>();
        agenda[qtdItensAgenda].horario = item["horario"].as<String>(); 
        agenda[qtdItensAgenda].jaDispensadoHoje = false;
        
        // DEVOLVE A MARCAÇÃO SE JÁ TOMOU HOJE
        for(int j = 0; j < qtdAntiga; j++) {
          if(agendaAntiga[j].nomeRemedio == agenda[qtdItensAgenda].nomeRemedio && 
             agendaAntiga[j].horario == agenda[qtdItensAgenda].horario) {
             agenda[qtdItensAgenda].jaDispensadoHoje = agendaAntiga[j].jaDispensadoHoje;
             break;
          }
        }
        qtdItensAgenda++;
      }
      Serial.println("Agenda atualizada do BackEnd. Total de remedios: " + String(qtdItensAgenda));
    }
  } else {
    Serial.println("Erro ao buscar agenda. Codigo HTTP: " + String(codigoResposta));
  }
  http.end();
}

// ================== VERIFICAR HORÁRIOS ==================
void verificarHorarios() {
  struct tm horaAtual;
  if (!getLocalTime(&horaAtual)) return; 
  
  int horaAgora = horaAtual.tm_hour;
  int minutoAgora = horaAtual.tm_min;
  
  if (horaAgora == 0 && minutoAgora == 0) {
    for (int i = 0; i < qtdItensAgenda; i++) {
      agenda[i].jaDispensadoHoje = false;
    }
  }
  
  char horaFormatada[9];
  sprintf(horaFormatada, "%02d:%02d:00", horaAgora, minutoAgora);
  String horaAgoraStr = String(horaFormatada);
  
  for (int i = 0; i < qtdItensAgenda; i++) {
    if (agenda[i].horario.substring(0, 5) == horaAgoraStr.substring(0, 5) && !agenda[i].jaDispensadoHoje) {
      dispensarRemedio(agenda[i].nomeRemedio);
      agenda[i].jaDispensadoHoje = true;
    }
  }
}

// ================== PEGAR PULSO (POR NOME EXATO) ==================
int pulsoDoRemedio(String nome) {
  nome.trim(); // Remove espaços vazios
  
  // SUBSTITUA AQUI PELOS NOMES QUE VOCÊ CADASTRA NO APP
  if (nome.equalsIgnoreCase("Remedio A") || nome.equalsIgnoreCase("A")) {
    return PULSO_A;
  }
  else if (nome.equalsIgnoreCase("Remedio B") || nome.equalsIgnoreCase("B")) {
    return PULSO_B;
  }
  
  Serial.println("ALERTA: O remedio '" + nome + "' nao esta mapeado no motor!");
  return PULSO_SAIDA; 
}

// ================== APITO + LED VERMELHO (ALERTA) ==================
void apitarAlerta() {
  for (int i = 0; i < 5; i++) {
    digitalWrite(PINO_BUZZER, HIGH);
    digitalWrite(PINO_LED_VERMELHO, HIGH);
    delay(200);
    digitalWrite(PINO_BUZZER, LOW);
    digitalWrite(PINO_LED_VERMELHO, LOW);
    delay(200);
  }
}

// ================== PISCA VERDE 3X (CONFIRMAÇÃO DO BOTÃO) ==================
void piscarConfirmacao() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(PINO_LED_VERDE, HIGH);
    delay(150);
    digitalWrite(PINO_LED_VERDE, LOW);
    delay(150);
  }
}

// ================== DISPENSAR ==================
void dispensarRemedio(String nomeRemedio) {
  Serial.println("\n>>> HORA DO REMEDIO: " + nomeRemedio + " <<<");

  // 1) Avisa com apito + LED vermelho antes de mexer no servo
  apitarAlerta();
  delay(500);

  // 2) Apito para (fica em silêncio) enquanto o servo trabalha
  Serial.println("Abrindo gaveta...");
  meuServo.writeMicroseconds(pulsoDoRemedio(nomeRemedio));
  delay(2500); // 2,5 segundos para o remédio cair

  Serial.println("Fechando gaveta...");
  meuServo.writeMicroseconds(PULSO_SAIDA);
  delay(1000);

  // 3) Servo desligou (voltou pra posição de repouso) -> apito volta a avisar
  Serial.println("Servo desligado. Avisando novamente...");
  apitarAlerta();

  // 4) Espera o paciente apertar o botão, com o LED verde piscando
  Serial.println("Aguardando paciente apertar o botão...");

  bool confirmado = false;
  unsigned long inicioEspera = millis();
  unsigned long ultimoPisca = millis();
  bool ledAceso = false;
  const unsigned long INTERVALO_PISCA_MS = 400;

  while (millis() - inicioEspera < 300000) {
    if (digitalRead(PINO_BOTAO1) == LOW) {
      confirmado = true;
      break;
    }

    if (millis() - ultimoPisca >= INTERVALO_PISCA_MS) {
      ledAceso = !ledAceso;
      digitalWrite(PINO_LED_VERDE, ledAceso ? HIGH : LOW);
      ultimoPisca = millis();
    }

    delay(20);
  }

  digitalWrite(PINO_LED_VERDE, LOW);

  if (confirmado) {
    Serial.println("-> Botao apertado! Remedio confirmado.");
    piscarConfirmacao();
    enviarConfirmacao(nomeRemedio);
  } else {
    Serial.println("-> TEMPO ESGOTADO. Remedio NAO confirmado.");
  }
}

// ================== ENVIAR CONFIRMAÇÃO ==================
void enviarConfirmacao(String nomeRemedio) {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  String url = String(SERVIDOR_BASE) + "/api/dispositivo/confirmacao";
  
  http.begin(url); 
  http.addHeader("Content-Type", "application/json");
  
  struct tm horaAtual;
  getLocalTime(&horaAtual);
  char horarioISO[25];
  strftime(horarioISO, sizeof(horarioISO), "%Y-%m-%dT%H:%M:%S", &horaAtual);
  
  StaticJsonDocument<256> doc;
  doc["id_dispositivo"] = ID_DISPOSITIVO;
  doc["nome_remedio"] = nomeRemedio;
  doc["horario_programado"] = horarioISO;
  
  String corpoJson;
  serializeJson(doc, corpoJson);
  
  int codigoResposta = http.POST(corpoJson);
  
  if (codigoResposta > 0) {
    Serial.println("Confirmacao enviada ao servidor! Resposta HTTP: " + String(codigoResposta));
  } else {
    Serial.println("Erro ao enviar confirmacao: " + http.errorToString(codigoResposta));
  }
  http.end();
}
