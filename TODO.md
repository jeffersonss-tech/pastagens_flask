# Sistema de Rotação de Pastagens

## 📋 TODO Completo

### Banco de Dados e Backend
- [x] Criar esquema completo (Fazendas, Piquetes, Lotes, Capins, Movimentações)
- [x] Implementar helpers de query
- [x] CRUD Fazendas
- [x] CRUD Piquetes
- [x] CRUD Lotes (completo)
- [x] CRUD Capins
- [x] Sistema de permissões (Admin vs Operador)
- [x] **Cálculo de Lotação (UA/ha)** ✅ **IMPLEMENTADO 2026-02-08**
- [x] **Sistema de Status Inteligente** ✅ **IMPLEMENTADO 2026-02-08**
  - [x] 6 Status: APTO, OCUPADO, DESCANSO, PRÓXIMO_SAÍDA, SAÍDA_IMEDIATA, BLOQUEADO
  - [x] Lógica de transição automática
  - [x] API de status detalhado
  - [x] Função verificar_passou_ponto
- [x] **Sistema de Lotes Completo** ✅ **IMPLEMENTADO 2026-02-08**
  - [x] Modelagem completa (nome, categoria, status_calculado, piquete_atual_id, data_entrada)
  - [x] API completa (listar, criar, mover, registrar saída)
  - [x] Status automático: OK / Atenção / Retirar
  - [x] Sugestão automática de piquetes aptos

### Frontend - Funcionalidades
- [x] Dashboard principal
- [x] Gestão de Fazendas
- [x] Gestão de Piquetes (com mapa Leaflet)
- [x] Gestão de Lotes (página completa)
- [x] **Dashboard de Lotação (UA/ha)** ✅
- [x] **Sistema de Alertas** ✅
- [x] **Algoritmo de Rotação IA** ✅
- [x] **Página de Lotes** ✅ **IMPLEMENTADO 2026-02-08**
  - [x] Cards de visão geral (total, ocupação, saída, animais)
  - [x] Filtros por status e categoria
  - [x] Tabela com status, dias, ações
  - [x] Modal de novo lote
  - [x] Modal de movimentação com sugestões
  - [x] **Modal de edição com select de piquetes** ✅ **IMPLEMENTADO 2026-02-10**
    - [x] Editar nome, categoria, quantidade, peso
    - [x] **Alterar piquete do lote**
    - [x] Botão "Sem Piquete" para limpar
    - [x] **Aviso ao selecionar piquete em recuperação** ✅
    - [x] **Mostrar apenas piquetes disponíveis (sem animais)** ✅ **IMPLEMENTADO 2026-02-10**

### Frontend - Funcionalidades
- [x] Dashboard principal
- [x] Gestão de Fazendas
- [x] Gestão de Piquetes (com mapa Leaflet)
- [x] Gestão de Lotes (página completa)
- [x] **Dashboard de Lotação (UA/ha)** ✅
- [x] **Sistema de Alertas** ✅
- [x] **Algoritmo de Rotação IA** ✅
- [x] **Página de Lotes** ✅ **IMPLEMENTADO 2026-02-08**
  - [x] Cards de visão geral (total, ocupação, saída, animais)
  - [x] Filtros por status e categoria
  - [x] Tabela com status, dias, ações
  - [x] Modal de novo lote
  - [x] Modal de movimentação com sugestões
  - [x] **Modal de edição com select de piquetes** ✅
  - [x] **Aviso de piquete em recuperação com animais** ✅ **NOVO 2026-02-10**
  - [x] **Modal de detalhes do lote (clicar no nome)** ✅ **IMPLEMENTADO 2026-02-10**
- [ ] Relatórios
- [ ] Logs de Auditoria (Admin)

### Integrações
- [x] Leaflet para mapas
- [x] SQLite (funcional)

---

## 🛠️ Tech Stack

- **Flask** - Interface web
- **SQLite** - Banco de dados
- **Leaflet** - Mapas
- **Python** - Backend

---

## 📁 Estrutura

```
pastagens_flask/
├── app.py              # Flask routes
├── database.py         # SQLite + funções
├── templates/
│   ├── login.html       # Login
│   ├── home.html       # Dashboard fazendas
│   ├── fazenda.html    # Gestão fazenda
│   ├── lotes.html      # Gestão de lotes (NOVO)
│   ├── rotacao.html    # IA Rotação
│   └── ...
├── pastagens.db        # Banco SQLite
└── requirements.txt
```

---

## 📊 Status do Sistema

### ✅ Funcionalidades Prontas:
- Login/Autenticação
- CRUD Fazendas
- CRUD Piquetes (com mapas)
- CRUD Lotes Completo
- Sistema de Status Inteligente
- Cálculo de Lotação (UA/ha)
- IA de Rotação
- Movimentações

### 📋 Próximas:
- Relatórios PDF/Excel
- Logs de Auditoria
- App Mobile

---

## 🔗 Links Úteis

- Dashboard: http://localhost:5000/
- Login: admin / admin123
