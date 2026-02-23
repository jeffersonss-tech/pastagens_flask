# -*- coding: utf-8 -*-
"""Serviço de Rotação de Piquetes"""
import sqlite3
import os


DB_PATH = os.path.join(os.path.dirname(__file__), "..", "pastagens.db")

# Dados técnicos dos capins
DADOS_CAPINS = {
    'Marandu': {'crescimento_diario': 1.2, 'consumo_diario': 0.85, 'dias_tecnicos': 28},
    'Piatã': {'crescimento_diario': 1.3, 'consumo_diario': 0.90, 'dias_tecnicos': 28},
    'Xaraés': {'crescimento_diario': 1.6, 'consumo_diario': 0.95, 'dias_tecnicos': 35},
    'Paiaguás': {'crescimento_diario': 1.2, 'consumo_diario': 0.85, 'dias_tecnicos': 28},
    'Decumbens': {'crescimento_diario': 1.0, 'consumo_diario': 0.75, 'dias_tecnicos': 24},
    'Humidicola': {'crescimento_diario': 0.8, 'consumo_diario': 0.70, 'dias_tecnicos': 24},
    'MG-5': {'crescimento_diario': 1.6, 'consumo_diario': 0.95, 'dias_tecnicos': 35},
    'Mombaça': {'crescimento_diario': 2.5, 'consumo_diario': 1.00, 'dias_tecnicos': 35},
    'Tanzânia': {'crescimento_diario': 2.3, 'consumo_diario': 0.95, 'dias_tecnicos': 32},
    'Zuri': {'crescimento_diario': 2.6, 'consumo_diario': 1.05, 'dias_tecnicos': 35},
    'Massai': {'crescimento_diario': 1.8, 'consumo_diario': 0.90, 'dias_tecnicos': 28},
    'Aruana': {'crescimento_diario': 1.7, 'consumo_diario': 0.85, 'dias_tecnicos': 28},
    'Tifton 85': {'crescimento_diario': 2.0, 'consumo_diario': 0.70, 'dias_tecnicos': 21},
    'Tifton 68': {'crescimento_diario': 2.0, 'consumo_diario': 0.70, 'dias_tecnicos': 21},
    'Coastcross': {'crescimento_diario': 1.6, 'consumo_diario': 0.75, 'dias_tecnicos': 24},
    'Jiggs': {'crescimento_diario': 1.9, 'consumo_diario': 0.72, 'dias_tecnicos': 22},
    'Andropogon': {'crescimento_diario': 1.8, 'consumo_diario': 0.80, 'dias_tecnicos': 28},
    'Capim Elefante': {'crescimento_diario': 3.5, 'consumo_diario': 1.10, 'dias_tecnicos': 40},
    'Capiaçu': {'crescimento_diario': 4.0, 'consumo_diario': 1.15, 'dias_tecnicos': 42},
    # compatibilidade
    'Brachiaria': {'crescimento_diario': 1.2, 'consumo_diario': 0.85, 'dias_tecnicos': 28},
    'Capim Aruana': {'crescimento_diario': 1.7, 'consumo_diario': 0.85, 'dias_tecnicos': 28},
    'Natalino': {'crescimento_diario': 1.8, 'consumo_diario': 0.80, 'dias_tecnicos': 28},
}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def calcular_dias_descanso_necessarios(capim, altura_entrada, altura_saida):
    """
    Calcula dias de descanso necessários para ir de altura_saida até altura_entrada.
    """
    if not capim or capim not in DADOS_CAPINS:
        return 30  # Fallback genérico
    
    crescimento = DADOS_CAPINS[capim]['crescimento_diario']
    altura_necessaria = altura_entrada - altura_saida
    
    if crescimento <= 0:
        return 30
    
    dias_necessarios = altura_necessaria / crescimento
    return max(1, int(dias_necessarios))  # Mínimo 1 dia


def calcular_dias_faltantes(capim, altura_entrada, altura_atual):
    """
    Calcula dias necessários para atingir altura de entrada, considerando altura ATUAL.
    Se altura_atual >= altura_entrada: retorna 0 (já atingiu)
    """
    if not capim or capim not in DADOS_CAPINS:
        return 0
    
    crescimento = DADOS_CAPINS[capim]['crescimento_diario']
    
    if altura_atual is None:
        return 30  # Fallback
    
    if altura_atual >= altura_entrada:
        return 0  # Já atingiu a altura ideal
    
    falta = altura_entrada - altura_atual
    if crescimento <= 0:
        return 30
    
    dias_faltantes = falta / crescimento
    return max(0, dias_faltantes)  # Retorna float para mostrar "~1 dia"


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
        
        # Calcular altura_estimada APENAS se já teve medição (data_medicao existe)
        if p.get('altura_estimada') is None and p.get('data_medicao'):
            from database import calcular_altura_estimada
            altura_calc, _ = calcular_altura_estimada(p)
            p['altura_estimada'] = altura_calc
        
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
    data_medicao = piquete.get('data_medicao')
    
    # Se não tem medição, bloquear
    if not altura_real and not altura_estimada and not data_medicao:
        return {'status': 'BLOQUEADO', 'emoji': '🔴', 'acao': 'Medir altura',
                'pergunta_1': 'Sem medição', 'pergunta_3': 'Bloqueado', 
                'progresso_descanso': None, 'cor': 'red',
                'dias_min_calculado': None, 'crescimento': None, 'falta_cm': None, 'alerta_ineficiencia': False}
    
    # Usar altura_estimada como prioridade (altura atual após crescimento)
    altura_base = altura_estimada if altura_estimada is not None else altura_real
    altura_entrada = float(piquete.get('altura_entrada', 25) or 25)
    altura_saida = float(piquete.get('altura_saida', 15) or 15)
    dias_ocupacao = int(piquete.get('dias_ocupacao', 3) or 3)
    dias_descanso = int(piquete.get('dias_descanso', 0) or 0)
    capim = piquete.get('capim')
    estado = piquete.get('estado')
    bloqueado = piquete.get('bloqueado', 0)
    
    # Info de crescimento
    crescimento = DADOS_CAPINS.get(capim, {}).get('crescimento_diario', 1.2) if capim else 1.2
    # Dias técnicos baseado no capim
    dias_tecnicos = DADOS_CAPINS.get(capim, {}).get('dias_tecnicos', 30) if capim else 30
    
    limite_maximo = 30  # Fallback máximo para alerta de ineficiência
    
    # Calcular dias necessários baseado na ALTURA ATUAL (não na altura de saída)
    if altura_base is not None:
        dias_faltantes_calc = calcular_dias_faltantes(capim, altura_entrada, altura_base)
    else:
        dias_faltantes_calc = calcular_dias_descanso_necessarios(capim, altura_entrada, altura_saida)
    
    # Se já atingiu altura ideal, dias necessários = 0
    if altura_base is not None and altura_base >= altura_entrada:
        dias_faltantes_calc = 0
    
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
        # Se ultrapassou o tempo técnico, saída imediata
        if dias_ocupacao >= dias_tecnicos:
            return {'status': 'SAIDA_IMEDIATA', 'emoji': '🔴', 'acao': 'RETIRAR JÁ!',
                    'pergunta_1': 'Tempo técnico atingido', 'pergunta_3': f'{dias_ocupacao}/{dias_tecnicos} dias',
                    'progresso_descanso': None, 'cor': 'red',
                    'dias_min_calculado': None, 'crescimento': None, 'falta_cm': None, 'alerta_ineficiencia': False}
        # Se está próximo do tempo técnico (80%), preparar saída
        elif dias_ocupacao >= dias_tecnicos * 0.8:
            return {'status': 'PROXIMO_SAIDA', 'emoji': '🟠', 'acao': 'Preparar saída',
                    'pergunta_1': fmt_altura(altura_base) + '/' + fmt_altura(altura_entrada) + ' cm', 
                    'pergunta_3': f'{dias_ocupacao}/{dias_tecnicos} dias (80%)',
                    'progresso_descanso': (dias_ocupacao / dias_tecnicos) * 100, 'cor': 'orange',
                    'dias_min_calculado': None, 'crescimento': None, 'falta_cm': None, 'alerta_ineficiencia': False}
        else:
            return {'status': 'EM_OCUPACAO', 'emoji': '🔵', 'acao': 'Em pastejo',
                    'pergunta_1': fmt_altura(altura_base) + '/' + fmt_altura(altura_entrada) + ' cm',
                    'pergunta_3': f'{dias_ocupacao}/{dias_tecnicos} dias',
                    'progresso_descanso': (dias_ocupacao / dias_tecnicos) * 100, 'cor': 'blue',
                    'dias_min_calculado': None, 'crescimento': None, 'falta_cm': None, 'alerta_ineficiencia': False}
    
    if altura_base is None:
        return {'status': 'SEM_ALTURA', 'emoji': '⚠️', 'acao': 'Medir altura',
                'pergunta_1': 'Sem dados', 'pergunta_3': str(dias_descanso) + ' dias',
                'progresso_descanso': None, 'cor': 'orange',
                'dias_min_calculado': dias_faltantes_calc, 'crescimento': crescimento, 'falta_cm': altura_entrada, 
                'alerta_ineficiencia': dias_descanso > limite_maximo}
    
    if altura_base >= altura_entrada:
        return {'status': 'APTO_ENTRADA', 'emoji': '🟢', 'acao': 'Entrada Liberada!',
                'pergunta_1': fmt_altura(altura_base) + ' cm', 
                'pergunta_3': f'{dias_descanso}/{dias_faltantes_calc} dias',
                'progresso_descanso': None, 'cor': 'green',
                'dias_min_calculado': dias_faltantes_calc, 'crescimento': crescimento, 'falta_cm': 0,
                'alerta_ineficiencia': False}
    elif altura_base >= altura_saida:
        falta_cm = altura_entrada - altura_base
        return {'status': 'EM_DESCANSO', 'emoji': '🟡', 'acao': 'Em recuperação',
                'pergunta_1': fmt_altura(altura_base) + '/' + fmt_altura(altura_entrada) + ' cm',
                'pergunta_3': f'{dias_descanso}/{dias_faltantes_calc} dias (necessários)',
                'progresso_descanso': min(100, (dias_descanso / max(1, dias_faltantes_calc)) * 100), 'cor': 'yellow',
                'dias_min_calculado': dias_faltantes_calc, 'crescimento': crescimento, 'falta_cm': falta_cm,
                'alerta_ineficiencia': alerta_ineficiencia}
    else:
        falta_cm = altura_entrada - altura_base
        return {'status': 'ABAIXO_MINIMO', 'emoji': '🔴', 'acao': 'Recuperação urgente',
                'pergunta_1': fmt_altura(altura_base) + ' cm (mín: ' + fmt_altura(altura_saida) + ')',
                'pergunta_3': str(dias_descanso) + ' dias',
                'progresso_descanso': None, 'cor': 'red',
                'dias_min_calculado': dias_faltantes_calc, 'crescimento': crescimento, 'falta_cm': falta_cm,
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
