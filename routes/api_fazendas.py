"""
API de Fazendas - Operações CRUD para fazendas
"""
from flask import jsonify, request, session
from database import get_db, atualizar_fazenda, excluir_fazenda
from datetime import datetime
from simular_data import now as data_teste_now  # Suporte a data de teste

def criar_api_fazendas(app):
    """Registra as rotas de API de fazendas no app Flask"""
    
    @app.route('/api/fazendas/<int:id>', methods=['PUT'])
    def api_editar_fazenda(id):
        """Edita uma fazenda existente"""
        if 'user_id' not in session:
            return jsonify({'error': 'Não autorizado'}), 401
        
        data = request.json
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se a fazenda pertence ao usuário
        cursor.execute('SELECT usuario_id FROM fazendas WHERE id = ?', (id,))
        fazenda = cursor.fetchone()
        
        if not fazenda:
            conn.close()
            return jsonify({'error': 'Fazenda não encontrada'}), 404
        
        if fazenda['usuario_id'] != session['user_id']:
            conn.close()
            return jsonify({'error': 'Acesso negado'}), 403
        
        conn.close()
        
        # Atualizar usando função do database
        atualizar_fazenda(
            id,
            data.get('nome'),
            data.get('area'),
            data.get('localizacao'),
            data.get('descricao'),
            data.get('latitude_sede'),
            data.get('longitude_sede'),
            data.get('clima_modo', 'automatico'),
            data.get('condicao_climatica_manual', 'normal')
        )
        
        return jsonify({'status': 'ok'})
    
    @app.route('/api/fazendas/<int:id>', methods=['DELETE'])
    def api_excluir_fazenda(id):
        """Exclui (desativa) uma fazenda"""
        if 'user_id' not in session:
            return jsonify({'error': 'Não autorizado'}), 401
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se a fazenda pertence ao usuário
        cursor.execute('SELECT usuario_id FROM fazendas WHERE id = ?', (id,))
        fazenda = cursor.fetchone()
        
        if not fazenda:
            conn.close()
            return jsonify({'error': 'Fazenda não encontrada'}), 404
        
        if fazenda['usuario_id'] != session['user_id']:
            conn.close()
            return jsonify({'error': 'Acesso negado'}), 403
        
        conn.close()
        
        # Excluir usando função do database
        excluir_fazenda(id)
        
        return jsonify({'status': 'ok'})
    
    @app.route('/api/fazendas/<int:id>', methods=['GET'])
    def api_get_fazenda(id):
        """Busca dados de uma fazenda pelo ID"""
        if 'user_id' not in session:
            return jsonify({'error': 'Não autorizado'}), 401
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM fazendas WHERE id = ?', (id,))
        fazenda = cursor.fetchone()
        
        conn.close()
        
        if not fazenda:
            return jsonify({'error': 'Fazenda não encontrada'}), 404
        
        return jsonify(dict(fazenda))
