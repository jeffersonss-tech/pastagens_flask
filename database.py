"""
Banco de Dados SQLite - Sistema de Pastagens com Lotes Completos
"""
import sqlite3
import os
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from config_data_teste import now as data_teste_now  # Suporte a data de teste
from services.manejo_service import calcular_altura_ocupacao, get_consumo_base
from services.rotacao_service import (
    calcular_prioridade_rotacao,
    calcular_status_piquete,
    plano_rotacao,
    verificar_passou_ponto
)

DB_PATH = os.path.join(os.path.dirname(__file__), "pastagens.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Inicializa todas as tabelas."""
    conn = get_db()
    cursor = conn.cursor()
    
    # Usuários
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            nome TEXT,
            role TEXT DEFAULT 'user',
            ativo INTEGER DEFAULT 1,
            created_at TEXT,
            updated_at TEXT
        )
    ''')
    
    # Fazendas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS fazendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER,
            nome TEXT NOT NULL,
            area REAL DEFAULT 0,
            localizacao TEXT,
            descricao TEXT,
            latitude_sede REAL,
            longitude_sede REAL,
            ativo INTEGER DEFAULT 1,
            created_at TEXT,
            updated_at TEXT,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    ''')
    
    # Piquetes
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS piquetes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fazenda_id INTEGER,
            nome TEXT NOT NULL,
            area REAL DEFAULT 0,
            capim TEXT,
            geometria TEXT,
            estado TEXT DEFAULT 'disponivel',
            -- Campos de status avançado
            altura_atual REAL,
            altura_real_medida REAL,
            data_medicao TEXT,
            altura_entrada REAL DEFAULT 25,
            altura_saida REAL DEFAULT 15,
            dias_ocupacao INTEGER DEFAULT 3,
            dias_descanso_min INTEGER DEFAULT 30,
            irrigado INTEGER DEFAULT 0,
            bloqueado INTEGER DEFAULT 0,
            motivo_bloqueio TEXT,
            observacao TEXT,
            capacidade_animal REAL DEFAULT 0,
            -- Campo climático para cálculo de crescimento
            condicao_climatica TEXT DEFAULT 'normal',
            ativo INTEGER DEFAULT 1,
            created_at TEXT,
            updated_at TEXT,
            FOREIGN KEY (fazenda_id) REFERENCES fazendas(id)
        )
    ''')
    
    # Lotes (NOVO - completo)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS lotes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fazenda_id INTEGER,
            nome TEXT NOT NULL,
            categoria TEXT,
            quantidade INTEGER DEFAULT 0,
            peso_medio REAL DEFAULT 0,
            -- Localização atual
            piquete_atual_id INTEGER,
            data_entrada TEXT,
            -- Status calculado
            status_calculado TEXT DEFAULT 'OK',
            -- Auditoria
            ativo INTEGER DEFAULT 1,
            observacao TEXT,
            created_at TEXT,
            updated_at TEXT,
            FOREIGN KEY (fazenda_id) REFERENCES fazendas(id),
            FOREIGN KEY (piquete_atual_id) REFERENCES piquetes(id)
        )
    ''')
    
    # Movimentações
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS movimentacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lote_id INTEGER,
            piquete_origem_id INTEGER,
            piquete_destino_id INTEGER,
            data_movimentacao TEXT,
            quantidade INTEGER DEFAULT 0,
            tipo TEXT DEFAULT 'movimentacao',
            motivo TEXT,
            observacao TEXT,
            created_at TEXT,
            FOREIGN KEY (lote_id) REFERENCES lotes(id),
            FOREIGN KEY (piquete_origem_id) REFERENCES piquetes(id),
            FOREIGN KEY (piquete_destino_id) REFERENCES piquetes(id)
        )
    ''')
    
    # Capins
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS capins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            crescimento_diario REAL DEFAULT 0,
            altura_entrada REAL DEFAULT 25,
            altura_saida REAL DEFAULT 15,
            tempo_descanso INTEGER DEFAULT 35,
            observacao TEXT,
            created_at TEXT,
            updated_at TEXT
        )
    ''')
    
    # Alertas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS alertas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER,
            fazenda_id INTEGER,
            piquete_id INTEGER,
            tipo TEXT NOT NULL,
            titulo TEXT,
            mensagem TEXT,
            lido INTEGER DEFAULT 0,
            created_at TEXT,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
            FOREIGN KEY (fazenda_id) REFERENCES fazendas(id),
            FOREIGN KEY (piquete_id) REFERENCES piquetes(id)
        )
    ''')
    
    # Usuário admin padrão
    cursor.execute('SELECT id FROM usuarios WHERE username = ?', ('admin',))
    if not cursor.fetchone():
        hash = generate_password_hash('admin123')
        cursor.execute('''
            INSERT INTO usuarios (username, password_hash, nome, role, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', ('admin', hash, 'Administrador', 'admin', datetime.now().isoformat(), datetime.now().isoformat()))
    
    # Capins padrão
    cursor.execute('SELECT id FROM capins')
    if not cursor.fetchone():
        capins = [
            ('Brachiaria', 60, 25, 15, 35),
            ('Mombaça', 80, 35, 20, 45),
            ('Tifton 85', 70, 20, 10, 30),
            ('Andropogon', 55, 25, 12, 35),
        ]
        cursor.executemany('''
            INSERT INTO capins (nome, crescimento_diario, altura_entrada, altura_saida, tempo_descanso, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', [(c + (datetime.now().isoformat(),)) for c in capins])
    
    conn.commit()
    conn.close()
    print("Banco inicializado!")

# ============ USUÁRIOS ============
def criar_usuario(username, password, nome=None, role='user'):
    hash = generate_password_hash(password)
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO usuarios (username, password_hash, nome, role, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (username, hash, nome, role, datetime.now().isoformat(), datetime.now().isoformat()))
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()
        return user_id
    except sqlite3.IntegrityError:
        conn.close()
        return None

def verificar_usuario(username, password):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM usuarios WHERE username = ? AND ativo = 1', (username,))
    user = cursor.fetchone()
    conn.close()
    if user and check_password_hash(user['password_hash'], password):
        return dict(user)
    return None

def get_usuario(id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id, username, nome, role, created_at FROM usuarios WHERE id = ?', (id,))
    user = cursor.fetchone()
    conn.close()
    return dict(user) if user else None

# ============ FAZENDAS ============
def criar_fazenda(usuario_id, nome, area=None, localizacao=None, descricao=None, latitude_sede=None, longitude_sede=None):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO fazendas (usuario_id, nome, area, localizacao, descricao, latitude_sede, longitude_sede, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (usuario_id, nome, area, localizacao, descricao, latitude_sede, longitude_sede, datetime.now().isoformat(), datetime.now().isoformat()))
    conn.commit()
    fazenda_id = cursor.lastrowid
    conn.close()
    return fazenda_id

def atualizar_fazenda(id, nome=None, area=None, localizacao=None, descricao=None, latitude_sede=None, longitude_sede=None):
    """Atualiza uma fazenda existente"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE fazendas SET nome=?, area=?, localizacao=?, descricao=?, latitude_sede=?, longitude_sede=?, updated_at=?
        WHERE id=?
    ''', (nome, area, localizacao, descricao, latitude_sede, longitude_sede, datetime.now().isoformat(), id))
    conn.commit()
    conn.close()

def excluir_fazenda(id):
    """Exclui (desativa) uma fazenda"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('UPDATE fazendas SET ativo = 0, updated_at = ? WHERE id = ?', 
                   (datetime.now().isoformat(), id))
    conn.commit()
    conn.close()

def listar_fazendas_usuario(usuario_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM fazendas WHERE usuario_id = ? AND ativo = 1 ORDER BY nome', (usuario_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_fazenda(id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM fazendas WHERE id = ?', (id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

# ============ RELATÓRIOS ============
def relatorio_estatisticas(fazenda_id=None):
    conn = get_db()
    cursor = conn.cursor()
    
    if fazenda_id:
        cursor.execute('SELECT COUNT(*) as total FROM fazendas WHERE id = ?', (fazenda_id,))
    else:
        cursor.execute('SELECT COUNT(*) as total FROM fazendas')
    total_fazendas = cursor.fetchone()['total']
    
    if fazenda_id:
        cursor.execute('SELECT COUNT(*) as total, SUM(area) as area_total FROM piquetes WHERE fazenda_id = ?', (fazenda_id,))
    else:
        cursor.execute('SELECT COUNT(*) as total, SUM(area) as area_total FROM piquetes')
    res = cursor.fetchone()
    total_piquetes = res['total']
    area_total = res['area_total'] or 0
    
    conn.close()
    
    return {
        'fazendas': total_fazendas,
        'piquetes': total_piquetes,
        'area_total': area_total
    }

# ============ LOTACAO ============
def calcular_lotacao_fazenda(fazenda_id):
    """Calcula a lotação da fazenda em UA (Unidade Animal) e UA/ha."""
    conn = get_db()
    cursor = conn.cursor()
    
    # Busca animais da fazenda (usando lotes agora)
    cursor.execute('''
        SELECT SUM(l.quantidade * l.peso_medio) as peso_total 
        FROM lotes l 
        WHERE l.fazenda_id = ? AND l.ativo = 1
    ''', (fazenda_id,))
    resultado = cursor.fetchone()
    peso_total = resultado['peso_total'] or 0
    
    # Calcula UA total (1 UA = 450 kg)
    ua_total = peso_total / 450
    
    # Busca área total dos piquetes
    cursor.execute('SELECT SUM(area) as area_total FROM piquetes WHERE fazenda_id = ?', (fazenda_id,))
    resultado = cursor.fetchone()
    area_total = resultado['area_total'] or 0
    
    # Calcula lotação por hectare
    lotacao_ha = ua_total / area_total if area_total > 0 else 0
    
    conn.close()
    
    return {
        'peso_total': peso_total,
        'ua_total': round(ua_total, 2),
        'area_total': area_total,
        'lotacao_ha': round(lotacao_ha, 2)
    }

# ============ LOTES ============
def criar_lote(fazenda_id, nome, categoria=None, quantidade=0, peso_medio=0, observacao=None, piquete_id=None):
    conn = get_db()
    cursor = conn.cursor()
    
    # Criar o lote primeiro
    cursor.execute('''
        INSERT INTO lotes (fazenda_id, nome, categoria, quantidade, peso_medio, observacao, piquete_atual_id, data_entrada, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (fazenda_id, nome, categoria, quantidade, peso_medio, observacao, 
          piquete_id, datetime.now().isoformat(),
          datetime.now().isoformat(), datetime.now().isoformat()))
    conn.commit()
    lote_id = cursor.lastrowid
    
    # Se tem piquete, calcular status real E setar estado como ocupado
    if piquete_id:
        # Buscar dados do piquete
        cursor.execute('SELECT * FROM piquetes WHERE id = ?', (piquete_id,))
        piquete = cursor.fetchone()
        if piquete:
            # Atualizar estado do piquete para ocupado
            cursor.execute('UPDATE piquetes SET estado = ? WHERE id = ?', ('ocupado', piquete_id))
            
            # Criar lote fake para calcular status
            lote_fake = {
                'piquete_atual_id': piquete_id,
                'data_entrada': datetime.now().isoformat(),
                'dias_no_piquete': 0,
                'dias_ocupacao': piquete['dias_ocupacao'] or 3,
                'altura_atual': piquete['altura_atual'],
                'altura_entrada': piquete['altura_entrada'] or 25,
                'altura_saida': piquete['altura_saida'] or 15,
                'piquete_bloqueado': piquete['bloqueado']
            }
            status_info = calcular_status_lote(lote_fake)
            cursor.execute('UPDATE lotes SET status_calculado = ? WHERE id = ?', 
                          (status_info['status'], lote_id))
            conn.commit()
    
    conn.close()
    return lote_id

def atualizar_lote(id, nome=None, categoria=None, quantidade=None, peso_medio=None, observacao=None, piquete_atual_id=None):
    """Atualiza um lote"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE lotes SET nome=?, categoria=?, quantidade=?, peso_medio=?, observacao=?, piquete_atual_id=?, updated_at=?
        WHERE id=?
    ''', (nome, categoria, quantidade, peso_medio, observacao, piquete_atual_id, datetime.now().isoformat(), id))
    conn.commit()
    conn.close()

def excluir_lote(id):
    """Exclui (desativa) um lote"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('UPDATE lotes SET ativo = 0, updated_at = ? WHERE id = ?', 
                   (datetime.now().isoformat(), id))
    conn.commit()
    conn.close()

def listar_lotes(fazenda_id=None, status_filtro=None, categoria_filtro=None):
    conn = get_db()
    cursor = conn.cursor()
    
    query = '''
        SELECT l.*, p.nome as piquete_nome, p.capim, p.area as piquete_area,
               p.altura_real_medida, p.altura_estimada,
               p.altura_entrada, p.altura_saida, p.dias_ocupacao,
               p.bloqueado as piquete_bloqueado
        FROM lotes l
        LEFT JOIN piquetes p ON l.piquete_atual_id = p.id
        WHERE l.ativo = 1
    '''
    params = []
    
    if fazenda_id:
        query += ' AND l.fazenda_id = ?'
        params.append(fazenda_id)
    
    if status_filtro:
        if status_filtro == 'AGUARDANDO_ALOCACAO':
            # Lotes sem piquete atual
            query += ' AND l.piquete_atual_id IS NULL'
        else:
            query += ' AND l.status_calculado = ?'
            params.append(status_filtro)
    
    if categoria_filtro:
        query += ' AND l.categoria = ?'
        params.append(categoria_filtro)
    
    query += ' ORDER BY l.nome'
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    # Adicionar campos calculados
    lotes = []
    for row in rows:
        lote = dict(row)
        lote['dias_no_piquete'] = calcular_dias_no_piquete(lote)
        
        # Calcular altura atual baseada em real vs estimada
        temReal = lote.get('altura_real_medida') is not None
        lote['altura_atual'] = lote.get('altura_real_medida') if temReal else lote.get('altura_estimada')
        lote['tem_altura_real'] = temReal
        
        lote['status_info'] = calcular_status_lote(lote)
        lotes.append(lote)
    
    return lotes

def calcular_dias_no_piquete(lote):
    """Calcula quantos dias o lote está no piquete atual"""
    if not lote.get('data_entrada'):
        return 0
    try:
        entrada = datetime.fromisoformat(lote['data_entrada'].replace('Z', '+00:00').replace('+00:00', ''))
        return (data_teste_now() - entrada).days
    except:
        return 0

def calcular_status_lote(lote):
    """
    Calcula status do lote baseado no status do piquete + dias
    Retorna: status, emoji, cor, acao, dias_faltam, mensagem
    """
    # Se não tem piquete atual, está aguardando alocação
    if not lote.get('piquete_atual_id'):
        return {
            'status': 'AGUARDANDO_ALOCACAO',
            'emoji': '🔵',
            'cor': 'blue',
            'acao': 'Aguardando',
            'dias_faltam': None,
            'mensagem': 'Sem piquete'
        }
    
    dias_no = lote.get('dias_no_piquete', 0)
    dias_max = lote.get('dias_ocupacao', 3) or 3
    
    # Usar altura_real_medida ou altura_estimada
    temReal = lote.get('altura_real_medida') is not None
    altura_atual = lote.get('altura_real_medida') if temReal else lote.get('altura_estimada')
    altura_entrada = lote.get('altura_entrada', 25) or 25
    altura_saida = lote.get('altura_saida', 15) or 15
    bloqueado = lote.get('piquete_bloqueado', 0)
    
    # Se não tem nenhuma altura (real nem estimada)
    if altura_atual is None:
        return {
            'status': 'SEM_ALTURA',
            'emoji': '⚠️',
            'cor': 'yellow',
            'acao': 'Atualizar medição',
            'dias_faltam': None,
            'mensagem': 'Piquete sem altura definida!'
        }
    
    # Se altura_atual < altura_entrada = RETIRAR (pasto muito baixo)
    if altura_atual < altura_entrada:
        msg = f'Pasto baixo! {altura_atual}/{altura_entrada} cm'
        if not temReal:
            msg += ' (estimado)'
        return {
            'status': 'RETIRAR',
            'emoji': '🔴',
            'cor': 'red',
            'acao': 'RETIRAR JÁ',
            'dias_faltam': 0,
            'mensagem': msg
        }
    
    # Se piquete bloqueado
    if bloqueado:
        return {
            'status': 'BLOQUEADO',
            'emoji': '🟣',
            'cor': 'purple',
            'acao': 'Retirar imediatamente',
            'dias_faltam': 0,
            'mensagem': 'Piquete bloqueado!'
        }
    
    # Verificar dias de ocupação
    if dias_no > dias_max:
        # 🔴 Passou do tempo máximo
        return {
            'status': 'RETIRAR',
            'emoji': '🔴',
            'cor': 'red',
            'acao': 'RETIRAR JÁ',
            'dias_faltam': 0,
            'mensagem': f'Passou do limite! {dias_no}/{dias_max} dias'
        }
    elif dias_no >= dias_max - 1:
        # 🟠 Último dia
        return {
            'status': 'ATENCAO',
            'emoji': '🟠',
            'cor': 'orange',
            'acao': 'Preparar saída',
            'dias_faltam': dias_max - dias_no,
            'mensagem': f'Último dia! {dias_no}/{dias_max} dias'
        }
    else:
        # 🔵 EM OCUPAÇÃO (OK - altura达标 E dentro do tempo)
        return {
            'status': 'EM_OCUPACAO',
            'emoji': '🔵',
            'cor': 'blue',
            'acao': 'Em ocupação',
            'dias_faltam': dias_max - dias_no,
            'mensagem': f'{dias_no}/{dias_max} dias'
        }

def atualizar_status_lotes(fazenda_id):
    """Atualiza status de todos os lotes da fazenda"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT l.*, p.altura_real_medida, p.altura_estimada, p.altura_entrada, 
               p.altura_saida, p.dias_ocupacao, p.bloqueado
        FROM lotes l
        LEFT JOIN piquetes p ON l.piquete_atual_id = p.id
        WHERE l.fazenda_id = ? AND l.ativo = 1
    ''', (fazenda_id,))
    
    lotes = cursor.fetchall()
    
    for lote in lotes:
        lote_dict = dict(lote)
        # Calcular altura_atual e tem_altura_real
        temReal = lote_dict.get('altura_real_medida') is not None
        lote_dict['altura_atual'] = lote_dict.get('altura_real_medida') if temReal else lote_dict.get('altura_estimada')
        
        status_info = calcular_status_lote(lote_dict)
        cursor.execute('''
            UPDATE lotes SET status_calculado = ?, updated_at = ?
            WHERE id = ?
        ''', (status_info['status'], datetime.now().isoformat(), lote['id']))
    
    conn.commit()
    conn.close()

def mover_lote(lote_id, piquete_destino_id, quantidade=None, motivo=None):
    """
    Move um lote para outro piquete.
    Atualiza automaticamente: lote.data_entrada, lote.piquete_atual_id, status, estado dos piquetes
    """
    conn = get_db()
    cursor = conn.cursor()
    
    # Buscar dados do lote
    cursor.execute('SELECT * FROM lotes WHERE id = ?', (lote_id,))
    lote = cursor.fetchone()
    
    if not lote:
        conn.close()
        return {'error': 'Lote não encontrado'}
    
    piquete_origem_id = lote['piquete_atual_id']
    
    # Criar registro de movimentação
    cursor.execute('''
        INSERT INTO movimentacoes (lote_id, piquete_origem_id, piquete_destino_id, data_movimentacao, quantidade, tipo, motivo, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (lote_id, piquete_origem_id, piquete_destino_id, datetime.now().isoformat(), 
          quantidade or lote['quantidade'], 'movimentacao', motivo, datetime.now().isoformat()))
    
    # Atualizar lote
    cursor.execute('''
        UPDATE lotes SET piquete_atual_id = ?, data_entrada = ?, updated_at = ?
        WHERE id = ?
    ''', (piquete_destino_id, datetime.now().isoformat(), datetime.now().isoformat(), lote_id))
    
    # ATUALIZAR ESTADO DOS PIQUETES
    # Piquete de origem: ficar disponível (se existir)
    if piquete_origem_id:
        cursor.execute('UPDATE piquetes SET estado = NULL WHERE id = ?', (piquete_origem_id,))
    
    # Piquete de destino: ficar ocupado
    cursor.execute('UPDATE piquetes SET estado = ? WHERE id = ?', ('ocupado', piquete_destino_id))
    
    # Recalcular status baseado no novo piquete
    cursor.execute('SELECT * FROM piquetes WHERE id = ?', (piquete_destino_id,))
    piquete = cursor.fetchone()
    if piquete:
        lote_fake = {
            'piquete_atual_id': piquete_destino_id,
            'data_entrada': datetime.now().isoformat(),
            'dias_no_piquete': 0,
            'dias_ocupacao': piquete['dias_ocupacao'] or 3,
            'altura_atual': piquete['altura_atual'],
            'altura_entrada': piquete['altura_entrada'] or 25,
            'altura_saida': piquete['altura_saida'] or 15,
            'piquete_bloqueado': piquete['bloqueado']
        }
        status_info = calcular_status_lote(lote_fake)
        cursor.execute('UPDATE lotes SET status_calculado = ? WHERE id = ?', 
                      (status_info['status'], lote_id))
    
    conn.commit()
    conn.close()
    
    return {'status': 'ok'}

def get_lote(id):
    """Busca um lote pelo ID"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT l.*, p.nome as piquete_nome, p.capim, p.estado as piquete_estado
        FROM lotes l
        LEFT JOIN piquetes p ON l.piquete_atual_id = p.id
        WHERE l.id = ?
    ''', (id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_estatisticas_lotes(fazenda_id):
    """Retorna estatísticas gerais dos lotes"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Total de lotes ativos
    cursor.execute('SELECT COUNT(*) as total FROM lotes WHERE fazenda_id = ? AND ativo = 1', (fazenda_id,))
    total = cursor.fetchone()['total']
    
    # Lotes em ocupação (com piquete_atual_id)
    cursor.execute('SELECT COUNT(*) as total FROM lotes WHERE fazenda_id = ? AND ativo = 1 AND piquete_atual_id IS NOT NULL', (fazenda_id,))
    em_ocupacao = cursor.fetchone()['total']
    
    # Lotes que precisam sair (status = RETIRAR)
    cursor.execute('SELECT COUNT(*) as total FROM lotes WHERE fazenda_id = ? AND ativo = 1 AND status_calculado = ?', (fazenda_id, 'RETIRAR'))
    saida_imediata = cursor.fetchone()['total']
    
    # Total de animais
    cursor.execute('SELECT SUM(quantidade) as total FROM lotes WHERE fazenda_id = ? AND ativo = 1', (fazenda_id,))
    total_animais = cursor.fetchone()['total'] or 0
    
    # Por categoria
    cursor.execute('SELECT categoria, SUM(quantidade) as total FROM lotes WHERE fazenda_id = ? AND ativo = 1 GROUP BY categoria', (fazenda_id,))
    por_categoria = {r['categoria'] or 'Não definido': r['total'] for r in cursor.fetchall()}
    
    conn.close()
    
    return {
        'total_lotes': total,
        'em_ocupacao': em_ocupacao,
        'saida_imediata': saida_imediata,
        'total_animais': total_animais,
        'por_categoria': por_categoria
    }

def sugerir_proximo_piquete(fazenda_id, lote_id):
    """Sugere os melhores piquetes para um lote"""
    conn = get_db()
    cursor = conn.cursor()
    
    from datetime import datetime
    
    # Buscar piquetes ocupados
    cursor.execute('''
        SELECT DISTINCT piquete_atual_id 
        FROM lotes 
        WHERE ativo = 1 AND piquete_atual_id IS NOT NULL
    ''')
    piquetes_ocupados = set(r['piquete_atual_id'] for r in cursor.fetchall())
    
    # Buscar piquetes disponíveis (não ocupados)
    # Considerar ultima mov do piquete (saida OU entrada)
    if piquetes_ocupados:
        query = '''
            SELECT p.*, 
                   COALESCE(m_saida.data_movimentacao, m_entrada.data_movimentacao, p.created_at) as ultima_mov
            FROM piquetes p
            LEFT JOIN movimentacoes m_saida ON p.id = m_saida.piquete_origem_id AND m_saida.tipo = 'saida'
            LEFT JOIN movimentacoes m_entrada ON p.id = m_entrada.piquete_destino_id
            WHERE p.fazenda_id = ? 
              AND p.bloqueado = 0 
              AND p.ativo = 1
              AND (p.altura_real_medida IS NOT NULL OR p.altura_atual IS NOT NULL)
              AND p.id NOT IN ({})
            GROUP BY p.id
        '''.format(','.join(map(str, piquetes_ocupados)))
        cursor.execute(query, (fazenda_id,))
    else:
        query = '''
            SELECT p.*, 
                   COALESCE(m_saida.data_movimentacao, m_entrada.data_movimentacao, p.created_at) as ultima_mov
            FROM piquetes p
            LEFT JOIN movimentacoes m_saida ON p.id = m_saida.piquete_origem_id AND m_saida.tipo = 'saida'
            LEFT JOIN movimentacoes m_entrada ON p.id = m_entrada.piquete_destino_id
            WHERE p.fazenda_id = ? 
              AND p.bloqueado = 0 
              AND p.ativo = 1
              AND (p.altura_real_medida IS NOT NULL OR p.altura_atual IS NOT NULL)
            GROUP BY p.id
        '''
        cursor.execute(query, (fazenda_id,))
    
    piquetes = []
    
    for row in cursor.fetchall():
        p = dict(row)
        
        # Calcular altura e fonte
        temReal = p.get('altura_real_medida') is not None
        altura_atual = p.get('altura_real_medida') if temReal else p.get('altura_atual')
        
        # Verificar se o piquete já foi ocupado antes
        piquete_ja_ocupado = p['ultima_mov'] and p['ultima_mov'] != p['created_at']
        
        # Calcular dias desde última movimentação
        try:
            if p['ultima_mov']:
                mov_dt = datetime.fromisoformat(p['ultima_mov'].replace('Z', '+00:00').replace('+00:00', ''))
                dias_descanso = (data_teste_now() - mov_dt).days
            else:
                dias_descanso = 0
        except:
            dias_descanso = 0
        
        dias_ideais = p.get('dias_descanso_min', 30) or 30
        altura_entrada = p.get('altura_entrada', 25) or 25
        
        # Regra: 
        # - RECUPERANDO: altura_atual < altura_entrada OU dias_descanso < dias_min
        # - APTO: altura_atual >= altura_entrada E dias_descanso >= dias_min
        # Se altura atingiu ideal, já pode entrar mesmo sem completar dias_min
        
        # Verificar se piquete é novo (nunca foi ocupado)
        piquete_novo = not piquete_ja_ocupado
        
        if altura_atual >= altura_entrada:
            # Altura atingiu o ideal!
            if piquete_novo:
                status = 'APTO'
                prioridade = 200
            else:
                # Já foi ocupado antes
                if dias_descanso >= dias_ideais:
                    status = 'APTO'
                    prioridade = 100
                else:
                    status = 'APTO_ALCANCADA'
                    prioridade = 90  # Prioridade menor que APTO completo
        else:
            # Altura ainda não atingiu
            status = 'RECUPERANDO'
            prioridade = 10
        
        piquetes.append({
            'id': p['id'],
            'nome': p['nome'],
            'capim': p['capim'],
            'area': p['area'] or 0,
            'dias_descanso': dias_descanso,
            'dias_ideais': dias_ideais,
            'altura_atual': altura_atual,
            'altura_real_medida': p.get('altura_real_medida'),
            'fonte_altura': 'real' if temReal else 'estimada',
            'altura_entrada': altura_entrada,
            'status': status,
            'prioridade': prioridade,
            'piquete_novo': not piquete_ja_ocupado
        })
    
    conn.close()
    
    # Ordenar: novos primeiro, depois aptos, depois em recuperação
    piquetes.sort(key=lambda x: (-x['prioridade'], -x.get('dias_descanso', 0)))
    
    return piquetes

# ============ PIQUETES ============
def criar_piquete(fazenda_id, nome, area=None, capim=None, geometria=None, 
                  altura_entrada=None, altura_saida=None, dias_ocupacao=None,
                  altura_atual=None, data_medicao=None, irrigado=None, observacao=None):
    conn = get_db()
    cursor = conn.cursor()
    
    # Se tem altura_atual, salvar com data da medicao
    if altura_atual is not None:
        cursor.execute('''
            INSERT INTO piquetes (fazenda_id, nome, area, capim, geometria, 
                                  altura_entrada, altura_saida, dias_ocupacao,
                                  altura_real_medida, data_medicao, irrigado, observacao,
                                  created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (fazenda_id, nome, area, capim, geometria,
              altura_entrada, altura_saida, dias_ocupacao,
              altura_atual, data_medicao, irrigado, observacao,
              datetime.now().isoformat(), datetime.now().isoformat()))
    else:
        cursor.execute('''
            INSERT INTO piquetes (fazenda_id, nome, area, capim, geometria, 
                                  altura_entrada, altura_saida, dias_ocupacao,
                                  altura_real_medida, irrigado, observacao,
                                  created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (fazenda_id, nome, area, capim, geometria,
              altura_entrada, altura_saida, dias_ocupacao,
              altura_atual, irrigado, observacao,
              datetime.now().isoformat(), datetime.now().isoformat()))
    
    conn.commit()
    piquete_id = cursor.lastrowid
    conn.close()
    return piquete_id

def listar_piquetes(fazenda_id=None):
    conn = get_db()
    cursor = conn.cursor()
    if fazenda_id:
        cursor.execute('SELECT * FROM piquetes WHERE fazenda_id = ? AND ativo = 1 ORDER BY nome', (fazenda_id,))
    else:
        cursor.execute('SELECT * FROM piquetes WHERE ativo = 1 ORDER BY nome')
    rows = cursor.fetchall()
    
    # Buscar contagem de animais e dados do lote por piquete
    cursor.execute('''
        SELECT l.piquete_atual_id, COUNT(*) as total_lotes, SUM(l.quantidade) as total_animais,
               l.id as lote_id, l.data_entrada
        FROM lotes l
        WHERE l.ativo = 1 AND l.piquete_atual_id IS NOT NULL
        GROUP BY l.piquete_atual_id
    ''')
    lotes_por_piquete = {r['piquete_atual_id']: r for r in cursor.fetchall()}
    
    conn.close()
    
    result = []
    for r in rows:
        row_dict = dict(r)
        piquete_id = row_dict['id']
        if piquete_id in lotes_por_piquete:
            lote_info = lotes_por_piquete[piquete_id]
            row_dict['lotes_no_piquete'] = lote_info['total_lotes']
            row_dict['animais_no_piquete'] = lote_info['total_animais']
            row_dict['lote_id'] = lote_info['lote_id']
            # Calcular dias no piquete
            if lote_info['data_entrada']:
                try:
                    entrada = datetime.fromisoformat(lote_info['data_entrada'].replace('Z', '+00:00').replace('+00:00', ''))
                    row_dict['dias_no_piquete'] = (data_teste_now() - entrada).days
                except:
                    row_dict['dias_no_piquete'] = 0
            else:
                row_dict['dias_no_piquete'] = 0
        else:
            row_dict['lotes_no_piquete'] = 0
            row_dict['animais_no_piquete'] = 0
            row_dict['dias_no_piquete'] = 0
            row_dict['lote_id'] = None
        
        # Calcular altura_estimada e determinar fonte
        altura_estimada, fonte = calcular_altura_estimada(row_dict)
        row_dict['altura_estimada'] = altura_estimada
        row_dict['fonte_altura'] = fonte  # 'real' ou 'estimada'
        
        # Usar altura_real_medida ou altura_estimada para altura_atual
        if fonte == 'real':
            row_dict['altura_atual'] = altura_estimada
        
        result.append(row_dict)
    
    return result

def get_piquete(id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM piquetes WHERE id = ?', (id,))
    row = cursor.fetchone()
    
    # Buscar ultima movimentacao do piquete
    cursor.execute('''
        SELECT MAX(data_movimentacao) as ultima_mov
        FROM movimentacoes
        WHERE piquete_destino_id = ? OR piquete_origem_id = ?
    ''', (id, id))
    mov_row = cursor.fetchone()
    conn.close()
    
    if row:
        row_dict = dict(row)
        
        # Calcular dias de descanso desde a data_medicao (se houver) ou ultima_mov
        data_medicao = row_dict.get('data_medicao')
        if data_medicao:
            try:
                medicao_dt = datetime.fromisoformat(data_medicao.replace('Z', '+00:00').replace('+00:00', ''))
                row_dict['dias_descanso'] = (data_teste_now() - medicao_dt).days
            except:
                row_dict['dias_descanso'] = 0
        else:
            # Usar ultima_mov como fallback
            ultima_mov = mov_row['ultima_mov'] if mov_row else None
            try:
                if ultima_mov:
                    mov_dt = datetime.fromisoformat(ultima_mov.replace('Z', '+00:00').replace('+00:00', ''))
                    row_dict['dias_descanso'] = (data_teste_now() - mov_dt).days
                else:
                    row_dict['dias_descanso'] = 0
            except:
                row_dict['dias_descanso'] = 0
        
        # Calcular altura_estimada e fonte
        altura_estimada, fonte = calcular_altura_estimada(row_dict)
        row_dict['altura_estimada'] = altura_estimada
        row_dict['fonte_altura'] = fonte
        if fonte == 'real':
            row_dict['altura_atual'] = altura_estimada
        else:
            row_dict['altura_atual'] = altura_estimada
        
        return row_dict
    return None

def atualizar_piquete(id, nome=None, area=None, capim=None, 
                     altura_entrada=None, altura_saida=None, dias_ocupacao=None,
                     altura_atual=None, data_medicao=None, irrigado=None, observacao=None,
                     limpar_altura=False):
    """
    Atualiza piquete. 
    - Se altura_atual for informada: salva como altura_real_medida com data_medicao
    - Se limpar_altura=True: define altura_real_medida como NULL
    """
    conn = get_db()
    cursor = conn.cursor()
    
    # Buscar valores atuais para manter se não informados
    cursor.execute('SELECT nome FROM piquetes WHERE id = ?', (id,))
    atual = cursor.fetchone()
    if atual:
        nome_atual = atual['nome']
    
    if limpar_altura:
        # Limpar a medição real
        cursor.execute('''
            UPDATE piquetes SET nome=?, area=?, capim=?, 
                              altura_entrada=?, altura_saida=?, dias_ocupacao=?,
                              altura_real_medida=NULL, data_medicao=NULL, irrigado=?, observacao=?,
                              updated_at=?
            WHERE id=?
        ''', (nome or nome_atual, area, capim,
              altura_entrada, altura_saida, dias_ocupacao,
              irrigado, observacao,
              datetime.now().isoformat(), id))
    elif altura_atual is not None:
        # Salvar nova medição com data
        cursor.execute('''
            UPDATE piquetes SET nome=?, area=?, capim=?, 
                              altura_entrada=?, altura_saida=?, dias_ocupacao=?,
                              altura_real_medida=?, data_medicao=?, irrigado=?, observacao=?,
                              updated_at=?
            WHERE id=?
        ''', (nome or nome_atual, area, capim,
              altura_entrada, altura_saida, dias_ocupacao,
              altura_atual, data_medicao, irrigado, observacao,
              datetime.now().isoformat(), id))
    else:
        # Atualizar sem mudar altura mas pode mudar data_medicao
        if data_medicao:
            cursor.execute('''
                UPDATE piquetes SET nome=?, area=?, capim=?, 
                                  altura_entrada=?, altura_saida=?, dias_ocupacao=?,
                                  data_medicao=?, irrigado=?, observacao=?,
                                  updated_at=?
                WHERE id=?
            ''', (nome or nome_atual, area, capim,
                  altura_entrada, altura_saida, dias_ocupacao,
                  data_medicao, irrigado, observacao,
                  datetime.now().isoformat(), id))
        else:
            cursor.execute('''
                UPDATE piquetes SET nome=?, area=?, capim=?, 
                                  altura_entrada=?, altura_saida=?, dias_ocupacao=?,
                                  irrigado=?, observacao=?,
                                  updated_at=?
                WHERE id=?
            ''', (nome or nome_atual, area, capim,
                  altura_entrada, altura_saida, dias_ocupacao,
                  irrigado, observacao,
                  datetime.now().isoformat(), id))
    conn.commit()
    conn.close()

def deletar_piquete(id):
    """Exclui (desativa) um piquete"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('UPDATE piquetes SET ativo = 0, updated_at = ? WHERE id = ?', 
                   (datetime.now().isoformat(), id))
    conn.commit()
    conn.close()

def listar_movimentacoes(fazenda_id=None):
    """Lista movimentações"""
    conn = get_db()
    cursor = conn.cursor()
    
    if fazenda_id:
        cursor.execute('''
            SELECT m.*, l.nome as lote_nome, p1.nome as origem_nome, p2.nome as destino_nome
            FROM movimentacoes m
            LEFT JOIN lotes l ON m.lote_id = l.id
            LEFT JOIN piquetes p1 ON m.piquete_origem_id = p1.id
            LEFT JOIN piquetes p2 ON m.piquete_destino_id = p2.id
            ORDER BY m.data_movimentacao DESC
            LIMIT 100
        ''')
    else:
        cursor.execute('''
            SELECT m.*, l.nome as lote_nome, p1.nome as origem_nome, p2.nome as destino_nome
            FROM movimentacoes m
            LEFT JOIN lotes l ON m.lote_id = l.id
            LEFT JOIN piquetes p1 ON m.piquete_origem_id = p1.id
            LEFT JOIN piquetes p2 ON m.piquete_destino_id = p2.id
            ORDER BY m.data_movimentacao DESC
            LIMIT 100
        ''')
    
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def listar_piquetes_apto(fazenda_id):
    """Lista piquetes disponíveis para entrada (com altura válida: real ou estimada)"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Busca piquetes ATIVOS, NÃO BLOQUEADOS E NÃO OCUPADOS
    cursor.execute('''
        SELECT p.*, 
               COALESCE(MAX(m.data_movimentacao), p.created_at) as ultima_mov
        FROM piquetes p
        LEFT JOIN movimentacoes m ON p.id = m.piquete_destino_id
        WHERE p.fazenda_id = ? 
          AND p.bloqueado = 0 
          AND p.ativo = 1
          AND (p.estado != 'ocupado' OR p.estado IS NULL)
        GROUP BY p.id
    ''', (fazenda_id,))
    
    piquetes = []
    for row in cursor.fetchall():
        p = dict(row)
        
        # Calcular altura_estimada e fonte
        altura_estimada, fonte = calcular_altura_estimada(p)
        p['altura_estimada'] = altura_estimada
        p['fonte_altura'] = fonte
        
        # Usar altura_real_medida ou altura_estimada
        altura_util = p.get('altura_real_medida') if p.get('fonte_altura') == 'real' else altura_estimada
        p['altura_atual'] = altura_util
        
        # Verificar se o piquete já foi ocupado antes
        piquete_ja_ocupado = p['ultima_mov'] and p['ultima_mov'] != p['created_at']
        
        # Calcular dias desde última movimentação
        try:
            if p['ultima_mov']:
                mov_dt = datetime.fromisoformat(p['ultima_mov'].replace('Z', '+00:00').replace('+00:00', ''))
                dias_descanso = (data_teste_now() - mov_dt).days
            else:
                dias_descanso = 0
        except:
            dias_descanso = 0
        
        dias_ideais = p.get('dias_descanso_min', 30) or 30
        altura_entrada = p.get('altura_entrada', 25) or 25
        
        # Adicionar campos calculados
        p['dias_descanso'] = dias_descanso
        p['dias_ideais'] = dias_ideais
        p['altura_entrada'] = altura_entrada
        
        # Regra: 
        # - RECUPERANDO: altura_util < altura_entrada
        # - APTO: altura_util >= altura_entrada E dias_descanso >= dias_ideais
        
        piquete_novo = not piquete_ja_ocupado
        
        if piquete_novo:
            if altura_util >= altura_entrada:
                p['status'] = 'APTO'
            else:
                p['status'] = 'RECUPERANDO'
        else:
            if altura_util >= altura_entrada and dias_descanso >= dias_ideais:
                p['status'] = 'APTO'
            else:
                p['status'] = 'RECUPERANDO'
        
        piquetes.append(p)
    
    conn.close()
    
    # Ordenar: novos primeiro, depois aptos, depois em recuperação
    piquetes.sort(key=lambda x: (-(x['status'] == 'APTO'), -x.get('dias_descanso', 0)))
    return piquetes

# ============ CAPINS ============
def listar_capins():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM capins ORDER BY nome')
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ============ ALERTAS ============
def criar_tabela_alertas():
    """Cria a tabela de alertas se não existir."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS alertas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER,
            fazenda_id INTEGER,
            piquete_id INTEGER,
            tipo TEXT NOT NULL,
            titulo TEXT,
            mensagem TEXT,
            lido INTEGER DEFAULT 0,
            created_at TEXT,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
            FOREIGN KEY (fazenda_id) REFERENCES fazendas(id),
            FOREIGN KEY (piquete_id) REFERENCES piquetes(id)
        )
    ''')
    conn.commit()
    conn.close()

def listar_piquetes_disponiveis(fazenda_id):
    """Lista piquetes disponíveis (sem animais) para criação/edição de lotes"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Buscar piquetes com animais (que estão ocupados)
    cursor.execute('''
        SELECT DISTINCT piquete_atual_id 
        FROM lotes 
        WHERE ativo = 1 AND piquete_atual_id IS NOT NULL
    ''')
    piquetes_ocupados = set(r['piquete_atual_id'] for r in cursor.fetchall())
    
    # Construir a query
    if fazenda_id:
        if piquetes_ocupados:
            query = '''
                SELECT p.*, 
                       (SELECT COUNT(*) FROM lotes l WHERE l.piquete_atual_id = p.id AND l.ativo = 1) as total_lotes,
                       (SELECT SUM(quantidade) FROM lotes l WHERE l.piquete_atual_id = p.id AND l.ativo = 1) as total_animais
                FROM piquetes p
                WHERE p.fazenda_id = ? AND p.ativo = 1 AND p.bloqueado = 0
                  AND p.id NOT IN ({})
                ORDER BY p.nome
            '''.format(','.join(map(str, piquetes_ocupados)))
        else:
            query = '''
                SELECT p.*, 
                       (SELECT COUNT(*) FROM lotes l WHERE l.piquete_atual_id = p.id AND l.ativo = 1) as total_lotes,
                       (SELECT SUM(quantidade) FROM lotes l WHERE l.piquete_atual_id = p.id AND l.ativo = 1) as total_animais
                FROM piquetes p
                WHERE p.fazenda_id = ? AND p.ativo = 1 AND p.bloqueado = 0
                ORDER BY p.nome
            '''
        cursor.execute(query, (fazenda_id,))
    else:
        if piquetes_ocupados:
            query = '''
                SELECT p.*, 
                       (SELECT COUNT(*) FROM lotes l WHERE l.piquete_atual_id = p.id AND l.ativo = 1) as total_lotes,
                       (SELECT SUM(quantidade) FROM lotes l WHERE l.piquete_atual_id = p.id AND l.ativo = 1) as total_animais
                FROM piquetes p
                WHERE p.ativo = 1 AND p.bloqueado = 0
                  AND p.id NOT IN ({})
                ORDER BY p.nome
            '''.format(','.join(map(str, piquetes_ocupados)))
        else:
            query = '''
                SELECT p.*, 
                       (SELECT COUNT(*) FROM lotes l WHERE l.piquete_atual_id = p.id AND l.ativo = 1) as total_lotes,
                       (SELECT SUM(quantidade) FROM lotes l WHERE l.piquete_atual_id = p.id AND l.ativo = 1) as total_animais
                FROM piquetes p
                WHERE p.ativo = 1 AND p.bloqueado = 0
                ORDER BY p.nome
            '''
        cursor.execute(query)
    
    rows = cursor.fetchall()
    conn.close()
    
    # Filtrar apenas piquetes sem animais e calcular altura_estimada
    result = []
    for r in rows:
        row_dict = dict(r)
        if row_dict['id'] not in piquetes_ocupados:
            # Calcular altura_estimada e fonte
            altura_estimada, fonte = calcular_altura_estimada(row_dict)
            row_dict['altura_estimada'] = altura_estimada
            row_dict['fonte_altura'] = fonte
            row_dict['lotes_no_piquete'] = 0
            row_dict['animais_no_piquete'] = 0
            result.append(row_dict)
    
    return result

def listar_alertas(fazenda_id=None, apenas_nao_lidos=False):
    """Lista alertas da fazenda."""
    conn = get_db()
    cursor = conn.cursor()
    
    if fazenda_id:
        if apenas_nao_lidos:
            cursor.execute('''
                SELECT a.*, p.nome as piquete_nome
                FROM alertas a
                LEFT JOIN piquetes p ON a.piquete_id = p.id
                WHERE a.fazenda_id = ? AND a.lido = 0
                ORDER BY a.created_at DESC
            ''', (fazenda_id,))
        else:
            cursor.execute('''
                SELECT a.*, p.nome as piquete_nome
                FROM alertas a
                LEFT JOIN piquetes p ON a.piquete_id = p.id
                WHERE a.fazenda_id = ?
                ORDER BY a.created_at DESC
            ''', (fazenda_id,))
    else:
        if apenas_nao_lidos:
            cursor.execute('''
                SELECT a.*, p.nome as piquete_nome
                FROM alertas a
                LEFT JOIN piquetes p ON a.piquete_id = p.id
                WHERE a.lido = 0
                ORDER BY a.created_at DESC
            ''')
        else:
            cursor.execute('''
                SELECT a.*, p.nome as piquete_nome
                FROM alertas a
                LEFT JOIN piquetes p ON a.piquete_id = p.id
                ORDER BY a.created_at DESC
            ''')
    
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def marcar_alerta_lido(alerta_id):
    """Marca um alerta como lido."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('UPDATE alertas SET lido = 1 WHERE id = ?', (alerta_id,))
    conn.commit()
    conn.close()

def contar_alertas_nao_lidos(fazenda_id=None):
    """Conta alertas não lidos."""
    conn = get_db()
    cursor = conn.cursor()
    if fazenda_id:
        cursor.execute('SELECT COUNT(*) as total FROM alertas WHERE fazenda_id = ? AND lido = 0', (fazenda_id,))
    else:
        cursor.execute('SELECT COUNT(*) as total FROM alertas WHERE lido = 0')
    resultado = cursor.fetchone()
    conn.close()
    return resultado['total'] if resultado else 0

def verificar_alertas_piquetes(fazenda_id):
    """Verifica piquetes e gera alertas."""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT p.*, m.data_movimentacao as data_entrada
        FROM piquetes p
        LEFT JOIN movimentacoes m ON p.id = m.piquete_destino_id
        WHERE p.fazenda_id = ? AND p.estado = 'ocupado'
        ORDER BY m.data_movimentacao DESC
    ''', (fazenda_id,))
    piquetes = cursor.fetchall()
    
    alertas_criados = []
    
    for p in piquetes:
        data_entrada = p['data_entrada']
        dias_ocupacao = p['dias_ocupacao'] or 3
        
        if data_entrada:
            try:
                entrada_dt = datetime.fromisoformat(data_entrada.replace('Z', '+00:00').replace('+00:00', ''))
                dias_passados = (data_teste_now() - entrada_dt).days
                
                if dias_passados >= dias_ocupacao:
                    cursor.execute('''
                        INSERT INTO alertas (usuario_id, fazenda_id, piquete_id, tipo, titulo, mensagem, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (1, fazenda_id, p['id'], 'ocupacao_max', 
                          f'Tempo maximo de ocupacao excedido',
                          f'O piquete {p["nome"]} está ocupado há {dias_passados} dias (máximo: {dias_ocupacao})',
                          datetime.now().isoformat()))
                    alertas_criados.append(f"Alerta criado para {p['nome']}: ocupação máxima")
            except Exception as e:
                print(f"Erro ao verificar ocupação: {e}")
    
    conn.commit()
    conn.close()
    return alertas_criados

def calcular_dias_descanso(capim):
    """Retorna dias de descanso ideal baseado no capim"""
    dias = {
        'Brachiaria': 28,
        'Mombaça': 35,
        'Tifton 85': 21,
        'Andropogon': 28,
        'Capim Aruana': 28,
        'Natalino': 30,
        'MG-5': 35,
    }
    return dias.get(capim, 30)

def calcular_consumo_diario(capim):
    """Retorna consumo diário estimado do capim em cm/dia"""
    # Estimativa baseada em crescimento típico
    consumo = {
        'Brachiaria': 0.8,
        'Mombaça': 1.0,
        'Tifton 85': 0.7,
        'Andropogon': 0.8,
        'Capim Aruana': 0.75,
        'Natalino': 0.85,
        'MG-5': 0.9,
    }
    return consumo.get(capim, 0.8)

def calcular_altura_estimada(piquete):
    """
    Calcula a altura do piquete baseada em medição real ou estimativa.
    Returns: (altura, fonte) onde fonte é 'real' ou 'estimada'
    
    Se houver medição real E dias_passados > 0:
    - Em ocupação: calcular degradação a partir da medição real
    - Em recuperação: calcular crescimento a partir da medição real
    
    Se não houver medição real OU dias_passados = 0:
    - Usar a medição real (se existir) OU calcular estimativa
    
    Prioridade:
    1. Se tem medição real E dias > 0: calcular com crescimento/degradação
    2. Se tem medição real E dias = 0: retornar medição real
    3. Se tem altura_atual legado: retornar como real
    4. Calcular estimativa
    """
    from datetime import datetime
    
    altura_real = piquete.get('altura_real_medida')
    data_medicao = piquete.get('data_medicao')
    estado = piquete.get('estado')
    dias_descanso = piquete.get('dias_descanso', 0) or 0
    dias_ocupacao = piquete.get('dias_ocupacao', 0) or 0
    capim = piquete.get('capim')
    
    # Parâmetros do piquete
    altura_saida = piquete.get('altura_saida', 15) or 15
    altura_entrada = piquete.get('altura_entrada', 25) or 25
    
    # Calcular dias desde a medição
    dias_desde_medicao = 0
    if data_medicao:
        try:
            medicao_dt = datetime.fromisoformat(data_medicao.replace('Z', '+00:00').replace('+00:00', ''))
            dias_desde_medicao = (data_teste_now() - medicao_dt).days
        except:
            dias_desde_medicao = 0
    
    # Se tem medição real E passaram dias desde a medição, calcular crescimento/degradação
    if altura_real is not None and dias_desde_medicao > 0:
        if estado == 'ocupado':
            # Em ocupação: calcular degradação a partir da medição real
            # A medição foi feita na entrada, agora precisamos subtrair o consumo
            consumo_base = get_consumo_base(capim)
            
            # Obter dados do lote para cálculo de lotação
            quantidade_animais = piquete.get('animais_no_piquete', 0) or 0
            area_piquete = piquete.get('area', 0) or 0
            
            if quantidade_animais > 0 and area_piquete > 0:
                # Usar modelo avançado com lotação
                try:
                    resultado = calcular_altura_ocupacao(
                        altura_base=altura_real,
                        altura_saida=altura_saida,
                        dias_ocupacao=dias_desde_medicao,
                        consumo_base_capim=consumo_base,
                        quantidade_animais=quantidade_animais,
                        area_piquete=area_piquete,
                        detalhar=False
                    )
                    return round(resultado, 1), 'estimada'
                except:
                    pass
            
            # Fallback: modelo linear simples
            consumo_diario = consumo_base
            altura_calc = altura_real - (dias_desde_medicao * consumo_diario)
            return max(altura_saida, round(altura_calc, 1)), 'estimada'
        else:
            # Em recuperação: calcular crescimento a partir da medição real
            # A medição foi feita na saída, agora precisamos somar o crescimento
            from services.clima_service import calcular_fator_climatico
            from services.manejo_service import calcular_altura_descanso
            
            condicao_climatica = piquete.get('condicao_climatica', 'normal') or 'normal'
            
            # Usar a altura_real como ponto de partida
            resultado = calcular_altura_descanso(
                altura_saida=altura_real,
                dias_descanso=dias_desde_medicao,
                capim=capim,
                condicao_climatica=condicao_climatica,
                altura_entrada=altura_entrada,
                detalhar=False
            )
            return round(resultado, 1), 'estimada'
    
    # Se tem medição real E não passaram dias, retornar a medição
    if altura_real is not None:
        return altura_real, 'real'
    
    # Prioridade 2: altura_atual legado (para compatibilidade)
    if piquete.get('altura_atual') is not None:
        return piquete['altura_atual'], 'real'
    
    # Prioridade 3: calcular estimativa sem medição real
    if estado == 'ocupado':
        # Em ocupação
        quantidade_animais = piquete.get('animais_no_piquete', 0) or 0
        area_piquete = piquete.get('area', 0) or 0
        consumo_base = get_consumo_base(capim)
        
        if quantidade_animais > 0 and area_piquete > 0:
            try:
                resultado = calcular_altura_ocupacao(
                    altura_base=altura_entrada,
                    altura_saida=altura_saida,
                    dias_ocupacao=dias_ocupacao,
                    consumo_base_capim=consumo_base,
                    quantidade_animais=quantidade_animais,
                    area_piquete=area_piquete,
                    detalhar=False
                )
                return resultado, 'estimada'
            except:
                pass
        
        consumo_diario = consumo_base
        altura_calc = altura_entrada - (dias_ocupacao * consumo_diario)
        return max(altura_saida, round(altura_calc, 1)), 'estimada'
    else:
        # Em recuperação
        from services.clima_service import calcular_fator_climatico
        from services.manejo_service import calcular_altura_descanso
        
        condicao_climatica = piquete.get('condicao_climatica', 'normal') or 'normal'
        
        resultado = calcular_altura_descanso(
            altura_saida=altura_saida,
            dias_descanso=dias_descanso,
            capim=capim,
            condicao_climatica=condicao_climatica,
            altura_entrada=altura_entrada,
            detalhar=False
        )
        return round(resultado, 1), 'estimada'


# Função removida - agora está em services/manejo_service.py
# Ver: calcular_crescimento_diario()
