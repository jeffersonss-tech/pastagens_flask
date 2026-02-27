// PastoFlow - Lógica específica da seção de Piquetes

var mapPiquetes = null;

const offlineConfig = {
    dbName: window.OFFLINE_DB_NAME || 'PastoFlowOffline',
    dbVersion: window.OFFLINE_DB_VERSION || 2,
    tileStore: window.OFFLINE_TILE_STORE || 'tiles',
    queueStore: window.OFFLINE_QUEUE_STORE || 'offlinePiquetes'
};
const OFFLINE_INDICATOR_ID = 'offline-queue-status';

function manterMapaPiquetesAlinhado() {
    if (!mapPiquetes) return;
    setTimeout(() => mapPiquetes.invalidateSize(), 50);
    setTimeout(() => mapPiquetes.invalidateSize(), 250);
    setTimeout(() => mapPiquetes.invalidateSize(), 700);
}

let offlineSyncInProgress = false;

function openOfflineQueueDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(offlineConfig.dbName, offlineConfig.dbVersion);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(offlineConfig.tileStore)) {
                db.createObjectStore(offlineConfig.tileStore);
            }
            if (!db.objectStoreNames.contains(offlineConfig.queueStore)) {
                db.createObjectStore(offlineConfig.queueStore, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

async function queueOfflinePiquete(payload) {
    try {
        const db = await openOfflineQueueDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(offlineConfig.queueStore, 'readwrite');
            const store = tx.objectStore(offlineConfig.queueStore);
            store.add({ payload, created_at: new Date().toISOString() });
            tx.oncomplete = () => {
                db.close();
                resolve();
            };
            tx.onerror = () => {
                db.close();
                reject(tx.error || new Error('Erro ao gravar offline'));
            };
        });
    } catch (err) {
        console.error('Não foi possível abrir IndexedDB:', err);
        throw err;
    }
}

async function getOfflineQueueItems() {
    const db = await openOfflineQueueDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(offlineConfig.queueStore, 'readonly');
        const request = tx.objectStore(offlineConfig.queueStore).getAll();
        request.onsuccess = () => {
            db.close();
            resolve(request.result || []);
        };
        request.onerror = () => {
            db.close();
            reject(request.error);
        };
    });
}

async function deleteOfflineQueueItem(id) {
    const db = await openOfflineQueueDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(offlineConfig.queueStore, 'readwrite');
        const request = tx.objectStore(offlineConfig.queueStore).delete(id);
        tx.oncomplete = () => {
            db.close();
            resolve();
        };
        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };
    });
}

async function getOfflineQueueCount() {
    const db = await openOfflineQueueDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(offlineConfig.queueStore, 'readonly');
        const request = tx.objectStore(offlineConfig.queueStore).count();
        request.onsuccess = () => {
            db.close();
            resolve(request.result || 0);
        };
        request.onerror = () => {
            db.close();
            reject(request.error);
        };
    });
}


let offlineQueueItems = [];

function converterOfflineQueueItem(item) {
    const payload = item.payload || {};
    const alturaEntrada = payload.altura_entrada || 0;
    const alturaAtual = payload.altura_atual !== undefined && payload.altura_atual !== null ? payload.altura_atual : null;
    const temReal = alturaAtual !== null;
    const alturaEstimada = temReal ? alturaAtual : alturaEntrada;
    const status = alturaEstimada >= alturaEntrada && alturaEntrada > 0 ? 'APTO' : 'RECUPERANDO';
    return {
        id: `offline-${item.id}`,
        nome: payload.nome || 'Piquete offline',
        capim: payload.capim || 'N/I',
        area: payload.area || 0,
        geometria: payload.geometria,
        altura_entrada: alturaEntrada,
        altura_saida: payload.altura_saida || 0,
        altura_real_medida: alturaAtual,
        altura_estimada: alturaEstimada,
        fonte_altura: temReal ? 'real' : 'estimada',
        dias_descanso: 0,
        dias_tecnicos: 0,
        estado: 'offline',
        status: status,
        animais_no_piquete: 0,
        data_medicao: payload.data_medicao || null,
        irrigado: payload.irrigado || 'nao',
        observacao: payload.observacao || null,
        possui_cocho: payload.possui_cocho || 0,
        percentual_suplementacao: payload.percentual_suplementacao || 0,
        offlinePending: true,
        offline_created_at: item.created_at,
        dias_ate_saida: null
    };
}

async function carregarPiquetesOfflinePendentes() {
    try {
        const db = await openOfflineQueueDB();
        return new Promise((resolve) => {
            const tx = db.transaction(offlineConfig.queueStore, 'readonly');
            const request = tx.objectStore(offlineConfig.queueStore).getAll();
            request.onsuccess = () => {
                const items = request.result || [];
                offlineQueueItems = items.map(converterOfflineQueueItem);
                db.close();
                resolve(offlineQueueItems);
            };
            request.onerror = () => {
                console.error('Erro ao ler fila offline:', request.error);
                offlineQueueItems = [];
                db.close();
                resolve(offlineQueueItems);
            };
        });
    } catch (err) {
        console.error('Erro ao abrir IndexedDB:', err);
        offlineQueueItems = [];
        return offlineQueueItems;
    }
}

function getPiquetesParaRenderizar() {
    return [...offlineQueueItems, ...piquetes];
}

function ensureOfflineQueueIndicator() {
    let indicator = document.getElementById(OFFLINE_INDICATOR_ID);
    if (indicator) return indicator;
    const button = document.querySelector('button[onclick="abrirModalPiquete()"]');
    if (!button || !button.parentNode) return null;
    indicator = document.createElement('span');
    indicator.id = OFFLINE_INDICATOR_ID;
    indicator.style.cssText = 'margin-left: 12px; font-size: 0.85rem; font-weight: 600; color: #fd7e14; display: inline-flex; align-items: center; gap: 4px;';
    indicator.title = 'Piquetes aguardando sincronização';
    button.parentNode.insertBefore(indicator, button.nextSibling);
    return indicator;
}

async function refreshOfflineQueueIndicator() {
    try {
        const count = await getOfflineQueueCount();
        const indicator = ensureOfflineQueueIndicator();
        if (!indicator) return;
        if (count > 0) {
            indicator.textContent = `⏳ ${count} offline pendente${count > 1 ? 's' : ''}`;
            indicator.style.display = 'inline-flex';
        } else {
            indicator.style.display = 'none';
        }
    } catch (err) {
        console.error('Erro ao atualizar indicador offline:', err);
    }
}

async function syncOfflinePiquetes() {
    if (!navigator.onLine) return;
    if (offlineSyncInProgress) return;
    offlineSyncInProgress = true;
    try {
        const items = await getOfflineQueueItems();
        if (!items.length) return;
        let synced = 0;
        for (const item of items) {
            try {
                const response = await fetch('/api/piquetes', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(item.payload)
                });
                if (!response.ok) throw new Error('Status ' + response.status);
                await response.json();
                await deleteOfflineQueueItem(item.id);
                synced++;
            } catch (err) {
                console.error('Erro ao sincronizar piquete offline:', err);
                break;
            }
        }
        if (synced > 0) {
            alert(`${synced} piquete${synced > 1 ? 's' : ''} offline sincronizado${synced > 1 ? 's' : ''}!`);
            loadAll();
        }
    } finally {
        offlineSyncInProgress = false;
        refreshOfflineQueueIndicator();
    }
}

// Maps e Desenho
function initMapPiquetes() {
    if (!mapPiquetes) {
        mapPiquetes = L.map('map-piquetes', {minZoom: 13, maxZoom: 17}).setView([mapaLat, mapaLng], 15);
        
        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Esri'
        });

        const offlineLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 17
        });

        offlineLayer.createTile = function(coords, done) {
            if (typeof window.createOfflineTile === 'function') {
                return window.createOfflineTile(coords, done, 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');
            }
            const tile = document.createElement('img');
            tile.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${coords.z}/${coords.y}/${coords.x}`;
            done(null, tile);
            return tile;
        };

        // Lógica de alternância: se online usa satélite, se offline usa o banco local
        function toggleMapLayerPiquetes() {
            if (!mapPiquetes) return;
            
            fetch('/api/data-teste?check_server=' + Date.now(), { method: 'HEAD', cache: 'no-store' })
            .then(() => {
                if (mapPiquetes.hasLayer(offlineLayer)) mapPiquetes.removeLayer(offlineLayer);
                satelliteLayer.addTo(mapPiquetes);
            })
            .catch(() => {
                if (mapPiquetes.hasLayer(satelliteLayer)) mapPiquetes.removeLayer(satelliteLayer);
                offlineLayer.addTo(mapPiquetes);
            });
        }

        // Primeira execução
        toggleMapLayerPiquetes();

        // Ouvir mudanças de conexão
        window.addEventListener('online', toggleMapLayerPiquetes);
        window.addEventListener('offline', toggleMapLayerPiquetes);
        
        if (temSede) {
            L.marker([mapaLat, mapaLng], {
                icon: L.divIcon({
                    className: 'fazenda-marker',
                    html: '<i class="fa-solid fa-house" style="font-size:20px;color:#1a1a2e;"></i>',
                    iconSize: [30, 30],
                    iconAnchor: [15, 30]
                })
            }).addTo(mapPiquetes).bindPopup(`<strong>${fazendaNome}</strong><br>Sede da fazenda`);
        }
    } else {
        mapPiquetes.setView([mapaLat, mapaLng], 15);
    }
    manterMapaPiquetesAlinhado();
}

function initMapDesenho() {
    if (mapDesenhoInit) {
        if (layerGroup) layerGroup.clearLayers();
        drawPiquetesExistentes();
        if (mapDesenho) setTimeout(() => mapDesenho.invalidateSize(), 200);
        return;
    }
    mapDesenho = L.map('map-desenho', {minZoom: 13, maxZoom: 17}).setView([mapaLat, mapaLng], 15);
    
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri'
    });

    const offlineLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 17
    });

    offlineLayer.createTile = function(coords, done) {
        if (typeof window.createOfflineTile === 'function') {
            return window.createOfflineTile(coords, done, 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');
        }
        const tile = document.createElement('img');
        tile.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${coords.z}/${coords.y}/${coords.x}`;
        done(null, tile);
        return tile;
    };

    function toggleMapLayerDesenho() {
        if (!mapDesenho) return;
        
        fetch('/api/data-teste?check_server=' + Date.now(), { method: 'HEAD', cache: 'no-store' })
        .then(() => {
            if (mapDesenho.hasLayer(offlineLayer)) mapDesenho.removeLayer(offlineLayer);
            satelliteLayer.addTo(mapDesenho);
        })
        .catch(() => {
            if (mapDesenho.hasLayer(satelliteLayer)) mapDesenho.removeLayer(satelliteLayer);
            offlineLayer.addTo(mapDesenho);
        });
    }

    // Primeira execução
    toggleMapLayerDesenho();

    // Ouvir mudanças de conexão
    window.addEventListener('online', toggleMapLayerDesenho);
    window.addEventListener('offline', toggleMapLayerDesenho);

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
    if (layerGroup) layerGroup.clearLayers();
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
        const areaEl = document.getElementById('pq-area');
        if (areaEl) {
            areaEl.value = area.toFixed(2);
            areaEl.setAttribute('readonly', true);
            areaEl.style.background = '#f5f5f5';
        }
    } else {
        const areaEl = document.getElementById('pq-area');
        if (areaEl) areaEl.value = '0';
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

async function drawAllPiquetes() {
    if (!mapPiquetes) return;

    await carregarPiquetesOfflinePendentes();
    const display = getPiquetesParaRenderizar();

    mapPiquetes.eachLayer(function(layer) {
        if (layer instanceof L.Polygon || (layer instanceof L.Marker && layer.options?.icon?.options?.className === 'piquete-label')) {
            mapPiquetes.removeLayer(layer);
        }
    });

    display.forEach(p => {
        if (!p.geometria) return;
        try {
            const geo = JSON.parse(p.geometria);
            if (geo.type !== 'Polygon' || !geo.coordinates || !geo.coordinates.length) return;
            const coords = geo.coordinates[0].map(c => [c[1], c[0]]);
            const isOffline = !!p.offlinePending;
            const temReal = p.altura_real_medida !== null && p.altura_real_medida !== undefined;
            const temAlgumaAltura = temReal || (p.altura_estimada !== null && p.altura_estimada !== undefined);
            const fonteAlt = p.fonte_altura || 'estimada';
            let corPoligono = '#28a745';
            let fillOpacityPoligono = isOffline ? 0.35 : 0.4;

            if (isOffline) {
                corPoligono = '#6c757d';
            } else if (!temReal) {
                corPoligono = '#fff3cd';
                fillOpacityPoligono = 0.5;
            } else if (p.estado === 'ocupado') {
                corPoligono = '#dc3545';
            } else if (p.altura_estimada >= p.altura_entrada || (temReal && p.altura_real_medida >= p.altura_entrada)) {
                corPoligono = '#28a745';
            } else {
                corPoligono = '#ffc107';
            }

            const badgeFonte = fonteAlt === 'real'
                ? '<br><span style="background:#28a745;color:white;padding:2px 6px;border-radius:8px;font-size:0.75rem;"><i class="fa-solid fa-ruler-vertical"></i> MEDIDA</span>'
                : '<br><span style="background:#fd7e14;color:white;padding:2px 6px;border-radius:8px;font-size:0.75rem;"><i class="fa-solid fa-ruler-combined"></i> ESTIMADA</span>';

            let diasInfo = '';
            if (!temAlgumaAltura) {
                diasInfo = `<br><i class="fa-solid fa-triangle-exclamation"></i> Aguardando altura`;
            } else if (p.estado === 'ocupado') {
                const diasDesdeOcupacao = p.dias_no_piquete || 0;
                diasInfo = `<br><i class="fa-solid fa-clock"></i> ${p.dias_tecnicos || 0} dias técnicos${badgeFonte}`;
                diasInfo += `<br><i class="fa-solid fa-calendar-day"></i> ${diasDesdeOcupacao} dias desde ocupação`;
                if (p.altura_estimada) {
                    diasInfo += `<br><i class="fa-solid fa-ruler-vertical"></i> Altura: ${p.altura_estimada}/${p.altura_entrada || '?'} cm`;
                }
            } else if (p.altura_estimada >= p.altura_entrada) {
                diasInfo = `<br><span style="color:#28a745;">●</span> APTO para entrada${badgeFonte}`;
                if (p.altura_estimada) {
                    diasInfo += `<br><i class="fa-solid fa-ruler-vertical"></i> Altura: ${p.altura_estimada} cm`;
                }
            } else {
                const diasDescanso = p.dias_descanso || 0;
                const diasMin = p.dias_descanso_min || 30;
                const faltam = Math.max(0, diasMin - diasDescanso);
                diasInfo = `<br><i class="fa-solid fa-clock"></i> ${diasDescanso}/${diasMin} dias (falta ${faltam})${badgeFonte}`;
                if (p.altura_estimada) {
                    diasInfo += `<br><i class="fa-solid fa-ruler-vertical"></i> Altura: ${p.altura_estimada}/${p.altura_entrada || '?'} cm`;
                }
            }

            let badgeClass = '';
            let badgeText = '';
            let statusInfo = '';
            let diasRestantes = '';
            let avisoMedicao = '';
            if (isOffline) {
                const quando = p.offline_created_at ? new Date(p.offline_created_at).toLocaleDateString('pt-BR') : 'agora';
                badgeClass = 'badge-gray';
                badgeText = '<i class="fa-solid fa-cloud-arrow-down"></i> Offline pendente';
                statusInfo = `<small style="color:#6c757d;"><i class="fa-solid fa-cloud-arrow-down"></i> ${quando}</small>`;
                diasRestantes = `<br><small style="color:#6c757d;"><i class="fa-solid fa-clock"></i> Aguardando conexão</small>`;
            } else if (!temReal) {
                if (!temAlgumaAltura) {
                    badgeClass = 'badge-yellow';
                    badgeText = '<i class="fa-solid fa-triangle-exclamation"></i> SEM ALTURA';
                    statusInfo = '<small style="color: #856404;">Adicione a altura medida</small>';
                } else {
                    badgeClass = 'badge-yellow';
                    badgeText = '<i class="fa-solid fa-triangle-exclamation"></i> PRECISA MEDIR';
                    statusInfo = `<small style="color: #fd7e14;"><i class="fa-solid fa-ruler-vertical"></i> ${p.altura_estimada}cm (estimada)</small>`;
                    avisoMedicao = `<br><small style="color:#fd7e14;"><i class="fa-solid fa-ruler-combined"></i> Altura estimada: ${p.altura_estimada}cm</small>`;
                }
            } else if (p.estado === 'ocupado') {
                badgeClass = 'badge-blue';
                badgeText = '<i class="fa-solid fa-circle"></i> Em Ocupação';
                statusInfo = `<small style="color: #007bff;"><i class="fa-solid fa-ruler-vertical"></i> ${p.altura_estimada || '?'}cm (est.)</small>`;
            } else if (p.altura_estimada >= p.altura_entrada || (temReal && p.altura_real_medida >= p.altura_entrada)) {
                badgeClass = 'badge-green';
                badgeText = '<i class="fa-solid fa-circle" style="color:#28a745;"></i> Disponível';
                const valorAltura = p.altura_real_medida || p.altura_estimada;
                const fonteLabel = (temReal && p.altura_real_medida !== null) ? '(medida)' : '(estimada)';
                statusInfo = `<small style="color: #28a745;"><i class="fa-solid fa-ruler-vertical"></i> ${valorAltura}cm ${fonteLabel}</small>`;
            } else {
                badgeClass = 'badge-orange';
                badgeText = '<i class="fa-solid fa-rotate-right"></i> Recuperando';
                statusInfo = `<small style="color: #c45a00;"><i class="fa-solid fa-ruler-vertical"></i> ${Math.max(p.altura_real_medida || 0, p.altura_estimada || 0)}/${p.altura_entrada} cm ${badgeFonte}</small>`;
            }

            if (!temAlgumaAltura) {
                diasRestantes = '';
            } else if (p.estado === 'ocupado') {
                diasRestantes = `<br><small style="color: #004085;"><i class="fa-solid fa-clock"></i> ${p.dias_tecnicos || 0} dias técnicos</small>`;
            } else if (p.altura_estimada >= p.altura_entrada || (temReal && p.altura_real_medida >= p.altura_entrada)) {
                diasRestantes = `<br><small style="color: #155724;"><i class="fa-solid fa-check"></i> Pronto para receber!</small>`;
            } else {
                const diasDescanso = p.dias_descanso || 0;
                const crescimento = (typeof getCrescimentoCapimReal === 'function') ? getCrescimentoCapimReal(p.capim) : getCrescimentoCapim(p.capim);
                const faltaCm = Math.max(0, p.altura_entrada - (p.altura_estimada || 0));
                const diasNecessarios = Math.round(faltaCm / (crescimento || 1));
                diasRestantes = `<br><small style="color: #856404;"><i class="fa-regular fa-calendar"></i> ~${diasNecessarios} dias necessário${diasNecessarios !== 1 ? 's' : ''} ${badgeFonte}</small><br><small style="color: #6c757d;"><i class="fa-solid fa-chart-line"></i> ${crescimento} cm/dia | Falta: ${faltaCm}cm</small>`;
            }

            let avisoUrgente = '';
            if (p.data_saida_prevista && p.animais_no_piquete > 0) {
                const diasAteSaida = p.dias_ate_saida;
                if (diasAteSaida !== undefined && diasAteSaida !== null) {
                    if (diasAteSaida < 0) {
                        const atrasado = Math.abs(diasAteSaida);
                        avisoUrgente = `<br><strong style="color:#dc3545;"><i class="fa-solid fa-triangle-exclamation"></i> RETIRAR JÁ! (atrasado ${atrasado} dia${atrasado !== 1 ? 's' : ''})</strong>`;
                    } else if (diasAteSaida <= 1) {
                        avisoUrgente = `<br><strong style="color:#fd7e14;"><i class="fa-solid fa-triangle-exclamation"></i> Preparar saída! (faltam ${diasAteSaida} dia${diasAteSaida !== 1 ? 's' : ''})</strong>`;
                    }
                }
            }

            L.polygon(coords, {
                color: corPoligono,
                weight: 3,
                fill: true,
                fillOpacity: fillOpacityPoligono
            }).addTo(mapPiquetes).bindPopup(`
                <div style="min-width:200px;">
                    <strong style="font-size:14px;">${p.nome}</strong><br>
                    <span class="badge ${badgeClass}" style="font-size:0.7rem;">${badgeText}</span><br>
                    <p style="margin:5px 0;"><i class="fa-solid fa-ruler-combined"></i> ${p.area || 0} hectares | <i class="fa-solid fa-leaf"></i> ${p.capim || 'N/I'}</p>
                    ${p.animais_no_piquete > 0 ? `<p style="color:#007bff;margin:5px 0;"><strong><i class="fa-solid fa-cow"></i> ${p.animais_no_piquete} animal(is)</strong></p>` : ''}
                    ${p.altura_real_medida ? `<p style="color:#28a745;margin:5px 0;"><i class="fa-solid fa-ruler-vertical"></i> ${p.altura_real_medida}cm (medida)</p>` : ''}
                    ${p.data_medicao ? `<p style="color:#999;font-size:0.75rem;margin:5px 0;"><i class="fa-regular fa-calendar"></i> ${new Date(p.data_medicao).toLocaleDateString('pt-BR')}</p>` : ''}
                    ${statusInfo ? `<p style="margin:5px 0;">${statusInfo}</p>` : ''}
                    ${avisoMedicao ? `<p style="margin:5px 0;">${avisoMedicao}</p>` : ''}
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
        } catch (e) {
            console.log('Erro ao desenhar poligono no mapa de piquetes', p.id, e);
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
            mapPiquetes = L.map('map-piquetes', {minZoom: 13, maxZoom: 17}).setView([mapaLat, mapaLng], 15);
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {attribution: 'Esri'}).addTo(mapPiquetes);
        }
        mapPiquetes.invalidateSize();
        drawAllPiquetes();
        
        // Centralizar no mapa mas NÃO criar novo polígono
        if (p.geometria) {
            try {
                const geo = JSON.parse(p.geometria);
                if (geo.type === 'Polygon' && geo.coordinates && geo.coordinates.length > 0) {
                    const coords = geo.coordinates[0].map(c => [c[1], c[0]]);
                    const bounds = L.latLngBounds(coords.map(c => [c[0], c[1]]));
                    mapPiquetes.fitBounds(bounds, {padding: [50, 50]});
                    
                    // Abrir popup do polígono após centralizar
                    setTimeout(() => {
                        mapPiquetes.eachLayer(function(layer) {
                            if (layer instanceof L.Polygon && layer.getPopup()) {
                                const popupContent = layer.getPopup().getContent();
                                if (popupContent && popupContent.includes(p.nome)) {
                                    layer.openPopup();
                                }
                            }
                        });
                    }, 300);
                }
            } catch (e) {
                console.log('Erro ao centralizar mapa', e);
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
        alturaBadge = '<span style="background:#28a745;color:white;padding:2px 8px;border-radius:10px;font-size:0.75rem;margin-left:5px;"><i class="fa-solid fa-ruler-vertical"></i> MEDIDA</span>';
    } else {
        alturaBadge = '<span style="background:#fd7e14;color:white;padding:2px 8px;border-radius:10px;font-size:0.75rem;margin-left:5px;"><i class="fa-solid fa-ruler-combined"></i> ESTIMADA</span>';
    }
    if (!temAlgumaAltura) {
        estadoTexto = '<i class="fa-solid fa-triangle-exclamation"></i> Aguardando Altura';
        estadoBadge = 'badge-orange';
        alturaInfo = `<p style="color:#fd7e14;"><strong><i class="fa-solid fa-triangle-exclamation"></i> Altura não calculada</strong><br>É necessário informar a altura inicial</p>`;
    } else if (p.estado === 'ocupado') {
        estadoTexto = '<i class="fa-solid fa-circle" style="color:#007bff;"></i> Em Ocupação';
        estadoBadge = 'badge-blue';
        const alturaMostrada = Math.max(p.altura_real_medida || 0, p.altura_estimada || 0);
        alturaInfo = `<p><strong>Altura Atual:</strong> ${alturaMostrada} cm ${alturaBadge}</p>`;
    } else if (p.altura_estimada >= p.altura_entrada) {
        estadoTexto = '<i class="fa-solid fa-circle" style="color:#28a745;"></i> Disponível';
        estadoBadge = 'badge-green';
        alturaInfo = `<p><strong>Altura Atual:</strong> ${p.altura_estimada} cm ${alturaBadge}</p>`;
    } else if (temReal && p.altura_real_medida >= p.altura_entrada) {
        estadoTexto = '<i class="fa-solid fa-circle" style="color:#28a745;"></i> Disponível';
        estadoBadge = 'badge-green';
        alturaInfo = `<p><strong>Altura Atual:</strong> ${p.altura_real_medida} cm ${alturaBadge}</p>`;
    } else {
        estadoTexto = '<i class="fa-solid fa-rotate-right"></i> Recuperando';
        estadoBadge = 'badge-yellow';
        const alturaMostrada = Math.max(p.altura_real_medida || 0, p.altura_estimada || 0);
        alturaInfo = `<p><strong>Altura Atual:</strong> ${alturaMostrada} cm ${alturaBadge}</p>`;
    }
    let diasInfo = '';
    if (p.estado === 'ocupado') {
        const diasDesdeOcupacao = p.dias_no_piquete || 0;
        diasInfo = `<p><strong>Dias Técnicos:</strong> ${p.dias_tecnicos || 0}</p><p style="color: #007bff;"><strong><i class="fa-solid fa-calendar-day"></i> Dias desde ocupação:</strong> ${diasDesdeOcupacao}</p>`;
    } else if (!temAlgumaAltura) {
        diasInfo = `<p><strong>Dias de Descanso:</strong> ${p.dias_descanso || 0}</p>`;
        const diasMin = calcularDiasNecessarios(p.capim, p.altura_entrada, p.altura_saida);
        const crescimento = getCrescimentoCapimReal(p.capim);
        diasInfo += `<p style="color:#6c757d;"><strong>Necessários:</strong> ~${diasMin} dias<br><small>(Crescimento: ${crescimento} cm/dia)</small></p>`;
    } else if (p.altura_estimada >= p.altura_entrada) {
        diasInfo = `<p style="color:#28a745;"><strong><i class="fa-solid fa-check"></i> APTO para receber animais!</strong></p>`;
    } else if (temReal && p.altura_real_medida >= p.altura_entrada) {
        diasInfo = `<p style="color:#28a745;"><strong><i class="fa-solid fa-check"></i> APTO para receber animais!</strong></p>`;
    } else {
        const diasDescanso = p.dias_descanso || 0;
        const crescimento = getCrescimentoCapimReal(p.capim);
        const alturaMostrada = Math.max(p.altura_real_medida || 0, p.altura_estimada || 0);
        const faltaCm = Math.max(0, p.altura_entrada - alturaMostrada);
        const diasNecessarios = Math.round(faltaCm / crescimento);
        diasInfo = `<p><strong>Dias de Descanso:</strong> ${diasDescanso}/${diasNecessarios} (necessários)</p>`;
        diasInfo += `<p style="color:#6c757d;"><small>Crescimento: ${crescimento} cm/dia | Falta: ${faltaCm}cm</small></p>`;
        if (diasDescanso > 30) {
            diasInfo += `<p style="color:#dc3545;"><strong><i class="fa-solid fa-triangle-exclamation"></i> Ineficiência!</strong><br><small>Passou de 30 dias sem atingir altura</small></p>`;
        }
    }
    
    // Adicionar aviso de saída prevista (mesma lógica do popup)
    if (p.data_saida_prevista && p.animais_no_piquete > 0) {
        const diasAteSaida = p.dias_ate_saida;
        if (diasAteSaida !== undefined && diasAteSaida !== null) {
            if (diasAteSaida < 0) {
                const atrasado = Math.abs(diasAteSaida);
                diasInfo += `<p style="color:#dc3545;background:#ffeef0;padding:8px;border-radius:4px;margin-top:8px;"><strong><i class="fa-solid fa-triangle-exclamation"></i> 🔴 RETIRAR JÁ!</strong><br><small>Atrasado ${atrasado} dia${atrasado !== 1 ? 's' : ''}</small></p>`;
            } else if (diasAteSaida <= 1) {
                diasInfo += `<p style="color:#fd7e14;background:#fff3cd;padding:8px;border-radius:4px;margin-top:8px;"><strong><i class="fa-solid fa-triangle-exclamation"></i> 🟠 Preparar saída!</strong><br><small>Faltam ${diasAteSaida} dia${diasAteSaida !== 1 ? 's' : ''}</small></p>`;
            }
        }
    }
    
    let estimativaInfo = '';
    if (temReal && p.altura_estimada !== null) {
        const diff = p.altura_estimada - p.altura_real_medida;
        const sinal = diff >= 0 ? '+' : '';
        estimativaInfo = `<p style="color:#6c757d;font-size:0.85rem;margin-top:5px;"><strong>Estimativa do sistema:</strong> ${p.altura_estimada} cm (${sinal}${diff.toFixed(1)} cm)</p>`;
    } else if (!temReal && p.altura_estimada !== null) {
        estimativaInfo = `<p style="color:#fd7e14;font-size:0.85rem;margin-top:5px;"><strong><i class="fa-solid fa-triangle-exclamation"></i> Valor estimado</strong> - <a href="#" onclick="fecharModal('modal-ver-piquete'); setTimeout(()=>abrirModalEditarPiquete(${p.id}),300);return false;" style="color:#007bff;">Atualizar medição</a></p>`;
    }
    document.getElementById('info-piquete').innerHTML = `
        <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <h4 style="margin-bottom: 10px; color: #1976d2;"><i class="fa-solid fa-map-location-dot"></i> ${p.nome}</h4>
            <p><strong>Área:</strong> ${p.area || 0} hectares</p>
            <p><strong>Capim:</strong> ${p.capim || 'N/I'}</p>
            <p><strong>Estado:</strong> <span class="badge ${estadoBadge}" style="color: white;">${estadoTexto}</span></p>
            ${diasInfo}
        </div>
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <h4 style="margin-bottom: 10px; color: #856404;"><i class="fa-solid fa-gear"></i> Parâmetros Técnicos</h4>
            <p><strong>Altura de Entrada:</strong> ${p.altura_entrada || 0} cm</p>
            <p><strong>Altura Mínima de Saída:</strong> ${p.altura_saida || 0} cm</p>
            ${p.dias_tecnicos ? `<p style="color: #1976d2;"><strong><i class="fa-solid fa-clock"></i> Dias Técnicos de Ocupação:</strong> ${p.dias_tecnicos} dias</p>` : ''}
            ${p.data_saida_prevista ? `<p style="color: #1976d2;"><strong><i class="fa-regular fa-calendar"></i> Saída Prevista:</strong> ${p.data_saida_prevista}</p>` : ''}
            ${alturaInfo}
            ${estimativaInfo}
        </div>
        ${(p.irrigado === 'sim' || p.observacao) ? `
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <h4 style="margin-bottom: 10px; color: #495057;"><i class="fa-solid fa-screwdriver-wrench"></i> Parâmetros Avançados</h4>
            ${p.irrigado === 'sim' ? '<p><strong>Irrigado:</strong> Sim</p>' : ''}
            ${p.observacao ? `<p><strong>Observações:</strong> ${p.observacao}</p>` : ''}
        </div>
        ` : ''}
        <p style="color: #666; font-size: 0.85rem;"><i class="fa-regular fa-calendar"></i> Criado em: ${p.created_at ? new Date(p.created_at).toLocaleDateString() : 'N/I'}</p>
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
                mapPiquetes = L.map('map-piquetes', {minZoom: 13, maxZoom: 17}).setView([lat, lon], 15);
                L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {attribution: 'Esri'}).addTo(mapPiquetes);
            } else {
                mapPiquetes.setView([lat, lon], 15);
            }
            L.marker([lat, lon], {
                icon: L.divIcon({
                    className: 'custom-marker',
                    html: '<i class="fa-solid fa-location-dot" style="font-size:20px;color:#dc3545;"></i>',
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
                    mapPiquetes = L.map('map-piquetes', {minZoom: 13, maxZoom: 17}).setView([lat, lng], 16);
                    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {attribution: 'Esri'}).addTo(mapPiquetes);
                } else {
                    mapPiquetes.setView([lat, lng], 16);
                }
                L.marker([lat, lng], {
                    icon: L.divIcon({
                        className: 'custom-marker',
                        html: '<i class="fa-solid fa-location-dot" style="font-size:20px;color:#007bff;"></i>',
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
                        html: '<i class="fa-solid fa-location-dot" style="font-size:20px;color:#28a745;"></i>',
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


let capimOutroCustom = { crescimentoDiario: null, fatorConsumo: null, lotacao: null };
let capimOutroContexto = 'novo';

function abrirModalCapimOutro(contexto = 'novo') {
    capimOutroContexto = contexto;
    const modal = document.getElementById('modal-capim-outro');
    if (!modal) return;
    document.getElementById('outro-crescimento').value = capimOutroCustom.crescimentoDiario ?? '';
    document.getElementById('outro-fator-consumo').value = capimOutroCustom.fatorConsumo ?? '';
    document.getElementById('outro-lotacao').value = capimOutroCustom.lotacao ?? '';
    modal.classList.add('active');
}

function fecharModalCapimOutro() {
    const modal = document.getElementById('modal-capim-outro');
    if (modal) modal.classList.remove('active');
}

function salvarCapimOutroCustom() {
    const crescimento = parseFloat(document.getElementById('outro-crescimento').value);
    const fator = parseFloat(document.getElementById('outro-fator-consumo').value);
    const lotacao = parseFloat(document.getElementById('outro-lotacao').value);

    if (!crescimento || crescimento <= 0) return alert('Informe um crescimento válido (> 0).');
    if (!fator || fator <= 0) return alert('Informe um fator de consumo válido (> 0).');
    if (!lotacao || lotacao <= 0) return alert('Informe uma lotação válida (> 0).');

    capimOutroCustom = { crescimentoDiario: crescimento, fatorConsumo: fator, lotacao };
    dadosCapins['Outro'] = {
        alturaEntrada: dadosCapins['Outro'].alturaEntrada,
        alturaSaida: dadosCapins['Outro'].alturaSaida,
        crescimentoDiario: crescimento,
        fatorConsumo: fator,
        lotacao: `${lotacao} UA/ha`
    };

    if (capimOutroContexto === 'editar') {
        atualizarInfoCapimEdit();
    } else {
        atualizarInfoCapim();
    }

    fecharModalCapimOutro();
}

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

let climaAtualFator = window._climaFatorAtual || 1.0;

function getCrescimentoCapim(capim) {
    if (capim && dadosCapins[capim]) return dadosCapins[capim].crescimentoDiario;
    return 1.2;
}

function getCrescimentoCapimReal(capim) {
    const base = getCrescimentoCapim(capim);
    return +(base * (climaAtualFator || 1.0)).toFixed(2);
}

function calcularDiasNecessarios(capim, alturaEntrada, alturaSaida) {
    if (!capim || !dadosCapins[capim]) return 30;
    const crescimento = getCrescimentoCapimReal(capim);
    const alturaNecessaria = alturaEntrada - alturaSaida;
    if (crescimento <= 0) return 30;
    return Math.max(1, Math.round(alturaNecessaria / crescimento));
}

function atualizarClimaAtualUI() {
    if (typeof fazendaId === 'undefined' || !fazendaId) return;

    fetch('/api/clima/condicao-atual?fazenda_id=' + fazendaId)
        .then(r => r.json())
        .then(data => {
            const condicao = (data.condicao || 'normal').toUpperCase();
            const fator = data.fator !== undefined ? data.fator : 1.0;
            const fonte = data.fonte || 'api';
            window._climaFatorAtual = parseFloat(fator) || 1.0;
            climaAtualFator = window._climaFatorAtual;

            const textoSidebar = `${condicao} (fator ${fator})`;
            const textoPiquetes = `${condicao} • fator ${fator} • fonte: ${fonte}`;

            const sidebarEl = document.getElementById('clima-sidebar-valor');
            if (sidebarEl) sidebarEl.textContent = textoSidebar;

            const topoEl = document.getElementById('clima-piquetes-valor');
            if (topoEl) topoEl.textContent = textoPiquetes;
        })
        .catch(() => {
            const sidebarEl = document.getElementById('clima-sidebar-valor');
            if (sidebarEl) sidebarEl.textContent = 'Indisponível';

            const topoEl = document.getElementById('clima-piquetes-valor');
            if (topoEl) topoEl.textContent = 'Indisponível';
        });
}

function atualizarInfoCapim() {
    const capim = document.getElementById('pq-capim').value;
    const infoDiv = document.getElementById('info-capim');
    if (capim === 'Outro' && !capimOutroCustom.crescimentoDiario) {
        abrirModalCapimOutro('novo');
    }
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
    if (capim === 'Outro' && !capimOutroCustom.crescimentoDiario) {
        abrirModalCapimOutro('editar');
    }
    if (capim && dadosCapins[capim]) {
        const dados = dadosCapins[capim];
        infoDiv.innerHTML = `<strong>ℹ️ ${capim}</strong><br>• Entrada: ${dados.alturaEntrada} cm<br>• Saída: ${dados.alturaSaida} cm<br>• Crescimento: ~${dados.crescimentoDiario} cm/dia<br>• Fator consumo: ${dados.fatorConsumo}<br>• Lotação sugerida: ${dados.lotacao}`;
        infoDiv.style.display = 'block';
    } else {
        infoDiv.style.display = 'none';
    }
}

function alternarSuplementacaoEdit() {
    const checkbox = document.getElementById('edit-pq-possui-cocho');
    const divPercentual = document.getElementById('edit-div-percentual-suplementacao');
    if (checkbox && divPercentual) {
        divPercentual.style.display = checkbox.checked ? 'block' : 'none';
        if (!checkbox.checked) {
            document.getElementById('edit-pq-percentual-suplementacao').value = '0';
        }
    }
}

function alternarSuplementacao() {
    const checkbox = document.getElementById('pq-possui-cocho');
    const divPercentual = document.getElementById('div-percentual-suplementacao');
    if (checkbox && divPercentual) {
        divPercentual.style.display = checkbox.checked ? 'block' : 'none';
        if (!checkbox.checked) {
            document.getElementById('pq-percentual-suplementacao').value = '0';
        }
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
    // Resetar campos de suplementação
    document.getElementById('pq-possui-cocho').checked = false;
    document.getElementById('pq-percentual-suplementacao').value = '0';
    document.getElementById('div-percentual-suplementacao').style.display = 'none';
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
    // Carregar campos de suplementação
    const possuiCocho = p.possui_cocho || 0;
    document.getElementById('edit-pq-possui-cocho').checked = possuiCocho === 1;
    const percentualSup = p.percentual_suplementacao || 0;
    document.getElementById('edit-pq-percentual-suplementacao').value = Math.round(percentualSup * 100);
    document.getElementById('edit-div-percentual-suplementacao').style.display = possuiCocho === 1 ? 'block' : 'none';
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
    if (!nome) return alert('Informe o nome do piquete!');
    if (!capim) return alert('Selecione o tipo de capim!');
    if (capim === 'Outro' && !capimOutroCustom.crescimentoDiario) return alert('Configure os parâmetros do capim Outro.');
    if (capim === 'Outro' && !capimOutroCustom.crescimentoDiario) return alert('Configure os parâmetros do capim Outro.');
    if (area <= 0) return alert('A área deve ser mayor que 0!');
    if (alturaEntrada <= 0) return alert('Informe a altura ideal de entrada!');
    if (alturaSaida <= 0) return alert('Informe a altura mínima de saída!');
    if (alturaSaida >= alturaEntrada) return alert('A altura de saída deve ser MENOR que a altura de entrada!');
    if (alturaAtual && !dataMedicao) return alert('Se informar a Altura Atual, informe também a Data da Medição!');
    if (pontos.length < 3 && area <= 0) {
        return alert('Desenhe o piquete no mapa OU libere a área manual!');
    }
    salvarPiquete();
}

async function salvarPiquete() {
    const nome = document.getElementById('pq-nome').value || 'Piquete_' + Date.now();
    const coords = pontos.map(p => [p[1], p[0]]);
    coords.push(coords[0]);
    const dataMedicao = document.getElementById('pq-data-medicao').value || null;
    let observacaoCustom = document.getElementById('pq-observacoes').value || '';
    if (document.getElementById('pq-capim').value === 'Outro' && capimOutroCustom.crescimentoDiario) {
        const customStr = `[CAPIM_OUTRO] crescimento=${capimOutroCustom.crescimentoDiario}; fator_consumo=${capimOutroCustom.fatorConsumo}; lotacao=${capimOutroCustom.lotacao}`;
        observacaoCustom = observacaoCustom ? `${observacaoCustom}\n${customStr}` : customStr;
    }

    const payload = {
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
        observacao: observacaoCustom || null,
        possui_cocho: document.getElementById('pq-possui-cocho').checked ? 1 : 0,
        percentual_suplementacao: document.getElementById('pq-possui-cocho').checked 
            ? (parseFloat(document.getElementById('pq-percentual-suplementacao').value) || 0) / 100 
            : 0
    };

    if (!navigator.onLine) {
        try {
            await queueOfflinePiquete(payload);
            alert('Sem internet. Piquete salvo localmente e será sincronizado quando voltar.');
            fecharModalPiquete();
            if (typeof refreshPiquetesOfflineDisplay === 'function') {
                refreshPiquetesOfflineDisplay();
            }
        } catch (err) {
            console.error('Erro ao salvar offline:', err);
            alert('Não foi possível salvar offline: ' + (err.message || 'IndexedDB indisponível.'));
        }
        refreshOfflineQueueIndicator();
        return;
    }

    try {
        const response = await fetch('/api/piquetes', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            // 4xx não deve enfileirar offline; mostrar erro amigável
            if (response.status >= 400 && response.status < 500) {
                let mensagem = '';
                try {
                    const asJson = await response.json();
                    mensagem = asJson?.error || asJson?.message || '';
                } catch (e) {
                    mensagem = await response.text().catch(() => '');
                }
                mensagem = mensagem || 'Sem permissão ou dados inválidos';
                throw new Error(mensagem);
            }
            const mensagem = await response.text().catch(() => '');
            throw new Error(mensagem || 'Status ' + response.status);
        }
        await response.json();
        alert('Piquete salvo!');
        fecharModalPiquete();
        loadAll();
    } catch (err) {
        console.error('Erro ao salvar piquete online:', err);
        const isAuthError = /403|401|permiss|Sem permissão|Acesso negado/i.test(err.message || '');
        const isValidation = /400|dados inválidos/i.test(err.message || '');
        if (!navigator.onLine || (!isAuthError && !isValidation)) {
            try {
                await queueOfflinePiquete(payload);
                alert('Não foi possível enviar agora. Piquete salvo offline e será sincronizado quando voltar.');
                fecharModalPiquete();
                if (typeof refreshPiquetesOfflineDisplay === 'function') {
                    refreshPiquetesOfflineDisplay();
                }
            } catch (queueErr) {
                console.error('Erro ao registrar offline:', queueErr);
                alert('Erro ao registrar offline: ' + (queueErr.message || 'IndexedDB indisponível.'));
            }
        } else {
            alert(err.message || 'Erro ao salvar piquete.');
        }
    } finally {
        refreshOfflineQueueIndicator();
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
    if (!nome) return alert('Informe o nome do piquete!');
    if (!capim) return alert('Selecione o tipo de capim!');
    if (area <= 0) return alert('A área deve ser mayor que 0!');
    if (alturaEntrada <= 0) return alert('Informe a altura de entrada!');
    if (alturaSaida <= 0) return alert('Informe a altura mínima de saída!');
    if (alturaSaida >= alturaEntrada) return alert('A altura de saída deve ser MENOR que a altura de entrada!');
    if (alturaAtual && !dataMedicao) return alert('Se informar a Altura Atual, informe também a Data da Medição!');
    salvarEdicaoPiquete();
}

function salvarEdicaoPiquete() {
    const id = document.getElementById('edit-pq-id').value;
    if (!id) return;
    const valorAltura = document.getElementById('edit-pq-altura-atual').value.trim();
    const dataMedicao = document.getElementById('edit-pq-data-medicao').value.trim();
    const p = piquetes.find(x => x.id == id);
    let observacaoEdit = document.getElementById('edit-pq-observacoes').value || '';
    if (document.getElementById('edit-pq-capim').value === 'Outro' && capimOutroCustom.crescimentoDiario) {
        const customStr = `[CAPIM_OUTRO] crescimento=${capimOutroCustom.crescimentoDiario}; fator_consumo=${capimOutroCustom.fatorConsumo}; lotacao=${capimOutroCustom.lotacao}`;
        observacaoEdit = observacaoEdit ? `${observacaoEdit}\n${customStr}` : customStr;
    }
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
        observacao: observacaoEdit || null,
        possui_cocho: document.getElementById('edit-pq-possui-cocho').checked ? 1 : 0,
        percentual_suplementacao: document.getElementById('edit-pq-possui-cocho').checked 
            ? (parseFloat(document.getElementById('edit-pq-percentual-suplementacao').value) || 0) / 100 
            : 0
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

window.addEventListener('resize', () => {
    manterMapaPiquetesAlinhado();
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) manterMapaPiquetesAlinhado();
});

let offlineSyncWatcher = null;

function startOfflineSyncWatcher() {
    if (offlineSyncWatcher) clearInterval(offlineSyncWatcher);
    offlineSyncWatcher = setInterval(() => {
        if (navigator.onLine) syncOfflinePiquetes();
    }, 30000);
}

function stopOfflineSyncWatcher() {
    if (offlineSyncWatcher) {
        clearInterval(offlineSyncWatcher);
        offlineSyncWatcher = null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    refreshOfflineQueueIndicator();
    syncOfflinePiquetes();
    startOfflineSyncWatcher();
});

window.addEventListener('online', () => {
    syncOfflinePiquetes();
    startOfflineSyncWatcher();
});
window.addEventListener('offline', () => {
    refreshOfflineQueueIndicator();
    stopOfflineSyncWatcher();
});

// Carregar fator climático ao iniciar (sincronizar com fazenda.js)
if (typeof fazendaId !== 'undefined' && fazendaId) {
    atualizarClimaAtualUI();
} else {
    // Se ainda não tem fazenda, definir padrão
    window._climaFatorAtual = 1.0;
    climaAtualFator = 1.0;
}

// Função para filtrar piquetes na lista
function filtrarPiquetes() {
    const termo = document.getElementById('buscar-piquete').value.toLowerCase();
    const statusFiltro = document.getElementById('filtro-status-piquete').value;
    
    const cards = document.querySelectorAll('#lista-piquetes > div');
    cards.forEach(card => {
        const nome = card.querySelector('h4')?.textContent.toLowerCase() || '';
        const texto = card.textContent.toLowerCase();
        
        let mostrar = nome.includes(termo);
        
        if (mostrar && statusFiltro) {
            if (statusFiltro === 'ocupado' && !texto.includes('em occupac') && !texto.includes('em ocupa') && !texto.includes('retirar')) {
                mostrar = false;
            } else if (statusFiltro === 'disponivel' && !texto.includes('disponivel') && !texto.includes('disponível')) {
                mostrar = false;
            } else if (statusFiltro === 'recuperando' && !texto.includes('recuperando')) {
                mostrar = false;
            } else if (statusFiltro === 'sem_altura' && !texto.includes('sem altura') && !texto.includes('precisa medir')) {
                mostrar = false;
            }
        }
        
        card.style.display = mostrar ? '' : 'none';
    });
}
