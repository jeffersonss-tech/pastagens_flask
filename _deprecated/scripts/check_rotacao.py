from services.rotacao_service import calcular_prioridade_rotacao

result = calcular_prioridade_rotacao(1)
for r in result:
    print(f"Piquete: {r['nome']}")
    print(f"  Estado: {r['estado']}")
    print(f"  Status: {r['status_detalhes']['status']}")
    print(f"  Lotes: {r.get('lotes_no_piquete')}")
    print()
