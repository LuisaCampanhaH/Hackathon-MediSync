/*
  ARQUIVO DE EXEMPLO — copie esse arquivo, renomeie para "secrets.h"
  (sem o "_exemplo") e preencha com seus dados reais.

  O "secrets.h" real NUNCA vai pro GitHub (já está no .gitignore),
  só esse arquivo de exemplo é que fica versionado, igual o time
  fez com .env.example no Backend e no Frontend.
*/

#ifndef SECRETS_H
#define SECRETS_H

#define WIFI_SSID  "Snoop"
#define WIFI_SENHA "Luisa0812"

// IP da máquina rodando o backend, na mesma rede Wi-Fi.
// NÃO use "localhost" — o ESP32 é um dispositivo separado do seu PC.
// Pra descobrir o IP: Windows -> "ipconfig" no cmd, Mac/Linux -> "ifconfig"
#define SERVIDOR_BASE "http://10.5.0.2:3000"

// Precisa bater com o id_dispositivo semeado em BackEnd/db/init.sql
#define ID_DISPOSITIVO "ESP32-TESTE-01"

#endif