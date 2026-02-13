"""
Teste do sistema de controle de data de teste.
Executar: python testar_data_teste.py
"""
import sys
sys.path.insert(0, '.')

from config_data_teste import setar_data, get_status, now, avancar_dias, retroceder_dias, CONFIG_FILE
import os

def testar():
    print("=" * 60)
    print("TESTE DO SISTEMA DE CONTROLE DE DATA")
    print("=" * 60)
    print()
    
    # Teste 1: Status inicial (deve usar data real)
    print("[TESTE 1] Status inicial (data real)")
    status = get_status()
    print(f"  Modo: {status['modo']}")
    print(f"  Data: {status['data_formatada']}")
    assert status['modo'] == 'real', "Deveria estar em modo real"
    print("  [OK]")
    print()
    
    # Teste 2: Setar data específica
    print("[TESTE 2] Setar data específica (2026-02-15)")
    result = setar_data('2026-02-15')
    print(f"  Resultado: {result}")
    assert result['status'] == 'ok', "Deveria retornar ok"
    assert result['data'] == '2026-02-15', "Deveria setar a data correta"
    print("  [OK]")
    print()
    
    # Teste 3: Verificar se agora usa a data de teste
    print("[TESTE 3] Verificar data de teste")
    status = get_status()
    print(f"  Modo: {status['modo']}")
    print(f"  Data: {status['data_formatada']}")
    assert status['modo'] == 'teste', "Deveria estar em modo teste"
    assert status['data'] == '2026-02-15', "Deveria mostrar a data de teste"
    print("  [OK]")
    print()
    
    # Teste 4: Verificar função now()
    print("[TESTE 4] Verificar função now()")
    data = now()
    print(f"  now(): {data.isoformat()}")
    assert data.year == 2026, "Deveria ser 2026"
    assert data.month == 2, "Deveria ser fevereiro"
    assert data.day == 15, "Deveria ser dia 15"
    print("  [OK]")
    print()
    
    # Teste 5: Avançar dias
    print("[TESTE 5] Avançar 7 dias")
    result = avancar_dias(7)
    print(f"  Resultado: {result}")
    status = get_status()
    print(f"  Nova data: {status['data_formatada']}")
    assert status['data'] == '2026-02-22', "Deveria avançar para 22/02"
    print("  [OK]")
    print()
    
    # Teste 6: Retroceder dias
    print("[TESTE 6] Retroceder 5 dias")
    result = retroceder_dias(5)
    print(f"  Resultado: {result}")
    status = get_status()
    print(f"  Nova data: {status['data_formatada']}")
    assert status['data'] == '2026-02-17', "Deveria voltar para 17/02"
    print("  [OK]")
    print()
    
    # Teste 7: Resetar para data real
    print("[TESTE 7] Resetar para data real")
    result = setar_data(None)
    print(f"  Resultado: {result}")
    status = get_status()
    assert status['modo'] == 'real', "Deveria voltar para modo real"
    print("  [OK]")
    print()
    
    # Teste 8: Arquivo de configuração existe
    print("[TESTE 8] Arquivo de configuração")
    print(f"  Arquivo existe: {CONFIG_FILE.exists()}")
    # Limpar arquivo de teste
    if CONFIG_FILE.exists():
        CONFIG_FILE.unlink()
    print("  Arquivo limpo")
    print()
    
    print("=" * 60)
    print("TODOS OS TESTES PASSARAM!")
    print("=" * 60)
    print()
    print("Para usar no dia a dia:")
    print("  python data_teste.bat 2026-02-15  # setar data")
    print("  python data_teste.bat +7         # avancar 7 dias")
    print("  python data_teste.bat -3         # retroceder 3 dias")
    print("  python data_teste.bat hj         # voltar ao normal")
    print()
    print("Ou diretamente no Python:")
    print("  from config_data_teste import setar_data, now")
    print("  setar_data('2026-02-15')")
    print("  data = now()")

if __name__ == "__main__":
    testar()
