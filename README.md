# PastoFlow - Sistema de Gestão de Pastagens

Sistema web completo para gestão de fazendas, pastagens, piquetes, lotes de animais e rotação inteligente de pastejo.

## Funcionalidades

### 🏠 Gestão de Fazendas
- CRUD completo com coordenadas da sede (GPS)
- Múltiplas fazendas por usuário
- Visualização no mapa

### 🗺️ Piquetes com Inteligência
- Desenho de polígonos no mapa (Leaflet.js)
- Cálculo automático de área por GPS
- Parâmetros técnicos por tipo de capim
- Sistema de cores por estado (verde/laranja/vermelho/amarelo/roxo)

### 📐 Sistema altura_real vs altura_estimada
- **altura_real_medida**: Informada manualmente (verdade absoluta)
- **altura_estimada**: Calculada automaticamente pelo sistema

**Prioridade:** MEDIDA > ESTIMADA

**Cálculo Automático:**
- Piquete VAZIO: `altura_saida + (dias_descanso * crescimento_diario)`
- Piquete OCUPAÇÃO: `altura_entrada - (dias_ocupacao * consumo_diario)`

### 🐄 Gestão de Lotes
- Cadastro com validações técnicas (peso médio 50-1200 kg)
- Status automático: OK / Atenção / Retirar
- Sugestão automática de piquetes aptos
- Movimentação entre piquetes
- Contador de dias no piquete

### 🔄 IA de Rotação
- Recomendações de rotação ordenadas por prioridade
- Plano completo de rotação otimizado
- Verificação automática de piquetes críticos

### 📊 Resumo Geral (7 Cards)
1. Total de Lotes
2. Total de Animais
3. Hectares Ocupados
4. Hectares em Descanso
5. Altura Média Estimada
6. Piquetes Prontos para Entrada
7. Piquetes Críticos

### 📈 Cálculo de Lotação (UA/ha)
- Peso total dos animais
- UA total (Unidade Animal)
- UA por hectare

### 🔔 Sistema de Alertas
- Notificações automáticas
- Piquetes que precisam de atenção

## Stack Tecnológica

- **Backend:** Flask (Python)
- **Banco de Dados:** SQLite
- **Frontend:** HTML/CSS/JavaScript
- **Mapas:** Leaflet.js + OpenStreetMap
- **Autenticação:** Flask Session
- **Arquitetura:** Service Layer + APIs REST

## Estrutura do Projeto

```
pastagens_flask/
├── app.py                    # Flask principal (rotas, auth, páginas)
├── database.py               # Funções de banco SQLite
├── routes/
│   ├── api_fazendas.py      # CRUD fazendas
│   └── api_categorias.py     # API categorias de animais
├── services/
│   ├── fazenda_service.py    # Lógica de negócio (Resumo Geral)
│   ├── rotacao_service.py    # IA de rotação
│   ├── manejo_service.py     # Serviço de manejo
│   └── clima_service.py      # Dados climáticos
├── templates/                # HTML (home, login, fazenda, lotes, rotacao, etc.)
└── tests/                   # Testes unitários
```

## APIs Principais

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/rotacao/resumo_geral` | GET | Resumo consolidado da fazenda |
| `/api/rotacao` | GET | Recomendações de rotação |
| `/api/rotacao/plano` | GET | Plano completo de rotação |
| `/api/lotes` | GET/POST | Lista/cria lotes |
| `/api/piquetes` | GET/POST | Lista/cria piquetes |
| `/api/piquetes/apto` | GET | Piquetes aptos para entrada |
| `/api/lotacao/<fazenda_id>` | GET | Cálculo de lotação |

## Páginas

| Rota | Descrição |
|------|-----------|
| `/` | Dashboard - lista fazendas |
| `/login` | Login de usuários |
| `/fazenda/<id>` | Gestão de piquetes + mapa |
| `/fazenda/<id>/lotes` | Gestão de lotes |
| `/fazenda/<id>/rotacao` | IA de rotação + Resumo Geral |

## Como Executar

```bash
# Entrar no diretório
cd pastagens_flask

# Criar ambiente virtual
python -m venv venv

# Ativar (Windows)
.\venv\Scripts\activate

# Instalar dependências
pip install flask

# Executar
python app.py

# Acessar
# http://localhost:5000
```

## Login Padrão

- **Usuário:** admin
- **Senha:** admin123

## Tipos de Capim Suportados

| Capim | Crescimento (cm/dia) | Consumo (cm/dia) | Dias Descanso |
|-------|---------------------|------------------|--------------|
| Tifton 85 | 1.0 | 0.7 | 21 |
| Brachiaria | 1.2 | 0.8 | 28 |
| Andropogon | 1.2 | 0.8 | 28 |
| Capim Aruana | 1.1 | 0.75 | 28 |
| Natalino | 1.3 | 0.85 | 30 |
| MG-5 | 1.4 | 0.9 | 35 |
| Mombaça | 1.5 | 1.0 | 35 |

## Status do Piquete

| Status | Emoji | Condição |
|--------|-------|----------|
| APTO_ENTRADA | 🟢 | Altura atingida + dias de descanso ideais |
| EM_OCUPACAO | 🔵 | Animais dentro, tempo OK |
| EM_DESCANSO | 🟡 | Vazio, recuperando |
| PROXIMO_SAIDA | 🟠 | Último dia ou pasto próximo saída |
| SAIDA_IMEDIATA | 🔴 | Passou do limite |
| BLOQUEADO | 🟣 | Indisponível (adubação, reforma, etc.) |

## Autor

**Jeferson Silva Santos**
- GitHub: [@jeffersonss-tech](https://github.com/jeffersonss-tech)
- Email: jeffersonssantos92@gmail.com

## Licença

MIT License
