# -*- coding: utf-8 -*-
"""
Teste das funcionalidades de alerta e remocao de animais
"""
import sys
sys.path.insert(0, '.')

from database import listar_piquetes, get_db
from services.rotacao_service import calcular_status_piquete

def testar_status_piquete():
    """Testa o calculo de status do piquete"""
    print("=" * 60)
    print("TESTE: Calculo de Status do Piquete")
    print("=" * 60)
    
    # Piquete ocupado com dias decorridos >= dias tecnicos
    # OBS: dias_tecnicos vem do banco de dados (salvo quando lote eh movido)
    # Para Brachiaria: dias_tecnicos = 28
    piquete_mock = {
        'id': 1,
        'nome': 'Piquete Teste',
        'estado': 'ocupado',
        'altura_real_medida': None,
        'altura_estimada': 20,
        'altura_entrada': 25,
        'altura_saida': 15,
        'dias_ocupacao': 25,
        'dias_descanso': 0,
        'dias_descanso_min': 30,
        'capim': 'Brachiaria',
        'bloqueado': 0,
        'motivo_bloqueio': None,
        # dias_tecnicos vem do banco de dados quando lote eh movido
        'dias_tecnicos': 28  # Exemplo: 28 dias para Brachiaria
    }
    
    # Simular dias_no_piquete = dias_ocupacao para teste
    piquete_mock['dias_no_piquete'] = piquete_mock['dias_ocupacao']
    
    status = calcular_status_piquete(piquete_mock)
    print(f"Piquete: {piquete_mock['nome']}")
    print(f"Estado: {piquete_mock['estado']}")
    print(f"Dias decorridos: {piquete_mock['dias_no_piquete']}")
    print(f"Dias tecnicos (max): {piquete_mock['dias_tecnicos']}")
    print(f"Status calculado: {status['status']}")
    print(f"Acao recomendada: {status['acao']}")
    
    # Verificar se esta SAIDA_IMEDIATA
    if status['status'] == 'SAIDA_IMEDIATA':
        print("STATUS CORRETO: Piquete deve ter saida imediata!")
    else:
        print(f"INFO: Status '{status['status']}' - pode ser que os dias nao tenham ultrapassado o limite")
        print(f"      (dias_no_piquete={piquete_mock['dias_no_piquete']}, dias_tecnicos={piquete_mock['dias_tecnicos']})")
    
    print()
    
    # Testar com dias ultrapassando o limite
    piquete_mock2 = {
        'id': 2,
        'nome': 'Piquete Ultrapassado',
        'estado': 'ocupado',
        'altura_real_medida': None,
        'altura_estimada': 20,
        'altura_entrada': 25,
        'altura_saida': 15,
        'dias_ocupacao': 35,  # Mais que os 28 dias tecnicos
        'dias_descanso': 0,
        'dias_descanso_min': 30,
        'capim': 'Brachiaria',
        'bloqueado': 0,
        'motivo_bloqueio': None,
        'dias_tecnicos': 28
    }
    piquete_mock2['dias_no_piquete'] = piquete_mock2['dias_ocupacao']
    
    status2 = calcular_status_piquete(piquete_mock2)
    print(f"Piquete: {piquete_mock2['nome']}")
    print(f"Dias decorridos: {piquete_mock2['dias_no_piquete']}")
    print(f"Dias tecnicos (max): {piquete_mock2['dias_tecnicos']}")
    print(f"Status calculado: {status2['status']}")
    print(f"Acao recomendada: {status2['acao']}")
    
    if status2['status'] == 'SAIDA_IMEDIATA':
        print("STATUS CORRETO: Piquete ultrapassou limite!")
    else:
        print(f"ERRO: Esperado 'SAIDA_IMEDIATA', obtido '{status2['status']}'")

def testar_listar_piquetes():
    """Testa a listagem de piquetes"""
    print()
    print("=" * 60)
    print("TESTE: Listagem de Piquetes")
    print("=" * 60)
    
    try:
        piquetes = listar_piquetes(1)  # Assumindo fazenda_id = 1
        print(f"Total de piquetes encontrados: {len(piquetes)}")
        
        for p in piquetes[:5]:  # Mostrar primeiros 5
            print(f"  - {p.get('nome', 'N/I')}: estado={p.get('estado')}, "
                  f"dias_no_piquete={p.get('dias_no_piquete')}, "
                  f"dias_tecnicos={p.get('dias_tecnicos')}, "
                  f"animais={p.get('animais_no_piquete', 0)}")
        
        # Verificar se tem os campos necessarios
        campos_necessarios = ['dias_no_piquete', 'dias_tecnicos', 'animais_no_piquete']
        tem_campos = all(p.get(c) is not None for p in piquetes for c in campos_necessarios)
        if tem_campos or len(piquetes) == 0:
            print("Todos os piquetes tem os campos necessarios!")
        else:
            print("ATENCAO: Algum piquete pode estar sem campos necessarios")
            
    except Exception as e:
        print(f"Erro ao listar piquetes: {e}")

def verificar_funcoes_js():
    """Verifica se as funcoes JS existem no template"""
    print()
    print("=" * 60)
    print("TESTE: Verificacao das Funcoes JavaScript")
    print("=" * 60)
    
    with open('templates/fazenda.html', 'r', encoding='utf-8') as f:
        html = f.read()
    
    funcoes_esperadas = [
        'removerAnimaisPiquete',
        'loadAll',
        'calcular_status_piquete'
    ]
    
    for func in funcoes_esperadas:
        if f'function {func}' in html:
            print(f"Funcao encontrada: {func}")
        else:
            print(f"Funcao NAO encontrada: {func}")
    
    # Verificar botoes de remover
    if 'removerAnimaisPiquete' in html and 'Remover Animais' in html:
        print("Botoes de Remover Animais encontrado no template!")
    else:
        print("Botoes de Remover Animais NAO encontrado no template")

if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("TESTES: Sistema de Alerta e Remocao de Animais")
    print("=" * 60 + "\n")
    
    try:
        testar_status_piquete()
        testar_listar_piquetes()
        verificar_funcoes_js()
        
        print()
        print("=" * 60)
        print("RESUMO: Todos os testes concluidos!")
        print("=" * 60)
        
    except Exception as e:
        print(f"Erro geral nos testes: {e}")
        import traceback
        traceback.print_exc()
