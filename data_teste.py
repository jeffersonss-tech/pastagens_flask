"""
Controle de data de teste do Sistema de Pastagens
Uso: python data_teste.py [comando]
"""
import sys
from config_data_teste import setar_data, get_status, avancar_dias, retroceder_dias

def main():
    if len(sys.argv) < 2:
        # Mostrar ajuda
        print("=" * 50)
        print("  CONTROLE DE DATA - SISTEMA DE PASTAGENS")
        print("=" * 50)
        print()
        print("  COMANDOS:")
        print()
        print("    status          - mostra a data atual")
        print("    hj, hoje       - usa a data real do sistema")
        print("    reset           - usa a data real do sistema")
        print("    +N              - avanca N dias (ex: +7)")
        print("    -N              - retrocede N dias (ex: -3)")
        print("    YYYY-MM-DD      - define data especifica")
        print()
        print("  EXEMPLOS:")
        print()
        print("    python data_teste.py +15")
        print("    python data_teste.py -5")
        print("    python data_teste.py 2026-03-01")
        print("    python data_teste.py hj")
        print()
        status = get_status()
        print(f"  Data atual: {status['data_formatada']} ({status['modo']})")
        return

    comando = sys.argv[1]

    if comando in ['hj', 'hoje', 'reset']:
        result = setar_data(None)
        print(result['mensagem'])
    elif comando == 'status':
        status = get_status()
        print(f"Modo: {status['modo']}")
        print(f"Data: {status['data_formatada']}")
    elif comando.startswith('+') and comando[1:].isdigit():
        dias = int(comando[1:])
        result = avancar_dias(dias)
        print(result['mensagem'])
    elif comando.startswith('-') and comando[1:].isdigit():
        dias = int(comando[1:])
        result = retroceder_dias(dias)
        print(result['mensagem'])
    else:
        # Assumir data YYYY-MM-DD
        result = setar_data(comando)
        print(result['mensagem'])

if __name__ == "__main__":
    main()
