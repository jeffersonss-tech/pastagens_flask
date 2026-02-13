# Sistema de Controle de Data de Teste

Permite simular datas diferentes para testar os contadores de crescimento e degradação de pasto.

## Arquivos

- `config_data_teste.py` - Módulo principal com funções `now()`, `setar_data()`, `get_status()`
- `data_teste.bat` - Script shell para Windows
- `testar_data_teste.py` - Testes do sistema

## Uso via Shell (recomendado)

```batch
REM Ver status atual
data_teste.bat

REM Definir data específica
data_teste.bat 2026-02-15

REM Avançar N dias
data_teste.bat +7   (avança 7 dias)
data_teste.bat +30  (avança 30 dias)

REM Retroceder N dias
data_teste.bat -5   (retrocede 5 dias)

REM Voltar para data real do sistema
data_teste.bat hj
data_teste.bat reset
```

## Uso via Python

```python
from config_data_teste import setar_data, get_status, now

# Ver status
status = get_status()
print(f"Modo: {status['modo']}, Data: {status['data']}")

# Definir data
setar_data('2026-02-15')

# Usar em código
from datetime import datetime
data_atual = now()  # retorna data de teste se configurada
```

## O que acontece quando a data é alterada?

O sistema usa a data de teste nos seguintes cálculos:

1. **Dias no piquete** (`calcular_dias_no_piquete`) - conta dias desde a entrada do lote
2. **Dias de descanso** - calcula dias desde a última movimentação
3. **Status dos lotes** - atualiza status baseado em dias de ocupação
4. **Alertas** - verifica ocupação máxima baseada em dias
5. **Alturas estimadas** - calcula crescimento/degradação baseado nos dias

## Campos que NÃO são afetados

Os campos de auditoria (`created_at`, `updated_at`) continuam usando a data real do sistema, mesmo com data de teste ativada.

## Exemplo de Teste

Para verificar se os contadores estão funcionando:

1. `data_teste.bat 2026-02-01` - Setar data para início do mês
2. Abrir o sistema e criar/editar algum piquete ou lote
3. `data_teste.bat +10` - Avançar 10 dias
4. Verificar se os contadores de dias no piquete/de descanso aumentaram
5. Verificar se as alturas estimadas mudaram (crescimento do pasto)
