"""
Serviços de Clima para Manejo de Pastagens
Fase 1: clima real (Open-Meteo) + cache local + fallback seguro.
"""

from enum import Enum
from typing import Optional
from datetime import datetime, timedelta, timezone
import sqlite3
import os
import json
from urllib.parse import urlencode
from urllib.request import urlopen


# ========== CONFIG ==========
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "pastagens.db")
CACHE_TTL_HOURS = 3
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


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


def _get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_clima_cache_table() -> None:
    conn = _get_db()
    cur = conn.cursor()
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS clima_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            provider TEXT NOT NULL,
            condicao TEXT NOT NULL,
            fator REAL NOT NULL,
            payload_json TEXT,
            fetched_at TEXT NOT NULL,
            expires_at TEXT NOT NULL
        )
        '''
    )
    conn.commit()
    conn.close()


def _round_coord(value: float) -> float:
    # 3 casas ~ 100m, evita spam de cache por pequena variação
    return round(float(value), 3)


def _get_cache(lat: float, lon: float, provider: str = "open-meteo") -> Optional[dict]:
    _init_clima_cache_table()
    now_iso = datetime.now(timezone.utc).isoformat()
    lat_r = _round_coord(lat)
    lon_r = _round_coord(lon)

    conn = _get_db()
    cur = conn.cursor()
    cur.execute(
        '''
        SELECT *
        FROM clima_cache
        WHERE lat = ? AND lon = ? AND provider = ? AND expires_at > ?
        ORDER BY fetched_at DESC
        LIMIT 1
        ''',
        (lat_r, lon_r, provider, now_iso)
    )
    row = cur.fetchone()
    conn.close()

    if not row:
        return None

    payload = {}
    if row["payload_json"]:
        try:
            payload = json.loads(row["payload_json"])
        except Exception:
            payload = {}

    return {
        "condicao": row["condicao"],
        "fator": row["fator"],
        "fonte": "cache",
        "provider": row["provider"],
        "latitude": row["lat"],
        "longitude": row["lon"],
        "fetched_at": row["fetched_at"],
        "expires_at": row["expires_at"],
        "payload": payload,
    }


def _save_cache(lat: float, lon: float, condicao: str, fator: float, payload: dict, provider: str = "open-meteo") -> None:
    _init_clima_cache_table()
    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=CACHE_TTL_HOURS)
    lat_r = _round_coord(lat)
    lon_r = _round_coord(lon)

    conn = _get_db()
    cur = conn.cursor()
    cur.execute(
        '''
        INSERT INTO clima_cache (lat, lon, provider, condicao, fator, payload_json, fetched_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''',
        (
            lat_r,
            lon_r,
            provider,
            condicao,
            float(fator),
            json.dumps(payload, ensure_ascii=False),
            now.isoformat(),
            expires.isoformat(),
        )
    )
    conn.commit()
    conn.close()


def calcular_fator_climatico(condicao: str) -> float:
    """
    Calcula o fator multiplicador do crescimento baseado na condição climática.

    Args:
        condicao: String representando a condição ('seca', 'normal', 'chuvoso')

    Returns:
        Fator multiplicador (0.6, 1.0, ou 1.2)
    """
    if not condicao:
        return FATORES_CLIMATICOS[CondicaoClimatica.NORMAL.value]

    condicao_lower = condicao.lower().strip()
    return FATORES_CLIMATICOS.get(condicao_lower, FATORES_CLIMATICOS[CondicaoClimatica.NORMAL.value])


def _inferir_condicao_por_open_meteo(payload: dict) -> str:
    """
    Regras simples para classificar condição climática com base em previsão Open-Meteo.
    """
    daily = payload.get("daily", {}) or {}
    chuva_lista = daily.get("precipitation_sum", []) or []
    chuva_7d = float(sum(chuva_lista[:7])) if chuva_lista else 0.0

    current = payload.get("current", {}) or {}
    umidade = current.get("relative_humidity_2m")

    # Regras iniciais (Fase 1) - simples e estáveis
    if chuva_7d >= 35:
        return CondicaoClimatica.CHUVIDOSO.value

    if chuva_7d <= 10:
        # Se pouca chuva e umidade baixa, seca
        if umidade is not None and float(umidade) < 55:
            return CondicaoClimatica.SECA.value
        # Ainda pode ser normal em regiões com umidade moderada
        return CondicaoClimatica.SECA.value

    return CondicaoClimatica.NORMAL.value


def obter_clima_real(lat: float, lon: float) -> dict:
    """
    Busca clima real no Open-Meteo e retorna condição + fator + payload resumido.

    Args:
        lat: Latitude
        lon: Longitude

    Returns:
        Dict com dados climáticos processados

    Raises:
        Exception em erro de rede/parsing
    """
    query = urlencode({
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,precipitation",
        "daily": "precipitation_sum,temperature_2m_max,temperature_2m_min",
        "forecast_days": 7,
        "timezone": "auto",
    })

    url = f"{OPEN_METEO_URL}?{query}"

    with urlopen(url, timeout=12) as resp:
        raw = resp.read().decode("utf-8")
        payload = json.loads(raw)

    condicao = _inferir_condicao_por_open_meteo(payload)
    fator = calcular_fator_climatico(condicao)

    current = payload.get("current", {}) or {}
    daily = payload.get("daily", {}) or {}

    resumo = {
        "condicao": condicao,
        "fator": fator,
        "fonte": "api",
        "provider": "open-meteo",
        "latitude": lat,
        "longitude": lon,
        "temperatura": current.get("temperature_2m"),
        "umidade": current.get("relative_humidity_2m"),
        "precipitacao_atual": current.get("precipitation"),
        "chuva_7d": float(sum((daily.get("precipitation_sum") or [])[:7])) if daily.get("precipitation_sum") else 0.0,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "payload": payload,
    }

    return resumo


def obter_clima_simulado(lat: float, lon: float) -> dict:
    """
    Retorna clima simulado para testes (offline).
    """
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


def obter_clima_com_fallback(lat: float, lon: float, prefer_cache: bool = True) -> dict:
    """
    Estratégia Fase 1:
    1) cache válido
    2) API real
    3) simulado
    4) normal seguro
    """
    # 1) cache
    if prefer_cache:
        cache = _get_cache(lat, lon)
        if cache:
            return cache

    # 2) API real
    try:
        real = obter_clima_real(lat, lon)
        _save_cache(
            lat=lat,
            lon=lon,
            condicao=real["condicao"],
            fator=real["fator"],
            payload=real.get("payload", {}),
            provider="open-meteo",
        )
        return real
    except Exception:
        pass

    # 3) simulado
    try:
        return obter_clima_simulado(lat, lon)
    except Exception:
        pass

    # 4) fallback final
    return {
        "condicao": CondicaoClimatica.NORMAL.value,
        "fator": FATORES_CLIMATICOS[CondicaoClimatica.NORMAL.value],
        "fonte": "fallback",
        "latitude": lat,
        "longitude": lon,
        "nota": "Fallback final para estabilidade do sistema."
    }


# ========== HELPERS ==========
def get_descricao_clima(condicao: str) -> str:
    """
    Retorna descrição textual da condição climática.
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
    """
    if not condicao or not condicao.strip():
        return CondicaoClimatica.NORMAL.value

    condicao_lower = condicao.lower().strip()

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
