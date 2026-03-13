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

            renderMovimentacoesRelatorio(filtradas);
        })
        .catch(() => {});

    carregarRotacaoRelatorios();
    carregarLotacaoRelatorios();
    carregarStatusPiquetesRelatorios();
    carregarInsightsRelatorios();
}

function carregarInsightsRelatorios() {
    if (typeof fazendaId === 'undefined') return;

    Promise.all([
        fetch(`/api/piquetes?fazenda_id=${fazendaId}`).then(r => r.json()).catch(() => []),
        fetch(`/api/lotacao/${fazendaId}`).then(r => r.json()).catch(() => ({})),
        fetch(`/api/rotacao/resumo_geral?fazenda_id=${fazendaId}`).then(r => r.json()).catch(() => ({})),
        fetch('/api/alertas/contar').then(r => r.json()).catch(() => ({}))
    ]).then(([piquetes, lotacao, resumo, alertas]) => {
        const lista = document.getElementById('relatorio-insights');
        if (!lista) return;

        const items = [];
        const data = Array.isArray(piquetes) ? piquetes : [];

        const semMedicao = data.filter(p => {
            const temReal = p.altura_real_medida !== null && p.altura_real_medida !== undefined;
            return !p.data_medicao && !temReal;
        }).length;
        if (semMedicao > 0) {
            items.push(`⚠️ ${semMedicao} piquete${semMedicao > 1 ? 's' : ''} sem medição recente`);
        }

        const lotacaoStatus = lotacao?.status_lotacao;
        if (lotacaoStatus === 'BAIXA') {
            items.push('⚠️ Lotação da fazenda abaixo do ideal');
        } else if (lotacaoStatus === 'MUITO_ALTA' || lotacaoStatus === 'ALTA') {
            items.push('⚠️ Lotação da fazenda acima do ideal');
        }

        const prontos = resumo?.piquetes_prontos ?? 0;
        if (prontos === 0 && data.length > 0) {
            items.push('⚠️ Nenhum piquete pronto para entrada');
        }

        const alertasTotal = alertas?.total ?? 0;
        if (alertasTotal > 0) {
            items.push(`⚠️ ${alertasTotal} alerta${alertasTotal > 1 ? 's' : ''} crítico${alertasTotal > 1 ? 's' : ''} pendente${alertasTotal > 1 ? 's' : ''}`);
        }

        const atrasados = data.filter(p => {
            if (p.estado !== 'ocupado') return false;
            const diasOcupados = p.dias_no_piquete || 0;
            const diasTecnicos = p.dias_tecnicos || 0;
            return diasTecnicos > 0 && diasOcupados > diasTecnicos;
        }).length;
        if (atrasados > 0) {
            items.push(`⚠️ ${atrasados} piquete${atrasados > 1 ? 's' : ''} acima do tempo técnico`);
        }

        if (!items.length) {
            lista.innerHTML = '<li>Nenhum insight gerado ainda.</li>';
            return;
        }

        lista.innerHTML = items.map(i => `<li>${i}</li>`).join('');
    });
}

function carregarStatusPiquetesRelatorios() {
    if (typeof fazendaId === 'undefined') return;

    fetch(`/api/piquetes?fazenda_id=${fazendaId}`)
        .then(r => r.json())
        .then(data => {
            const piquetes = Array.isArray(data) ? data : [];
            renderStatusPiquetesRelatorios(piquetes);
        })
        .catch(() => {});
}

function renderStatusPiquetesRelatorios(piquetes) {
    const container = document.getElementById('relatorio-status-piquetes');
    if (!container) return;

    if (!piquetes.length) {
        container.textContent = 'Sem dados.';
        return;
    }

    let disponiveis = 0;
    let ocupados = 0;
    let recuperando = 0;
    let semAltura = 0;

    piquetes.forEach(p => {
        const temReal = p.altura_real_medida !== null && p.altura_real_medida !== undefined;
        const temAlgumaAltura = temReal || (p.altura_estimada !== null && p.altura_estimada !== undefined);
        const semMedicao = !p.data_medicao && !temReal;

        if (!temAlgumaAltura || semMedicao) {
            semAltura += 1;
            return;
        }
        if (p.estado === 'ocupado') {
            ocupados += 1;
            return;
        }
        if (p.altura_estimada >= p.altura_entrada || (temReal && p.altura_real_medida >= p.altura_entrada)) {
            disponiveis += 1;
        } else {
            recuperando += 1;
        }
    });

    const total = disponiveis + ocupados + recuperando + semAltura;
    const pct = (v) => total ? Math.round((v / total) * 100) : 0;

    container.innerHTML = `
        <div style="display:grid; grid-template-columns: repeat(4, minmax(120px, 1fr)); gap:10px;">
            <div style="display:flex; flex-direction:column; gap:6px;">
                <div style="font-size:0.85rem; color:#555;"><i class="fa-solid fa-circle" style="color:#28a745;"></i> Disponível</div>
                <div style="font-weight:700;">${disponiveis}</div>
                <div style="height:8px; background:#e9ecef; border-radius:6px;">
                    <div style="width:${pct(disponiveis)}%; background:#28a745; height:8px; border-radius:6px;"></div>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px;">
                <div style="font-size:0.85rem; color:#555;"><i class="fa-solid fa-circle" style="color:#dc3545;"></i> Ocupado</div>
                <div style="font-weight:700;">${ocupados}</div>
                <div style="height:8px; background:#e9ecef; border-radius:6px;">
                    <div style="width:${pct(ocupados)}%; background:#dc3545; height:8px; border-radius:6px;"></div>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px;">
                <div style="font-size:0.85rem; color:#555;"><i class="fa-solid fa-circle" style="color:#ffc107;"></i> Recuperando</div>
                <div style="font-weight:700;">${recuperando}</div>
                <div style="height:8px; background:#e9ecef; border-radius:6px;">
                    <div style="width:${pct(recuperando)}%; background:#ffc107; height:8px; border-radius:6px;"></div>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px;">
                <div style="font-size:0.85rem; color:#555;"><i class="fa-solid fa-circle" style="color:#adb5bd;"></i> Sem medição</div>
                <div style="font-weight:700;">${semAltura}</div>
                <div style="height:8px; background:#e9ecef; border-radius:6px;">
                    <div style="width:${pct(semAltura)}%; background:#adb5bd; height:8px; border-radius:6px;"></div>
                </div>
            </div>
        </div>
    `;
}

function carregarRotacaoRelatorios() {
    if (typeof fazendaId === 'undefined') return;
    fetch(`/api/piquetes?fazenda_id=${fazendaId}`)
        .then(r => r.json())
        .then(data => {
            const piquetes = Array.isArray(data) ? data : [];
            renderRotacaoRelatorios(piquetes);
        })
        .catch(() => {});
}

function renderRotacaoRelatorios(piquetes) {
    const elOcup = document.getElementById('relatorio-rotacao-ocupacao');
    const elDesc = document.getElementById('relatorio-rotacao-descanso');
    const elProntos = document.getElementById('relatorio-rotacao-prontos');
    const elAtrasados = document.getElementById('relatorio-rotacao-atrasados');
    const tabela = document.getElementById('relatorio-rotacao-tabela');

    if (!tabela) return;

    let somaOcup = 0;
    let countOcup = 0;
    let somaDesc = 0;
    let countDesc = 0;
    let prontos = 0;
    let atrasados = 0;

    const linhas = piquetes.map(p => {
        const estado = p.estado || '';
        const diasOcupacao = p.dias_no_piquete || 0;
        const diasDescanso = p.dias_descanso || 0;
        const diasIdeais = p.dias_ideais || p.dias_descanso_min || 30;
        const diasTecnicos = p.dias_tecnicos || 0;

        let status = 'OK';
        if (estado === 'ocupado') {
            somaOcup += diasOcupacao;
            countOcup += 1;
            if (diasTecnicos && diasOcupacao > diasTecnicos) {
                status = '⚠️ acima do ideal';
                atrasados += 1;
            }
        } else {
            somaDesc += diasDescanso;
            countDesc += 1;
            if (p.status === 'APTO') {
                prontos += 1;
            }
            if (diasDescanso < diasIdeais) {
                status = '⚠️ abaixo do ideal';
            }
        }

        return `
            <tr>
                <td>${p.nome || '-'}</td>
                <td>${estado === 'ocupado' ? diasOcupacao : '-'}</td>
                <td>${estado === 'ocupado' ? '-' : diasDescanso}</td>
                <td>${status}</td>
            </tr>
        `;
    }).join('');

    const mediaOcup = countOcup ? (somaOcup / countOcup).toFixed(1) : '-';
    const mediaDesc = countDesc ? (somaDesc / countDesc).toFixed(1) : '-';

    if (elOcup) elOcup.textContent = mediaOcup;
    if (elDesc) elDesc.textContent = mediaDesc;
    if (elProntos) elProntos.textContent = prontos;
    if (elAtrasados) elAtrasados.textContent = atrasados;

    tabela.innerHTML = linhas || '<tr><td colspan="4" class="relatorios-empty">Sem dados</td></tr>';
}

function carregarLotacaoRelatorios() {
    if (typeof fazendaId === 'undefined') return;

    fetch(`/api/lotacao/${fazendaId}`)
        .then(r => r.json())
        .then(data => {
            const elUa = document.getElementById('relatorio-lotacao-ua');
            const elUaHa = document.getElementById('relatorio-lotacao-uaha');
            if (elUa) elUa.textContent = data?.ua_total ?? '-';
            if (elUaHa) elUaHa.textContent = data?.lotacao_ha ?? '-';
        })
        .catch(() => {});

    fetch(`/api/lotacao/historico/${fazendaId}`)
        .then(r => r.json())
        .then(data => {
            const series = Array.isArray(data) ? data : [];
            const range = obterRangeRelatorios();
            const filtrada = series.filter(p => {
                if (!p.data_ref) return false;
                const dt = new Date(p.data_ref + 'T00:00:00');
                if (range.inicioDate && dt < range.inicioDate) return false;
                if (range.fimDate && dt > range.fimDate) return false;
                return true;
            });
            renderChartLotacaoUaha(filtrada);
        })
        .catch(() => {
            renderChartLotacaoUaha([]);
        });

    fetch(`/api/rotacao/resumo_geral?fazenda_id=${fazendaId}`)
        .then(r => r.json())
        .then(data => {
            const elOcupada = document.getElementById('relatorio-lotacao-ocupada');
            const elDescanso = document.getElementById('relatorio-lotacao-descanso');
            const areaOcupada = data?.area_ocupada;
            const areaDescanso = data?.area_descanso;
            if (elOcupada) {
                elOcupada.textContent = Number.isFinite(areaOcupada) ? `${areaOcupada.toFixed(2)} ha` : '-';
            }
            if (elDescanso) {
                elDescanso.textContent = Number.isFinite(areaDescanso) ? `${areaDescanso.toFixed(2)} ha` : '-';
            }
        })
        .catch(() => {});
}

function renderChartLotacaoUaha(series) {
    const canvas = document.getElementById('relatorio-chart-uaha');
    const note = document.getElementById('relatorio-chart-uaha-note');
    if (!canvas || typeof Chart === 'undefined') {
        if (note) note.textContent = 'Gráfico indisponível.';
        return;
    }

    if (!Array.isArray(series) || series.length === 0) {
        if (note) note.textContent = 'Sem histórico registrado ainda.';
        return;
    }

    const labels = series.map(p => {
        const dt = new Date(p.data_ref + 'T00:00:00');
        return dt.toLocaleDateString('pt-BR');
    });
    const data = series.map(p => p.lotacao_ha ?? 0);

    if (canvas._chart) {
        canvas._chart.destroy();
    }

    canvas._chart = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'UA/ha',
                data,
                borderColor: '#0d6efd',
                backgroundColor: 'rgba(13,110,253,0.15)',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointRadius: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { display: false },
                y: { beginAtZero: true }
            }
        }
    });

    if (note) note.textContent = 'Histórico real de lotação (UA/ha).';
}

function renderMovimentacoesRelatorio(movs) {
    const grafico = document.getElementById('relatorio-mov-grafico');
    const tabela = document.getElementById('relatorio-mov-tabela');
    if (!grafico || !tabela) return;

    if (!movs.length) {
        grafico.textContent = 'Sem movimentações no período.';
        tabela.innerHTML = '<tr><td colspan="6" class="relatorios-empty">Sem dados</td></tr>';
        return;
    }

    // Gráfico: uso dos piquetes (destino)
    const contagem = {};
    movs.forEach(m => {
        const nome = m.destino_nome || 'Sem destino';
        contagem[nome] = (contagem[nome] || 0) + 1;
    });

    const itens = Object.entries(contagem)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const max = itens.length ? Math.max(...itens.map(i => i[1])) : 1;
    grafico.innerHTML = itens.map(([nome, qtd]) => {
        const pct = Math.round((qtd / max) * 100);
        return `
            <div style="display:flex; align-items:center; gap:8px; margin:6px 0;">
                <div style="width:120px; font-size:0.85rem; color:#555; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${nome}</div>
                <div style="flex:1; background:#f1f3f5; border-radius:6px; height:10px; position:relative;">
                    <div style="width:${pct}%; background:#0d6efd; height:10px; border-radius:6px;"></div>
                </div>
                <div style="width:30px; text-align:right; font-size:0.8rem; color:#555;">${qtd}</div>
            </div>
        `;
    }).join('');

    // Tabela
    const linhas = movs.slice(0, 30).map(m => {
        const dataFmt = m.data_movimentacao ? new Date(m.data_movimentacao).toLocaleDateString('pt-BR') : '-';
        const tipoFmt = (m.tipo || '-').replace('movimentacao', 'manual');
        return `
            <tr>
                <td>${m.lote_nome || '-'}</td>
                <td>${m.origem_nome || '-'}</td>
                <td>${m.destino_nome || '-'}</td>
                <td>${dataFmt}</td>
                <td>${tipoFmt}</td>
                <td>${m.motivo || '-'}</td>
            </tr>
        `;
    }).join('');
    tabela.innerHTML = linhas || '<tr><td colspan="6" class="relatorios-empty">Sem dados</td></tr>';
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
