"""
Servicos de Fazenda
Funcoes isoladas para regras de negocio relacionadas a fazenda.

Arquitetura:
    - Camada de servico (service layer)
    - Sem logica em controllers Flask
    - Queries SQL otimizadas (O(1) ou O(n) onde n = linhas retornadas)
    
Complexidade:
    - Tempo: O(1) por query + O(n) para fetch de resultados
    - Space: O(1) alem dos resultados
    
Testes:
    - test_fazenda_service.py
    - Coverage: Empty state, Normal state, Extreme (100+), Edge cases
"""
import sqlite3
import os
from datetime import datetime
from simular_data import now as data_teste_now  # Suporte a data de teste


# ========== CONSTANTES ==========
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "pastagens.db")


def get_db():
    """
    Retorna conexao com o banco de dados.
    
    Returns:
        sqlite3.Connection: Conexao SQLite configurada com row_factory.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def gerar_resumo_geral(fazenda_id: int) -> dict:
    """
    Gera resumo geral consolidado da fazenda.
    
    Funcao pura de servico - sem dependencia de framework web.
    
    Args:
        fazenda_id (int): ID unico da fazenda.
    
    Returns:
        dict: Consolidacao com metricas da fazenda:
            {
                'total_lotes': int,
                'total_animais': int,
                'total_piquetes': int,
                'area_ocupada': float,
                'area_descanso': float,
                'media_altura_estimada': float,
                'piquetes_prontos': int,
                'piquetes_criticos': int
            }
    
    Raises:
        ValueError: Se fazenda_id for invalido (<= 0 ou None).
    
    Complexidade:
        - Tempo: O(1) para cada query + O(n) para fetch
        - Queries: 5 queries fixas (independente de n)
        - Memory: O(1) alem dos resultados
    
    Logica de Calculo:
        - total_lotes: COUNT(*) WHERE ativo = 1
        - total_animais: SUM(quantidade) WHERE ativo = 1
        - area_ocupada: SUM(area) WHERE estado = 'ocupado'
        - area_descanso: SUM(area) WHERE estado != 'ocupado' AND bloqueado = 0
        - media_altura: AVG(COALESCE(altura_real_medida, altura_estimada))
        - piquetes_prontos: COUNT WHERE altura >= altura_entrada AND estado != 'ocupado'
        - piquetes_criticos: COUNT WHERE altura < altura_saida
    
    Exemplos:
        >>> gerar_resumo_geral(1)
        {
            'total_lotes': 5,
            'total_animais': 150,
            'total_piquetes': 10,
            'area_ocupada': 45.5,
            'area_descanso': 120.3,
            'media_altura_estimada': 28.5,
            'piquetes_prontos': 3,
            'piquetes_criticos': 1
        }
    """
    if not fazenda_id or fazenda_id <= 0:
        raise ValueError(f"ID de fazenda invalido: {fazenda_id}")
    
    conn = get_db()
    cursor = conn.cursor()
    
    # ========== TOTAL DE LOTES E ANIMAIS ==========
    cursor.execute('''
        SELECT COUNT(*) as total_lotes, SUM(quantidade) as total_animais
        FROM lotes 
        WHERE fazenda_id = ? AND ativo = 1
    ''', (fazenda_id,))
    row = cursor.fetchone()
    total_lotes = row['total_lotes'] or 0
    total_animais = row['total_animais'] or 0
    
    # ========== TOTAL DE PIQUETES ==========
    cursor.execute('''
        SELECT COUNT(*) as total
        FROM piquetes 
        WHERE fazenda_id = ? AND ativo = 1
    ''', (fazenda_id,))
    total_piquetes = cursor.fetchone()['total'] or 0
    
    # ========== AREAS OCUPADA E DESCANSO ==========
    cursor.execute('''
        SELECT id, area, estado, bloqueado, altura_real_medida, altura_estimada, data_medicao,
               altura_entrada, altura_saida, dias_ocupacao, dias_descanso, capim
        FROM piquetes
        WHERE fazenda_id = ? AND ativo = 1
    ''', (fazenda_id,))
    piquetes = [dict(r) for r in cursor.fetchall()]

    # Área ocupada continua baseada no estado do piquete
    area_ocupada = sum((p.get('area') or 0) for p in piquetes if p.get('estado') == 'ocupado')

    # Área de descanso = SOMENTE status EM_DESCANSO (alinhado com a lógica da IA Rotação)
    # Contagem de "prontos" e "críticos" também segue o status da IA Rotação.
    from services.rotacao_service import calcular_status_piquete
    from database import calcular_altura_estimada

    area_descanso = 0
    piquetes_prontos = 0
    piquetes_criticos = 0

    for p in piquetes:
        # Calcular altura_estimada consistente com a IA Rotação, quando houver medição
        if p.get('altura_estimada') is None and p.get('data_medicao'):
            altura_calc, _fonte = calcular_altura_estimada(p)
            p['altura_estimada'] = altura_calc

        status = calcular_status_piquete(p).get('status')

        # Considerar como "desocupado":
        # - EM_DESCANSO (descanso real)
        # - BLOQUEADO por ausência de medição (sem altura real/estimada e sem data_medicao)
        sem_medicao = (
            (not p.get('altura_real_medida'))
            and (not p.get('altura_estimada'))
            and (not p.get('data_medicao'))
        )
        if status == 'EM_DESCANSO' or (status == 'BLOQUEADO' and sem_medicao):
            area_descanso += (p.get('area') or 0)

        if status == 'APTO_ENTRADA':
            piquetes_prontos += 1
        if status == 'ABAIXO_MINIMO':
            piquetes_criticos += 1
    
    # ========== MEDIA DE ALTURA ==========
    cursor.execute('''
        SELECT AVG(COALESCE(altura_real_medida, altura_estimada)) as media
        FROM piquetes 
        WHERE fazenda_id = ? AND ativo = 1 
          AND (altura_real_medida IS NOT NULL OR altura_estimada IS NOT NULL)
    ''', (fazenda_id,))
    row = cursor.fetchone()
    media_altura = round(float(row['media'] or 0), 1)
    
    conn.close()
    
    return {
        'total_lotes': total_lotes,
        'total_animais': total_animais,
        'total_piquetes': total_piquetes,
        'area_ocupada': round(area_ocupada, 2),
        'area_descanso': round(area_descanso, 2),
        'media_altura_estimada': media_altura,
        'piquetes_prontos': piquetes_prontos,
        'piquetes_criticos': piquetes_criticos
    }
