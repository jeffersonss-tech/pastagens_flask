"""
Serviços de Fazenda
Funções isoladas para regras de negócio relacionadas a fazenda.

Arquitetura:
    - Camada de serviço (service layer)
    - Sem lógica em controllers Flask
    - Queries SQL otimizadas (O(1) ou O(n) onde n = linhas retornadas)
    
Complexidade:
    - Tempo: O(1) por query + O(n) para fetch de resultados
    - Space: O(1) além dos resultados
    
Testes:
    - test_fazenda_service.py
    - Coverage: Empty state, Normal state, Extreme (100+), Edge cases
"""
import sqlite3
import os
from datetime import datetime


# ========== CONSTANTES ==========
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "pastagens.db")


def get_db():
    """
    Retorna conexão com o banco de dados.
    
    Returns:
        sqlite3.Connection: Conexão SQLite configurada com row_factory.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def gerar_resumo_geral(fazenda_id: int) -> dict:
    """
    Gera resumo geral consolidado da fazenda.
    
    Função pura de serviço - sem dependência de framework web.
    
    Args:
        fazenda_id (int): ID único da fazenda.
    
    Returns:
        dict: Consolidação com métricas da fazenda:
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
        ValueError: Se fazenda_id for inválido (<= 0 ou None).
    
    Complexidade:
        - Tempo: O(1) para cada query + O(n) para fetch
        - Queries: 5 queries fixas (independente de n)
        - Memory: O(1) além dos resultados
    
    Lógica de Cálculo:
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
        raise ValueError(f"ID de fazenda inválido: {fazenda_id}")
    
    conn = get_db()
    cursor = conn.cursor()
    
    # ========== TOTAL DE LOTES E ANIMAIS ==========