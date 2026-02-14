"""
API de Categorias de Animais
Endpoints para obter categorias de animais e pesos médios.
"""
from flask import Blueprint, jsonify
from services.manejo_service import CATEGORIAS_BOVINOS, get_peso_medio_categoria

api_categorias = Blueprint('api_categorias', __name__)


@api_categorias.route('/api/categorias', methods=['GET'])
def listar_categorias():
    """
    Lista todas as categorias de animais disponíveis.

    Returns:
        JSON com lista de categorias e seus dados:
        {
            "categorias": [
                {
                    "nome": "Bezerro(a)",
                    "peso_medio": 200,
                    "consumo_relativo": 0.6,
                    "fator_pressao": 0.5
                },
                ...
            ]
        }
    """
    categorias = []
    for nome, dados in CATEGORIAS_BOVINOS.items():
        categorias.append({
            'nome': nome,
            'peso_medio': dados['peso_medio'],
            'consumo_relativo': dados['consumo_relativo'],
            'fator_pressao': dados['fator_pressao']
        })
    
    return jsonify({
        'categorias': categorias,
        'total': len(categorias)
    })


@api_categorias.route('/api/categorias/<categoria>/peso', methods=['GET'])
def get_peso_categoria(categoria):
    """
    Retorna o peso médio de uma categoria específica.

    Args:
        categoria: Nome da categoria (url encoded)

    Returns:
        JSON com o peso médio:
        {
            "categoria": "Bezerro(a)",
            "peso_medio": 200
        }
    """
    peso = get_peso_medio_categoria(categoria)
    
    if peso is None:
        return jsonify({
            'error': 'Categoria não encontrada ou não tem peso padrão',
            'categoria': categoria
        }), 404
    
    return jsonify({
        'categoria': categoria,
        'peso_medio': peso
    })
