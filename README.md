# PastoFlow - Sistema de Gestão de Pastagens

Sistema web para gestão de fazendas, piquetes, lotes e rotação inteligente de pastejo.

## 🚀 Novidades recentes (26/02/2026)

### 📴 Experiência offline robusta (PWA)
- **Mapas por fazenda**: cada fazenda baixa tiles próprios (`PastoFlowOffline_<fazendaId>`) com chaves `fazendaId::url`, evitando que duas fazendas compartilhem o mesmo cache.
- **Fila de intenção offline**: piquetes criados sem internet ficam salvos em IndexedDB (`offlinePiquetes`) e são sincronizados automaticamente assim que o navegador detecta conexão (checagem a cada 30s + evento `online`).
- **Indicador visual**: badge na interface e cards/mapas destacam os piquetes pendentes (cinza) sem precisar recarregar a página.
- **Fallback de recarga**: botão "Recarregar" na Home/Sidebar detecta offline e exibe um toast em vez de tentar baixar assets inexistentes.

### 🌐 Botões "Recarregar" espalhados
- **Sidebar**: botão estilizado, no rodapé, reduz o texto ao colapsar e agora exibe só o ícone quando a barra fica estreita.
- **Home**: botão no header com gradiente e ícone que mostra aviso quando você está offline e evita o reload que quebra assets.

### 📦 Ajustes visuais e usabilidade
- **Sidebar compacta**: largura reduzida para 192 px (toolbar e margin-left ajustados), economizando espaço.
- **Botão recarregar responsivo**: encolhe bastante quando a sidebar está colapsada para acompanhar o layout.

---

## 🔧 Funcionalidades

### 🏠 Gestão de Fazendas
- CRUD completo com coordenadas da sede (GPS);
- Multiplas fazendas por usuário;
- Modo climático por fazenda (automático/manual) com override técnico.

### 🗺️ Piquetes e mapas
- Desenho de polígonos no mapa (Leaflet) com cálculo automático de área;
- Streaming de dados offline com indicadores de status e sincronização automática;
- Mapas offline via IndexedDB (tiles de satélite) e fallback OpenStreetMap para cenários sem conexão.

### 🐄 Lotes e rotação
- Cadastro com validações de peso e status técnico (dias técnicos, dias ocupação, saída prevista);
- IA de rotação prioriza qualidade do pasto e alerta quando lote está pronto para mudança;
- Modal de detalhes e filtros atualizados para refletir os status reais do fluxo operacional.

### 🌦️ Clima
- Integração com Open-Meteo + cache local (`clima_cache` em SQLite);
- Fallback em cascata: cache → API → simulação → condição segura;
- Endpoint `GET /api/clima/condicao-atual` e visualização na sidebar, home e piquetes;
- Modo manual by farm para testes e simulações.

---

## 🧰 Infraestrutura offline/multiprojetos

1. **Tiles por fazenda**: baixe mapas offline na home, cada fazenda registra seus tiles e metadados no `localStorage` (`PastoFlowOfflineFarms`).
2. **Queue local**: piquetes offline entram na fila `offlinePiquetes`; o contador exibe quantos ainda precisam sincronizar.
3. **Sincronização automática**: evento `online` + watcher a cada 30 s tentam reenviar os payloads para `/api/piquetes` assim que a conexão retorna.
4. **Reload seguro**: botão da home usa `handleHomeReload()` para não forçar reload offline; botão da sidebar mantém `window.location.reload()` para cenários de troubleshooting.
5. **Indicadores**: o mapa (dashboard/piquetes) desenha tanto registros online quanto offline, com badges/colorização específica.

---

## 📦 Stack Tecnológica

- **Backend:** Flask (Python)
- **Banco:** SQLite
- **Frontend:** HTML, CSS, JavaScript, Leaflet
- **Offline:** IndexedDB + service worker + sync em cache
- **Clima:** Open-Meteo com cache local

## 🧭 Estrutura do projeto

```
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
└── memory/ (daily notes)
```

## 📞 Contato

**Jeferson Silva Santos**
- GitHub: [@jeffersonss-tech](https://github.com/jeffersonss-tech)
- Email: jeffersonssantos92@gmail.com
