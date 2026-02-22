# PastoFlow - Sistema de Gestão de Pastagens

Sistema web para gestão de fazendas, piquetes, lotes e rotação inteligente de pastejo.

## 🚀 Novidades (22/02/2026)

### ✅ Refatoração e limpeza
- CSS do `admin/dashboard.html` externalizado para `static/css/admin.css`.
- Limpeza de arquivos legados para `_deprecated/` (templates/scripts/ícones não usados).
- Organização de estrutura e manutenção preventiva sem remoções destrutivas.

### 🌿 Catálogo de capins (novo)
- Seleção de capim no modal de piquete agora é **agrupada por tipo**:
  - Brachiaria
  - Panicum
  - Cynodon
  - Outros
- Catálogo técnico atualizado com parâmetros por cultivar:
  - altura de entrada/saída
  - crescimento base (cm/dia)
  - fator de consumo
  - lotação sugerida
- Compatibilidade mantida para nomes legados (`Brachiaria`, `Capim Aruana`, `Natalino`).

### 🌦️ Clima inteligente - Fase 1
- Implementada integração real com **Open-Meteo** em `services/clima_service.py`.
- Adicionado **cache local** em SQLite (`clima_cache`) com TTL.
- Fallback robusto em cascata:
  1. cache
  2. API real
  3. simulação
  4. condição normal segura
- Integração no cálculo de altura estimada (recuperação) no backend.
- Endpoint novo: `GET /api/clima/condicao-atual`.

### 🧪 Clima manual por fazenda (para testes)
- Nova configuração no cadastro/edição de fazenda:
  - `clima_modo`: `automatico` ou `manual`
  - `condicao_climatica_manual`: `seca`, `normal`, `chuvoso`
- Quando em manual, o sistema força a condição definida na fazenda.

### 🧭 UI de clima no sistema
- Sidebar mostra condição climática atual (quando há fazenda selecionada).
- Tela de piquetes mostra condição climática no topo.
- Tela “Minhas Fazendas” mostra clima por card de fazenda.
- Correção de carregamento em páginas de **lotes** e **rotação** (conflito de `window.onload`).

### 🗺️ Mapa de piquetes
- Melhorias de estabilidade de renderização (realinhamento com `invalidateSize`).
- Limites de zoom padronizados no modal de criação de piquete:
  - `minZoom: 10`
  - `maxZoom: 17`

### 📋 Lotes (detalhes e status)
- Modal de detalhes de lote aprimorado com:
  - dias técnicos
  - dias passados
  - dias restantes
  - saída prevista
  - peso total estimado
  - UA total
  - consumo base
  - consumo estimado (quando possível)
  - altura estimada do capim
- Correções de formatação de datas (ISO + BR) para evitar `NaN/NaN/NaN`.
- Normalização visual de status:
  - `EM_OCUPACAO` exibido como `EM OCUPAÇÃO`
  - status “Aguardando Alocação” ajustado para visual branco (`⚪`).
- Filtro de status da tela de lotes atualizado para os status reais do fluxo.

---

## Funcionalidades

### 🏠 Gestão de Fazendas
- CRUD completo com coordenadas da sede (GPS).
- Múltiplas fazendas por usuário.
- Modo climático por fazenda (automático/manual).

### 🗺️ Piquetes
- Desenho de polígonos no mapa (Leaflet).
- Cálculo automático de área.
- Parâmetros técnicos por capim.
- Crescimento/recuperação influenciados por clima.

### 🐄 Lotes
- Cadastro com validações de peso.
- Sugestão de piquetes aptos.
- Status técnico de ocupação com dias restantes.
- Modal de detalhes completo para decisão operacional.

### 🔄 IA de Rotação
- Priorização técnica de piquetes.
- Alertas de saída imediata.
- Recomendações para reduzir degradação de pasto.

## Stack Tecnológica

- **Backend:** Flask (Python)
- **Banco de Dados:** SQLite
- **Frontend:** HTML, CSS, JavaScript
- **Mapas:** Leaflet.js
- **Clima:** Open-Meteo + cache local

## Estrutura do Projeto

```text
pastagens_flask/
├── app.py
├── database.py
├── services/
│   ├── clima_service.py
│   ├── manejo_service.py
│   └── rotacao_service.py
├── static/
│   ├── css/
│   └── js/
├── templates/
│   ├── base.html
│   └── modals/
├── _deprecated/
└── simular_data.py
```

## Autor

**Jeferson Silva Santos**
- GitHub: [@jeffersonss-tech](https://github.com/jeffersonss-tech)
- Email: jeffersonssantos92@gmail.com
