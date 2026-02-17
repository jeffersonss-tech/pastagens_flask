"""
Módulo de controle de data para testes do PastoFlow.
Permite simular datas diferentes para testar contadores de crescimento/degradação.

Uso:
    from config_data_teste import now, setar_data
    
    # Usar em todo lugar que usaria datetime.now()
    data_atual = now()
"""
import json
import os
from datetime import datetime, date
from pathlib import Path

# Arquivo de configuração da data
CONFIG_FILE = Path(__file__).parent / "data_teste_config.json"


def get_data_teste() -> datetime | None:
    """
    Retorna a data de teste configurada, ou None se usar data real.
    
    Returns:
        datetime: Data configurada para teste
        None: Usa datetime.now() normalmente
    """
    if not CONFIG_FILE.exists():
        return None
    
    try:
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
        
        data_str = config.get('data')
        if data_str:
            return datetime.fromisoformat(data_str)
    except Exception as e:
        print(f"Erro ao ler config de data: {e}")
    
    return None


def now() -> datetime:
    """
    Retorna a data/hora atual, considerando configuração de teste.
    
    Returns:
        datetime: Data de teste se configurada, senão datetime.now()
    """
    data_teste = get_data_teste()
    if data_teste is not None:
        return data_teste
    return datetime.now()


def today() -> date:
    """
    Retorna a data atual (sem hora), considerando configuração de teste.
    
    Returns:
        date: Data de teste se configurada, senão date.today()
    """
    return now().date()


def setar_data(data_str: str = None) -> dict:
    """
    Define a data de teste.
    
    Args:
        data_str: Data no formato YYYY-MM-DD, ou None para resetar (usar data real)
    
    Returns:
        dict com status e data atual
    """
    if data_str is None:
        # Resetar para data real
        if CONFIG_FILE.exists():
            CONFIG_FILE.unlink()
        return {
            'status': 'ok',
            'modo': 'real',
            'mensagem': 'Data resetada para data real do sistema'
        }
    
    # Validar formato
    try:
        data = datetime.strptime(data_str, '%Y-%m-%d')
    except ValueError:
        return {
            'status': 'erro',
            'mensagem': f"Formato inválido: {data_str}. Use YYYY-MM-DD"
        }
    
    # Salvar configuração
    config = {
        'data': data.isoformat(),
        'setado_em': datetime.now().isoformat(),
        'modo': 'teste'
    }
    
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2)
    
    return {
        'status': 'ok',
        'modo': 'teste',
        'data': data_str,
        'mensagem': f"Data setada para {data_str}"
    }


def get_status() -> dict:
    """Retorna o status atual do controle de data."""
    data_teste = get_data_teste()
    
    if data_teste:
        return {
            'modo': 'teste',
            'data': data_teste.strftime('%Y-%m-%d'),
            'data_formatada': data_teste.strftime('%d/%m/%Y'),
            'dia_semana': data_teste.strftime('%A'),
            'arquivo_existe': True
        }
    else:
        hoje = datetime.now()
        return {
            'modo': 'real',
            'data': hoje.strftime('%Y-%m-%d'),
            'data_formatada': hoje.strftime('%d/%m/%Y'),
            'dia_semana': hoje.strftime('%A'),
            'arquivo_existe': False
        }


def avancar_dias(dias: int) -> dict:
    """Avança N dias a partir da data atual (real ou de teste)."""
    data_ref = get_data_teste()
    if data_ref is None:
        data_ref = datetime.now()
    
    nova_data = data_ref.replace(day=data_ref.day + dias)
    return setar_data(nova_data.strftime('%Y-%m-%d'))


def retroceder_dias(dias: int) -> dict:
    """Retrocede N dias a partir da data atual (real ou de teste)."""
    data_ref = get_data_teste()
    if data_ref is None:
        data_ref = datetime.now()
    
    nova_data = data_ref.replace(day=data_ref.day - dias)
    return setar_data(nova_data.strftime('%Y-%m-%d'))


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        # Mostrar help e status
        print("""
=== CONTROLE DE DATA DE TESTE ===

Uso:
    python simular_data.py            # ver status atual
    python simular_data.py +<n>      # avançar n dias
    python simular_data.py -<n>      # retroceder n dias
    python simular_data.py YYYY-MM-DD # data específica
    python simular_data.py reset     # voltar para data real
    python simular_data.py hoje      # data de hoje (reset)

Exemplos:
    python simular_data.py +10       # pula 10 dias
    python simular_data.py -5        # volta 5 dias
    python simular_data.py 2026-03-17  #define data para 17/03/2026
""")
        status = get_status()
        print(f"Status atual:")
        print(f"  Modo: {status['modo']}")
        print(f"  Data: {status['data_formatada']} ({status['dia_semana']})")
        print(f"  Arquivo config: {'Existe' if status['arquivo_existe'] else 'Nao existe'}")
    else:
        comando = sys.argv[1]
        
        if comando == "status":
            status = get_status()
            print(f"Modo: {status['modo']}")
            print(f"Data: {status['data_formatada']}")
        elif comando == "hoje":
            result = setar_data(None)
            print(result['mensagem'])
        elif comando == "reset":
            result = setar_data(None)
            print(result['mensagem'])
        elif comando.startswith("+") and comando[1:].isdigit():
            # +5 = avançar 5 dias
            dias = int(comando[1:])
            result = avancar_dias(dias)
            print(result['mensagem'])
        elif comando.startswith("-") and comando[1:].isdigit():
            # -3 = retroceder 3 dias
            dias = int(comando[1:])
            result = retroceder_dias(dias)
            print(result['mensagem'])
        else:
            # Assumir que é uma data YYYY-MM-DD
            result = setar_data(comando)
            print(result['mensagem'])
