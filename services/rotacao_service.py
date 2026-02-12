# -*- coding: utf-8 -*-
"""Serviço de Rotação de Piquetes"""
import sqlite3
import os


DB_PATH = os.path.join(os.path.dirname(__file__), "..", "pastagens.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def calcular_prioridade_rotacao(fazenda_id):
    """Calcula prioridade de rotacao para todos os piquetes da fazenda."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT p.id, p.nome, p.capim, p.area, p.estado,
               p.altura_entrada, p.altura_saida, p.dias_ocupacao,
               p.dias_descanso, p.bloqueado, p.motivo_bloqueio,
               p.altura_real_medida, p.altura_estimada,
               p.condicao_climatica, p.dias_descanso_min,
               COALESCE(SUM(l.quantidade), 0) as total_animais
        FROM piquetes p
        LEFT JOIN lotes l ON p.id = l.piquete_atual_id AND l.ativo = 1
        WHERE p.fazenda_id = ? AND p.ativo = 1
        GROUP BY p.id
    ''', (fazenda_id,))
    rows = cursor.fetchall()
    conn.close()
    resultado = []
    for row in rows:
        p = dict(row)
        status_info = calcular_status_piquete(p)
        resultado.append({
            'id': p['id'], 'nome': p['nome'], 'capim': p['capim'],
            'area': p['area'], 'estado': p['estado'],
            'animais_no_piquete': p['total_animais'],
            'altura_estimada': p.get('altura_estimada'),
            'status_detalhes': status_info
        })
    return resultado


def calcular_status_piquete(piquete):
    """Calcula status detalhado de um piquete."""
    altura_real = piquete.get('altura_real_medida')
    altura_estimada = piquete.get('altura_estimada')
    altura_base = altura_real if altura_real is not None else altura_estimada
    altura_entrada = piquete.get('altura_entrada', 25) or 25
    altura_saida = piquete.get('altura_saida', 15) or 15
    dias_ocupacao = piquete.get('dias_ocupacao', 3) or 3
    dias_descanso = piquete.get('dias_descanso', 0) or 0
    dias_descanso_min = piquete.get('dias_descanso_min', 30) or 30
    estado = piquete.get('estado')
    bloqueado = piquete.get('bloqueado', 0)
    
    if bloqueado:
        return {'status': 'BLOQUEADO', 'emoji': '🟣', 'acao': ' Aguardar',
                'pergunta_1': 'Motivo: ' + (piquete.get('motivo_bloqueio') or 'Não informado'),
                'pergunta_3': 'Bloqueado', 'progresso_descanso': None, 'cor': 'purple'}
    
    if estado == 'ocupado':
        if altura_base and altura_base <= altura_saida:
            return {'status': 'SAIDA_IMEDIATA', 'emoji': '🔴', 'acao': 'RETIRAR JÁ!',
                    'pergunta_1': 'Abaixo do mínimo', 'pergunta_3': str(dias_ocupacao) + ' dias',
                    'progresso_descanso': None, 'cor': 'red'}
        elif altura_base and altura_base <= altura_saida + 3:
            return {'status': 'PROXIMO_SAIDA', 'emoji': '🟠', 'acao': 'Preparar saída',
                    'pergunta_1': str(int(altura_base)) + '/' + str(altura_entrada) + ' cm', 
                    'pergunta_3': str(dias_ocupacao) + ' dias',
                    'progresso_descanso': None, 'cor': 'orange'}
        else:
            return {'status': 'EM_OCUPACAO', 'emoji': '🔵', 'acao': 'Em pastejo',
                    'pergunta_1': str(int(altura_base)) + '/' + str(altura_entrada) + ' cm',
                    'pergunta_3': str(dias_ocupacao) + ' dias',
                    'progresso_descanso': None, 'cor': 'blue'}
    
    if altura_base is None:
        return {'status': 'SEM_ALTURA', 'emoji': '⚠️', 'acao': 'Medir altura',
                'pergunta_1': 'Sem dados', 'pergunta_3': str(dias_descanso) + ' dias',
                'progresso_descanso': None, 'cor': 'orange'}
    
    if altura_base >= altura_entrada:
        return {'status': 'APTO_ENTRADA', 'emoji': '🟢', 'acao': 'Entrada Liberada!',
                'pergunta_1': str(int(altura_base)) + ' cm', 
                'pergunta_3': str(dias_descanso) + '/' + str(dias_descanso_min) + ' dias',
                'progresso_descanso': min(100, (dias_descanso / dias_descanso_min) * 100), 'cor': 'green'}
    elif altura_base >= altura_saida:
        return {'status': 'EM_DESCANSO', 'emoji': '🟡', 'acao': 'Em recuperação',
                'pergunta_1': str(int(altura_base)) + '/' + str(altura_entrada) + ' cm',
                'pergunta_3': str(dias_descanso) + '/' + str(dias_descanso_min) + ' dias',
                'progresso_descanso': min(100, (dias_descanso / dias_descanso_min) * 100), 'cor': 'yellow'}
    else:
        return {'status': 'ABAIXO_MINIMO', 'emoji': '🔴', 'acao': 'Recuperação urgente',
                'pergunta_1': str(int(altura_base)) + ' cm (min: ' + str(altura_saida) + ')',
                'pergunta_3': str(dias_descanso) + ' dias',
                'progresso_descanso': None, 'cor': 'red'}


def plano_rotacao(fazenda_id):
    """Retorna plano de rotacao baseado na estrategia."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM piquetes WHERE fazenda_id = ? AND ativo = 1 ORDER BY nome', (fazenda_id,))
    piquetes = [dict(row) for row in cursor.fetchall()]
    cursor.execute('SELECT * FROM lotes WHERE fazenda_id = ? AND ativo = 1', (fazenda_id,))
    animais = [dict(row) for row in cursor.fetchall()]
    conn.close()
    for p in piquetes:
        status = calcular_status_piquete(p)
        p['status_detalhes'] = status
    return {'fase_1_disponivel': [p for p in piquetes if p['status_detalhes']['status'] == 'APTO_ENTRADA'],
            'fase_2_descanso': [p for p in piquetes if p['status_detalhes']['status'] == 'EM_DESCANSO'],
            'fase_3_ocupados': [p for p in piquetes if p['status_detalhes']['status'] == 'EM_OCUPACAO'],
            'fase_bloqueado': [p for p in piquetes if p['status_detalhes']['status'] == 'BLOQUEADO'],
            'total_piquetes': len(piquetes),
            'total_animais': sum(a.get('quantidade', 0) for a in animais)}


def verificar_passou_ponto(fazenda_id):
    """Verifica piquetes que passaram do ponto de saida."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM piquetes WHERE fazenda_id = ? AND ativo = 1 AND estado = 'ocupado'", (fazenda_id,))
    piquetes = [dict(row) for row in cursor.fetchall()]
    conn.close()
    alertas = []
    for p in piquetes:
        status = calcular_status_piquete(p)
        if status['status'] == 'SAIDA_IMEDIATA':
            alertas.append({'id': p['id'], 'nome': p['nome'], 'tipo': 'urgente',
                           'mensagem': 'Piquete ' + p['nome'] + ' passou do ponto de saida!', 'acao': status['acao']})
    return alertas
