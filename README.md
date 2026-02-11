# 🌱 Sistema de Pastagens - Gerenciamento de Fazendas

Sistema web completo para gestão de pastagens, piquetes, lotes de animais e rotação inteligente de pastejo.

## 🚀 Funcionalidades

- **🏠 Gestão de Fazendas** - CRUD completo com coordenadas da sede
- **🗺️ Mapas Interativos** - Visualização dos piquetes no mapa com Leaflet.js
- **📊 Dashboard** - Estatísticas em tempo real (área, animais, lotação)
- **🐄 Gestão de Lotes** - Cadastro e acompanhamento de animais
- **🔄 IA de Rotação** - Recomendações automáticas de rotação de pastagem
- **📈 Cálculo de Lotação** - UA (Unidade Animal) e UA/hectare
- **🔔 Sistema de Alertas** - Notificações de piquetes que precisam de atenção
- **📱 Responsivo** - Funciona em desktop e mobile

## 🛠️ Tech Stack

- **Backend:** Flask (Python)
- **Banco de Dados:** SQLite
- **Frontend:** HTML/CSS/JavaScript
- **Mapas:** Leaflet.js + OpenStreetMap
- **Autenticação:** Flask Session

## 📁 Estrutura

```
pastagens_flask/
├── app.py              # Aplicação principal
├── database.py         # Banco de dados e modelos
├── routes/
│   └── api_fazendas.py # APIs de fazendas
├── templates/
│   ├── home.html       # Dashboard de fazendas
│   ├── fazenda.html    # Gestão de piquetes
│   └── lotes.html      # Gestão de lotes
└── pastagens.db        # Banco SQLite
```

## 🚦 Como Executar

```bash
# Criar ambiente virtual
python -m venv venv

# Ativar
.\venv\Scripts\activate  # Windows

# Instalar dependências
pip install flask

# Executar
python app.py

# Acessar
http://localhost:5000
```

## 🔐 Login Padrão

- **Usuário:** admin
- **Senha:** admin123

## 📋 Módulos

### Dashboard (/)
- Visão geral das fazendas
- Estatísticas gerais
- Criar/editar/excluir fazendas

### Fazenda (/fazenda/{id})
- Mapa dos piquetes
- CRUD de piquetes
- Status inteligente (APTO, OCUPADO, EM_DESCANSO, etc.)

### Lotes (/fazenda/{id}/lotes)
- Gestão completa de lotes
- Movimentação entre piquetes
- Sugestão automática de piquetes

### IA Rotação (/fazenda/{id}/rotacao)
- Recomendações prioritárias
- Plano de rotação otimizado

## 🐍 Autor

**Jeferson Silva Santos**
- GitHub: [@jeffersonss-tech](https://github.com/jeffersonss-tech)
- Email: jeffersonssantos92@gmail.com

## 📄 Licença

MIT License
