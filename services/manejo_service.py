"""
Serviços de Manejo de Pastagens
Funções isoladas para regras de negócio relacionadas a manejo de piquetes e lotes.
"""


class ManejoError(Exception):
    """Exceção controlada para erros de manejo."""
    pass


def calcular_altura_ocupacao(
    altura_entrada: float,
    altura_saida: float,
    dias_ocupacao: int,
    consumo_base_capim: float,
    quantidade_animais: int,
    area_piquete: float
) -> float:
    """
    Calcula a altura estimada do pasto durante ocupação considerando taxa de lotação.
    
    Args:
        altura_entrada: Altura ideal de entrada dos animais (cm)
        altura_saida: Altura mínima de saída (cm)
        dias_ocupacao: Dias que o lote permanece no piquete
        consumo_base_capim: Consumo base diário do capim (cm/animal)
        quantidade_animais: Quantidade de animais no lote
        area_piquete: Área do piquete em hectares
    
    Returns:
        Altura estimada do pasto após ocupação (cm)
    
    Raises:
        ManejoError: Se área for <= 0
    """
    # ========== VALIDAÇÕES ==========
    if area_piquete <= 0:
        raise ManejoError(f"Área do piquete deve ser maior que 0. Recebido: {area_piquete}")
    
    if quantidade_animais <= 0:
        # Sem animais, altura não muda
        return altura_entrada
    
    if altura_entrada <= altura_saida:
        raise ManejoError(
            f"Altura de entrada ({altura_entrada}) deve ser maior que "
            f"altura de saída ({altura_saida})"
        )
    
    # ========== CÁLCULO ==========
    # Taxa de lotação: animais por hectare
    taxa_lotacao = quantidade_animais / area_piquete
    
    # Ajuste do consumo baseado na lotação
    # Ex: 5 UA/ha consome mais que 2 UA/ha
    consumo_real = consumo_base_capim * taxa_lotacao
    
    # Redução total de altura
    reducao_total = consumo_real * dias_ocupacao
    
    # Altura estimada após ocupação
    altura_estimada = altura_entrada - reducao_total
    
    # ========== LIMITES ==========
    # Nunca permitir ultrapassar altura de entrada
    altura_estimada = min(altura_estimada, altura_entrada)
    
    # Nunca permitir低于 altura mínima de saída
    altura_estimada = max(altura_estimada, altura_saida)
    
    return round(altura_estimada, 1)


def calcular_taxa_lotacao(quantidade_animais: int, area_piquete: float) -> float:
    """
    Calcula taxa de lotação do piquete.
    
    Args:
        quantidade_animais: Número de animais
        area_piquete: Área em hectares
    
    Returns:
        Taxa de lotação (animais por hectare)
    """
    if area_piquete <= 0:
        return 0
    return round(quantidade_animais / area_piquete, 2)


def classificar_lotacao(taxa_animais_ha: float) -> str:
    """
    Classifica a lotação do piquete.
    
    Args:
        taxa_animais_ha: Taxa de animais por hectare
    
    Returns:
        Classificação: BAIXA, MODERADA, ALTA, MUITO_ALTA
    """
    if taxa_animais_ha < 2:
        return "BAIXA"
    elif taxa_animais_ha <= 4:
        return "MODERADA"
    elif taxa_animais_ha <= 6:
        return "ALTA"
    else:
        return "MUITO_ALTA"


def calcular_consumo_ajustado(
    consumo_base: float,
    taxa_lotacao: float,
    fator_lotacao: float = 1.0
) -> float:
    """
    Calcula consumo ajustado baseado na lotação.
    
    Args:
        consumo_base: Consumo base do capim (cm/dia)
        taxa_lotacao: Animais por hectare
        fator_lotacao: Fator multiplicador opcional
    
    Returns:
        Consumo ajustado (cm/dia)
    """
    return round(consumo_base * taxa_lotacao * fator_lotacao, 2)


# ========== CONSUMO BASE POR CAPIM ==========
# Valores base de consumo (cm/animal/dia) em lotação de 2 UA/ha
CONSUMO_BASE_CAPIM = {
    'Tifton 85': 0.7,
    'Brachiaria': 0.8,
    'Andropogon': 0.8,
    'Capim Aruana': 0.75,
    'Natalino': 0.85,
    'MG-5': 0.9,
    'Mombaça': 1.0,
}


def get_consumo_base(capim: str) -> float:
    """
    Retorna o consumo base do capim.
    
    Args:
        nome do capim
    
    Returns:
        Consumo base (cm/animal/dia) ou valor padrão
    """
    return CONSUMO_BASE_CAPIM.get(capim, 0.8)


def calcular_consumo_com_peso(
    consumo_base: float,
    peso_medio_kg: float,
    fator_conversao: float = 450.0
) -> float:
    """
    Calcula consumo baseado no peso médio do lote.
    Futuro: Para modelo nível 3 com UA.
    
    Args:
        consumo_base: Consumo base (cm)
        peso_medio_kg: Peso médio dos animais (kg)
        fator_conversao: kg por UA (default 450)
    
    Returns:
        Consumo ajustado pelo peso
    """
    ua_por_animal = peso_medio_kg / fator_conversao
    return round(consumo_base * ua_por_animal, 3)
