# -*- coding: utf-8 -*-
"""Serviço de Rotação de Piquetes"""
import sqlite3
import os


DB_PATH = os.path.join(os.path.dirname(__file__), "..", "pastagens.db")

# Dados técnicos dos capins (cm/dia)
DADOS_CAPINS = {
    'Tifton 85': {'crescimento_diario': 1.0, 'consumo_diario': 0.7},
    'Brachiaria': {'crescimento_diario': 1.2, 'consumo_diario': 0.8},
    'Andropogon': {'crescimento_diario': 1.2, 'consumo_diario': 0.8},
    'Capim Aruana': {'crescimento_diario': 1.1, 'consumo_diario': 0.75},
    'Natalino': {'crescimento_diario': 1.3, 'consumo_diario': 0.85},
    'MG-5': {'crescimento_diario': 1.4, 'consumo_diario': 0.9},
    'Mombaça': {'crescimento_diario': 1.5, 'consumo_diario': 1.0},
}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def calcular_dias_descanso_necessarios(capim, altura_entrada, altura_saida):
    """Calcula dias de descanso necessários baseado no capim e alturas."""
    if not capim or capim not in DADOS_CAPINS:
        return 30  # Fallback genérico
    
    crescimento = DADOS_CAPINS[capim]['crescimento_diario']
    altura_necessaria = altura_entrada - altura_saida
    
    if crescimento <= 0:
        return 30
    
    dias_necessarios = altura_necessaria / crescimento
    return max(1, int(dias_necessarios))  # Mínimo 1 dia


def calcular_prioridade_rotacao(fazenda_id):
    """Calcula prioridade de rotacao para todos os piquetes da fazenda."""
    conn = get_db()
    cursor = conn.cursor()
    
    # Query com info do lote (nome, categoria, quantidade) - usando GROUP BY para evitar duplicados
    cursor.execute('''
        SELECT p.id, p.nome as piquete_nome, p.capim, p.area, p.estado,
               p.altura_entrada, p.altura_saida, p.dias_ocupacao,
               p.dias_descanso, p.bloqueado, p.motivo_bloqueio,
               p.altura_real_medida, p.altura_estimada, p.data_medicao,
               p.condicao_climatica, p.dias_descanso_min,
               COALESCE(SUM(l.quantidade), 0) as total_animais,
               GROUP_CONCAT(DISTINCT l.nome || '|' || COALESCE(l.categoria, '') || '|' || COALESCE(l.quantidade, 0)) as lotes_info
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
        
        # Parsear info dos lotes
        lotes_list = []
        if p.get('lotes_info'):
            for lote_str in p['lotes_info'].split(','):
                parts = lote_str.split('|')
                if len(parts) >= 3:
                    try:
                        lotes_list.append({
                            'nome': parts[0] if parts[0] else None,
                            'categoria': parts[1] if parts[1] else None,
                            'quantidade': int(parts[2]) if parts[2] else 0
                        })
                    except (ValueError, IndexError):
                        pass
        
        # Calcular status
        status_info = calcular_status_piquete(p)
        
        resultado.append({
            'id': p['id'],
            'nome': p['piquete_nome'],
            'capim': p['capim'],
            'area': p['area'],
            'estado': p['estado'],
            'animais_no_piquete': p['total_animais'],
            'altura_real_medida': p.get('altura_real_medida'),
            'altura_estimada': p.get('altura_estimada'),
            'data_medicao': p.get('data_medicao'),
            'lotes_no_piquete': lotes_list,
            'status_detalhes': status_info
        })
    
    return resultado


def calcular_status_piquete(piquete):
    """Calcula status detalhado de um piquete."""
    altura_real = piquete.get('altura_real_medida')
    altura_estimada = piquete.get('altura_estimada')
    altura_base = altura_real if altura_real is not None else altura_estimada
    altura_entrada = float(piquete.get('altura_entrada', 25) or 25)
    altura_saida = float(piquete.get('altura_saida', 15) or 15)
    dias_ocupacao = int(piquete.get('dias_ocupacao', 3) or 3)
    dias_descanso = int(piquete.get('dias_descanso', 0) or 0)
    capim = piquete.get('capim')
    estado = piquete.get('estado')
    bloqueado = piquete.get('bloqueado', 0)
    
    # Calcular dias necessários baseado no capim
    dias_descanso_min = calcular_dias_descanso_necessarios(capim, altura_entrada, altura_saida)
    limite_maximo = 30  # Fallback máximo para alerta de ineficiência
    
    # Info de crescimento
    crescimento = DADOS_CAPINS.get(capim, {}).get('crescimento_diario', 1.2) if capim else 1.2
    falta_cm = altura_entrada - altura_base if altura_base else altura_entrada
    dias_faltantes_calc = int(falta_cm / crescimento) if crescimento > 0 and altura_base else dias_descanso_min
    
    # Alerta de ineficiência: passou do limite máximo sem atingir altura
    alerta_ineficiencia = dias_descanso > limite_maximo and altura_base and altura_base < altura_entrada
    
    # Formatador de altura seguro
    def fmt_altura(val):
        if val is None:
            return '-'
        try:
            return str(int(val))
        except (ValueError, TypeError):
            return str(round(val, 1))
    
    if bloqueado:
        return {'status': 'BLOQUEADO', 'emoji': '🟣', 'acao': ' Aguardar',
                'pergunta_1': 'Motivo: ' + (piquete.get('motivo_bloqueio') or 'Não informado'),
                'pergunta_3': 'Bloqueado', 'progresso_descanso': None, 'cor': 'purple',
                'dias_min_calculado': None, 'crescimento': None, 'falta_cm': None, 'alerta_ineficiencia': False}
    
    if estado == 'ocupado':
        if altura_base and altura_base <= altura_saida:
            return {'status': 'SAIDA_IMEDIATA', 'emoji': '🔴', 'acao': 'RETIRAR JÁ!',
                    'pergunta_1': 'Abaixo do mínimo', 'pergunta_3': str(dias_ocupacao) + ' dias',
                    'progresso_descanso': None, 'cor': 'red',
                    'dias_min_calculado': None, 'crescimento': None, 'falta_cm': None, 'alerta_ineficiencia': False}
        elif altura_base and altura_base <= altura_saida + 3:
            return {'status': 'PROXIMO_SAIDA', 'emoji': '🟠', 'acao': 'Preparar saída',
                    'pergunta_1': fmt_altura(altura_base) + '/' + fmt_altura(altura_entrada) + ' cm', 
                    'pergunta_3': str(dias_ocupacao) + ' dias',
                    'progresso_descanso': None, 'cor': 'orange',
                    'dias_min_calculado': None, 'crescimento': None, 'falta_cm': None, 'alerta_ineficiencia': False}
        else:
            return {'status': 'EM_OCUPACAO', 'emoji': '🔵', 'acao': 'Em pastejo',
                    'pergunta_1': fmt_altura(altura_base) + '/' + fmt_altura(altura_entrada) + ' cm',
                    'pergunta_3': str(dias_ocupacao) + ' dias',
                    'progresso_descanso': None, 'cor': 'blue',
                    'dias_min_calculado': None, 'crescimento': None, 'falta_cm': None, 'alerta_ineficiencia': False}
    
    if altura_base is None:
        return {'status': 'SEM_ALTURA', 'emoji': '⚠️', 'acao': 'Medir altura',
                'pergunta_1': 'Sem dados', 'pergunta_3': str(dias_descanso) + ' dias',
                'progresso_descanso': None, 'cor': 'orange',
                'dias_min_calculado': dias_descanso_min, 'crescimento': crescimento, 'falta_cm': altura_entrada, 
                'alerta_ineficiencia': dias_descanso > limite_maximo}
    
    if altura_base >= altura_entrada:
        return {'status': 'APTO_ENTRADA', 'emoji': '🟢', 'acao': 'Entrada Liberada!',
                'pergunta_1': fmt_altura(altura_base) + ' cm', 
                'pergunta_3': f'{dias_descanso}/{dias_descanso_min} dias (necessário)',
                'progresso_descanso': min(100, (dias_descanso / dias_descanso_min) * 100), 'cor': 'green',
                'dias_min_calculado': dias_descanso_min, 'crescimento': crescimento, 'falta_cm': 0,
                'alerta_ineficiencia': False}
    elif altura_base >= altura_saida:
        return {'status': 'EM_DESCANSO', 'emoji': '🟡', 'acao': 'Em recuperação',
                'pergunta_1': fmt_altura(altura_base) + '/' + fmt_altura(altura_entrada) + ' cm',
                'pergunta_3': f'{dias_descanso}/{dias_descanso_min} dias (necessário)',
                'progresso_descanso': min(100, (dias_descanso / dias_descanso_min) * 100), 'cor': 'yellow',
                'dias_min_calculado': dias_descanso_min, 'crescimento': crescimento, 'falta_cm': falta_cm,
                'alerta_ineficiencia': alerta_ineficiencia}
    else:
        return {'status': 'ABAIXO_MINIMO', 'emoji': '🔴', 'acao': 'Recuperação urgente',
                'pergunta_1': fmt_altura(altura_base) + ' cm (mín: ' + fmt_altura(altura_saida) + ')',
                'pergunta_3': str(dias_descanso) + ' dias',
                'progresso_descanso': None, 'cor': 'red',
                'dias_min_calculado': dias_descanso_min, 'crescimento': crescimento, 'falta_cm': falta_cm,
                'alerta_ineficiencia': alerta_ineficiencia}


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
