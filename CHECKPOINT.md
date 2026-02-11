# Sistema de Pastagens Flask - Checkpoint 2026-02-10

## Status: 🟢 PRODUÇÃO

---

## Bugs Corrigidos HOJE (2026-02-10)

### 1. Query NOT IN NULL
**Problema:** SQLite ignora `NOT IN (NULL)` → sempre retornava 0 resultados
**Arquivo:** `database.py`
**Solução:** Query condicional - só usa `NOT IN` se houver ocupados

### 2. Coluna dias_descanso inexistente
**Problema:** `sqlite3.OperationalError: no such column: dias_descanso`
**Solução:** Adicionada coluna ao banco

### 3. Mapa da aba Piquetes não renderizava
**Problema:** `showSection('piquetes')` não chamava `drawAllPiquetes()`
**Arquivo:** `templates/fazenda.html`
**Solução:** Adicionado `drawAllPiquetes()` após `invalidateSize()`

### 4. Dois window.onload no HTML
**Problema:** Segundo sobrescrevia o primeiro, funções não eram chamadas
**Solução:** Removido duplicata,留下的 só um no final do arquivo

---

## Features Implementadas (2026-02-10)

### Sistema altura_real vs altura_estimada
- `altura_real_medida` → informada manualmente (verde "MEDIDA")
- `altura_estimada` → calculada automaticamente (laranja "ESTIMADA")
- Prioridade: real > estimada > altura_atual (legacy)

### Cálculo de Estimativa Automática
```python
# Piquete VAZIO
altura = altura_saida + (dias_descanso * crescimento_diario)

# Piquete EM OCUPAÇÃO
altura = altura_entrada - (dias_ocupacao * consumo_diario)
```

### Crescimento/Consumo por Capim
| Capim | Cresc (cm/dia) | Consum (cm/dia) |
|-------|----------------|-----------------|
| Tifton 85 | 1.0 | 0.7 |
| Brachiaria | 1.2 | 0.8 |
| Andropogon | 1.2 | 0.8 |
| Capim Aruana | 1.1 | 0.75 |
| Natalino | 1.3 | 0.85 |
| MG-5 | 1.4 | 0.9 |
| Mombaça | 1.5 | 1.0 |

---

## Arquivos Modificados
- `database.py` - queries, funções de cálculo
- `app.py` - APIs
- `templates/fazenda.html` - mapas, cards, badges
- `templates/lotes.html` - selects, sugestões
- `pastagens.db` - estrutura atualizada

---

## Páginas
- Dashboard: `/fazenda/{id}`
- Lotes: `/fazenda/{id}/lotes`
- IA Rotação: `/fazenda/{id}/rotacao`

---

## Comandos Úteis
```bash
# Reiniciar
cd C:\projetos\pastagens_flask && .\iniciar.bat

# Verificar erros
python -c "from app import app"
```

---

**Próximos:** Moltbook X/Twitter verification pendente
