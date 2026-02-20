// PastoFlow - Lógica do Dashboard da Fazenda

let map, mapDesenho, layerGroup;
let pontos = [];
let piquetes = [];
let animais = [];
let mapPiquetes = null;
let mapDesenhoInit = false;

// Variáveis globais esperadas (injetadas via HTML):
// fazendaId, mapaLat, mapaLng, fazendaNome, temSede

function showSection(id) {
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    // Encontrar o item de menu clicado (ou o que disparou o evento)
    if (event && event.target) {
        event.target.closest('.menu-item').classList.add('active');
    }
    
    document.querySelectorAll('[id$="-section"]').forEach(s => s.style.display = 'none');
    document.getElementById(id + '-section').style.display = 'block';
    
    if (id === 'piquetes') {
        setTimeout(() => {
            if (!mapPiquetes) {
                mapPiquetes = L.map('map-piquetes', {minZoom: 10, maxZoom: 17}).setView([mapaLat, mapaLng], 15);
                L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {attribution: 'Esri'}).addTo(mapPiquetes);
            }
            mapPiquetes.invalidateSize();
            drawAllPiquetes();  
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

function initMapPiquetes() {
    if (!mapPiquetes) {
        mapPiquetes = L.map('map-piquetes', {minZoom: 10, maxZoom: 17}).setView([mapaLat, mapaLng], 15);
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {attribution: 'Esri'}).addTo(mapPiquetes);
        
        if (temSede) {
            L.marker([mapaLat, mapaLng], {
                icon: L.divIcon({
                    className: 'fazenda-marker',
                    html: '🏠',
                    iconSize: [30, 30],
                    iconAnchor: [15, 30]
                })
            }).addTo(mapPiquetes).bindPopup(`<strong>${fazendaNome}</strong><br>Sede da fazenda`);
        }
    }
    mapPiquetes.invalidateSize();
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
        });
}

function initMapDesenho() {
    if (mapDesenhoInit) {
        layerGroup.clearLayers();
        drawPiquetesExistentes();
        setTimeout(() => mapDesenho.invalidateSize(), 200);
        return;
    }
    mapDesenho = L.map('map-desenho').setView([mapaLat, mapaLng], 15);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {attribution: 'Esri'}).addTo(mapDesenho);
    layerGroup = L.layerGroup().addTo(mapDesenho);
    
    drawPiquetesExistentes();
    
    mapDesenho.on('click', function(e) {
        pontos.push([e.latlng.lat, e.latlng.lng]);
        atualizarDesenho();
    });
    mapDesenhoInit = true;
    setTimeout(() => mapDesenho.invalidateSize(), 200);
}

function drawPiquetesExistentes() {
    piquetes.forEach(p => {
        if (p.geometria) {
            try {
                const geo = JSON.parse(p.geometria);
                if (geo.type === 'Polygon' && geo.coordinates && geo.coordinates.length > 0) {
                    const coords = geo.coordinates[0].map(c => [c[1], c[0]]);
                    L.polygon(coords, {
                        color: '#666',
                        weight: 2,
                        fill: true,
                        fillOpacity: 0.2
                    }).addTo(layerGroup).bindPopup(`${p.nome} (existente)`);
                }
            } catch (e) {}
        }
    });
}

function atualizarDesenho() {
    layerGroup.clearLayers();
    drawPiquetesExistentes();
    
    pontos.forEach((p, i) => {
        L.circleMarker([p[0], p[1]], {color: 'red', fillColor: 'red', fillOpacity: 1, radius: 6}).addTo(layerGroup);
    });
    if (pontos.length >= 2) {
        L.polyline(pontos, {color: 'red', weight: 2}).addTo(layerGroup);
    }
    if (pontos.length >= 3) {
        L.polygon(pontos, {color: '#228B22', weight: 3, fill: true, fillOpacity: 0.3}).addTo(layerGroup);
        const area = calcularAreaPolygon(pontos);
        document.getElementById('pq-area').value = area.toFixed(2);
        document.getElementById('pq-area').setAttribute('readonly', true);
        document.getElementById('pq-area').style.background = '#f5f5f5';
    } else {
        document.getElementById('pq-area').value = '0';
    }
}

function calcularAreaPolygon(coords) {
    let areaGraus = 0;
    const n = coords.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        areaGraus += coords[i][0] * coords[j][1];
        areaGraus -= coords[j][0] * coords[i][1];
    }
    areaGraus = Math.abs(areaGraus) / 2;
    let latMedia = 0;
    coords.forEach(p => latMedia += p[0]);
    latMedia /= coords.length;
    const kmPorGrauLat = 111.32;
    const kmPorGrauLng = 111.32 * Math.cos(latMedia * Math.PI / 180);
    const areaKm2 = areaGraus * kmPorGrauLat * kmPorGrauLng;
    return areaKm2 * 100; 
}

function loadAll() {
    fetch('/api/piquetes?fazenda_id=' + fazendaId).then(r => r.json()).then(data => {
        piquetes = data;
        document.getElementById('lista-piquetes').innerHTML = data.map(p => {
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
                    const crescimento = getCrescimentoCapim(p.capim);
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
        
        if (mapPiquetes) {
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
    
    fetch('/api/movimentacoes').then(r => r.json()).then(data => {
        document.getElementById('historico-mov').innerHTML = data.slice(0, 10).map(m => `
            <tr><td>${new Date(m.data_movimentacao).toLocaleDateString()}</td><td>${m.animal_nome || '-'}</td><td>${m.origem_nome || '-'}</td><td>${m.destino_nome || '-'}</td><td>${m.motivo || '-'}</td></tr>
        `).join('');
        document.getElementById('ultimas-mov').innerHTML = data.slice(0, 5).map(m => `
            <tr><td>${m.animal_nome || '-'}</td><td>${m.origem_nome || '-'}</td><td>${m.destino_nome || '-'}</td><td>${new Date(m.data_movimentacao).toLocaleDateString()}</td></tr>
        `).join('');
    });
    
    fetch('/api/piquetes?fazenda_id=' + fazendaId).then(r => r.json()).then(data => {
        const opts = data.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
        document.getElementById('mov-origem').innerHTML = '<option value="">Nenhum</option>' + opts;
        document.getElementById('mov-destino').innerHTML = '<option value="">Selecione...</option>' + opts;
        
        if (map) {
            drawAllPiquetesOnMap();
        }
    });
}

// Modals
function abrirModalPiquete() { 
    pontos = [];
    document.getElementById('pq-nome').value = '';
    document.getElementById('pq-capim').value = '';
    document.getElementById('pq-area').value = '0';
    document.getElementById('pq-altura-entrada').value = '0';
    document.getElementById('pq-altura-saida').value = '0';
    document.getElementById('pq-altura-atual').value = '';
    document.getElementById('pq-irrigado').value = 'nao';
    document.getElementById('pq-observacoes').value = '';
    
    document.getElementById('modal-piquete').classList.add('active'); 
    setTimeout(() => initMapDesenho(), 100); 
}
function fecharModalPiquete() { document.getElementById('modal-piquete').classList.remove('active'); }
function abrirModalLote() { document.getElementById('modal-lote').classList.add('active'); }
function fecharModalLote() { document.getElementById('modal-lote').classList.remove('active'); }
function abrirModalVerPiquete() { document.getElementById('modal-ver-piquete').classList.add('active'); }
function fecharModalVerPiquete() { document.getElementById('modal-ver-piquete').classList.remove('active'); }

function salvarPiquete() {
    const nome = document.getElementById('pq-nome').value || 'Piquete_' + Date.now();
    const coords = pontos.map(p => [p[1], p[0]]);
    coords.push(coords[0]);
    const dataMedicao = document.getElementById('pq-data-medicao').value || null;
    
    fetch('/api/piquetes', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            fazenda_id: fazendaId,
            nome,
            capim: document.getElementById('pq-capim').value,
            area: parseFloat(document.getElementById('pq-area').value) || 0,
            geometria: JSON.stringify({type: 'Polygon', coordinates: [coords]}),
            altura_entrada: parseFloat(document.getElementById('pq-altura-entrada').value) || 0,
            altura_saida: parseFloat(document.getElementById('pq-altura-saida').value) || 0,
            altura_atual: parseFloat(document.getElementById('pq-altura-atual').value) || null,
            data_medicao: dataMedicao,
            irrigado: document.getElementById('pq-irrigado').value || 'nao',
            observacao: document.getElementById('pq-observacoes').value || null
        })
    }).then(r => r.json()).then(data => {
        alert('Piquete salvo!');
        fecharModalPiquete();
        loadAll();
    });
}

function salvarLote() {
    const nome = document.getElementById('lote-nome').value;
    if (!nome) return alert('Digite o nome!');
    
    fetch('/api/animais', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            fazenda_id: fazendaId,
            nome,
            quantidade: parseInt(document.getElementById('lote-qtd').value) || 1,
            categoria: document.getElementById('lote-cat').value,
            peso_medio: parseFloat(document.getElementById('lote-peso').value) || 0
        })
    }).then(r => r.json()).then(data => {
        alert('Lote adicionado!');
        fecharModalLote();
        loadAll();
    });
}

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

function abrirModalEditarPiquete(id) {
    const p = piquetes.find(x => x.id === id);
    if (!p) return;
    
    document.getElementById('edit-pq-id').value = p.id;
    document.getElementById('edit-pq-nome').value = p.nome || '';
    document.getElementById('edit-pq-capim').value = p.capim || '';
    document.getElementById('edit-pq-area').value = p.area || 0;
    document.getElementById('edit-pq-altura-entrada').value = p.altura_entrada || 0;
    document.getElementById('edit-pq-altura-saida').value = p.altura_saida || 0;
    const alturaReal = p.altura_real_medida !== null && p.altura_real_medida !== undefined 
        ? p.altura_real_medida 
        : '';
    document.getElementById('edit-pq-altura-atual').value = alturaReal;
    document.getElementById('edit-pq-data-medicao').value = p.data_medicao || '';
    document.getElementById('edit-pq-irrigado').value = p.irrigado || 'nao';
    document.getElementById('edit-pq-observacoes').value = p.observacao || '';
    atualizarInfoCapimEdit();
    if (p.geometria) {
        document.getElementById('edit-pq-area').setAttribute('readonly', true);
        document.getElementById('edit-pq-area').style.background = '#f5f5f5';
    } else {
        document.getElementById('edit-pq-area').removeAttribute('readonly');
        document.getElementById('edit-pq-area').style.background = 'white';
    }
    document.getElementById('modal-editar-piquete').classList.add('active');
}

function atualizarInfoCapimEdit() {
    const capim = document.getElementById('edit-pq-capim').value;
    const infoDiv = document.getElementById('edit-info-capim');
    if (capim && dadosCapins[capim]) {
        const dados = dadosCapins[capim];
        infoDiv.innerHTML = `<strong>ℹ️ ${capim}</strong><br>${dados.descricao}`;
        infoDiv.style.display = 'block';
    } else {
        infoDiv.style.display = 'none';
    }
}

function validarSalvarEdicaoPiquete() {
    const nome = document.getElementById('edit-pq-nome').value.trim();
    const capim = document.getElementById('edit-pq-capim').value;
    const area = parseFloat(document.getElementById('edit-pq-area').value) || 0;
    const alturaEntrada = parseFloat(document.getElementById('edit-pq-altura-entrada').value) || 0;
    const alturaSaida = parseFloat(document.getElementById('edit-pq-altura-saida').value) || 0;
    const alturaAtual = document.getElementById('edit-pq-altura-atual').value.trim();
    const dataMedicao = document.getElementById('edit-pq-data-medicao').value.trim();
    if (!nome) return alert('❌ Informe o nome do piquete!');
    if (!capim) return alert('❌ Selecione o tipo de capim!');
    if (area <= 0) return alert('❌ A área deve ser maior que 0!');
    if (alturaEntrada <= 0) return alert('❌ Informe a altura de entrada!');
    if (alturaSaida <= 0) return alert('❌ Informe a altura mínima de saída!');
    if (alturaSaida >= alturaEntrada) return alert('❌ A altura de saída deve ser MENOR que a altura de entrada!');
    if (alturaAtual && !dataMedicao) return alert('❌ Se informar a Altura Atual, informe também a Data da Medição!');
    salvarEdicaoPiquete();
}

function fecharModalEditarPiquete() {
    document.getElementById('modal-editar-piquete').classList.remove('active');
}

function salvarEdicaoPiquete() {
    const id = document.getElementById('edit-pq-id').value;
    if (!id) return;
    const valorAltura = document.getElementById('edit-pq-altura-atual').value.trim();
    const dataMedicao = document.getElementById('edit-pq-data-medicao').value.trim();
    const p = piquetes.find(x => x.id == id);
    const alturaAnterior = p.altura_real_medida !== null && p.altura_real_medida !== undefined 
        ? p.altura_real_medida 
        : p.altura_atual;
    
    const bodyObj = {
        nome: document.getElementById('edit-pq-nome').value,
        capim: document.getElementById('edit-pq-capim').value,
        area: parseFloat(document.getElementById('edit-pq-area').value) || 0,
        altura_entrada: parseFloat(document.getElementById('edit-pq-altura-entrada').value) || 0,
        altura_saida: parseFloat(document.getElementById('edit-pq-altura-saida').value) || 0,
        data_medicao: dataMedicao || null,
        irrigado: document.getElementById('edit-pq-irrigado').value || 'nao',
        observacao: document.getElementById('edit-pq-observacoes').value || null
    };
    
    if (valorAltura === '') {
        bodyObj.altura_atual = null;
        bodyObj.data_medicao = null;
        bodyObj.limpar_altura = true;
    } else {
        const novaAltura = parseFloat(valorAltura);
        if (!isNaN(novaAltura) && novaAltura !== alturaAnterior) {
            bodyObj.altura_atual = novaAltura;
            if (!dataMedicao) {
                bodyObj.data_medicao = new Date().toISOString().split('T')[0];
            }
        }
    }
    
    fetch('/api/piquetes/' + id, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(bodyObj)
    }).then(r => r.json()).then(data => {
        if (data.status === 'ok') {
            alert('Piquete atualizado!');
            fecharModalEditarPiquete();
            loadAll();
        } else {
            alert('Erro ao atualizar!');
        }
    });
}

function excluirPiquete() {
    const id = document.getElementById('edit-pq-id').value;
    if (!id) return;
    if (!confirm('Tem certeza que deseja excluir este piquete?')) return;
    fetch('/api/piquetes/' + id, { method: 'DELETE' })
        .then(r => r.json()).then(data => {
            if (data.status === 'ok') {
                alert('Piquete excluído!');
                fecharModalEditarPiquete();
                loadAll();
            } else {
                alert('Erro ao excluir!');
            }
        });
}

function centralizarLocalizacao() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                mapDesenho.setView([lat, lng], 16);
                L.marker([lat, lng], {
                    icon: L.divIcon({
                        className: 'custom-marker',
                        html: '📍',
                        iconSize: [30, 30],
                        iconAnchor: [15, 30]
                    })
                }).addTo(mapDesenho).bindPopup('Sua localização').openPopup();
            },
            function(error) {
                alert('Erro ao obter localização: ' + error.message);
            }
        );
    } else {
        alert('Geolocalização não suportada pelo navegador!');
    }
}

function drawAllPiquetes() {
    if (!mapPiquetes) return;
    mapPiquetes.eachLayer(function(layer) {
        if (layer instanceof L.Polygon || (layer instanceof L.Marker && layer.options?.icon?.options?.className === 'piquete-label')) {
            mapPiquetes.removeLayer(layer);
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
                    let badgeClass = '';
                    let badgeText = '';
                    let statusInfo = '';
                    let diasRestantes = '';
                    if (!temAlgumaAltura) {
                        badgeClass = 'badge-yellow';
                        badgeText = '⚠️ SEM ALTURA';
                        statusInfo = '<small style="color: #856404;">Adicione a altura medida</small>';
                    } else if (p.estado === 'ocupado') {
                        badgeClass = 'badge-blue';
                        badgeText = '🔵 Em Ocupação';
                        statusInfo = `<small style="color: #007bff;">📏 ${p.altura_estimada || '?'}cm (est.)</small>`;
                    } else if (p.altura_estimada >= p.altura_entrada) {
                        badgeClass = 'badge-green';
                        badgeText = '🟢 Disponível';
                        statusInfo = `<small style="color: #28a745;">📏 ${p.altura_estimada}cm (estimada)</small>`;
                    } else if (temReal && p.altura_real_medida >= p.altura_entrada) {
                        badgeClass = 'badge-green';
                        badgeText = '🟢 Disponível';
                        statusInfo = `<small style="color: #28a745;">📏 ${p.altura_real_medida}cm (medida)</small>`;
                    } else {
                        badgeClass = 'badge-orange';
                        badgeText = '🔄 Recuperando';
                        statusInfo = `<small style="color: #c45a00;">📏 ${Math.max(p.altura_real_medida || 0, p.altura_estimada || 0)}/${p.altura_entrada} cm ${badgeFonte}</small>`;
                    }
                    if (!temAlgumaAltura) {
                        diasRestantes = '';
                    } else if (p.estado === 'ocupado') {
                        diasRestantes = `<br><small style="color: #004085;">📊 ${p.dias_tecnicos || 0} dias técnicos</small>`;
                    } else if (p.altura_estimada >= p.altura_entrada) {
                        diasRestantes = `<br><small style="color: #155724;">✅ Pronto para receber!</small>`;
                    } else {
                        const diasDescanso = p.dias_descanso || 0;
                        const crescimento = 1.2; 
                        const faltaCm = Math.max(0, p.altura_entrada - (p.altura_estimada || 0));
                        const diasNecessarios = Math.round(faltaCm / crescimento);
                        diasRestantes = `<br><small style="color: #856404;">📅 ~${diasNecessarios} dias necessário${diasNecessarios !== 1 ? 's' : ''} ${badgeFonte}</small><br><small style="color: #6c757d;">📈 ${crescimento} cm/dia | Falta: ${faltaCm}cm</small>`;
                    }
                    L.polygon(coords, {
                        color: corPoligono,
                        weight: 3,
                        fill: true,
                        fillOpacity: 0.4
                    }).addTo(mapPiquetes).bindPopup(`
                        <div style="min-width:200px;">
                            <strong style="font-size:14px;">${p.nome}</strong><br>
                            <span class="badge ${badgeClass}" style="font-size:0.7rem;">${badgeText}</span><br>
                            <p style="margin:5px 0;">📐 ${p.area || 0} hectares | 🌿 ${p.capim || 'N/I'}</p>
                            ${p.animais_no_piquete > 0 ? `<p style="color:#007bff;margin:5px 0;"><strong>🐄 ${p.animais_no_piquete} animal(is)</strong></p>` : ''}
                            ${p.altura_real_medida ? `<p style="color:#28a745;margin:5px 0;">📏 ${p.altura_real_medida}cm (medida)</p>` : ''}
                            ${p.data_medicao ? `<p style="color:#999;font-size:0.75rem;margin:5px 0;">📅 ${new Date(p.data_medicao).toLocaleDateString('pt-BR')}</p>` : ''}
                            ${statusInfo ? `<p style="margin:5px 0;">${statusInfo}</p>` : ''}
                            ${diasRestantes}
                            ${avisoUrgente}
                        </div>
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
                        L.marker([centerLat, centerLng], {icon: label}).addTo(mapPiquetes);
                    }
                }
            } catch (e) {
                console.log('Erro ao desenhar poligono no mapa de piquetes', p.id);
            }
        });
    });
}

function mostrarPiquete(id) {
    const p = piquetes.find(x => x.id === id);
    if (!p) return;
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    document.querySelector('.menu-item:nth-child(2)').classList.add('active');
    document.querySelectorAll('[id$="-section"]').forEach(s => s.style.display = 'none');
    document.getElementById('piquetes-section').style.display = 'block';
    setTimeout(() => {
        if (!mapPiquetes) {
            mapPiquetes = L.map('map-piquetes', {minZoom: 10, maxZoom: 17}).setView([mapaLat, mapaLng], 15);
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {attribution: 'Esri'}).addTo(mapPiquetes);
        }
        mapPiquetes.invalidateSize();
        drawAllPiquetes();
        if (p.geometria) {
            try {
                const geo = JSON.parse(p.geometria);
                if (geo.type === 'Polygon' && geo.coordinates && geo.coordinates.length > 0) {
                    const coords = geo.coordinates[0].map(c => [c[1], c[0]]);
                    const bounds = L.latLngBounds(coords.map(c => [c[0], c[1]]));
                    mapPiquetes.fitBounds(bounds, {padding: [50, 50]});
                    let corPoligono = '#28a745'; 
                    if (p.estado === 'ocupado') corPoligono = '#dc3545';
                    else if (p.altura_atual && p.altura_atual < p.altura_entrada) corPoligono = '#ffc107';
                    else if (!p.altura_atual) corPoligono = '#fd7e14';
                    L.polygon(coords, {
                        color: corPoligono,
                        weight: 4,
                        fill: true,
                        fillOpacity: 0.4
                    }).addTo(mapPiquetes).bindPopup(`
                        <strong>${p.nome}</strong><br>
                        🌿 ${p.capim || 'N/I'}<br>
                        📐 ${p.area || 0} hectares<br>
                        📏 ${p.altura_atual || '?'}/${p.altura_entrada || '?'} cm<br>
                        ${p.estado === 'ocupado' 
                            ? `📊 ${p.dias_tecnicos || 0} dias técnicos${p.data_saida_prevista ? ' • 📆 ' + p.data_saida_prevista : ''}`
                            : `📅 ${p.dias_descanso || 0}/${p.dias_descanso_min || 30} dias descanso`}
                    `).openPopup();
                }
            } catch (e) {
                console.log('Erro ao mostrar piquete', e);
            }
        }
    }, 200);
    const temReal = p.altura_real_medida !== null && p.altura_real_medida !== undefined;
    const temAlgumaAltura = temReal || (p.altura_estimada !== null && p.altura_estimada !== undefined);
    const fonteAlt = p.fonte_altura || 'estimada';
    let estadoTexto = '';
    let estadoBadge = '';
    let alturaInfo = '';
    let alturaBadge = '';
    if (fonteAlt === 'real') {
        alturaBadge = '<span style="background:#28a745;color:white;padding:2px 8px;border-radius:10px;font-size:0.75rem;margin-left:5px;">📏 MEDIDA</span>';
    } else {
        alturaBadge = '<span style="background:#fd7e14;color:white;padding:2px 8px;border-radius:10px;font-size:0.75rem;margin-left:5px;">📐 ESTIMADA</span>';
    }
    if (!temAlgumaAltura) {
        estadoTexto = '⚠️ Aguardando Altura';
        estadoBadge = 'badge-orange';
        alturaInfo = `<p style="color:#fd7e14;"><strong>⚠️ Altura não calculada</strong><br>É necessário informar a altura inicial</p>`;
    } else if (p.estado === 'ocupado') {
        estadoTexto = '🔵 Em Ocupação';
        estadoBadge = 'badge-blue';
        const alturaMostrada = Math.max(p.altura_real_medida || 0, p.altura_estimada || 0);
        alturaInfo = `<p><strong>Altura Atual:</strong> ${alturaMostrada} cm ${alturaBadge}</p>`;
    } else if (p.altura_estimada >= p.altura_entrada) {
        estadoTexto = '🟢 Disponível';
        estadoBadge = 'badge-green';
        alturaInfo = `<p><strong>Altura Atual:</strong> ${p.altura_estimada} cm ${alturaBadge}</p>`;
    } else if (temReal && p.altura_real_medida >= p.altura_entrada) {
        estadoTexto = '🟢 Disponível';
        estadoBadge = 'badge-green';
        alturaInfo = `<p><strong>Altura Atual:</strong> ${p.altura_real_medida} cm ${alturaBadge}</p>`;
    } else {
        estadoTexto = '🔄 Recuperando';
        estadoBadge = 'badge-yellow';
        const alturaMostrada = Math.max(p.altura_real_medida || 0, p.altura_estimada || 0);
        alturaInfo = `<p><strong>Altura Atual:</strong> ${alturaMostrada} cm ${alturaBadge}</p>`;
    }
    let diasInfo = '';
    if (p.estado === 'ocupado') {
        diasInfo = `<p><strong>Dias Técnicos:</strong> ${p.dias_tecnicos || 0}</p>`;
    } else if (!temAlgumaAltura) {
        diasInfo = `<p><strong>Dias de Descanso:</strong> ${p.dias_descanso || 0}</p>`;
        const diasMin = calcularDiasNecessarios(p.capim, p.altura_entrada, p.altura_saida);
        const crescimento = getCrescimentoCapim(p.capim);
        diasInfo += `<p style="color:#6c757d;"><strong>Necessários:</strong> ~${diasMin} dias<br><small>(Crescimento: ${crescimento} cm/dia)</small></p>`;
    } else if (p.altura_estimada >= p.altura_entrada) {
        diasInfo = `<p style="color:#28a745;"><strong>✅ APTO para receber animais!</strong></p>`;
    } else if (temReal && p.altura_real_medida >= p.altura_entrada) {
        diasInfo = `<p style="color:#28a745;"><strong>✅ APTO para receber animais!</strong></p>`;
    } else {
        const diasDescanso = p.dias_descanso || 0;
        const crescimento = getCrescimentoCapim(p.capim);
        const alturaMostrada = Math.max(p.altura_real_medida || 0, p.altura_estimada || 0);
        const faltaCm = Math.max(0, p.altura_entrada - alturaMostrada);
        const diasNecessarios = Math.round(faltaCm / crescimento);
        diasInfo = `<p><strong>Dias de Descanso:</strong> ${diasDescanso}/${diasNecessarios} (necessários)</p>`;
        diasInfo += `<p style="color:#6c757d;"><small>Crescimento: ${crescimento} cm/dia | Falta: ${faltaCm}cm</small></p>`;
        if (diasDescanso > 30) {
            diasInfo += `<p style="color:#dc3545;"><strong>⚠️ Ineficiência!</strong><br><small>Passou de 30 dias sem atingir altura</small></p>`;
        }
    }
    let estimativaInfo = '';
    if (temReal && p.altura_estimada !== null) {
        const diff = p.altura_estimada - p.altura_real_medida;
        const sinal = diff >= 0 ? '+' : '';
        estimativaInfo = `<p style="color:#6c757d;font-size:0.85rem;margin-top:5px;"><strong>Estimativa do sistema:</strong> ${p.altura_estimada} cm (${sinal}${diff.toFixed(1)} cm)</p>`;
    } else if (!temReal && p.altura_estimada !== null) {
        estimativaInfo = `<p style="color:#fd7e14;font-size:0.85rem;margin-top:5px;"><strong>⚠️ Valor estimado</strong> - <a href="#" onclick="fecharModal('modal-ver-piquete'); setTimeout(()=>abrirModalEditarPiquete(${p.id}),300);return false;" style="color:#007bff;">Atualizar medição</a></p>`;
    }
    document.getElementById('info-piquete').innerHTML = `
        <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <h4 style="margin-bottom: 10px; color: #1976d2;">📍 ${p.nome}</h4>
            <p><strong>Área:</strong> ${p.area || 0} hectares</p>
            <p><strong>Capim:</strong> ${p.capim || 'N/I'}</p>
            <p><strong>Estado:</strong> <span class="badge ${estadoBadge}" style="color: white;">${estadoTexto}</span></p>
            ${diasInfo}
        </div>
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <h4 style="margin-bottom: 10px; color: #856404;">⚙️ Parâmetros Técnicos</h4>
            <p><strong>Altura de Entrada:</strong> ${p.altura_entrada || 0} cm</p>
            <p><strong>Altura Mínima de Saída:</strong> ${p.altura_saida || 0} cm</p>
            ${p.dias_tecnicos ? `<p style="color: #1976d2;"><strong>📊 Dias Técnicos de Ocupação:</strong> ${p.dias_tecnicos} dias</p>` : ''}
            ${p.data_saida_prevista ? `<p style="color: #1976d2;"><strong>📆 Saída Prevista:</strong> ${p.data_saida_prevista}</p>` : ''}
            ${alturaInfo}
            ${estimativaInfo}
        </div>
        ${(p.irrigado === 'sim' || p.observacao) ? `
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <h4 style="margin-bottom: 10px; color: #495057;">🔧 Parâmetros Avançados</h4>
            ${p.irrigado === 'sim' ? '<p><strong>Irrigado:</strong> Sim</p>' : ''}
            ${p.observacao ? `<p><strong>Observações:</strong> ${p.observacao}</p>` : ''}
        </div>
        ` : ''}
        <p style="color: #666; font-size: 0.85rem;">📅 Criado em: ${p.created_at ? new Date(p.created_at).toLocaleDateString() : 'N/I'}</p>
    `;
    abrirModalVerPiquete();
}

function buscarEndereco() {
    const endereco = document.getElementById('endereco-busca').value;
    if (!endereco) return alert('Digite um endereço!');
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(endereco)}&limit=1`;
    fetch(url).then(r => r.json()).then(data => {
        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            if (!mapPiquetes) {
                mapPiquetes = L.map('map-piquetes', {minZoom: 10, maxZoom: 17}).setView([lat, lon], 15);
                L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {attribution: 'Esri'}).addTo(mapPiquetes);
            } else {
                mapPiquetes.setView([lat, lon], 15);
            }
            L.marker([lat, lon], {
                icon: L.divIcon({
                    className: 'custom-marker',
                    html: '📍',
                    iconSize: [30, 30],
                    iconAnchor: [15, 30]
                })
            }).addTo(mapPiquetes).bindPopup(data[0].display_name.substring(0, 80) + '...').openPopup();
        } else {
            alert('Endereço não encontrado!');
        }
    }).catch(e => {
        alert('Erro ao buscar endereço: ' + e.message);
    });
}

function geoLocalizacaoMapaPiquetes() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                if (!mapPiquetes) {
                    mapPiquetes = L.map('map-piquetes', {minZoom: 10, maxZoom: 17}).setView([lat, lng], 16);
                    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {attribution: 'Esri'}).addTo(mapPiquetes);
                } else {
                    mapPiquetes.setView([lat, lng], 16);
                }
                L.marker([lat, lng], {
                    icon: L.divIcon({
                        className: 'custom-marker',
                        html: '📍',
                        iconSize: [30, 30],
                        iconAnchor: [15, 30]
                    })
                }).addTo(mapPiquetes).bindPopup('Sua localização').openPopup();
            },
            function(error) {
                alert('Erro ao obter localização: ' + error.message);
            }
        );
    } else {
        alert('Geolocalização não suportada pelo navegador!');
    }
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

// ========== DADOS DOS CAPINS ==========
const dadosCapins = {
    'Brachiaria': {
        alturaEntrada: 30,
        alturaSaida: 15,
        diasOcupacao: 3,
        crescimentoDiario: 1.2,
        descricao: '• Altura entrada: 25–30 cm<br>• Altura saída: 15 cm<br>• Crescimento: ~1.2 cm/dia'
    },
    'Mombaça': {
        alturaEntrada: 35,
        alturaSaida: 20,
        diasOcupacao: 3,
        crescimentoDiario: 1.5,
        descricao: '• Altura entrada: 35–40 cm<br>• Altura saída: 20 cm<br>• Crescimento: ~1.5 cm/dia'
    },
    'Tifton 85': {
        alturaEntrada: 20,
        alturaSaida: 10,
        diasOcupacao: 3,
        crescimentoDiario: 1.0,
        descricao: '• Altura entrada: 20–25 cm<br>• Altura saída: 10 cm<br>• Crescimento: ~1.0 cm/dia'
    },
    'Andropogon': {
        alturaEntrada: 25,
        alturaSaida: 12,
        diasOcupacao: 3,
        crescimentoDiario: 1.2,
        descricao: '• Altura entrada: 25–30 cm<br>• Altura saída: 12 cm<br>• Crescimento: ~1.2 cm/dia'
    },
    'Capim Aruana': {
        alturaEntrada: 25,
        alturaSaida: 15,
        diasOcupacao: 3,
        crescimentoDiario: 1.1,
        descricao: '• Altura entrada: 25 cm<br>• Altura saída: 15 cm<br>• Crescimento: ~1.1 cm/dia'
    },
    'Natalino': {
        alturaEntrada: 30,
        alturaSaida: 15,
        diasOcupacao: 3,
        crescimentoDiario: 1.3,
        descricao: '• Altura entrada: 30 cm<br>• Altura saída: 15 cm<br>• Crescimento: ~1.3 cm/dia'
    },
    'MG-5': {
        alturaEntrada: 35,
        alturaSaida: 18,
        diasOcupacao: 3,
        crescimentoDiario: 1.4,
        descricao: '• Altura entrada: 35 cm<br>• Altura saída: 18 cm<br>• Crescimento: ~1.4 cm/dia'
    },
    'Outro': {
        alturaEntrada: 25,
        alturaSaida: 15,
        diasOcupacao: 3,
        crescimentoDiario: 1.2,
        descricao: '• Defina os valores manualmente<br>• Consulta um agrônomo para orientação'
    }
};

function getCrescimentoCapim(capim) {
    if (capim && dadosCapins[capim]) {
        return dadosCapins[capim].crescimentoDiario;
    }
    return 1.2; 
}

function calcularDiasNecessarios(capim, alturaEntrada, alturaSaida) {
    if (!capim || !dadosCapins[capim]) {
        return 30; 
    }
    const crescimento = dadosCapins[capim].crescimentoDiario;
    const alturaNecessaria = alturaEntrada - alturaSaida;
    if (crescimento <= 0) return 30;
    return Math.max(1, Math.round(alturaNecessaria / crescimento));
}

function atualizarInfoCapim() {
    const capim = document.getElementById('pq-capim').value;
    const infoDiv = document.getElementById('info-capim');
    if (capim && dadosCapins[capim]) {
        const dados = dadosCapins[capim];
        infoDiv.innerHTML = `<strong>ℹ️ ${capim}</strong><br>${dados.descricao}`;
        infoDiv.style.display = 'block';
        document.getElementById('pq-altura-entrada').value = dados.alturaEntrada;
        document.getElementById('pq-altura-saida').value = dados.alturaSaida;
    } else {
        infoDiv.style.display = 'none';
    }
}

function liberarAreaManual() {
    const areaInput = document.getElementById('pq-area');
    areaInput.removeAttribute('readonly');
    areaInput.style.background = 'white';
    areaInput.focus();
}

function desfazerPonto() {
    if (pontos.length > 0) {
        pontos.pop();
        atualizarDesenho();
    }
}

function limparDesenho() {
    pontos = [];
    document.getElementById('pq-area').value = '0';
    atualizarDesenho();
}

function validarSalvarPiquete() {
    const nome = document.getElementById('pq-nome').value.trim();
    const capim = document.getElementById('pq-capim').value;
    const area = parseFloat(document.getElementById('pq-area').value) || 0;
    const alturaEntrada = parseFloat(document.getElementById('pq-altura-entrada').value) || 0;
    const alturaSaida = parseFloat(document.getElementById('pq-altura-saida').value) || 0;
    const alturaAtual = document.getElementById('pq-altura-atual').value.trim();
    const dataMedicao = document.getElementById('pq-data-medicao').value.trim();
    if (!nome) return alert('❌ Informe o nome do piquete!');
    if (!capim) return alert('❌ Selecione o tipo de capim!');
    if (area <= 0) return alert('❌ A área deve ser maior que 0!');
    if (alturaEntrada <= 0) return alert('❌ Informe a altura ideal de entrada!');
    if (alturaSaida <= 0) return alert('❌ Informe a altura mínima de saída!');
    if (alturaSaida >= alturaEntrada) return alert('❌ A altura de saída deve ser MENOR que a altura de entrada!');
    if (alturaAtual && !dataMedicao) return alert('❌ Se informar a Altura Atual, informe também a Data da Medição!');
    if (pontos.length < 3 && area <= 0) {
        return alert('❌ Desenhe o piquete no mapa OU libere a área manual!');
    }
    salvarPiquete();
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

window.onload = function() {
    initMap();
    loadAll();
    injetarLotacaoUI();
    carregarLotacao();
    carregarAlertas();
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
