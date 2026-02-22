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
    fetch('/api/rotacao')
        .then(r => r.json())
        .then(data => {
            const counts = {
                'APTO_ENTRADA': 0,
                'EM_OCUPACAO': 0,
                'EM_DESCANSO': 0,
                'PROXIMO_SAIDA': 0,
                'SAIDA_IMEDIATA': 0,
                'BLOQUEADO': 0
            };
            
            data.forEach(item => {
                const status = item.status_detalhes.status;
                if (counts.hasOwnProperty(status)) counts[status]++;
            });
            
            document.getElementById('count-apto').textContent = counts['APTO_ENTRADA'];
            document.getElementById('count-ocupacao').textContent = counts['EM_OCUPACAO'];
            document.getElementById('count-descanso').textContent = counts['EM_DESCANSO'];
            document.getElementById('count-proximo').textContent = counts['PROXIMO_SAIDA'];
            document.getElementById('count-saida').textContent = counts['SAIDA_IMEDIATA'];
            document.getElementById('count-bloqueado').textContent = counts['BLOQUEADO'];
            
            const porStatus = {
                'SAIDA_IMEDIATA': 'lista-saida',
                'PROXIMO_SAIDA': 'lista-proximo',
                'EM_OCUPACAO': 'lista-ocupacao',
                'APTO_ENTRADA': 'lista-apto',
                'EM_DESCANSO': 'lista-descanso',
                'BLOQUEADO': 'lista-bloqueado'
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
    const lotacao = temLotes && item.area > 0 ? ((totalAnimais * 450 / item.area) / 1000).toFixed(2) : '0';
    
    const animaisBadge = temLotes ? `<span style="background: #007bff; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; margin-left: 5px;">🐄 ${totalAnimais}</span>` : '';
    
    let loteInfoHTML = '';
    if (temLotes) {
        const lotesHTML = item.lotes_no_piquete.map(l => `
            <div style="padding: 6px 0; border-bottom: 1px solid #eee;">
                <strong style="color: #007bff;">📦 ${l.nome || 'Sem nome'}</strong>
                ${l.categoria ? `<span style="background: #6c757d; color: white; padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 5px;">${l.categoria}</span>` : ''}
                <span style="color: #28a745; margin-left: 8px;">🐄 ${l.quantidade} animais</span>
            </div>`).join('');
        
        loteInfoHTML = `<div style="margin-top: 8px; padding: 10px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 8px; font-size: 0.8rem; border-left: 3px solid #007bff;">
            <div style="margin-bottom: 8px;"><strong style="color: #007bff;">📦 Lote(s) neste piquete:</strong></div>
            ${lotesHTML}
            <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 0.75rem;">
                <span><strong>🐄 Total:</strong> ${totalAnimais} animais</span>
                <span><strong>📐 Área:</strong> ${item.area} ha</span>
                <span><strong>📏 Lotação:</strong> ${lotacao} UA/ha</span>
            </div>
        </div>`;
    } else {
        loteInfoHTML = `<div style="margin-top: 8px; padding: 10px; background: #f8f9fa; border-radius: 8px; font-size: 0.8rem; color: #666;"><span style="color: #28a745;">✅ Piquete disponível</span> - Aguardando animais</div>`;
    }
    
    return `<div class="piquete-card ${statusClass}">
        <div class="piquete-info">
            <h4>${item.nome} ${animaisBadge}</h4>
            <p>${item.capim} • ${item.area} ha</p>
            <div class="piquete-meta">
                <span>📍 ${s.pergunta_1 || '-'}</span>
                <span>⏱️ ${s.pergunta_3 || '-'}</span>
            </div>
            <div class="piquete-meta" style="margin-top: 5px;">
                ${item.altura_real_medida ? `<span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">📏 ${item.altura_real_medida}cm (MEDIDA)</span>` : ''}
                <span style="background: #6c757d; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">📐 Est: ${item.altura_estimada || 0}cm</span>
                ${item.data_medicao ? `<span style="font-size: 0.7rem; color: #666; margin-left: 5px;">(Medido: ${new Date(item.data_medicao).toLocaleDateString('pt-BR')})</span>` : ''}
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
                let msg = '⚠️ PASSOU DO PONTO:\n\n';
                data.forEach(a => msg += `• ${a.nome}: ${a.mensagem}\n`);
                alert(msg);
            } else {
                alert('✅ Nenhum piquete passou do ponto!');
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

window.addEventListener('load', () => {
    atualizar();
    carregarDataTeste();
});