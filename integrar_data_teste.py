"""
Script de integração do sistema de data de teste.
Executar: python integrar_data_teste.py
"""
import re

ARQUIVOS = [
    'database.py',
    'app.py',
    'routes/api_fazendas.py',
    'services/fazenda_service.py',
    'services/manejo_service.py',
]

def integrar_arquivo(caminho):
    """Integra o sistema de data de teste num arquivo."""
    
    with open(caminho, 'r', encoding='utf-8') as f:
        conteudo = f.read()
    
    # Verificar se já tem o import
    if 'from config_data_teste import now' in conteudo:
        print(f"  [OK] {caminho} ja integrado")
        return True
    
    # Adicionar import depois do import de datetime
    if 'from datetime import datetime' in conteudo:
        conteudo = conteudo.replace(
            'from datetime import datetime',
            'from datetime import datetime\nfrom config_data_teste import now as data_teste_now  # Suporte a data de teste'
        )
        print(f"  [+] Import adicionado em {caminho}")
    elif 'import datetime' in conteudo:
        conteudo = conteudo.replace(
            'import datetime',
            'import datetime\nfrom config_data_teste import now as data_teste_now  # Suporte a data de teste'
        )
        print(f"  [+] Import adicionado em {caminho}")
    
    # Substituir datetime.now() por data_teste_now() nos cálculos de dias
    # Mas manter datetime.now() nos campos de created_at/updated_at
    
    # Padrões que DEVEM mudar (cálculos de dias):
    padroes_calculo = [
        (r'(\(datetime\.now\(\) - entrada\)\.days)', r'(data_teste_now() - entrada).days'),
        (r'(\(datetime\.now\(\) - mov_dt\)\.days)', r'(data_teste_now() - mov_dt).days'),
        (r'(\(datetime\.now\(\) - entrada_dt\)\.days)', r'(data_teste_now() - entrada_dt).days'),
    ]
    
    for padrao, substituto in padroes_calculo:
        if re.search(padrao, conteudo):
            conteudo = re.sub(padrao, substituto, conteudo)
            print(f"    [OK] Calculo substituido em {caminho}")
    
    # Salvar se houve mudanças
    with open(caminho, 'w', encoding='utf-8') as f:
        f.write(conteudo)
    
    return True

if __name__ == "__main__":
    print("=" * 50)
    print("INTEGRAÇÃO DO SISTEMA DE DATA DE TESTE")
    print("=" * 50)
    print()
    
    for arquivo in ARQUIVOS:
        caminho_completo = f"C:\\projetos\\pastagens_flask\\{arquivo}"
        try:
            integrar_arquivo(caminho_completo)
        except FileNotFoundError:
            print(f"  × {arquivo} não encontrado (pulando)")
        except Exception as e:
            print(f"  × Erro em {arquivo}: {e}")
    
    print()
    print("=" * 50)
    print("Para usar:")
    print("  1. python data_teste.bat 2026-02-15  # setar data")
    print("  2. python data_teste.bat +7         # avançar 7 dias")
    print("  3. python data_teste.bat hj          # voltar pro normal")
    print("=" * 50)
