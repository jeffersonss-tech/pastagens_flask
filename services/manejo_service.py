"""
Serviços de Manejo de Pastagens
Funções isoladas para regras de negócio relacionadas a manejo de piquetes e lotes.
"""


# ========== CONSTANTES ==========
TAXA_MAXIMA_LOTACAO = 10  # UA/ha - limite técnico para evitar explosão


class ManejoError(Exception):
    """Exceção controlada para erros de manejo."""
    pass


def calcular_altura_ocupacao(
    altura_base: float,
    altura_saida: float,
    dias_ocupacao: int,
    consumo_base_capim: float,
    quantidade_animais: int,
    area_piquete: float,
    detalhar: bool = False
) -> float | dict:
    """
    Calcula a altura estimada do pasto durante ocupação considerando taxa de lotação.
    
    Args:
        altura_base: Altura inicial do pasto (real medida ou estimada anterior)
        altura_saida: Altura mínima fisiológica de saída (cm)
        dias_ocupacao: Dias que o lote permanece no piquete
        consumo_base_capim: Consumo base diário do capim (cm/animal em 2 UA/ha)
        quantidade_animais: Quantidade de animais no lote
        area_piquete: Área do piquete em hectares
        detalhar: Se True, retorna dict com detalhes do cálculo
    
    Returns:
        Se detalhar=False: altura_estimada (float)
        Se detalhar=True: dict com {"altura", "taxa_lotacao", "consumo_real", "reducao_diaria", "reducao_total"}
    
    Raises:
        ManejoError: Se parâmetros inválidos
    """
    # ========== VALIDAÇÕES ==========
    if area_piquete <= 0:
        raise ManejoError(f"Área do piquete deve ser maior que 0. Recebido: {area_piquete}")
    
    if altura_base < altura_saida:
        raise ManejoError(
            f"Altura base ({altura_base}) não pode ser menor que "
            f"altura de saída ({altura_saida})"
        )
    
    if dias_ocupacao < 0:
        raise ManejoError(f"Dias de ocupação não pode ser negativo: {dias_ocupacao}")
    
    # ========== CÁLCULO ==========
    
    # Se sem animais, altura não muda
    if quantidade_animais <= 0:
        if detalhar:
            return {
                "altura": altura_base,
                "taxa_lotacao": 0,
                "consumo_real": 0,
                "reducao_diaria": 0,
                "reducao_total": 0,
                "status": "sem_animais"
            }
        return altura_base
    
    # Taxa de lotação: animais por hectare
    taxa_lotacao = quantidade_animais / area_piquete
    
    # Limitar taxa de lotação para evitar valores absurdos
    taxa_original = taxa_lotacao
    taxa_lotacao = min(taxa_lotacao, TAXA_MAXIMA_LOTACAO)
    
    # Ajuste do consumo baseado na lotação
    # O consumo_base é para 2 UA/ha, então ajustamos proporcionalmente
    consumo_real = consumo_base_capim * (taxa_lotacao / 2)
    
    # Redução total durante ocupação
    reducao_diaria = consumo_real
    reducao_total = consumo_real * dias_ocupacao
    
    # ========== APLICAÇÃO ==========
    altura_estimada = altura_base - reducao_total
    
    # Limite físico inferior: nunca低于 altura mínima
    altura_estimada = max(altura_estimada, altura_saida)
    
    # Limite físico superior: nunca ultrapassar altura base
    altura_estimada = min(altura_estimada, altura_base)
    
    # ========== RETORNO ==========
    if detalhar:
        return {
            "altura": round(altura_estimada, 1),
            "taxa_lotacao": round(taxa_lotacao, 2),
            "taxa_original": round(taxa_original, 2),
            "taxa_limitada": taxa_lotacao < taxa_original,
            "consumo_real": round(consumo_real, 2),
            "reducao_diaria": round(reducao_diaria, 2),
            "reducao_total": round(reducao_total, 1),
            "altura_base": altura_base,
            "altura_saida": altura_saida,
            "dias_ocupacao": dias_ocupacao,
            "status": "ok"
        }
    
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
        Consumo base (cm/animal/dia em 2 UA/ha) ou valor padrão
    """
    return CONSUMO_BASE_CAPIM.get(capim, 0.8)


# ========== MODELO FUTURO (NÍVEL 3) - PREPARADO ==========

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


def simular_ocupacao_diaria(
    altura_inicial: float,
    altura_saida: float,
    dias_totais: int,
    consumo_base: float,
    quantidade_animais: int,
    area_piquete: float,
    detalhar: bool = False
) -> list | dict:
    """
    Simula ocupação dia a dia (futuro - nível 3).
    
    Args:
        altura_inicial: Altura no início da ocupação
        altura_saida: Altura mínima de saída
        dias_totais: Total de dias de ocupação
        consumo_base: Consumo base do capim
        quantidade_animais: Número de animais
        area_piquete: Área em hectares
        detalhar: Se True, retorna lista com cada dia
    
    Returns:
        Lista de dicts com evolução diária OU dict com resultado final
    """
    # Validar
    if area_piquete <= 0 or dias_totais <= 0:
        raise ManejoError("Parâmetros inválidos para simulação")
    
    taxa_lotacao = min(quantidade_animais / area_piquete, TAXA_MAXIMA_LOTACAO)
    consumo_diario = consumo_base * (taxa_lotacao / 2)
    
    evolucao = []
    altura_atual = altura_inicial
    
    for dia in range(1, dias_totais + 1):
        altura_anterior = altura_atual
        altura_atual = max(altura_saida, altura_atual - consumo_diario)
        
        if detalhar:
            evolucao.append({
                "dia": dia,
                "altura_inicio": round(altura_anterior, 1),
                "altura_fim": round(altura_atual, 1),
                "reducao": round(consumo_diario, 2),
                "atingiu_minimo": altura_atual <= altura_saida
            })
    
    if detalhar:
        return {
            "evolucao_diaria": evolucao,
            "resumo": {
                "altura_inicial": altura_inicial,
                "altura_final": round(altura_atual, 1),
                "altura_saida": altura_saida,
                "dias_totais": dias_totais,
                "consumo_diario": round(consumo_diario, 2),
                "taxa_lotacao": round(taxa_lotacao, 2),
                "reducao_total": round(altura_inicial - altura_atual, 1)
            }
        }
    
    return evolucao
