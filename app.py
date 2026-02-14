"""
App Flask - Sistema de Pastagens
"""
from flask import Flask, render_template, request, jsonify, redirect, url_for, session
import database
import logging
from routes.api_fazendas import criar_api_fazendas  # Módulo de APIs de fazendas
from routes.api_categorias import api_categorias  # Módulo de APIs de categorias de animais
from config_data_teste import now, get_status  # Suporte a data de teste

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
            return redirect(url_for('home'))
        else:
            return render_template('login.html', error='Usuário ou senha inválidos!')
    
    return render_template('login.html')

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

# ============ HOME ============
@app.route('/')
def home():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    from database import listar_fazendas_usuario, relatorio_estatisticas
    fazendas = listar_fazendas_usuario(session['user_id'])
    stats = relatorio_estatisticas()
    return render_template('home.html', fazendas=fazendas, stats=stats, usuario=session)

# ============ FAZENDA ============
@app.route('/fazenda/<int:id>')
def fazenda(id):
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    from database import get_fazenda, listar_piquetes
    fazenda = get_fazenda(id)
    
    if not fazenda:
        return "Fazenda não encontrada", 404
    
    if fazenda['usuario_id'] != session['user_id']:
        return "Acesso negado", 403
    
    session['fazenda_id'] = id
    piquetes = listar_piquetes(id)
    
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
    """Cria um novo lote"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    data = request.json
    fazenda_id = session.get('fazenda_id')
    
    lote_id = database.criar_lote(
        fazenda_id,
        data['nome'],
        data.get('categoria'),
        data.get('quantidade', 0),
        data.get('peso_medio', 0),
        data.get('observacao'),
        data.get('piquete_id')
    )
    
    return jsonify({'id': lote_id, 'status': 'ok'})

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
    """Atualiza um lote"""
    if 'user_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401
    
    data = request.json
    database.atualizar_lote(
        id,
        data.get('nome'),
        data.get('categoria'),
        data.get('quantidade'),
        data.get('peso_medio'),
        data.get('observacao'),
        data.get('piquete_atual_id')
    )
    return jsonify({'status': 'ok'})

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
    
