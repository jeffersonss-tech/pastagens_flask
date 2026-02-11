"""
Serviços do Sistema de Pastagens
"""
from services.manejo_service import (
    calcular_altura_ocupacao,
    calcular_taxa_lotacao,
    classificar_lotacao,
    get_consumo_base,
    ManejoError
)
from services.clima_service import (
    calcular_fator_climatico,
    CondicaoClimatica,
    get_descricao_clima,
    validar_condicao_climatica,
    obter_clima_simulado,
    obter_clima_real
)
from services.fazenda_service import (
    gerar_resumo_geral
)
