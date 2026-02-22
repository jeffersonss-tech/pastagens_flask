"""
App Flask - PastoFlow
"""
from flask import Flask, render_template, request, jsonify, redirect, url_for, session
import database
import logging
from routes.api_fazendas import criar_api_fazendas  # Módulo de APIs de fazendas
from routes.api_categorias import api_categorias  # Módulo de APIs de categorias de animais
from simular_data import now, get_status  # Suporte a data de teste

app = Flask(__name__)
app.secret_key = 'pastagens_secret_key_2024'

database.init_db()

# Registrar módulos de APIs
criar_api_fazendas(app)
app.register_blueprint(api_categorias)  # Registrar API de categorias

# ============ API DATA ============
@app.route('/api/data-teste')
def api_data_teste():
    """Retorna a data atual (teste ou real)"""
    return jsonify(get_status())

# ============ AUTH ============
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        user = database.verificar_usuario(username, password)
        if user:
            session['user_id'] = user['id']
            session['username'] = user['username']
            session['role'] = user['role']
            
            # Redirecionamento baseado em Role
            if user['role'] == 'admin':
                return redirect(url_for('admin_dashboard'))
            return redirect(url_for('home'))
        else:
            return render_template('login.html', error='Usuário ou senha inválidos!')
    
    return render_template('login.html')

@app.route('/admin')
@database.role_required('admin')
def admin_dashboard():
    """Painel do Administrador do Sistema"""
    # Se estiver impersonando E não tiver admin_real_id (algo estranho), redireciona
    if session.get('impersonando') and not session.get('admin_real_id'):
        return redirect(url_for('home'))
        
    conn = database.get_db()
    cursor = conn.cursor()
    
    # Busca usuários e adiciona info de vinculado a (para operadores)
    cursor.execute('''
        SELECT u.id, u.username, u.nome, u.role, u.ativo, u.email,
               GROUP_CONCAT(DISTINCT g.username) as gerentes_vinculados,
               GROUP_CONCAT(DISTINCT g.id) as gerentes_ids
        FROM usuarios u
        LEFT JOIN user_farm_permissions p ON u.id = p.user_id
        LEFT JOIN fazendas f ON p.farm_id = f.id
        LEFT JOIN usuarios g ON f.usuario_id = g.id AND g.role IN ('gerente', 'admin')
        GROUP BY u.id
        ORDER BY u.role, u.username
    ''')
    usuarios = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return render_template('admin/dashboard.html', usuarios=usuarios, fazenda=None)


@app.route('/admin/impersonar/<int:user_id>')
@database.role_required('admin')
def admin_impersonar(user_id):
    """Assume o acesso de outro usuário"""
    user = database.get_usuario(user_id)
    if user:
        session['admin_real_id'] = session['user_id']
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['role'] = user['role']
        session['impersonando'] = True
    return redirect(url_for('home'))

@app.route('/admin/usuario/salvar', methods=['POST'])
@database.role_required('admin')
def admin_salvar_usuario():
    """Cria ou edita um usuário via Admin"""
    data = request.form
    user_id = data.get('id')
    username = data.get('username')
    nome = data.get('nome')
    email = data.get('email')
    role = data.get('role')
    password = data.get('password')
    ativo = 1 if data.get('ativo') else 0

    conn = database.get_db()
    cursor = conn.cursor()

    if user_id:
        # Update
        if password: # Se informou senha, atualiza ela também
            from werkzeug.security import generate_password_hash
            hash_pw = generate_password_hash(password)
            cursor.execute('''
                UPDATE usuarios SET username=?, nome=?, email=?, role=?, ativo=?, password_hash=?, updated_at=?
                WHERE id=?
            ''', (username, nome, email, role, ativo, hash_pw, database.datetime.now().isoformat(), user_id))
        else:
            cursor.execute('''
                UPDATE usuarios SET username=?, nome=?, email=?, role=?, ativo=?, updated_at=?
                WHERE id=?
            ''', (username, nome, email, role, ativo, database.datetime.now().isoformat(), user_id))
    else:
        # Insert
        from werkzeug.security import generate_password_hash
        hash_pw = generate_password_hash(password or '123456') # Senha padrão se não informar
        try:
            cursor.execute('''
                INSERT INTO usuarios (username, nome, email, role, ativo, password_hash, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (username, nome, email, role, ativo, hash_pw, database.datetime.now().isoformat(), database.datetime.now().isoformat()))
        except Exception as e:
            return f"Erro ao criar usuário: {e}", 400

    conn.commit()
    conn.close()
    return redirect(url_for('admin_dashboard'))

@app.route('/admin/usuario/toggle/<int:user_id>')
@database.role_required('admin')
def admin_toggle_usuario(user_id):
    """Ativa/Desativa usuário"""
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute('UPDATE usuarios SET ativo = NOT ativo WHERE id = ?', (user_id,))
    conn.commit()
    conn.close()
    return redirect(url_for('admin_dashboard'))


@app.route('/admin/usuario/excluir/<int:user_id>')
@database.role_required('admin')
def admin_excluir_usuario(user_id):
    """Exclui um usuário"""
    # Não permite excluir a si mesmo
    if user_id == session.get('user_id'):
        return "Não é possível excluir seu próprio usuário", 400
    
    conn = database.get_db()
    cursor = conn.cursor()
    
    # Remove permissões primeiro
    cursor.execute('DELETE FROM user_farm_permissions WHERE user_id = ?', (user_id,))
    # Remove o usuário
    cursor.execute('DELETE FROM usuarios WHERE id = ?', (user_id,))
    
    conn.commit()
    conn.close()
    return redirect(url_for('admin_dashboard'))


@app.route('/admin/voltar')
def admin_voltar():
    """Volta para a conta de administrador"""
    if 'admin_real_id' in session:
        admin_id = session['admin_real_id']
        user = database.get_usuario(admin_id)
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['role'] = user['role']
        session.pop('admin_real_id', None)
        session.pop('impersonando', None)
        return redirect(url_for('admin_dashboard'))
    return redirect(url_for('home'))


# ============ GERENTE - GERENCIAR OPERADORES ============
@app.route('/gerentes/operadores')
def gerenciar_operadores():
    """Página para o gerente gerenciar operadores de suas fazendas"""
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    # Apenas gerente e admin podem acessar
    if session.get('role') not in ['gerente', 'admin']:
        return "Acesso negado", 403
    
    # Lista as fazendas do gerente
    from database import listar_fazendas_usuario
    fazendas = listar_fazendas_usuario(session['user_id'])
    
    # Lista operadores vinculados às fazendas do gerente
    conn = database.get_db()
    cursor = conn.cursor()
    
    # Busca operadores que têm permissão em alguma das fazendas do gerente
    fazenda_ids = [f['id'] for f in fazendas]
    if fazenda_ids:
        placeholders = ','.join(['?'] * len(fazenda_ids))
        cursor.execute(f'''
            SELECT u.*, GROUP_CONCAT(p.farm_id) as fazendas_ids
            FROM usuarios u
            LEFT JOIN user_farm_permissions p ON u.id = p.user_id
            WHERE u.role = 'operador' AND p.farm_id IN ({placeholders})
            GROUP BY u.id
        ''', fazenda_ids)
    else:
        cursor.execute('''
            SELECT u.*, '' as fazendas_ids
            FROM usuarios u
            WHERE u.role = 'operador' AND 1=0
        ''')
    
    operadores = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return render_template('gerente_operadores.html', operadores=operadores, fazendas=fazendas, usuario=session)


@app.route('/gerentes/operador/salvar', methods=['POST'])
def gerente_salvar_operador():
    """Cria ou edita um operador vinculado às fazendas do gerente"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    if session.get('role') not in ['gerente', 'admin']:
        return jsonify({'error': 'Acesso negado'}), 403
    
    data = request.form
    user_id = data.get('id')
    username = data.get('username')
    nome = data.get('nome')
    email = data.get('email')
    password = data.get('password')
    fazendas_selecionadas = request.form.getlist('fazendas')
    ativo = 1 if data.get('ativo') else 0
    
    if not username:
        return "Username é obrigatório", 400
    
    if not fazendas_selecionadas:
        return "Selecione pelo menos uma fazenda", 400
    
    conn = database.get_db()
    cursor = conn.cursor()
    
    if user_id:
        # Update - edita operador existente
        if password:
            from werkzeug.security import generate_password_hash
            hash_pw = generate_password_hash(password)
            cursor.execute('''
                UPDATE usuarios SET username=?, nome=?, email=?, ativo=?, password_hash=?, updated_at=?
                WHERE id=? AND role='operador'
            ''', (username, nome, email, ativo, hash_pw, database.datetime.now().isoformat(), user_id))
        else:
            cursor.execute('''
                UPDATE usuarios SET username=?, nome=?, email=?, ativo=?, updated_at=?
                WHERE id=? AND role='operador'
            ''', (username, nome, email, ativo, database.datetime.now().isoformat(), user_id))
        
        # Remove permissões antigas e adiciona as novas
        cursor.execute('DELETE FROM user_farm_permissions WHERE user_id = ?', (user_id,))
        for farm_id in fazendas_selecionadas:
            cursor.execute('INSERT INTO user_farm_permissions (user_id, farm_id, created_at) VALUES (?, ?, ?)',
                         (user_id, farm_id, database.datetime.now().isoformat()))
    else:
        # Insert - cria novo operador
        from werkzeug.security import generate_password_hash
        hash_pw = generate_password_hash(password or '123456')
        
        try:
            cursor.execute('''
                INSERT INTO usuarios (username, nome, email, role, ativo, password_hash, created_at, updated_at)
                VALUES (?, ?, ?, 'operador', ?, ?, ?, ?)
            ''', (username, nome, email, ativo, hash_pw, database.datetime.now().isoformat(), database.datetime.now().isoformat()))
            
            operador_id = cursor.lastrowid
            
            # Adiciona permissões às fazendas
            for farm_id in fazendas_selecionadas:
                cursor.execute('INSERT INTO user_farm_permissions (user_id, farm_id, created_at) VALUES (?, ?, ?)',
                             (operador_id, farm_id, database.datetime.now().isoformat()))
        except Exception as e:
            conn.rollback()
            conn.close()
            return f"Erro ao criar operador: {e}", 400
    
    conn.commit()
    conn.close()
    return redirect(url_for('gerenciar_operadores'))


@app.route('/gerentes/operador/toggle/<int:user_id>')
def gerente_toggle_operador(user_id):
    """Ativa ou desativa um operador"""
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    if session.get('role') not in ['gerente', 'admin']:
        return "Acesso negado", 403
    
    conn = database.get_db()
    cursor = conn.cursor()
    
    # Verifica se o operador tem permissão em alguma fazenda do gerente
    from database import listar_fazendas_usuario
    fazendas = listar_fazendas_usuario(session['user_id'])
    fazenda_ids = [f['id'] for f in fazendas]
    
    if fazenda_ids:
        placeholders = ','.join(['?'] * len(fazenda_ids))
        cursor.execute(f'''
            SELECT COUNT(*) FROM user_farm_permissions 
            WHERE user_id = ? AND farm_id IN ({placeholders})
        ''', [user_id] + fazenda_ids)
        
        if cursor.fetchone()[0] == 0:
            conn.close()
            return "Operador não encontrado", 403
    
    # Toggle ativo
    cursor.execute('UPDATE usuarios SET ativo = NOT ativo WHERE id = ? AND role = "operador"', (user_id,))
    conn.commit()
    conn.close()
    
    return redirect(url_for('gerenciar_operadores'))


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/registrar')
def registrar():
    """Página de registro"""
    if 'user_id' in session:
        return redirect(url_for('home'))
    return render_template('registrar.html')

@app.route('/home')
def home_redirect():
    """Fallback para rota /home"""
    return redirect(url_for('home'))

# ============ HOME ============
@app.route('/')
def home():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    # Se for Admin, mostrar o dashboard de admin por padrão ao acessar a raiz
    if session.get('role') == 'admin' and not session.get('impersonando'):
        return redirect(url_for('admin_dashboard'))
    
    from database import listar_fazendas_usuario, relatorio_estatisticas
    fazendas = listar_fazendas_usuario(session['user_id'])
    stats = relatorio_estatisticas()
    return render_template('home.html', fazendas=fazendas, stats=stats, usuario=session)


# ============ FAZENDA ============
@app.route('/fazenda/<int:id>')
@database.farm_permission_required
def fazenda(id):
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    from database import get_fazenda, listar_piquetes, verificar_alertas_piquetes
    fazenda = get_fazenda(id)
    
    if not fazenda:
        return "Fazenda não encontrada", 404
    
    # Verifica se tem acesso (dono ou tem permissão via user_farm_permissions)
    if fazenda['usuario_id'] != session['user_id']:
        # Se não for dono, verifica se tem permissão (já verificado pelo decorator, mas redundante para clareza)
        if session.get('role') not in ['admin', 'gerente']:
            return "Acesso negado", 403
    
    session['fazenda_id'] = id
    piquetes = listar_piquetes(id)
    
    # Verificar alertas automaticamente ao carregar a página
    verificar_alertas_piquetes(id)
    
    # Stats básicas
    stats = {
        'piquetes': len(piquetes),
        'area_total': sum(p.get('area', 0) or 0 for p in piquetes)
    }
    
    return render_template('fazenda.html', fazenda=fazenda, piquetes=piquetes, stats=stats, usuario=session)

@app.route('/api/fazendas', methods=['POST'])
def api_criar_fazenda():
    """Cria uma nova fazenda"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    data = request.json
    fazenda_id = database.criar_fazenda(
        session['user_id'],
        data.get('nome'),
        data.get('area'),
        data.get('localizacao'),
        data.get('descricao'),
        data.get('latitude_sede'),
        data.get('longitude_sede')
    )
    return jsonify({'id': fazenda_id, 'status': 'ok'})

@app.route('/fazenda/<int:id>/lotes')
@database.farm_permission_required
def lotes(id):
    """Página de lotes completa"""
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    from database import get_fazenda
    fazenda = get_fazenda(id)
    
    if not fazenda:
        return "Fazenda não encontrada", 404
    
    if fazenda['usuario_id'] != session['user_id']:
        return "Acesso negado", 403
    
    session['fazenda_id'] = id
    return render_template('lotes.html', fazenda=fazenda, usuario=session)

@app.route('/fazenda/<int:id>/rotacao')
@database.farm_permission_required
def rotacao(id):
    """Página de IA Rotação"""
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    from database import get_fazenda
    fazenda = get_fazenda(id)
    
    if not fazenda:
        return "Fazenda não encontrada", 404
    
    if fazenda['usuario_id'] != session['user_id']:
        return "Acesso negado", 403
    
    session['fazenda_id'] = id
    return render_template('rotacao.html', fazenda=fazenda)

# ============ APIs ============
@app.route('/api/lotes', methods=['GET'])
def api_lotes():
    """Lista lotes com filtros"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    # Aceitar fazenda_id via query param ou session
    fazenda_id = request.args.get('fazenda_id') or session.get('fazenda_id')
    if not fazenda_id:
        return jsonify({'error': 'Nenhuma fazenda'}), 400
    
    status_filtro = request.args.get('status')
    categoria_filtro = request.args.get('categoria')
    
    lotes = database.listar_lotes(fazenda_id, status_filtro, categoria_filtro)
    return jsonify(lotes)

@app.route('/api/lotes', methods=['POST'])
def api_criar_lote():
    """Cria um novo lote com validações técnicas."""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    data = request.json
    fazenda_id = session.get('fazenda_id')
    
    # ========== VALIDAÇÕES ==========
    categoria = data.get('categoria')
    peso_medio = data.get('peso_medio', 0)
    consumo_base = data.get('consumo_base')
    
    if categoria == 'Personalizado':
        # Peso obrigatório para Personalizado
        if peso_medio <= 0:
            return jsonify({'error': 'Peso médio é obrigatório para categoria Personalizado'}), 400
        if peso_medio < 50:
            return jsonify({'error': 'Peso médio mínimo é 50 kg'}), 400
        if peso_medio > 1200:
            return jsonify({'error': 'Peso médio máximo é 1200 kg'}), 400
        if consumo_base is not None:
            if consumo_base < 0.1:
                return jsonify({'error': 'Consumo base mínimo é 0.1 cm/dia'}), 400
            if consumo_base > 3.0:
                return jsonify({'error': 'Consumo base máximo é 3.0 cm/dia'}), 400
    else:
        # Para outras categorias, ignorar consumo_base
        consumo_base = None
    
    try:
        lote_id = database.criar_lote(
            fazenda_id,
            data['nome'],
            categoria,
            data.get('quantidade', 0),
            peso_medio,
            data.get('observacao'),
            data.get('piquete_id'),
            consumo_base
        )
        return jsonify({'id': lote_id, 'status': 'ok'})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Erro ao criar lote: {str(e)}'}), 500

@app.route('/api/lotes/<int:id>', methods=['GET'])
def api_get_lote(id):
    """Busca um lote pelo ID"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    lote = database.get_lote(id)
    if not lote:
        return jsonify({'error': 'Lote não encontrado'}), 404
    
    return jsonify(lote)

@app.route('/api/lotes/<int:id>', methods=['PUT'])
def api_put_lote(id):
    """Atualiza um lote com validações técnicas."""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    data = request.json
    
    # ========== VALIDAÇÕES ==========
    categoria = data.get('categoria')
    peso_medio = data.get('peso_medio')
    consumo_base = data.get('consumo_base')
    
    if categoria == 'Personalizado':
        if peso_medio is not None and peso_medio > 0:
            if peso_medio < 50:
                return jsonify({'error': 'Peso médio mínimo é 50 kg'}), 400
            if peso_medio > 1200:
                return jsonify({'error': 'Peso médio máximo é 1200 kg'}), 400
        if consumo_base is not None:
            if consumo_base < 0.1:
                return jsonify({'error': 'Consumo base mínimo é 0.1 cm/dia'}), 400
            if consumo_base > 3.0:
                return jsonify({'error': 'Consumo base máximo é 3.0 cm/dia'}), 400
    else:
        consumo_base = None
    
    try:
        database.atualizar_lote(
            id,
            data.get('nome'),
            categoria,
            data.get('quantidade'),
            peso_medio,
            data.get('observacao'),
            data.get('piquete_atual_id'),
            consumo_base
        )
        return jsonify({'status': 'ok'})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Erro ao atualizar lote: {str(e)}'}), 500

@app.route('/api/lotes/<int:id>', methods=['DELETE'])
def api_delete_lote(id):
    """Exclui um lote"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    database.excluir_lote(id)
    return jsonify({'status': 'ok'})

@app.route('/api/lotes/<int:id>/mover', methods=['POST'])
def api_mover_lote(id):
    """Move um lote para outro piquete"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    data = request.json
    result = database.mover_lote(
        id,
        data['piquete_destino_id'],
        data.get('quantidade'),
        data.get('motivo')
    )
    
    if 'error' in result:
        return jsonify(result), 400
    
    # Atualizar status do lote
    fazenda_id = request.args.get('fazenda_id') or session.get('fazenda_id')
    database.atualizar_status_lotes(fazenda_id)
    
    return jsonify(result)

@app.route('/api/lotes/<int:id>/sair', methods=['POST'])
def api_registrar_saida(id):
    """Registra saída do piquete (lote fica sem piquete E piquete é liberado)"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    from database import get_db
    from datetime import datetime
    
    # Aceitar fazenda_id via query param ou session
    fazenda_id = request.args.get('fazenda_id') or session.get('fazenda_id')
    if not fazenda_id:
        return jsonify({'error': 'Nenhuma fazenda'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Buscar piquete atual do lote
    cursor.execute('SELECT piquete_atual_id FROM lotes WHERE id = ?', (id,))
    lote = cursor.fetchone()
    piquete_origem_id = lote['piquete_atual_id'] if lote else None
    
    # Criar movimentação de saída
    cursor.execute('''
        INSERT INTO movimentacoes (lote_id, piquete_origem_id, data_movimentacao, tipo, created_at)
        VALUES (?, ?, ?, 'saida', ?)
    ''', (id, piquete_origem_id, datetime.now().isoformat(), datetime.now().isoformat()))
    
    # Atualizar lote - sem piquete = AGUARDANDO_ALOCACAO
    cursor.execute('''
        UPDATE lotes SET piquete_atual_id = NULL, data_entrada = NULL, status_calculado = 'AGUARDANDO_ALOCACAO', updated_at = ?
        WHERE id = ?
    ''', (datetime.now().isoformat(), id))
    
    # LIBERAR O PIQUETE (setar estado = NULL)
    if piquete_origem_id:
        # Liberar o piquete E resetar dias_descanso para 0
        cursor.execute('UPDATE piquetes SET estado = NULL, dias_descanso = 0 WHERE id = ?', (piquete_origem_id,))
    
    conn.commit()
    conn.close()
    
    return jsonify({'status': 'ok'})

@app.route('/api/lotes/stats')
def api_stats_lotes():
    """Estatísticas dos lotes"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    fazenda_id = request.args.get('fazenda_id') or session.get('fazenda_id')
    if not fazenda_id:
        return jsonify({'error': 'Nenhuma fazenda'}), 400
    
    stats = database.get_estatisticas_lotes(fazenda_id)
    return jsonify(stats)

@app.route('/api/lotes/<int:id>/sugerir-piquetes')
def api_sugerir_piquetes(id):
    """Sugere piquetes para um lote"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    # Aceitar fazenda_id via query param ou session
    fazenda_id = request.args.get('fazenda_id') or session.get('fazenda_id')
    if not fazenda_id:
        return jsonify({'error': 'Nenhuma fazenda'}), 400
    
    sugestoes = database.sugerir_proximo_piquete(fazenda_id, id)
    return jsonify(sugestoes)

@app.route('/api/lotes/atualizar-status', methods=['POST'])
def api_atualizar_status():
    """Atualiza status de todos os lotes"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    fazenda_id = request.args.get('fazenda_id') or session.get('fazenda_id')
    if not fazenda_id:
        return jsonify({'error': 'Nenhuma fazenda'}), 400
    
    database.atualizar_status_lotes(fazenda_id)
    return jsonify({'status': 'ok'})

# ============ PIQUETES ============
@app.route('/api/piquetes', methods=['GET'])
def api_piquetes():
    """Lista piquetes"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    fazenda_id = request.args.get('fazenda_id') or session.get('fazenda_id')
    piquetes = database.listar_piquetes(fazenda_id)
    return jsonify(piquetes)

@app.route('/api/piquetes/<int:id>', methods=['DELETE'])
def api_deletar_piquete(id):
    """Exclui um piquete"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    database.deletar_piquete(id)
    return jsonify({'status': 'ok'})

@app.route('/api/piquetes/<int:id>', methods=['GET'])
def api_get_piquete(id):
    """Busca um piquete pelo ID"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    piquete = database.get_piquete(id)
    if not piquete:
        return jsonify({'error': 'Piquete não encontrado'}), 404
    
    return jsonify(piquete)

@app.route('/api/piquetes/apto')
def api_piquetes_apto():
    """Lista piquetes aptos para entrada"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    # Aceitar fazenda_id via query param ou session
    fazenda_id = request.args.get('fazenda_id') or session.get('fazenda_id')
    if not fazenda_id:
        return jsonify({'error': 'Nenhuma fazenda'}), 400
    
    piquetes = database.listar_piquetes_apto(fazenda_id)
    return jsonify(piquetes)

@app.route('/api/piquetes/disponiveis')
def api_piquetes_disponiveis():
    """Lista piquetes disponíveis (sem animais) para criação/edição de lotes"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    fazenda_id = request.args.get('fazenda_id') or session.get('fazenda_id')
    if not fazenda_id:
        return jsonify({'error': 'Nenhuma fazenda'}), 400
    
    piquetes = database.listar_piquetes_disponiveis(fazenda_id)
    return jsonify(piquetes)

@app.route('/api/piquetes', methods=['POST'])
def api_criar_piquete():
    """Cria um novo piquete"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    data = request.json
    fazenda_id = session.get('fazenda_id')
    
    piquete_id = database.criar_piquete(
        fazenda_id,
        data['nome'],
        data.get('area'),
        data.get('capim'),
        data.get('geometria'),
        data.get('altura_entrada'),
        data.get('altura_saida'),
        data.get('dias_ocupacao'),
        data.get('altura_atual'),
        data.get('data_medicao'),
        data.get('irrigado'),
        data.get('observacao')
    )
    
    return jsonify({'id': piquete_id, 'status': 'ok'})

@app.route('/api/capins')
def api_capins():
    """Lista tipos de capim"""
    capins = database.listar_capins()
    return jsonify(capins)

# ============ ANIMAIS (LEGADO - USA LAGARTOS AGORA) ============
@app.route('/api/animais', methods=['GET'])
def api_animais():
    """Lista animais (usa lotes agora)"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    fazenda_id = request.args.get('fazenda_id')
    if not fazenda_id:
        fazenda_id = session.get('fazenda_id')
    
    # Agora usa lotes em vez de animais
    from database import listar_lotes
    lotes = listar_lotes(fazenda_id)
    return jsonify(lotes)

@app.route('/api/animais', methods=['POST'])
def api_criar_animal():
    """Cria animal (agora usa lotes)"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    data = request.json
    fazenda_id = session.get('fazenda_id')
    
    # Cria como lote
    lote_id = database.criar_lote(
        fazenda_id,
        data.get('nome'),
        data.get('categoria', 'Bovino'),
        data.get('quantidade', 1),
        data.get('peso_medio', 0)
    )
    return jsonify({'id': lote_id, 'status': 'ok'})

# ============ MOVIMENTAÇÕES ============
@app.route('/api/movimentacoes')
def api_listar_movimentacoes():
    """Lista movimentações"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    from database import listar_movimentacoes
    movimentacoes = listar_movimentacoes()
    return jsonify(movimentacoes)

@app.route('/api/movimentacoes', methods=['POST'])
def api_criar_movimentacao():
    """Cria movimentação"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    data = request.json
    
    # Usa a nova função de mover lote
    result = database.mover_lote(
        data.get('animal_id'),  # Agora é lote_id
        data.get('piquete_destino_id'),
        data.get('quantidade'),
        data.get('motivo')
    )
    return jsonify(result)

# ============ LOTACAO ============
@app.route('/api/lotacao/<int:fazenda_id>')
def api_lotacao_fazenda(fazenda_id):
    """Retorna cálculo de lotação da fazenda (UA, UA/ha)"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    lotacao = database.calcular_lotacao_fazenda(fazenda_id)
    return jsonify(lotacao)

@app.route('/api/lotacao/piquete/<int:piquete_id>')
def api_lotacao_piquete(piquete_id):
    """Retorna cálculo de lotação de um piquete específico"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    lotacao = database.calcular_lotacao_piquete(piquete_id)
    if lotacao is None:
        return jsonify({'error': 'Piquete não encontrado'}), 404
    return jsonify(lotacao)

# ============ ALERTAS ============
@app.route('/api/alertas')
def api_alertas():
    """Lista alertas da fazenda"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    database.criar_tabela_alertas()
    alertas = database.listar_alertas(session.get('fazenda_id'))
    return jsonify(alertas)

@app.route('/api/alertas/contar')
def api_contar_alertas():
    """Conta alertas não lidos"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    total = database.contar_alertas_nao_lidos(session.get('fazenda_id'))
    return jsonify({'total': total})

@app.route('/api/alertas/<int:id>/ler', methods=['POST'])
def api_marcar_alerta_lido(id):
    """Marca um alerta como lido"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    database.marcar_alerta_lido(id)
    return jsonify({'status': 'ok'})

@app.route('/api/alertas/verificar', methods=['POST'])
def api_verificar_alertas():
    """Força verificação de alertas"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    database.criar_tabela_alertas()
    alertas = database.verificar_alertas_piquetes(session.get('fazenda_id'))
    return jsonify({'status': 'ok', 'alertas_criados': alertas})

# ============ RESUMO GERAL E LOTE ============
@app.route('/api/rotacao/resumo_geral')
def api_resumo_geral():
    """Retorna resumo geral consolidado da fazenda"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    fazenda_id = request.args.get('fazenda_id') or session.get('fazenda_id')
    if not fazenda_id:
        return jsonify({'error': 'Nenhuma fazenda selecionada'}), 400
    
    try:
        from services.fazenda_service import gerar_resumo_geral
        resumo = gerar_resumo_geral(int(fazenda_id))
        return jsonify(resumo)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/rotacao/resumo_lote/<int:lote_id>')
def api_resumo_lote(lote_id):
    """Retorna resumo de um lote específico"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    try:
        from services.fazenda_service import gerar_resumo_lote
        resumo = gerar_resumo_lote(lote_id)
        if not resumo:
            return jsonify({'error': 'Lote não encontrado'}), 404
        return jsonify(resumo)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

# ============ ROTAÇÃO ============
@app.route('/api/rotacao')
def api_rotacao():
    """Retorna recomendações de rotação ordenadas por prioridade"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    fazenda_id = session.get('fazenda_id')
    if not fazenda_id:
        return jsonify({'error': 'Nenhuma fazenda selecionada'}), 400
    
    recomendacoes = database.calcular_prioridade_rotacao(fazenda_id)
    return jsonify(recomendacoes)

@app.route('/api/rotacao/plano')
def api_plano_rotacao():
    """Retorna plano completo de rotação"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    fazenda_id = session.get('fazenda_id')
    if not fazenda_id:
        return jsonify({'error': 'Nenhuma fazenda selecionada'}), 400
    
    plano = database.plano_rotacao(fazenda_id)
    return jsonify(plano)

@app.route('/api/piquetes/<int:id>/status')
def api_status_piquete(id):
    """Retorna status detalhado de um piquete"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    piquete = database.get_piquete(id)
    if not piquete:
        return jsonify({'error': 'Piquete não encontrado'}), 404
    
    status_info = database.calcular_status_piquete(piquete)
    return jsonify(status_info)

@app.route('/api/piquetes/<int:id>/bloquear', methods=['POST'])
def api_bloquear_piquete(id):
    """Bloqueia ou desbloqueia um piquete"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    data = request.json
    bloqueado = data.get('bloqueado', True)
    motivo = data.get('motivo', '')
    
    database.bloquear_piquete(id, bloqueado, motivo)
    return jsonify({'status': 'ok', 'bloqueado': bloqueado})

@app.route('/api/piquetes/<int:id>', methods=['PUT'])
def api_put_piquete(id):
    """Atualiza um piquete"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    data = request.json
    database.atualizar_piquete(
        id,
        data.get('nome'),
        data.get('area'),
        data.get('capim'),
        data.get('altura_entrada'),
        data.get('altura_saida'),
        data.get('dias_ocupacao'),
        data.get('altura_atual'),
        data.get('data_medicao'),
        data.get('irrigado'),
        data.get('observacao'),
        data.get('limpar_altura', False)
    )
    return jsonify({'status': 'ok'})

@app.route('/api/rotacao/verificar-passou-ponto')
def api_verificar_passou_ponto():
    """Verifica piquetes que passaram do ponto"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    fazenda_id = session.get('fazenda_id')
    if not fazenda_id:
        return jsonify({'error': 'Nenhuma fazenda selecionada'}), 400
    
    alertas = database.verificar_passou_ponto(fazenda_id)
    return jsonify(alertas)

if __name__ == '__main__':
    logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
    app.run(debug=True, port=5000)
    
