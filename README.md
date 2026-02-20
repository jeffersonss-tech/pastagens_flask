# PastoFlow - Sistema de Gestão de Pastagens

Sistema web completo para gestão de fazendas, pastagens, piquetes, lotes de animais e rotação inteligente de pastejo.

## 🚀 Novidades da Versão (Refatoração 20/02/2026)

O sistema passou por uma grande evolução arquitetural e visual:
- **Arquitetura Profissional:** Separação total de CSS, JS e Modais em arquivos externos.
- **Layout Unificado:** Implementação de `base.html` com Sidebar inteligente e navegação fluida entre abas.
- **Sidebar Contraível:** Barra lateral que expande/recolhe com persistência (lembra sua escolha ao recarregar).
- **Motor de Cálculo Integrado:** Integração real do motor de manejo com a simulação de data (consumo e crescimento dinâmico).
- **Navegação Inteligente:** Sincronização automática da URL com a seção ativa (Hash URL).

## Funcionalidades

### 🏠 Gestão de Fazendas
- CRUD completo com coordenadas da sede (GPS)
- Múltiplas fazendas por usuário
- Dashboard consolidado com estatísticas globais corrigidas

### 🗺️ Piquetes com Inteligência
- Desenho de polígonos no mapa (Leaflet.js)
- Cálculo automático de área por GPS
- Sistema de cores por estado (verde/laranja/vermelho/amarelo/roxo)
- Barra de progresso de recuperação baseada em altura real

### 📐 Sistema altura_real vs altura_estimada
- **altura_real_medida**: Informada manualmente (verdade absoluta)
- **altura_estimada**: Calculada automaticamente baseada na carga animal (UA/ha)

**Cálculo Automático Dinâmico:**
- Piquete VAZIO: Crescimento baseado no clima e dias de descanso.
- Piquete OCUPAÇÃO: Consumo proporcional ao peso do lote e taxa de lotação.

### 🐄 Gestão de Lotes
- Unificação de modais: Criar lotes da dashboard ou da tela de lotes agora segue o mesmo padrão técnico.
- Cadastro com validações: Pesos de 50-1200 kg.
- Sugestão automática de piquetes aptos baseada no tipo de gado.

### 🔄 IA de Rotação
- Recomendações ordenadas por prioridade técnica.
- Plano de rotação otimizado para evitar degradação.
- Alertas de "Passou do Ponto" (Saída Imediata).

## Stack Tecnológica

- **Backend:** Flask (Python 3.10)
- **Banco de Dados:** SQLite
- **Frontend:** HTML5, CSS3, JavaScript ES6
- **Mapas:** Leaflet.js
- **Simulação:** Sistema de data customizado para testes de manejo

## Estrutura do Projeto

```
pastagens_flask/
├── app.py                    # Flask principal (rotas, auth, páginas)
├── database.py               # Motor de banco e lógica de altura
├── static/
│   ├── css/                  # Estilos (fazenda.css, lotes.css, rotacao.css, piquetes.css)
│   └── js/                   # Lógicas (fazenda.js, lotes.js, rotacao.js, piquetes.js)
├── templates/
│   ├── base.html             # Estrutura base (sidebar/header)
│   ├── modals/               # Modais separados por função
│   └── (fazenda, lotes, etc) # Páginas específicas
├── services/                 # Regras de negócio isoladas
└── simular_data.py           # Ferramenta de simulação temporal
```

## Autor

**Jeferson Silva Santos**
- GitHub: [@jeffersonss-tech](https://github.com/jeffersonss-tech)
- Email: jeffersonssantos92@gmail.com
