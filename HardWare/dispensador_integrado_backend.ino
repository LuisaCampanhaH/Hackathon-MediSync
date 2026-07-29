/*
  DISPENSADOR DE REMÉDIOS - Código Final integrado com o BackEnd real
*/
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <time.h>
#include "secrets.h" 

// ================== PINOS ==================
const int PINO_SERVO   = 13;
const int PINO_BUZZER  = 25;
const int PINO_LED_VERDE    = 26;
const int PINO_LED_VERMELHO = 27;
const int PINO_BOTAO1  = 32;

Servo meuServo;

// ================== AJUSTAR: VALORES DE CALIBRAÇÃO (pulso em microssegundos) ==================
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
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); 
  Serial.begin(115200);
  
  meuServo.attach(PINO_SERVO, 500, 2400);
  meuServo.writeMicroseconds(PULSO_SAIDA);
  
  pinMode(PINO_BUZZER, OUTPUT);
  pinMode(PINO_LED_VERDE, OUTPUT);
  pinMode(PINO_LED_VERMELHO, OUTPUT);
  pinMode(PINO_BOTAO1, INPUT_PULLUP);
  
  conectarWiFi();
  configTime(-10800, 0, "pool.ntp.org"); 
  buscarAgenda(); 
  
  Serial.println("Sistema pronto!");
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
    Serial.println("\nWi-Fi conectado! IP do ESP32: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nFalha ao conectar Wi-Fi.");
  }
}

// ================== BUSCAR AGENDA NO SERVIDOR ==================
void buscarAgenda() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Sem Wi-Fi, não foi possível buscar a agenda.");
    return;
  }
  
  HTTPClient http;
  String url = String(SERVIDOR_BASE) + "/api/dispositivo/" + ID_DISPOSITIVO + "/agenda";
  http.begin(url);
  
  int codigoResposta = http.GET();
  if (codigoResposta == 200) {
    String resposta = http.getString();
    Serial.println("Agenda recebida: " + resposta);
    
    DynamicJsonDocument doc(4096);
    DeserializationError erro = deserializeJson(doc, resposta);
    
    if (!erro) {
      qtdItensAgenda = 0;
      JsonArray lista = doc.as<JsonArray>();
      for (JsonObject item : lista) {
        if (qtdItensAgenda >= 20) break;
        agenda[qtdItensAgenda].nomeRemedio = item["nome_remedio"].as<String>();
        agenda[qtdItensAgenda].horario = item["horario"].as<String>(); 
        agenda[qtdItensAgenda].jaDispensadoHoje = false;
        qtdItensAgenda++;
      }
      Serial.println("Total de horarios carregados: " + String(qtdItensAgenda));
    } else {
      Serial.println("Erro ao interpretar JSON da agenda.");
    }
  } else {
    Serial.println("Erro ao buscar agenda. Codigo: " + String(codigoResposta));
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

// ================== PEGAR PULSO ==================
int pulsoDoRemedio(String nome) {
  if (nome == "A") return PULSO_A;
  if (nome == "B") return PULSO_B;
  return PULSO_SAIDA; 
}

// ================== DISPENSAR ==================
void dispensarRemedio(String nomeRemedio) {
  Serial.println("Dispensando remedio: " + nomeRemedio);
  
  for (int i = 0; i < 5; i++) {
    digitalWrite(PINO_BUZZER, HIGH);
    digitalWrite(PINO_LED_VERMELHO, HIGH);
    delay(200);
    digitalWrite(PINO_BUZZER, LOW);
    digitalWrite(PINO_LED_VERMELHO, LOW);
    delay(200);
  }
  
  meuServo.writeMicroseconds(pulsoDoRemedio(nomeRemedio));
  delay(800);
  meuServo.writeMicroseconds(PULSO_SAIDA);
  delay(800);
  
  digitalWrite(PINO_LED_VERDE, HIGH);
  
  bool confirmado = false;
  unsigned long inicioEspera = millis();
  
  while (millis() - inicioEspera < 300000) {
    if (digitalRead(PINO_BOTAO1) == LOW) {
      confirmado = true;
      break;
    }
    delay(100);
  }
  
  digitalWrite(PINO_LED_VERDE, LOW);
  
  if (confirmado) {
    Serial.println("Remedio " + nomeRemedio + " confirmado.");
    enviarConfirmacao(nomeRemedio);
  } else {
    Serial.println("Remedio " + nomeRemedio + " NAO confirmado a tempo.");
  }
}

// ================== ENVIAR CONFIRMAÇÃO ==================
void enviarConfirmacao(String nomeRemedio) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Sem Wi-Fi, não foi possível enviar confirmação.");
    return;
  }
  
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
    Serial.println("Confirmacao enviada! Resposta: " + String(codigoResposta));
  } else {
    Serial.println("Erro ao enviar confirmacao: " + http.errorToString(codigoResposta));
  }
  http.end();
}