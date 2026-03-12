function definirPeriodoRelatorios() {
    const periodo = document.getElementById('relatorios-periodo');
    const inicio = document.getElementById('relatorios-data-inicio');
    const fim = document.getElementById('relatorios-data-fim');
    if (!periodo || !inicio || !fim) return;

    const hoje = new Date();
    const fimData = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    let inicioData = new Date(fimData);

    if (periodo.value === 'custom') {
        inicio.disabled = false;
        fim.disabled = false;
        return;
    }

    const dias = parseInt(periodo.value, 10) || 30;
    inicioData.setDate(inicioData.getDate() - (dias - 1));

    inicio.value = inicioData.toISOString().slice(0, 10);
    fim.value = fimData.toISOString().slice(0, 10);
    inicio.disabled = true;
    fim.disabled = true;
}

function obterRangeRelatorios() {
    const inicio = document.getElementById('relatorios-data-inicio')?.value;
    const fim = document.getElementById('relatorios-data-fim')?.value;
    const inicioDate = inicio ? new Date(inicio + 'T00:00:00') : null;
    const fimDate = fim ? new Date(fim + 'T23:59:59') : null;
    return { inicioDate, fimDate };
}

function dentroDoPeriodo(dataStr, range) {
    if (!dataStr) return false;
    const dt = new Date(dataStr);
    if (Number.isNaN(dt.getTime())) return false;
    if (range.inicioDate && dt < range.inicioDate) return false;
    if (range.fimDate && dt > range.fimDate) return false;
    return true;
}

async function carregarResumoRelatorios() {
    if (typeof fazendaId === 'undefined') return;

    const range = obterRangeRelatorios();

    // Lotação média (animais/ha)
    fetch(`/api/lotacao/${fazendaId}`)
        .then(r => r.json())
        .then(data => {
            const el = document.getElementById('relatorio-lotacao-media');
            if (el) el.textContent = data?.taxa_animais_ha ?? '-';
        })
        .catch(() => {});

    // Piquetes disponíveis (usa resumo da rotação)
    fetch(`/api/rotacao/resumo_geral?fazenda_id=${fazendaId}`)
        .then(r => r.json())
        .then(data => {
            const el = document.getElementById('relatorio-piquetes-disponiveis');
            if (el) el.textContent = data?.piquetes_prontos ?? '-';
        })
        .catch(() => {});

    // Alertas críticos (não lidos)
    fetch('/api/alertas/contar')
        .then(r => r.json())
        .then(data => {
            const el = document.getElementById('relatorio-alertas');
            if (el) el.textContent = data?.total ?? '-';
        })
        .catch(() => {});

    // Movimentações
    fetch(`/api/movimentacoes?fazenda_id=${fazendaId}`)
        .then(r => r.json())
        .then(data => {
            const movs = Array.isArray(data) ? data : [];
            const filtradas = movs.filter(m => dentroDoPeriodo(m.data_movimentacao, range));

            const total = filtradas.length;
            const saidas = filtradas.filter(m => m.tipo === 'saida').length;
            const entradas = filtradas.filter(m => m.tipo === 'entrada').length;
            const manuais = filtradas.filter(m => m.tipo === 'movimentacao').length;

            const elPeriodo = document.getElementById('relatorio-mov-periodo');
            const elTotal = document.getElementById('relatorio-mov-total');
            const elSaidas = document.getElementById('relatorio-mov-saidas');
            const elEntradas = document.getElementById('relatorio-mov-entradas');
            const elManuais = document.getElementById('relatorio-mov-manuais');

            if (elPeriodo) elPeriodo.textContent = total;
            if (elTotal) elTotal.textContent = total;
            if (elSaidas) elSaidas.textContent = saidas;
            if (elEntradas) elEntradas.textContent = entradas;
            if (elManuais) elManuais.textContent = manuais;
        })
        .catch(() => {});
}

function bindRelatorios() {
    const periodo = document.getElementById('relatorios-periodo');
    const aplicar = document.getElementById('relatorios-aplicar');
    if (periodo) {
        periodo.addEventListener('change', () => {
            definirPeriodoRelatorios();
            if (periodo.value !== 'custom') carregarResumoRelatorios();
        });
    }
    if (aplicar) {
        aplicar.addEventListener('click', () => {
            carregarResumoRelatorios();
        });
    }
}

window.addEventListener('load', () => {
    definirPeriodoRelatorios();
    bindRelatorios();
    carregarResumoRelatorios();
});
