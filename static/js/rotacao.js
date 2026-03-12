function carregarResumoGeral() {
    fetch('/api/rotacao/resumo_geral?fazenda_id=' + fazendaId)
        .then(r => r.json())
        .then(data => {
            document.getElementById('total-lotes').textContent = data.total_lotes || 0;
            document.getElementById('total-animais').textContent = data.total_animais || 0;
            document.getElementById('area-ocupada').textContent = (data.area_ocupada || 0).toFixed(1);
            document.getElementById('area-descanso').textContent = (data.area_descanso || 0).toFixed(1);
            document.getElementById('media-altura').textContent = data.media_altura_estimada || 0;
            document.getElementById('prontos').textContent = data.piquetes_prontos || 0;
            document.getElementById('criticos').textContent = data.piquetes_criticos || 0;
            
            const criticosBox = document.querySelector('.resumo-box.criticos');
            if (criticosBox) {
                criticosBox.style.background = data.piquetes_criticos > 0 ? '#fff5f5' : 'white';
            }
        });
}

function atualizar() {
    carregarResumoGeral();
    carregarStatusLotacaoRotacao();
    fetch('/api/rotacao')
        .then(r => r.json())
        .then(data => {
            const prioridadeStatus = {
                'SAIDA_IMEDIATA': 1,
                'ABAIXO_MINIMO': 2,
                'PROXIMO_SAIDA': 3,
                'EM_OCUPACAO': 4,
                'APTO_ENTRADA': 5,
                'EM_DESCANSO': 6,
                'SEM_ALTURA': 7,
                'BLOQUEADO': 8
            };

            data.sort((a, b) => {
                const sa = a.status_detalhes?.status || '';
                const sb = b.status_detalhes?.status || '';
                const pa = prioridadeStatus[sa] || 99;
                const pb = prioridadeStatus[sb] || 99;
                if (pa !== pb) return pa - pb;

                const progA = a.status_detalhes?.progresso_descanso ?? null;
                const progB = b.status_detalhes?.progresso_descanso ?? null;
                if (progA !== null && progB !== null && progA !== progB) return progB - progA;

                const altA = a.altura_estimada ?? a.altura_real_medida ?? null;
                const altB = b.altura_estimada ?? b.altura_real_medida ?? null;
                if (altA !== null && altB !== null) {
                    if (sa === 'ABAIXO_MINIMO') return altA - altB;
                    return altB - altA;
                }

                return (a.nome || '').localeCompare(b.nome || '');
            });

            const counts = {
                'APTO_ENTRADA': 0,
                'EM_OCUPACAO': 0,
                'EM_DESCANSO': 0,
                'PROXIMO_SAIDA': 0,
                'SAIDA_IMEDIATA': 0,
                'BLOQUEADO': 0
            };
            
            data.forEach(item => {
                const { status } = item.status_detalhes;
                if (counts.hasOwnProperty(status)) counts[status]++;
            });
            
            document.getElementById('count-apto').textContent = counts['APTO_ENTRADA'];
            document.getElementById('count-ocupacao').textContent = counts['EM_OCUPACAO'];
            document.getElementById('count-descanso').textContent = counts['EM_DESCANSO'];
            document.getElementById('count-proximo').textContent = counts['PROXIMO_SAIDA'];
            document.getElementById('count-saida').textContent = counts['SAIDA_IMEDIATA'];
            document.getElementById('count-bloqueado').textContent = counts['BLOQUEADO'];
            // Garantir que o card "Prontos" acompanhe os aptos calculados na rotação
            const prontosCard = document.getElementById('prontos');
            if (prontosCard) prontosCard.textContent = counts['APTO_ENTRADA'];
            
            const porStatus = {
                'SAIDA_IMEDIATA': 'lista-saida',
                'PROXIMO_SAIDA': 'lista-proximo',
                'EM_OCUPACAO': 'lista-ocupacao',
                'APTO_ENTRADA': 'lista-apto',
                'EM_DESCANSO': 'lista-descanso',
                'BLOQUEADO': 'lista-bloqueado',
                'ABAIXO_MINIMO': 'lista-abaixo',
                'SEM_ALTURA': 'lista-sem_altura'
            };
            
            Object.keys(porStatus).forEach(status => {
                const containerId = porStatus[status];
                const sectionId = 'section-' + containerId.split('-')[1];
                const items = data.filter(d => d.status_detalhes.status === status);
                
                const section = document.getElementById(sectionId);
                if (section) section.style.display = items.length > 0 ? 'block' : 'none';
                
                const container = document.getElementById(containerId);
                if (container) container.innerHTML = items.map(item => renderCard(item)).join('');
            });
        });
}

function renderCard(item) {
    const s = item.status_detalhes;
    const statusClass = s.status.toLowerCase();
    const temLotes = item.lotes_no_piquete && item.lotes_no_piquete.length > 0;
    const totalAnimais = temLotes ? item.lotes_no_piquete.reduce((sum, l) => sum + l.quantidade, 0) : 0;

    const fmtArea = (v) => (v || v === 0) ? `${Number(v).toFixed(1)} ha` : '-';
    const fmtAltura = (v) => (v || v === 0) ? `${Number(v).toFixed(1)} cm` : '-';
    const fmtLotacao = (total, area) => (total && area > 0) ? `${((total * 450 / area) / 1000).toFixed(2)} UA/ha` : '0.00 UA/ha';

    const dataMedicao = item.data_medicao ? new Date(item.data_medicao) : null;
    const diasDesdeMedicao = dataMedicao ? Math.max(0, Math.floor((new Date() - dataMedicao) / (1000 * 60 * 60 * 24))) : null;
    const dataMedicaoTexto = dataMedicao ? `${dataMedicao.toLocaleDateString('pt-BR')}${diasDesdeMedicao !== null ? ` • há ${diasDesdeMedicao} dias` : ''}` : null;

    const lotacao = fmtLotacao(totalAnimais, item.area);
    const animaisBadge = temLotes ? `<span style="background: #007bff; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; margin-left: 5px;"><i class="fa-solid fa-cow"></i> ${totalAnimais}</span>` : '';

    let loteInfoHTML = '';
    if (temLotes) {
        const lotesHTML = item.lotes_no_piquete.map(l => `
            <div style="padding: 6px 0; border-bottom: 1px solid #eee;">
                <strong style="color: #007bff;"><i class="fa-solid fa-layer-group"></i> ${l.nome || 'Sem nome'}</strong>
                ${l.categoria ? `<span style="background: #6c757d; color: white; padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 5px;">${l.categoria}</span>` : ''}
                <span style="color: #28a745; margin-left: 8px;"><i class="fa-solid fa-cow"></i> ${l.quantidade} animais</span>
            </div>`).join('');

        loteInfoHTML = `<div style="margin-top: 8px; padding: 10px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 8px; font-size: 0.8rem; border-left: 3px solid #007bff;">
            <div style="margin-bottom: 8px;"><strong style="color: #007bff;"><i class="fa-solid fa-layer-group"></i> Lote(s) neste piquete:</strong></div>
            ${lotesHTML}
            <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 0.75rem;">
                <span><strong><i class="fa-solid fa-cow"></i> Total:</strong> ${totalAnimais} animais</span>
                <span><strong><i class="fa-solid fa-ruler-combined"></i> Área:</strong> ${fmtArea(item.area)}</span>
                <span><strong><i class="fa-solid fa-chart-line"></i> Lotação:</strong> ${lotacao}</span>
            </div>
        </div>`;
    } else {
        loteInfoHTML = '';
    }

    return `<div class="piquete-card ${statusClass}">
        <div class="piquete-info">
            <h4>${item.nome} ${animaisBadge}</h4>
            <p>${item.capim} • ${fmtArea(item.area)}</p>
            <div class="piquete-meta">
                <span><i class="fa-solid fa-location-dot"></i> ${s.pergunta_1 || '-'}</span>
                <span><i class="fa-solid fa-clock"></i> ${s.pergunta_3 || '-'}</span>
            </div>
            <div class="piquete-meta" style="margin-top: 5px;">
                ${item.altura_real_medida ? `<span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;"><i class="fa-solid fa-ruler-vertical"></i> ${fmtAltura(item.altura_real_medida)} (MEDIDA)</span>` : ''}
                <span style="background: #6c757d; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;"><i class="fa-solid fa-ruler-combined"></i> Est: ${fmtAltura(item.altura_estimada || 0)}</span>
                ${dataMedicaoTexto ? `<span style="font-size: 0.7rem; color: #666; margin-left: 5px;">Última medição: ${dataMedicaoTexto}</span>` : ''}
            </div>
            ${loteInfoHTML}
        </div>
        <div class="acao">
            <span class="status-badge ${statusClass}">${s.emoji} ${s.status.replace('_', ' ')}</span>
            <div class="acao-texto ${statusClass}">${s.acao}</div>
            ${s.progresso_descanso ? `<div class="progress"><div class="progress-bar descanso" style="width: ${s.progresso_descanso}%"></div></div><div style="font-size: 0.7rem; color: #666; margin-top: 3px;">${s.pergunta_3 || ''}</div>` : ''}
        </div>
    </div>`;
}

function verificarPassouPonto() {
    fetch('/api/rotacao/verificar-passou-ponto')
        .then(r => r.json())
        .then(data => {
            if (data.length > 0) {
                let msg = '<i class="fa-solid fa-triangle-exclamation"></i> PASSOU DO PONTO:\n\n';
                data.forEach(a => msg += `• ${a.nome}: ${a.mensagem}\n`);
                alert(msg);
            } else {
                alert('<i class="fa-solid fa-check"></i> Nenhum piquete passou do ponto!');
            }
        });
}

function carregarDataTeste() {
    fetch('/api/data-teste')
        .then(r => r.json())
        .then(data => {
            const display = document.getElementById('data-teste-display');
            const valor = document.getElementById('data-teste-valor');
            if (display && valor) {
                valor.textContent = data.data_formatada;
                if (data.modo === 'teste') {
                    display.style.borderColor = 'rgba(255, 193, 7, 0.5)';
                    valor.style.color = '#00d9ff';
                } else {
                    display.style.borderColor = 'rgba(40, 167, 69, 0.5)';
                    valor.style.color = '#28a745';
                }
            }
        });
}

function carregarStatusLotacaoRotacao() {
    if (typeof fazendaId === 'undefined') return;
    fetch(`/api/lotacao/${fazendaId}`)
        .then(r => r.json())
        .then(data => {
            const el = document.getElementById('lotacao-status-rotacao');
            if (!el) return;
            el.textContent = data?.status_lotacao || '-';
        })
        .catch(() => {
            const el = document.getElementById('lotacao-status-rotacao');
            if (el) el.textContent = '-';
        });
}

function toggleDetalhesLotacaoRotacao() {
    const box = document.getElementById('lotacao-detalhes-rotacao');
    const lista = document.getElementById('lotacao-detalhes-rotacao-lista');
    if (!box || !lista || typeof fazendaId === 'undefined') return;

    const aberto = box.style.display === 'block';
    box.style.display = aberto ? 'none' : 'block';
    if (aberto) return;

    lista.textContent = 'Carregando...';
    fetch(`/api/lotacao/baixa-lotes/${fazendaId}`)
        .then(r => r.json())
        .then(data => {
            if (!Array.isArray(data) || data.length === 0) {
                lista.innerHTML = '<em>Nenhum lote com lotação baixa.</em>';
                return;
            }
            const html = data.map(l => `
                <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #eee;">
                    <div><strong>${l.nome}</strong> • ${l.piquete_nome || '-'} • ${Number(l.area || 0).toFixed(1)} ha</div>
                    <div>${l.quantidade} animais • ${l.taxa_animais_ha} animais/ha</div>
                </div>
            `).join('');
            lista.innerHTML = html;
        })
        .catch(() => {
            lista.innerHTML = '<em>Erro ao carregar detalhes.</em>';
        });
}

window.addEventListener('load', () => {
    atualizar();
    carregarDataTeste();
    const card = document.getElementById('lotacao-status-card');
    if (card) card.addEventListener('click', toggleDetalhesLotacaoRotacao);
});
