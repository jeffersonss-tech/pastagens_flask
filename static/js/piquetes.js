// PastoFlow - Lógica específica da seção de Piquetes

var mapPiquetes = null;

// Maps e Desenho
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
    } else {
        // Se já existe, garantir que o mapa esteja focado e limpo para novos desenhos
        mapPiquetes.setView([mapaLat, mapaLng], 15);
    }
    setTimeout(() => mapPiquetes.invalidateSize(), 100);
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
        }
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

// ========== DADOS DOS CAPINS (AGRUPADOS POR TIPO) ==========
const catalogoCapins = {
    'Brachiaria': {
        'Marandu': {alturaEntrada: 32, alturaSaida: 17, crescimentoDiario: 1.2, fatorConsumo: 0.85, lotacao: '2.5 UA/ha'},
        'Piatã': {alturaEntrada: 32, alturaSaida: 17, crescimentoDiario: 1.3, fatorConsumo: 0.90, lotacao: '2.5 UA/ha'},
        'Xaraés': {alturaEntrada: 38, alturaSaida: 18, crescimentoDiario: 1.6, fatorConsumo: 0.95, lotacao: '3.0 UA/ha'},
        'Paiaguás': {alturaEntrada: 32, alturaSaida: 17, crescimentoDiario: 1.2, fatorConsumo: 0.85, lotacao: '2.2 UA/ha'},
        'Decumbens': {alturaEntrada: 27, alturaSaida: 12, crescimentoDiario: 1.0, fatorConsumo: 0.75, lotacao: '1.8 UA/ha'},
        'Humidicola': {alturaEntrada: 27, alturaSaida: 12, crescimentoDiario: 0.8, fatorConsumo: 0.70, lotacao: '1.5 UA/ha'},
        'MG-5': {alturaEntrada: 38, alturaSaida: 18, crescimentoDiario: 1.6, fatorConsumo: 0.95, lotacao: '3.0 UA/ha'}
    },
    'Panicum': {
        'Mombaça': {alturaEntrada: 80, alturaSaida: 35, crescimentoDiario: 2.5, fatorConsumo: 1.00, lotacao: '4.5 UA/ha'},
        'Tanzânia': {alturaEntrada: 68, alturaSaida: 35, crescimentoDiario: 2.3, fatorConsumo: 0.95, lotacao: '4.0 UA/ha'},
        'Zuri': {alturaEntrada: 80, alturaSaida: 35, crescimentoDiario: 2.6, fatorConsumo: 1.05, lotacao: '4.5 UA/ha'},
        'Massai': {alturaEntrada: 45, alturaSaida: 22, crescimentoDiario: 1.8, fatorConsumo: 0.90, lotacao: '3.0 UA/ha'},
        'Aruana': {alturaEntrada: 40, alturaSaida: 18, crescimentoDiario: 1.7, fatorConsumo: 0.85, lotacao: '2.8 UA/ha'}
    },
    'Cynodon': {
        'Tifton 85': {alturaEntrada: 30, alturaSaida: 12, crescimentoDiario: 2.0, fatorConsumo: 0.70, lotacao: '4.5 UA/ha'},
        'Tifton 68': {alturaEntrada: 30, alturaSaida: 12, crescimentoDiario: 2.0, fatorConsumo: 0.70, lotacao: '4.0 UA/ha'},
        'Coastcross': {alturaEntrada: 25, alturaSaida: 12, crescimentoDiario: 1.6, fatorConsumo: 0.75, lotacao: '3.5 UA/ha'},
        'Jiggs': {alturaEntrada: 30, alturaSaida: 12, crescimentoDiario: 1.9, fatorConsumo: 0.72, lotacao: '4.5 UA/ha'}
    },
    'Outros': {
        'Andropogon': {alturaEntrada: 70, alturaSaida: 35, crescimentoDiario: 1.8, fatorConsumo: 0.80, lotacao: '2.8 UA/ha'},
        'Capim Elefante': {alturaEntrada: 110, alturaSaida: 45, crescimentoDiario: 3.5, fatorConsumo: 1.10, lotacao: '6.0 UA/ha'},
        'Capiaçu': {alturaEntrada: 135, alturaSaida: 55, crescimentoDiario: 4.0, fatorConsumo: 1.15, lotacao: '7.0 UA/ha'}
    }
};

const dadosCapins = Object.values(catalogoCapins).reduce((acc, grupo) => Object.assign(acc, grupo), {});
dadosCapins['Brachiaria'] = dadosCapins['Marandu'];
dadosCapins['Capim Aruana'] = dadosCapins['Aruana'];
dadosCapins['Natalino'] = dadosCapins['Andropogon'];
dadosCapins['Outro'] = {alturaEntrada: 25, alturaSaida: 15, crescimentoDiario: 1.2, fatorConsumo: 1.0, lotacao: 'N/I'};

function preencherSelectCapins(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const valorAtual = select.value;
    select.innerHTML = '<option value="">Selecione...</option>';

    Object.entries(catalogoCapins).forEach(([grupoNome, capins]) => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = grupoNome;
        Object.keys(capins).forEach((nomeCapim) => {
            const option = document.createElement('option');
            option.value = nomeCapim;
            option.textContent = nomeCapim;
            optgroup.appendChild(option);
        });
        select.appendChild(optgroup);
    });

    const optOutro = document.createElement('option');
    optOutro.value = 'Outro';
    optOutro.textContent = 'Outro (manual)';
    select.appendChild(optOutro);

    if (valorAtual) select.value = valorAtual;
}

function getCrescimentoCapim(capim) {
    if (capim && dadosCapins[capim]) return dadosCapins[capim].crescimentoDiario;
    return 1.2;
}

function calcularDiasNecessarios(capim, alturaEntrada, alturaSaida) {
    if (!capim || !dadosCapins[capim]) return 30;
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
        infoDiv.innerHTML = `<strong>ℹ️ ${capim}</strong><br>• Entrada: ${dados.alturaEntrada} cm<br>• Saída: ${dados.alturaSaida} cm<br>• Crescimento: ~${dados.crescimentoDiario} cm/dia<br>• Fator consumo: ${dados.fatorConsumo}<br>• Lotação sugerida: ${dados.lotacao}`;
        infoDiv.style.display = 'block';
        document.getElementById('pq-altura-entrada').value = dados.alturaEntrada;
        document.getElementById('pq-altura-saida').value = dados.alturaSaida;
    } else {
        infoDiv.style.display = 'none';
    }
}

function atualizarInfoCapimEdit() {
    const capim = document.getElementById('edit-pq-capim').value;
    const infoDiv = document.getElementById('edit-info-capim');
    if (capim && dadosCapins[capim]) {
        const dados = dadosCapins[capim];
        infoDiv.innerHTML = `<strong>ℹ️ ${capim}</strong><br>• Entrada: ${dados.alturaEntrada} cm<br>• Saída: ${dados.alturaSaida} cm<br>• Crescimento: ~${dados.crescimentoDiario} cm/dia<br>• Fator consumo: ${dados.fatorConsumo}<br>• Lotação sugerida: ${dados.lotacao}`;
        infoDiv.style.display = 'block';
    } else {
        infoDiv.style.display = 'none';
    }
}

function abrirModalPiquete() { 
    preencherSelectCapins('pq-capim');
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

function fecharModalPiquete() { 
    document.getElementById('modal-piquete').classList.remove('active');
}

function abrirModalVerPiquete() { 
    document.getElementById('modal-ver-piquete').classList.add('active');
}

function fecharModalVerPiquete() { 
    document.getElementById('modal-ver-piquete').classList.remove('active');
}

function abrirModalEditarPiquete(id) {
    preencherSelectCapins('edit-pq-capim');
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

function fecharModalEditarPiquete() {
    document.getElementById('modal-editar-piquete').classList.remove('active');
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
