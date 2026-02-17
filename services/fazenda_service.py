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
        SELECT 
            COALESCE(SUM(CASE WHEN estado = 'ocupado' THEN area ELSE 0 END), 0) as area_ocupada,
            COALESCE(SUM(CASE WHEN estado != 'ocupado' AND bloqueado = 0 THEN area ELSE 0 END), 0) as area_descanso
        FROM piquetes 
        WHERE fazenda_id = ? AND ativo = 1
    ''', (fazenda_id,))
    row = cursor.fetchone()
    area_ocupada = float(row['area_ocupada'] or 0)
    area_descanso = float(row['area_descanso'] or 0)
    
    # ========== MEDIA DE ALTURA ==========
    cursor.execute('''
        SELECT AVG(COALESCE(altura_real_medida, altura_estimada)) as media
        FROM piquetes 
        WHERE fazenda_id = ? AND ativo = 1 
          AND (altura_real_medida IS NOT NULL OR altura_estimada IS NOT NULL)
    ''', (fazenda_id,))
    row = cursor.fetchone()
    media_altura = round(float(row['media'] or 0), 1)
    
    # ========== PIQUETES PRONTOS E CRITICOS ==========
    cursor.execute('''
        SELECT 
            COUNT(CASE WHEN (altura_real_medida IS NOT NULL OR altura_estimada IS NOT NULL)
                      AND COALESCE(altura_real_medida, altura_estimada) >= altura_entrada
                      AND estado != 'ocupado' THEN 1 END) as prontos,
            COUNT(CASE WHEN (altura_real_medida IS NOT NULL OR altura_estimada IS NOT NULL)
                      AND COALESCE(altura_real_medida, altura_estimada) < altura_saida THEN 1 END) as criticos
        FROM piquetes 
        WHERE fazenda_id = ? AND ativo = 1
    ''', (fazenda_id,))
    row = cursor.fetchone()
    piquetes_prontos = row['prontos'] or 0
    piquetes_criticos = row['criticos'] or 0
    
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
