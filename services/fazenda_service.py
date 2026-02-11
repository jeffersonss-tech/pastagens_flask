"""
Serviços de Fazenda
Funções isoladas para regras de negócio relacionadas a fazenda.
"""
import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "pastagens.db")


def get_db():
    """Retorna conexão com o banco."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def gerar_resumo_geral(fazenda_id: int) -> dict:
    """
    Gera resumo geral consolidado da fazenda.
    
    Args:
        fazenda_id: ID da fazenda
    
    Returns:
        Dict com:
        - total_lotes: int
        - total_animais: int
        - area_ocupada: float
        - area_descanso: float
        - media_altura_estimada: float
        - piquetes_prontos: int
        - piquetes_criticos: int
    
    Raises:
        ValueError: Se fazenda_id inválido
    """
    if not fazenda_id or fazenda_id <= 0:
        raise ValueError(f"ID de fazenda inválido: {fazenda_id}")
    
    conn = get_db()
    cursor = conn.cursor()
    
    # ========== TOTAL DE LOTES E ANIMAIS ==========
    cursor.execute('''
        SELECT 
            COUNT(*) as total_lotes,
            SUM(quantidade) as total_animais
        FROM lotes
        WHERE fazenda_id = ? AND ativo = 1
    ''', (fazenda_id,))
    res_lotes = cursor.fetchone()
    total_lotes = res_lotes['total_lotes'] or 0
    total_animais = res_lotes['total_animais'] or 0
    
    # ========== PIQUETES POR STATUS ==========
    cursor.execute('''
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN estado = 'ocupado' THEN area ELSE 0 END) as area_ocupada,
            SUM(CASE WHEN estado != 'ocupado' AND bloqueado = 0 THEN area ELSE 0 END) as area_descanso
        FROM piquetes
        WHERE fazenda_id = ? AND ativo = 1
    ''', (fazenda_id,))
    res_piquetes = cursor.fetchone()
    
    total_piquetes = res_piquetes['total'] or 0
    area_ocupada = res_piquetes['area_ocupada'] or 0
    area_descanso = res_piquetes['area_descanso'] or 0
    
    # ========== ALTURA MÉDIA ESTIMADA ==========
    cursor.execute('''
        SELECT 
            CASE 
                WHEN SUM(CASE WHEN altura_real_medida IS NOT NULL THEN 1 ELSE 0 END) > 0
                THEN AVG(COALESCE(altura_real_medida, altura_estimada))
                ELSE AVG(altura_estimada)
            END as media_altura
        FROM piquetes
        WHERE fazenda_id = ? AND ativo = 1
          AND (altura_real_medida IS NOT NULL OR altura_estimada IS NOT NULL)
    ''', (fazenda_id,))
    res_altura = cursor.fetchone()
    media_altura_estimada = round(res_altura['media_altura'] or 0, 1)
    
    # ========== PIQUETES PRONTOS E CRÍTICOS ==========
    # Prontos: altura >= altura_entrada E estado != 'ocupado'
    cursor.execute('''
        SELECT COUNT(*) as count
        FROM piquetes
        WHERE fazenda_id = ? 
          AND ativo = 1
          AND bloqueado = 0
          AND estado != 'ocupado'
          AND (
              (altura_real_medida IS NOT NULL AND altura_real_medida >= altura_entrada)
              OR (altura_real_medida IS NULL AND altura_estimada >= altura_entrada)
          )
    ''', (fazenda_id,))
    piquetes_prontos = cursor.fetchone()['count'] or 0
    
    # Críticos: altura < altura_saida (abaixo do mínimo fisiológico)
    cursor.execute('''
        SELECT COUNT(*) as count
        FROM piquetes
        WHERE fazenda_id = ? 
          AND ativo = 1
          AND (
              (altura_real_medida IS NOT NULL AND altura_real_medida < altura_saida)
              OR (altura_real_medida IS NULL AND altura_estimada < altura_saida)
          )
    ''', (fazenda_id,))
    piquetes_criticos = cursor.fetchone()['count'] or 0
    
    conn.close()
    
    return {
        'total_lotes': total_lotes,
        'total_animais': total_animais,
        'total_piquetes': total_piquetes,
        'area_ocupada': round(area_ocupada, 2),
        'area_descanso': round(area_descanso, 2),
        'media_altura_estimada': media_altura_estimada,
        'piquetes_prontos': piquetes_prontos,
        'piquetes_criticos': piquetes_criticos
    }


def gerar_resumo_lote(lote_id: int) -> dict:
    """
    Gera resumo de um lote específico.
    
    Args:
        lote_id: ID do lote
    
    Returns:
        Dict com dados do lote ou None se não encontrado
    """
    if not lote_id or lote_id <= 0:
        return None
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT 
            l.*,
            p.nome as piquete_nome,
            p.capim,
            p.area as piquete_area,
            p.altura_entrada,
            p.altura_saida,
            p.altura_real_medida,
            p.altura_estimada,
            p.estado as piquete_estado,
            p.condicao_climatica,
            p.dias_descanso_min,
            p.dias_descanso
        FROM lotes l
        LEFT JOIN piquetes p ON l.piquete_atual_id = p.id
        WHERE l.id = ?
    ''', (lote_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    lote = dict(row)
    
    # Calcular altura atual
    tem_real = lote.get('altura_real_medida') is not None
    altura_atual = lote.get('altura_real_medida') if tem_real else lote.get('altura_estimada')
    
    # Determinar status do piquete
    estado_piquete = lote.get('piquete_estado')
    
    # Calcular status de disponibilidade
    if estado_piquete == 'ocupado':
        status_disponibilidade = 'OCUPADO'
        status_emoji = '🔵'
        status_texto = 'Em Ocupação'
    elif altura_atual and altura_atual >= (lote.get('altura_entrada') or 25):
        status_disponibilidade = 'APTO'
        status_emoji = '🟢'
        status_texto = 'Apto para Entrada'
    elif altura_atual and altura_atual >= (lote.get('altura_saida') or 15):
        status_disponibilidade = 'RECUPERANDO'
        status_emoji = '🟡'
        status_texto = 'Em Recuperação'
    else:
        status_disponibilidade = 'CRITICO'
        status_emoji = '🔴'
        status_texto = 'Crítico'
    
    return {
        'id': lote['id'],
        'nome': lote['nome'],
        'quantidade': lote['quantidade'] or 0,
        'peso_medio': lote['peso_medio'] or 0,
        'piquete_atual_id': lote['piquete_atual_id'],
        'piquete_nome': lote['piquete_nome'],
        'capim': lote['capim'],
        'piquete_area': lote['piquete_area'] or 0,
        'altura_atual': altura_atual,
        'altura_entrada': lote.get('altura_entrada') or 25,
        'altura_saida': lote.get('altura_saida') or 15,
        'dias_descanso_min': lote.get('dias_descanso_min') or 30,
        'dias_descanso': lote.get('dias_descanso') or 0,
        'condicao_climatica': lote.get('condicao_climatica') or 'normal',
        'status_disponibilidade': status_disponibilidade,
        'status_emoji': status_emoji,
        'status_texto': status_texto
    }
