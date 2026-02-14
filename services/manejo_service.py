"""
Serviços de Manejo de Pastagens
Funções isoladas para regras de negócio relacionadas a manejo de piquetes e lotes.
"""
from services.clima_service import calcular_fator_climatico


# ========== CONSTANTES ==========
TAXA_MAXIMA_LOTACAO = 10  # UA/ha - limite técnico para evitar explosão
FATOR_CONVERSAO_UA = 450  # kg por Unidade Animal


# ========== CATEGORIAS DE ANIMAIS ==========
# Categorias técnicas para bovinos de corte com pesos médios e fatores de consumo
CATEGORIAS_BOVINOS = {
    'Bezerro(a)': {
        'peso_medio': 200,      # kg
        'consumo_relativo': 0.6, # 60% do consumo base (menor pressão)
        'fator_pressao': 0.5     # Baixa pressão no pasto
    },
    'Garrote / Novilho(a)': {
        'peso_medio': 325,      # kg
        'consumo_relativo': 0.8, # 80% do consumo base
        'fator_pressao': 0.7     # Pressão média
    },
    'Boi Magro / Engorda': {
        'peso_medio': 475,      # kg
        'consumo_relativo': 1.0, # 100% do consumo base (referência)
        'fator_pressao': 1.0     # Alta pressão no pasto
    },
    'Vaca': {
        'peso_medio': 500,      # kg
        'consumo_relativo': 1.0, # 100% do consumo base
        'fator_pressao': 1.0     # Alta pressão
    },
    'Touro': {
        'peso_medio': 850,      # kg
        'consumo_relativo': 1.3, # 130% do consumo base
        'fator_pressao': 1.3     # Muito alta pressão
    },
    'Personalizado': {
        'peso_medio': None,     # Usuário define manualmente
        'consumo_relativo': 1.0,
        'fator_pressao': 1.0
    }
}


def get_peso_medio_categoria(categoria: str) -> float | None:
    """
    Retorna o peso médio padrão para a categoria de animal.

    Args:
        nome da categoria

    Returns:
        Peso médio em kg ou None se for Personalizado
    """
    dados = CATEGORIAS_BOVINOS.get(categoria)
    return dados['peso_medio'] if dados else None


def get_consumo_relativo_categoria(categoria: str) -> float:
    """
    Retorna o fator de consumo relativo para a categoria.

    Args:
        nome da categoria

    Returns:
        Fator de consumo (1.0 = referência)
    """
    dados = CATEGORIAS_BOVINOS.get(categoria)
    return dados['consumo_relativo'] if dados else 1.0


def calcular_peso_total_categoria(quantidade: int, categoria: str, peso_manual: float = None) -> float:
    """
    Calcula o peso total do lote baseado na categoria.

    Args:
        quantidade: Número de animais
        categoria: Categoria do lote
        peso_manual: Peso médio manual (se fornecido, sobrescreve o padrão)

    Returns:
        Peso total em kg
    """
    peso_medio = peso_manual if peso_manual else get_peso_medio_categoria(categoria)
    if peso_medio is None:
        return 0
    return quantidade * peso_medio


def calcular_ua_total(peso_total_kg: float) -> float:
    """
    Calcula o total de UA (Unidade Animal) baseado no peso total.

    Args:
        peso_total_kg: Peso total do lote em kg

    Returns:
        Total de UA (1 UA = 450 kg)
    """
    return round(peso_total_kg / FATOR_CONVERSAO_UA, 2)


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
    categoria: str = None,
    peso_medio_kg: float = None,
    detalhar: bool = False
) -> float | dict:
    """
    Calcula a altura estimada do pasto durante ocupação considerando taxa de lotação
    e peso da categoria de animal.

    Args:
        altura_base: Altura inicial do pasto (real medida ou estimada anterior)
        altura_saida: Altura mínima fisiológica de saída (cm)
        dias_ocupacao: Dias que o lote permanece no piquete
        consumo_base_capim: Consumo base diário do capim (cm/animal em 2 UA/ha)
        quantidade_animais: Quantidade de animais no lote
        area_piquete: Área do piquete em hectares
        categoria: Categoria do lote (Bezerro, Garrote, Boi, etc.)
        peso_medio_kg: Peso médio manual do animal (se fornecido, sobrescreve categoria)
        detalhar: Se True, retorna dict com detalhes do cálculo

    Returns:
        Se detalhar=False: altura_estimada (float)
        Se detalhar=True: dict com detalhes do cálculo

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
                "ua_total": 0,
                "ua_ha": 0,
                "consumo_real": 0,
                "reducao_diaria": 0,
                "reducao_total": 0,
                "categoria": categoria,
                "peso_usado": None,
                "status": "sem_animais"
            }
        return altura_base

    # ========== CÁLCULO POR CATEGORIA ==========
    # Calcular peso total e UA baseado na categoria
    peso_total = calcular_peso_total_categoria(quantidade_animais, categoria, peso_medio_kg)
    ua_total = calcular_ua_total(peso_total) if peso_total > 0 else 0

    # Taxa de lotação em UA/ha
    ua_ha = ua_total / area_piquete if area_piquete > 0 else 0

    # Fator de consumo da categoria (se não tiver peso manual)
    fator_categoria = get_consumo_relativo_categoria(categoria) if not peso_medio_kg and categoria else 1.0

    # Limitar UA/ha para evitar valores absurdos
    ua_ha_limitado = min(ua_ha, TAXA_MAXIMA_LOTACAO)

    # Ajuste do consumo baseado na lotação e categoria
    # O consumo_base é para 2 UA/ha (padrão de referência), ajustamos proporcionalmente
    # E aplicamos o fator da categoria
    consumo_real = consumo_base_capim * (ua_ha_limitado / 2) * fator_categoria

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
            "taxa_lotacao": round(ua_ha, 2),
            "taxa_limitada": ua_ha > TAXA_MAXIMA_LOTACAO,
            "ua_total": ua_total,
            "ua_ha": round(ua_ha_limitado, 2),
            "peso_total": peso_total,
            "peso_medio": peso_medio_kg or get_peso_medio_categoria(categoria),
            "categoria": categoria,
            "consumo_base_capim": consumo_base_capim,
            "consumo_ajustado": round(consumo_real, 2),
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


# ========== CRESCIMENTO EM DESCANSO (COM FATOR CLIMÁTICO) ==========

def calcular_crescimento_diario(capim: str) -> float:
    """
    Retorna crescimento diário estimado do capim em cm/dia.
    
    Args:
        nome do capim
    
    Returns:
        Crescimento base (cm/dia)
    """
    crescimento = {
        'Brachiaria': 1.2,
        'Mombaça': 1.5,
        'Tifton 85': 1.0,
        'Andropogon': 1.2,
        'Capim Aruana': 1.1,
        'Natalino': 1.3,
        'MG-5': 1.4,
    }
    return crescimento.get(capim, 1.2)


def calcular_altura_descanso(
    altura_saida: float,
    dias_descanso: int,
    capim: str,
    condicao_climatica: str = "normal",
    altura_entrada: float = None,
    detalhar: bool = False
) -> float | dict:
    """
    Calcula a altura estimada do pasto durante descanso considerando fator climático.
    
    Args:
        altura_saida: Altura mínima de saída (cm)
        dias_descanso: Dias em descanso
        capim: Tipo de capim
        condicao_climatica: Condição climática ('seca', 'normal', 'chuvoso')
        altura_entrada: Altura de entrada para cálculo do limite máximo (opcional)
        detalhar: Se True, retorna dict com detalhes
    
    Returns:
        Se detalhar=False: altura_estimada (float)
        Se detalhar=True: dict com detalhes do cálculo
    
    Raises:
        ManejoError: Se parâmetros inválidos
    """
    # ========== VALIDAÇÕES ==========
    if dias_descanso < 0:
        raise ManejoError(f"Dias de descanso não pode ser negativo: {dias_descanso}")
    
    # ========== CÁLCULO ==========
    # Se sem dias de descanso, altura não muda
    if dias_descanso == 0:
        if detalhar:
            return {
                "altura": altura_saida,
                "crescimento_base": 0,
                "fator_climatico": 1.0,
                "crescimento_real": 0,
                "status": "sem_descanso"
            }
        return altura_saida
    
    # Crescimento base do capim
    crescimento_base = calcular_crescimento_diario(capim)
    
    # Fator climático
    fator_climatico = calcular_fator_climatico(condicao_climatica)
    
    # Crescimento real com ajuste climático
    crescimento_real = crescimento_base * fator_climatico
    
    # Altura estimada
    altura_estimada = altura_saida + (dias_descanso * crescimento_real)
    
    # ========== LIMITE MÁXIMO ==========
    # Limite: altura máxima é 1.5x a altura de entrada (evita crescimento infinito)
    # Se não fornecer altura_entrada, usa 2x a saída como limite razoável
    limite_maximo = altura_entrada * 1.5 if altura_entrada else altura_saida * 2.5
    altura_estimada = min(altura_estimada, limite_maximo)
    
    # ========== RETORNO ==========
    if detalhar:
        return {
            "altura": round(altura_estimada, 1),
            "crescimento_base": round(crescimento_base, 2),
            "fator_climatico": round(fator_climatico, 2),
            "crescimento_real": round(crescimento_real, 2),
            "dias_descanso": dias_descanso,
            "altura_saida": altura_saida,
            "limite_maximo": round(limite_maximo, 1),
            "foi_limitada": altura_estimada >= limite_maximo,
            "status": "ok"
        }
    
    return round(altura_estimada, 1)


# ========== CÁLCULO DE DIAS TÉCNICOS ==========

def calcular_dias_tecnicos(
    altura_atual: float,
    altura_saida: float,
    consumo_diario: float,
    detalhar: bool = False
) -> dict:
    """
    Calcula os dias técnicos de ocupação baseado na altura do pasto e consumo.
    
    Fórmula: dias_tecnicos = (altura_atual - altura_saida) / consumo_diario
    """
    from datetime import datetime, timedelta
    
    # Validações
    if altura_atual <= altura_saida:
        if detalhar:
            return {"dias_tecnicos": 0, "consumo_invalido": False, "mensagem": "⚠️ Altura atual ≤ altura de saída", "data_saida_prevista": None, "status": "erro_altura"}
        return 0
    
    if consumo_diario <= 0:
        if detalhar:
            return {"dias_tecnicos": 999, "consumo_invalido": True, "mensagem": "⚠️ Consumo insuficiente", "data_saida_prevista": None, "status": "erro_consumo"}
        return 999
    
    # Cálculo
    altura_total_consumir = altura_atual - altura_saida
    dias_brutos = altura_total_consumir / consumo_diario
    dias_tecnicos = max(0, int(dias_brutos))
    
    # Data de saída prevista
    if dias_tecnicos > 0:
        data_saida = datetime.now() + timedelta(days=dias_tecnicos)
        data_saida_prevista = data_saida.strftime('%d/%m/%Y')
    else:
        data_saida_prevista = None
    
    if detalhar:
        return {
            "dias_tecnicos": dias_tecnicos,
            "altura_atual": altura_atual,
            "altura_saida": altura_saida,
            "altura_total_consumir": round(altura_total_consumir, 1),
            "consumo_diario": round(consumo_diario, 2),
            "dias_brutos": round(dias_brutos, 1),
            "consumo_invalido": False,
            "data_saida_prevista": data_saida_prevista,
            "status": "ok"
        }
    
    return dias_tecnicos
