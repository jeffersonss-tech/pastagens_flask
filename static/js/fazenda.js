// PastoFlow - Lógica do Dashboard da Fazenda

let map, mapDesenho, layerGroup;
let pontos = [];
let piquetes = [];
let animais = [];
let mapDesenhoInit = false;
window._climaFatorAtual = 1.0;

function getCrescimentoComClima(capim) {
    const fator = window._climaFatorAtual || 1.0;

    if (typeof getCrescimentoCapimReal === 'function') {
        return getCrescimentoCapimReal(capim);
    }

    if (typeof getCrescimentoCapim === 'function') {
        const base = getCrescimentoCapim(capim);
        return +(base * fator).toFixed(2);
    }

    return +(1.2 * fator).toFixed(2);
}

// Variáveis globais esperadas (injetadas via HTML):
// fazendaId, mapaLat, mapaLng, fazendaNome, temSede

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const icon = document.getElementById('toggle-icon');
    const isCollapsed = sidebar.classList.toggle('collapsed');
    
    // Salvar preferência
    localStorage.setItem('sidebarCollapsed', isCollapsed);
    
    // Atualizar ícone
    icon.className = isCollapsed ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-left';
    
    // Forçar redimensionamento dos mapas se existirem
    setTimeout(() => {
        if (typeof map !== 'undefined' && map) map.invalidateSize();
        if (typeof mapPiquetes !== 'undefined' && mapPiquetes) mapPiquetes.invalidateSize();
    }, 300);
}

// Aplicar preferência ao carregar
document.addEventListener('DOMContentLoaded', () => {
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
        const sidebar = document.getElementById('sidebar');
        const icon = document.getElementById('toggle-icon');
        if (sidebar) sidebar.classList.add('collapsed');
        if (icon) icon.className = 'fa-solid fa-chevron-right';
    }
});

function showSection(id) {
    // Verificar se estamos na página da fazenda (onde as seções existem)
    const targetSection = document.getElementById(id + '-section');
    if (!targetSection) {
        // Se a seção não existe nesta página (ex: estamos na página de Lotes), redireciona
        window.location.href = '/fazenda/' + fazendaId + '#' + id;
        return;
    }

    // Atualizar a URL sem recarregar a página
    history.pushState(null, null, '#' + id);

    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    
    // Tentar ativar o item de menu baseado no ID da seção ou no evento
    if (typeof event !== 'undefined' && event && event.target && event.target.closest) {
        const menuItem = event.target.closest('.menu-item');
        if (menuItem) menuItem.classList.add('active');
    } else {
        // Fallback: busca pelo ícone se não houver evento (ex: carregamento via URL)
        const sectionIcons = { 'dashboard': '📊', 'piquetes': '📍', 'movimentacao': '🔄', 'relatorios': '📈' };
        if (sectionIcons[id]) {
            document.querySelectorAll('.menu-item').forEach(item => {
                if (item.textContent.includes(sectionIcons[id])) item.classList.add('active');
            });
        }
    }
    
    document.querySelectorAll('[id$="-section"]').forEach(s => s.style.display = 'none');
    targetSection.style.display = 'block';
    
    if (id === 'piquetes') {
        setTimeout(() => {
            if (typeof initMapPiquetes === 'function') {
                initMapPiquetes();
                if (typeof drawAllPiquetes === 'function') {
                    drawAllPiquetes();
                }
            }
            if (typeof atualizarClimaAtualUI === 'function') {
                atualizarClimaAtualUI();
            }
        }, 200);
    }
}

// Maps
function initMap() {
    map = L.map('map', {minZoom: 10, maxZoom: 17}).setView([mapaLat, mapaLng], 14);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {attribution: 'Esri'}).addTo(map);
    
    if (temSede) {
        L.marker([mapaLat, mapaLng], {
            icon: L.divIcon({
                className: 'fazenda-marker',
                html: '🏠',
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            })
        }).addTo(map).bindPopup(`<strong>${fazendaNome}</strong><br>Sede da fazenda`).openPopup();
    }
}

function drawAllPiquetesOnMap() {
    if (!map) return;
    
    map.eachLayer(function(layer) {
        if (layer instanceof L.Polygon || (layer instanceof L.Marker && layer.options?.icon?.options?.className === 'piquete-label')) {
            map.removeLayer(layer);
        }
    });
    
    piquetes.forEach(p => {
        if (p.geometria) {
            try {
                const geo = JSON.parse(p.geometria);
                if (geo.type === 'Polygon' && geo.coordinates && geo.coordinates.length > 0) {
                    const coords = geo.coordinates[0].map(c => [c[1], c[0]]); 
                    
                    let corPoligono = '#28a745'; 
                    const temReal = p.altura_real_medida !== null && p.altura_real_medida !== undefined;
                    const temAlgumaAltura = temReal || (p.altura_estimada !== null && p.altura_estimada !== undefined);
                    const fonteAlt = p.fonte_altura || 'estimada';
                    
                    if (!temAlgumaAltura) {
                        corPoligono = '#fd7e14'; 
                    } else if (p.estado === 'ocupado') {
                        corPoligono = '#dc3545'; 
                    } else if (p.altura_estimada >= p.altura_entrada) {
                        corPoligono = '#28a745'; 
                    } else if (temReal && p.altura_real_medida >= p.altura_entrada) {
                        corPoligono = '#28a745'; 
                    } else {
                        corPoligono = '#ffc107'; 
                    }
                    
                    const animaisInfo = p.animais_no_piquete > 0 
                        ? `<br><strong style="color:#007bff;">🐄 ${p.animais_no_piquete} animal(is)</strong>` 
                        : '';
                    
                    const badgeFonte = fonteAlt === 'real'
                        ? '<br><span style="background:#28a745;color:white;padding:2px 6px;border-radius:8px;font-size:0.75rem;">📏 MEDIDA</span>'
                        : '<br><span style="background:#fd7e14;color:white;padding:2px 6px;border-radius:8px;font-size:0.75rem;">📐 ESTIMADA</span>';
                    
                    let diasInfo = '';
                    if (!temAlgumaAltura) {
                        diasInfo = `<br>⚠️ Aguardando altura`;
                    } else if (p.estado === 'ocupado') {
                        diasInfo = `<br>📊 ${p.dias_tecnicos || 0} dias técnicos${badgeFonte}`;
                        if (p.altura_estimada) {
                            diasInfo += `<br>📏 Altura: ${p.altura_estimada}/${p.altura_entrada || '?'} cm`;
                        }
                    } else if (p.altura_estimada >= p.altura_entrada) {
                        diasInfo = `<br>🟢 APTO para entrada${badgeFonte}`;
                        if (p.altura_estimada) {
                            diasInfo += `<br>📏 Altura: ${p.altura_estimada} cm`;
                        }
                    } else {
                        const diasDescanso = p.dias_descanso || 0;
                        const diasMin = p.dias_descanso_min || 30;
                        const faltam = Math.max(0, diasMin - diasDescanso);
                        diasInfo = `<br>🔄 ${diasDescanso}/${diasMin} dias (falta ${faltam})${badgeFonte}`;
                        if (p.altura_estimada) {
                            diasInfo += `<br>📏 Altura: ${p.altura_estimada}/${p.altura_entrada || '?'} cm`;
                        }
                    }
                    
                    const avisoUrgente = (p.animais_no_piquete > 0 && p.altura_estimada && p.altura_estimada < p.altura_entrada)
                        ? `<br><strong style="color:#dc3545;">🚨 AVISO: Remova urgentemente!</strong>`
                        : '';
                    
                    const polygon = L.polygon(coords, {
                        color: corPoligono,
                        weight: 3,
                        fill: true,
                        fillOpacity: 0.4
                    }).addTo(map).bindPopup(`
                        <strong style="font-size:14px;">${p.nome}</strong><br>
                        <strong>🌿 ${p.capim || 'N/I'}</strong>${animaisInfo}<br>
                        📐 ${p.area || 0} hectares<br>
                        📏 ${p.altura_estimada || '?'}/${p.altura_entrada || '?'} cm${badgeFonte}${diasInfo}${avisoUrgente}
                    `);
                    
                    if (coords.length > 0) {
                        let latSum = 0, lngSum = 0;
                        coords.forEach(c => { latSum += c[0]; lngSum += c[1]; });
                        const centerLat = latSum / coords.length;
                        const centerLng = lngSum / coords.length;
                        
                        const label = L.divIcon({
                            className: 'piquete-label',
                            html: `<div style="background:rgba(255,255,255,0.9);padding:2px 6px;border-radius:4px;font-size:11px;font-weight:bold;color:#1a1a2e;text-shadow:1px 1px 0 #fff;box-shadow:0 1px 3px rgba(0,0,0,0.2);">${p.nome}</div>`,
                            iconSize: [80, 20],
                            iconAnchor: [40, 10]
                        });
                        L.marker([centerLat, centerLng], {icon: label}).addTo(map);
                    }
                }
            } catch (e) {
                console.log('Erro ao desenhar poligono', p.id);
            }
        }
    });
}

function loadAll() {
    fetch('/api/piquetes?fazenda_id=' + fazendaId).then(r => r.json()).then(data => {
        piquetes = data;
        const listaPiquetes = document.getElementById('lista-piquetes');
        if (listaPiquetes) {
            listaPiquetes.innerHTML = data.map(p => {
                const temReal = p.altura_real_medida !== null && p.altura_real_medida !== undefined;
                const temAlgumaAltura = temReal || (p.altura_estimada !== null && p.altura_estimada !== undefined);
                const fonteAlt = p.fonte_altura || 'estimada';
                const alturaMostrada = temReal ? p.altura_real_medida : p.altura_estimada;
                const animaisNoPiquete = p.animais_no_piquete > 0;
                
                let badgeClass = '';
                let badgeText = '';
                let statusInfo = '';
                let alertaUrgente = '';
                let diasRestantes = '';
                let badgeFonte = fonteAlt === 'real' 
                    ? '<span style="background:#28a745;color:white;padding:1px 5px;border-radius:8px;font-size:0.7rem;margin-left:3px;">MEDIDA</span>'
                    : '<span style="background:#fd7e14;color:white;padding:1px 5px;border-radius:8px;font-size:0.7rem;margin-left:3px;">ESTIMADA</span>';
                
                if (!temReal) {
                    if (!temAlgumaAltura) {
                        badgeClass = 'badge-yellow';
                        badgeText = '⚠️ SEM ALTURA';
                        statusInfo = '<small style="color: #856404;">Adicione a altura medida</small>';
                    } else {
                        badgeClass = 'badge-yellow';
                        badgeText = '⚠️ PRECISA MEDIR';
                        statusInfo = `<small style="color: #fd7e14;">📏 ${alturaMostrada}cm (estimada) - <a href="#" onclick="fecharModal('modal-ver-piquete'); setTimeout(()=>abrirModalEditarPiquete(${p.id}),300);return false;" style="color:#007bff;">Atualizar medição</a></small>`;
                    }
                } else if (p.estado === 'ocupado') {
                    const diasTecnicos = p.dias_tecnicos || 30;
                    const diasOcupados = p.dias_no_piquete || 0; 
                    if (diasOcupados >= diasTecnicos) {
                        badgeClass = 'badge-red';
                        badgeText = '🔴 SAIDA IMEDIATA';
                        statusInfo = `<small style="color: #dc3545;">⚠️ Tempo tecnico ultrapassado!</small>`;
                        if (animaisNoPiquete) {
                            alertaUrgente = `
                                <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 8px; margin-top: 8px; text-align: center;">
                                    <strong style="color: #856404;">⚠️ Tempo tecnico! ${diasOcupados}/${diasTecnicos} dias</strong><br>
                                    <a href="/fazenda/${fazendaId}/lotes" class="btn btn-warning btn-sm" style="margin-top: 5px; font-size: 0.8rem;">🔄 Ir para Lotes</a>
                                </div>
                            `;
                        }
                    } else {
                        badgeClass = 'badge-blue';
                        badgeText = '🔵 Em Occupacao';
                        statusInfo = `<small style="color: #007bff;">📏 ${p.altura_estimada || '?'}cm (est.)</small>`;
                    }
                } else if (p.altura_estimada >= p.altura_entrada) {
                    badgeClass = 'badge-green';
                    badgeText = '🟢 Disponível';
                    statusInfo = `<small style="color: #28a745;">📏 ${p.altura_estimada}cm (estimada)</small>`;
                } else if (temReal && p.altura_real_medida >= p.altura_entrada) {
                    badgeClass = 'badge-green';
                    badgeText = '🟢 Disponível';
                    statusInfo = `<small style="color: #28a745;">📏 ${p.altura_real_medida}cm (medida)</small>`;
                } else {
                    const alturaBase = Math.max(p.altura_real_medida || 0, p.altura_estimada || 0);
                    badgeClass = 'badge-orange';
                    badgeText = '🔄 Recuperando';
                    statusInfo = `<small style="color: #c45a00;">📏 ${alturaBase}/${p.altura_entrada} cm ${badgeFonte}</small>`;
                    if (animaisNoPiquete) {
                        alertaUrgente = `
                            <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 8px; margin-top: 8px; text-align: center;">
                                <strong style="color: #856404;">⚠️ ${p.animais_no_piquete} animal(is) em recuperação!</strong><br>
                                <a href="/fazenda/${fazendaId}/lotes" class="btn btn-warning btn-sm" style="margin-top: 5px; font-size: 0.8rem;">🔄 Ir para Lotes</a>
                            </div>
                        `;
                    }
                    if (!temAlgumaAltura) {
                        diasRestantes = '';
                    } else if (p.estado === 'ocupado') {
                        diasRestantes = `<small style="color: #004085;">📊 ${p.dias_tecnicos || 0} dias técnicos</small>`;
                    } else if (alturaMostrada >= p.altura_entrada) {
                        diasRestantes = `<small style="color: #155724;">✅ Pronto para receber!</small>`;
                    } else {
                        const alturaBase = Math.max(p.altura_real_medida || 0, p.altura_estimada || 0);
                        const diasDescanso = p.dias_descanso || 0;
                        const crescimento = getCrescimentoComClima(p.capim);
                        const faltaCm = Math.max(0, p.altura_entrada - alturaBase);
                        const diasNecessarios = Math.round(faltaCm / crescimento);
                        const limiteMaximo = 30; 
                        const progresso = Math.min(100, (diasDescanso / Math.max(1, diasNecessarios)) * 100);
                        const alertaIneficiencia = diasDescanso > limiteMaximo;
                        if (faltaCm > 0) {
                            diasRestantes = `
                                <div style="margin-top: 8px;">
                                    <small style="color: #856404;">📅 ~${diasNecessarios} dia${diasNecessarios !== 1 ? 's' : ''} necessário${diasNecessarios !== 1 ? 's' : ''} ${badgeFonte}</small><br>
                                    <small style="color: #6c757d;">📈 ${crescimento} cm/dia | Falta: ${faltaCm}cm</small>
                                    <div style="background: #e9ecef; border-radius: 10px; height: 8px; margin-top: 5px; overflow: hidden;">
                                        <div style="background: linear-gradient(90deg, #ffc107, #28a745); width: ${progresso}%; height: 100%;"></div>
                                    </div>
                                    ${alertaIneficiencia ? `<small style="color: #dc3545;">⚠️ Ineficiência! Passou de ${limiteMaximo} dias</small>` : ''}
                                </div>
                            `;
                        } else {
                            diasRestantes = `<small style="color: #28a745;">✅ Descanso completo!</small>`;
                        }
                    }
                }
                
                let cardClass = 'piquete-card';
                if (!temAlgumaAltura) {
                    cardClass += ' sem-altura';
                } else if (p.estado === 'ocupado') {
                    cardClass += ' ocupado';
                } else if (p.altura_estimada >= p.altura_entrada) {
                    cardClass += ' disponivel';
                } else if (temReal && p.altura_real_medida >= p.altura_entrada) {
                    cardClass += ' disponivel';
                } else {
                    cardClass += ' recuperando';
                }
                
                return `
                <div class="${cardClass}" onclick="mostrarPiquete(${p.id})" style="cursor:pointer">
                    <h4>${p.nome}</h4>
                    <p>📐 ${p.area || 0} hectares</p>
                    <p>🌿 ${p.capim || 'N/I'}</p>
                    ${animaisNoPiquete ? `<p style="color: #007bff;"><strong>🐄 ${p.animais_no_piquete} animal(is)</strong></p>` : ''}
                    ${p.dias_tecnicos ? `<p style="color: #007bff;"><strong>📊 ${p.dias_tecnicos} dias técnicos</strong></p>` : ''}
                    <span class="badge ${badgeClass}">${badgeText}</span>
                    ${statusInfo ? `<br>${statusInfo}` : ''}
                    ${p.altura_real_medida ? `<small style="color: #28a745;">📏 ${p.altura_real_medida}cm (medida)</small>` : ''}
                    ${p.data_medicao ? `<small style="color: #999; font-size: 0.7rem;"><br>📅 ${new Date(p.data_medicao).toLocaleDateString('pt-BR')}</small>` : ''}
                    ${diasRestantes}
                    ${alertaUrgente}
                    <div style="margin-top: 10px; display: flex; gap: 5px;">
                        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); abrirModalEditarPiquete(${p.id})">✏️ Editar</button>
                        <button class="btn btn-sm" style="background:#6c757d;color:white" onclick="event.stopPropagation(); mostrarPiquete(${p.id})">👁️ Ver</button>
                    </div>
                </div>
                `;
            }).join('');
        }
        
        if (typeof drawAllPiquetes === 'function') {
            drawAllPiquetes();
        }
    });
    
    fetch('/api/animais?fazenda_id=' + fazendaId).then(r => r.json()).then(data => {
        animais = data;
        const listaLotes = document.getElementById('lista-lotes');
        if (listaLotes) {
            listaLotes.innerHTML = data.map(a => `
                <tr><td>${a.nome}</td><td>${a.quantidade || 0}</td><td>${a.categoria || '-'}</td><td>${a.peso_medio || 0} kg</td></tr>
            `).join('');
        }
        
        const movAnimal = document.getElementById('mov-animal');
        if (movAnimal) {
            const opts = data.map(a => `<option value="${a.id}">${a.nome}</option>`).join('');
            movAnimal.innerHTML = '<option value="">Selecione...</option>' + opts;
        }
    });
    
    fetch('/api/movimentacoes?fazenda_id=' + fazendaId).then(r => r.json()).then(data => {
        const histMov = document.getElementById('historico-mov');
        if (histMov) {
            histMov.innerHTML = data.slice(0, 10).map(m => `
                <tr><td>${new Date(m.data_movimentacao).toLocaleDateString()}</td><td>${m.animal_nome || '-'}</td><td>${m.origem_nome || '-'}</td><td>${m.destino_nome || '-'}</td><td>${m.motivo || '-'}</td></tr>
            `).join('');
        }
        const ultMov = document.getElementById('ultimas-mov');
        if (ultMov) {
            ultMov.innerHTML = data.slice(0, 5).map(m => `
                <tr><td>${m.animal_nome || '-'}</td><td>${m.origem_nome || '-'}</td><td>${m.destino_nome || '-'}</td><td>${new Date(m.data_movimentacao).toLocaleDateString()}</td></tr>
            `).join('');
        }
    });
    
    fetch('/api/piquetes?fazenda_id=' + fazendaId).then(r => r.json()).then(data => {
        const opts = data.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
        const movOrigem = document.getElementById('mov-origem');
        if (movOrigem) movOrigem.innerHTML = '<option value="">Nenhum</option>' + opts;
        const movDestino = document.getElementById('mov-destino');
        if (movDestino) movDestino.innerHTML = '<option value="">Selecione...</option>' + opts;
        
        if (map) {
            drawAllPiquetesOnMap();
        }
    });
}

function abrirModalLote() {
    document.getElementById('modal-lote').classList.add('active');
    if (typeof carregarPiquetesSelect === 'function') {
        carregarPiquetesSelect();
    }
}
function fecharModalLote() { document.getElementById('modal-lote').classList.remove('active'); }

function novaMovimentacao() {
    const animal_id = document.getElementById('mov-animal').value;
    if (!animal_id) return alert('Selecione um animal!');
    
    fetch('/api/movimentacoes', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            animal_id: parseInt(animal_id),
            piquete_origem_id: document.getElementById('mov-origem').value || null,
            piquete_destino_id: document.getElementById('mov-destino').value || null,
            quantidade: 1
        })
    }).then(r => r.json()).then(data => {
        alert('Movimentação registrada!');
        loadAll();
    });
}

function geoLocalizacaoDashboard() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                map.setView([lat, lng], 16);
                L.marker([lat, lng], {
                    icon: L.divIcon({
                        className: 'custom-marker',
                        html: '📍',
                        iconSize: [30, 30],
                        iconAnchor: [15, 30]
                    })
                }).addTo(map).bindPopup('Sua localização').openPopup();
            },
            function(error) {
                alert('Erro ao obter localização: ' + error.message);
            }
        );
    } else {
        alert('Geolocalização não suportada pelo navegador!');
    }
}

function buscarEnderecoDashboard() {
    const endereco = document.getElementById('endereco-dashboard').value;
    if (!endereco) return alert('Digite um endereço!');
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(endereco)}&limit=1`;
    fetch(url).then(r => r.json()).then(data => {
        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            map.setView([lat, lon], 15);
            L.marker([lat, lon], {
                icon: L.divIcon({
                    className: 'custom-marker',
                    html: '📍',
                    iconSize: [30, 30],
                    iconAnchor: [15, 30]
                })
            }).addTo(map).bindPopup(data[0].display_name.substring(0, 80) + '...').openPopup();
        } else {
            alert('Endereço não encontrado!');
        }
    }).catch(e => {
        alert('Erro ao buscar endereço: ' + e.message);
    });
}

function carregarLotacao() {
    fetch('/api/lotacao/' + fazendaId)
        .then(r => r.json())
        .then(data => {
            if (data && data.ua_total !== undefined) {
                document.getElementById('lotacao-peso').textContent = (data.peso_total || 0).toLocaleString('pt-BR');
                document.getElementById('lotacao-ua').textContent = data.ua_total;
                document.getElementById('lotacao-lha').textContent = data.lotacao_ha;
                const lha = data.lotacao_ha;
                const statusEl = document.getElementById('lotacao-status');
                const msgEl = document.getElementById('lotacao-msg');
                if (lha < 2) {
                    statusEl.textContent = 'SUBUTILIZADO';
                    statusEl.style.color = '#1976d2';
                    msgEl.textContent = 'Pastagem com capacidade para mais';
                } else if (lha > 4) {
                    statusEl.textContent = 'SOBRECARGA';
                    statusEl.style.color = '#d32f2f';
                    msgEl.textContent = 'Atenção: lotação acima do limite!';
                } else {
                    statusEl.textContent = 'ÓTIMO';
                    statusEl.style.color = '#388e3c';
                    msgEl.textContent = 'Lotação adequada';
                }
            }
        }).catch(e => {
            console.log('Erro ao carregar lotação:', e);
        });
}

function injetarLotacaoUI() {
    const statsGrid = document.querySelector('.stats-grid');
    if (!statsGrid || document.getElementById('lotacao-peso')) return;
    const lotacaoHTML = document.createElement('div');
    lotacaoHTML.style.cssText = 'grid-column: span 4; display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 15px;';
    lotacaoHTML.innerHTML = `
        <div style="text-align: center; padding: 15px; background: #e3f2fd; border-radius: 10px;">
            <h5 style="color: #1976d2; margin-bottom: 8px;">Peso Total</h5>
            <strong id="lotacao-peso" style="font-size: 1.6rem; color: #1976d2;">0</strong>
            <p style="color: #666; font-size: 0.8rem;">kg</p>
        </div>
        <div style="text-align: center; padding: 15px; background: #e8f5e9; border-radius: 10px;">
            <h5 style="color: #388e3c; margin-bottom: 8px;">UA Total</h5>
            <strong id="lotacao-ua" style="font-size: 1.6rem; color: #388e3c;">0</strong>
            <p style="color: #666; font-size: 0.8rem;">1 UA = 450 kg</p>
        </div>
        <div style="text-align: center; padding: 15px; background: #fff3e0; border-radius: 10px;">
            <h5 style="color: #f57c00; margin-bottom: 8px;">L/ha</h5>
            <strong id="lotacao-lha" style="font-size: 1.6rem; color: #f57c00;">0</strong>
            <p style="color: #666; font-size: 0.8rem;">UA/hectare</p>
        </div>
        <div style="text-align: center; padding: 15px; background: #fce4ec; border-radius: 10px;">
            <h5 style="color: #c2185b; margin-bottom: 8px;">Status</h5>
            <strong id="lotacao-status" style="font-size: 1.1rem; color: #c2185b;">-</strong>
            <p style="color: #666; font-size: 0.75rem;" id="lotacao-msg">carregando...</p>
        </div>
    `;
    statsGrid.parentNode.insertBefore(lotacaoHTML, statsGrid.nextSibling);
    const ref = document.createElement('p');
    ref.style.cssText = 'color: #666; font-size: 0.8rem; margin-top: 12px; margin-bottom: 20px;';
    ref.innerHTML = '💡 <strong>Referência:</strong> 2-4 UA/ha = ideal | Abaixo de 2 = subutilizado | Acima de 4 = sobrecarga';
    lotacaoHTML.parentNode.insertBefore(ref, lotacaoHTML.nextSibling);
}

function atualizarClimaSidebar() {
    const sidebarEl = document.getElementById('clima-sidebar-valor');
    if (!sidebarEl || typeof fazendaId === 'undefined' || !fazendaId) return;

    fetch('/api/clima/condicao-atual?fazenda_id=' + fazendaId)
        .then(r => r.json())
        .then(data => {
            const cond = (data.condicao || 'normal').toUpperCase();
            const fator = data.fator !== undefined ? data.fator : 1.0;
            window._climaFatorAtual = parseFloat(fator) || 1.0;
            sidebarEl.textContent = `${cond} (fator ${fator})`;

            // Re-render dos cards para sincronizar com modal quando clima mudar
            if (document.getElementById('lista-piquetes') && typeof loadAll === 'function') {
                loadAll();
            }
        })
        .catch(() => {
            sidebarEl.textContent = 'Indisponível';
        });
}

window.onload = function() {
    const mapElement = document.getElementById('map');
    if (mapElement) {
        initMap();
        loadAll();
        injetarLotacaoUI();
        carregarLotacao();
        carregarAlertas();
    } else {
        console.log('Elemento #map não encontrado. Ignorando initMap().');
    }

    // Sempre atualizar sidebar (independente de tela)
    atualizarClimaSidebar();

    // Se existir função completa (piquetes), ela também atualiza topo da seção
    if (typeof atualizarClimaAtualUI === 'function') {
        atualizarClimaAtualUI();
    }
};

function carregarAlertas() {
    fetch('/api/alertas/contar').then(r => r.json()).then(data => {
        const badge = document.getElementById('alerta-badge');
        if (badge) {
            if (data.total > 0) {
                badge.textContent = data.total;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    });
}

setInterval(carregarAlertas, 30000);

function exibirAlertas() {
    fetch('/api/alertas').then(r => r.json()).then(alertas => {
        const container = document.getElementById('alertas-container');
        if (!container) return;
        if (alertas.length === 0) {
            container.innerHTML = '<p style="color: #666; text-align: center; padding: 30px;">Nenhum alerta! 🎉</p>';
            return;
        }
        container.innerHTML = alertas.map(a => `
            <div style="padding: 15px; border-bottom: 1px solid #eee; ${a.lido ? 'opacity: 0.5;' : 'background: #fff3cd;'}" onclick="marcarAlertaLido(${a.id})">
                <div style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                    <span style="font-size: 1.5rem;">${getEmojiAlerta(a.tipo)}</span>
                    <div style="flex: 1;">
                        <strong style="color: #1a1a2e; font-size: 0.95rem;">${a.titulo}</strong>
                        <p style="color: #666; font-size: 0.85rem; margin: 5px 0;">${a.mensagem}</p>
                        <small style="color: #999; font-size: 0.75rem;">${formatarData(a.created_at)}</small>
                    </div>
                    ${!a.lido ? '<span style="color: #dc3545; font-size: 0.8rem;">●</span>' : ''}
                </div>
            </div>
        `).join('');
    });
}

function getEmojiAlerta(tipo) {
    switch(tipo) {
        case 'ocupacao_max': return '⚠️';
        case 'pronto_entrada': return '🌿';
        case 'pronto_saida': return '🔔';
        default: return '📢';
    }
}

function formatarData(dataStr) {
    if (!dataStr) return '';
    const d = new Date(dataStr);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
}

function marcarAlertaLido(id) {
    fetch('/api/alertas/' + id + '/ler', {method: 'POST'}).then(r => r.json()).then(data => {
        if (data.status === 'ok') {
            carregarAlertas();
            exibirAlertas();
        }
    });
}

function abrirModalAlertas() {
    document.getElementById('modal-alertas').classList.add('active');
    exibirAlertas();
}

function fecharModalAlertas() {
    document.getElementById('modal-alertas').classList.remove('active');
}

function verificarAlertasManualmente() {
    fetch('/api/alertas/verificar', {method: 'POST'}).then(r => r.json()).then(data => {
        alert('Verificacao concluida! ' + (data.alertas_criados && data.alertas_criados.length > 0 ? data.alertas_criados.length + ' alertas criados' : 'Nenhum alerta novo'));
        carregarAlertas();
        exibirAlertas();
    });
}

function carregarDataTeste() {
    fetch('/api/data-teste').then(r => r.json()).then(data => {
        const display = document.getElementById('data-teste-display');
        const valor = document.getElementById('data-teste-valor');
        if (display && valor) {
            valor.textContent = data.data_formatada;
            if (data.modo === 'teste') {
                display.classList.remove('modo-real');
            } else {
                display.classList.add('modo-real');
            }
        }
    }).catch(() => {
        const valor = document.getElementById('data-teste-valor');
        if (valor) valor.textContent = 'Erro';
    });
}

carregarDataTeste();
