"""
Serviços de Clima para Manejo de Pastagens
Funções isoladas para cálculos climáticos e integração futura com APIs meteorológicas.
"""

from enum import Enum
from typing import Optional


# ========== ENUM DE CONDIÇÃO CLIMÁTICA ==========
class CondicaoClimatica(Enum):
    """Condições climáticas possíveis para cálculo de crescimento."""
    SECA = "seca"
    NORMAL = "normal"
    CHUVIDOSO = "chuvoso"


# ========== FATORES CLIMÁTICOS ==========
# Fator multiplicador do crescimento base baseado na condição
FATORES_CLIMATICOS = {
    CondicaoClimatica.SECA.value: 0.6,       # Seca: crescimento 60% do normal
    CondicaoClimatica.NORMAL.value: 1.0,     # Normal: crescimento 100%
    CondicaoClimatica.CHUVIDOSO.value: 1.2,  # Chuvoso: crescimento 120%
}


def calcular_fator_climatico(condicao: str) -> float:
    """
    Calcula o fator multiplicador do crescimento baseado na condição climática.
    
    Args:
        condicao: String representando a condição ('seca', 'normal', 'chuvoso')
    
    Returns:
        Fator multiplicador (0.6, 1.0, ou 1.2)
    
    Raises:
        ValueError: Se condição for inválida
    """
    if not condicao:
        # Se vazio ou None, retornar fator normal
        return FATORES_CLIMATICOS[CondicaoClimatica.NORMAL.value]
    
    condicao_lower = condicao.lower().strip()
    
    # Validar e retornar
    if condicao_lower in FATORES_CLIMATICOS:
        return FATORES_CLIMATICOS[condicao_lower]
    
    # Se valor inválido, retornar normal como padrão
    return FATORES_CLIMATICOS[CondicaoClimatica.NORMAL.value]


# ========== API FUTURA - PLACEHOLDER ==========
def obter_clima_real(lat: float, lon: float) -> dict:
    """
    Placeholder para integração futura com API meteorológica.
    
    Args:
        lat: Latitude da localização
        lon: Longitude da localização
    
    Returns:
        Dict com dados climáticos ou estrutura vazia se indisponível
    
    Raises:
        NotImplementedError: Quando API real não estiver implementada
    """
    # TODO: Implementar integração real com API meteorológica
    # Sugestões de APIs:
    # - OpenWeatherMap (grátis até 1000 chamadas/dia)
    # - WeatherAPI (grátis até 1M chamadas/mês)
    # - INMET (brasileira, dados de estações)
    
    raise NotImplementedError(
        "Integração com API meteorológica ainda não implementada. "
        "Use fator climático manual até então."
    )


def obter_clima_simulado(lat: float, lon: float) -> dict:
    """
    Retorna clima simulado para testes (offline).
    
    Args:
        lat: Latitude
        lon: Longitude
    
    Returns:
        Dict com dados climáticos simulados
    """
    # Simulação baseada em localização (Brasil)
    # Norte/Nordeste: mais seco
    # Sul/Sudeste: mais chuvoso
    
    if lat < -10:  # Norte/Nordeste
        condicao = "seca" if lon > -50 else "normal"
    elif lat < -15:  # Centro-Oeste
        condicao = "normal"
    elif lat < -20:  # São Paulo/Minas
        condicao = "chuvoso" if lon > -50 else "normal"
    else:  # Sul
        condicao = "chuvoso"
    
    return {
        "condicao": condicao,
        "fator": calcular_fator_climatico(condicao),
        "fonte": "simulacao",
        "latitude": lat,
        "longitude": lon,
        "nota": "Dados simulados. Configure API real para dados precisos."
    }


# ========== HELPERS ==========
def get_descricao_clima(condicao: str) -> str:
    """
    Retorna descrição textual da condição climática.
    
    Args:
        condicao: String da condição
    
    Returns:
        Descrição amigável
    """
    descricoes = {
        "seca": "🔴 Seca - Crescimento reduzido (60%)",
        "normal": "🟢 Normal - Crescimento padrão (100%)",
        "chuvoso": "🔵 Chuvoso - Crescimento elevado (120%)"
    }
    return descricoes.get(condicao.lower(), "🟢 Normal - Crescimento padrão (100%)")


def validar_condicao_climatica(condicao: Optional[str]) -> str:
    """
    Valida e normaliza condição climática.
    
    Args:
        condicao: Valor inputado pelo usuário
    
    Returns:
        Valor validado ('seca', 'normal', 'chuvoso') ou 'normal' como padrão
    """
    if not condicao or not condicao.strip():
        return CondicaoClimatica.NORMAL.value
    
    condicao_lower = condicao.lower().strip()
    
    # Mapear variações comuns
    mapeamento = {
        "seco": "seca",
        "seca": "seca",
        "dry": "seca",
        "normal": "normal",
        "regular": "normal",
        "chuvoso": "chuvoso",
        "chuva": "chuvoso",
        "rainy": "chuvoso",
        "molhado": "chuvoso",
    }
    
    return mapeamento.get(condicao_lower, CondicaoClimatica.NORMAL.value)
