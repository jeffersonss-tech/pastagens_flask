// PastoFlow - Lógica do Dashboard da Fazenda

let map, mapDesenho, layerGroup;
let pontos = [];
let piquetes = [];
let animais = [];
let mapDesenhoInit = false;
window._climaFatorAtual = 1.0;

const OFFLINE_DB_NAME = 'PastoFlowOffline';
const OFFLINE_DB_VERSION = 2;
const OFFLINE_TILE_STORE = 'tiles';
const OFFLINE_QUEUE_STORE = 'offlinePiquetes';
window.OFFLINE_DB_NAME = OFFLINE_DB_NAME;
window.OFFLINE_DB_VERSION = OFFLINE_DB_VERSION;
window.OFFLINE_TILE_STORE = OFFLINE_TILE_STORE;
window.OFFLINE_QUEUE_STORE = OFFLINE_QUEUE_STORE;

function buildOfflineTileKey(url) {
    const id = typeof fazendaId !== 'undefined' && fazendaId ? String(fazendaId) : 'global';
    return `${id}::${url}`;
}

let piquetesOfflinePendentes = [];

function openOfflineQueueDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
                db.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

function converterItemOfflineParaPiquete(item) {
    const payload = item.payload || {};
    const alturaEntrada = payload.altura_entrada || 0;
    const alturaAtual = payload.altura_atual !== undefined && payload.altura_atual !== null ? payload.altura_atual : null;
    const alturaEstimada = alturaAtual !== null ? alturaAtual : alturaEntrada;
    const temReal = alturaAtual !== null;
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
            const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readonly');
            const request = tx.objectStore(OFFLINE_QUEUE_STORE).getAll();
            request.onsuccess = () => {
                const items = request.result || [];
                piquetesOfflinePendentes = items.map(converterItemOfflineParaPiquete);
                db.close();
                resolve(piquetesOfflinePendentes);
            };
            request.onerror = () => {
                console.error('Erro ao ler fila offline:', request.error);
                piquetesOfflinePendentes = [];
                db.close();
                resolve(piquetesOfflinePendentes);
            };
        });
    } catch (err) {
        console.error('Erro ao abrir IndexedDB para fila offline:', err);
        piquetesOfflinePendentes = [];
        return piquetesOfflinePendentes;
    }
}

function getPiquetesParaRenderizar() {
    return [...piquetesOfflinePendentes, ...piquetes];
}

function refreshPiquetesOfflineDisplay() {
    carregarPiquetesOfflinePendentes().then(() => {
        renderPiquetesCards();
        if (typeof drawAllPiquetes === 'function') {
            drawAllPiquetes();
        }
        if (typeof drawAllPiquetesOnMap === 'function') {
            drawAllPiquetesOnMap();
        }
        refreshOfflineQueueIndicator();
    });
}

window.refreshPiquetesOfflineDisplay = refreshPiquetesOfflineDisplay;

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
    
    // Adicionar/remover classe no body para ajustar main-content
    document.body.classList.toggle('sidebar-collapsed', isCollapsed);
    
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
        document.body.classList.add('sidebar-collapsed');
    }
});

function showSection(id) {
    console.log('Solicitada seção:', id);
    
    // Normalizar ID (remover hash se houver)
    const cleanId = id.replace('#', '') || 'dashboard';
    const targetSection = document.getElementById(cleanId + '-section');
    
    // Se não estivermos na página da fazenda (ex: Lotes), redireciona com o hash
    if (!targetSection) {
        window.location.href = '/fazenda/' + fazendaId + '#' + cleanId;
        return;
    }

    // 1. ESCONDER TODAS AS SEÇÕES PRIMEIRO
    const allSections = document.querySelectorAll('[id$="-section"]');
    allSections.forEach(s => {
        s.style.setProperty('display', 'none', 'important');
    });

    // 2. MOSTRAR APENAS A ALVO
    targetSection.style.setProperty('display', 'block', 'important');
    console.log('Seção exibida:', cleanId);

    // 3. ATUALIZAR URL (sem disparar hashchange se já for o mesmo)
    if (window.location.hash !== '#' + cleanId) {
        history.pushState(null, null, '#' + cleanId);
    }

    // 4. ATUALIZAR MENU
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    const sectionNames = { 
        'dashboard': ['Dashboard', 'gauge'], 
        'piquetes': ['Piquetes', 'map'], 
        'movimentacao': ['Movimentação', 'rotate'], 
        'relatorios': ['Relatórios', 'chart'] 
    };
    
    document.querySelectorAll('.menu-item').forEach(item => {
        const info = sectionNames[cleanId];
        if (info && (item.textContent.includes(info[0]) || item.querySelector(`[class*="${info[1]}"]`))) {
            item.classList.add('active');
        }
    });
    
    // 5. EXECUTAR ACOES ESPECIFICAS
    if (cleanId === 'dashboard') {
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
                console.log('Map invalidated (Dashboard)');
            }
        }, 200);
    }

    if (cleanId === 'piquetes') {
        setTimeout(() => {
            if (typeof initMapPiquetes === 'function') {
                initMapPiquetes();
                if (typeof drawAllPiquetes === 'function') drawAllPiquetes();
            }
        }, 100);
    }
}

// Ouvir mudanças de hash (botões voltar/avançar do navegador)
window.addEventListener('hashchange', () => {
    const id = window.location.hash.substring(1) || 'dashboard';
    showSection(id);
});

// Inicialização ao carregar o DOM
document.addEventListener('DOMContentLoaded', () => {
    // Só executa se estivermos na página da fazenda
    if (document.querySelector('[id$="-section"]')) {
        const initialId = window.location.hash.substring(1) || 'dashboard';
        showSection(initialId);
    }
});

// Maps
function initMap() {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;
    
    map = L.map('map', {minZoom: 13, maxZoom: 17}).setView([mapaLat, mapaLng], 14);
    
    // 1. Camada Satélite (Esri) - PRIORIDADE ONLINE
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri'
    });

    // 2. Camada Offline (IndexedDB / OpenStreetMap) - APENAS OFFLINE
    const offlineLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 17
    });

    // Singleton para a conexão do banco
    window._dbInstance = null;
    window.getPastoFlowDB = function(callback) {
        if (window._dbInstance) return callback(window._dbInstance);
        const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
        request.onerror = () => callback(null);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(OFFLINE_TILE_STORE)) {
                db.createObjectStore(OFFLINE_TILE_STORE);
            }
            if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
                db.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = (e) => {
            window._dbInstance = e.target.result;
            callback(window._dbInstance);
        };
    };

    window.createOfflineTile = function(coords, done, urlTemplate) {
        const tile = document.createElement('img');
        // Tratar URL de Satélite (Esri usa Z, Y, X em ordem diferente ou formatos específicos)
        let url = urlTemplate.replace('{z}', coords.z).replace('{x}', coords.x).replace('{y}', coords.y);
        
        // Se a template for do Esri, a ordem no banco deve ser respeitada
        if (urlTemplate.includes('arcgisonline')) {
            url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${coords.z}/${coords.y}/${coords.x}`;
        }
        
        window.getPastoFlowDB((db) => {
            if (!db || !db.objectStoreNames.contains(OFFLINE_TILE_STORE)) {
                tile.src = url; 
                done(null, tile); 
                return;
            }
            
            try {
                const tx = db.transaction(OFFLINE_TILE_STORE, 'readonly');
                const store = tx.objectStore(OFFLINE_TILE_STORE);
                const key = buildOfflineTileKey(url);
                const getRequest = store.get(key);
                getRequest.onsuccess = function() {
                    if (getRequest.result) {
                        tile.src = URL.createObjectURL(getRequest.result);
                        done(null, tile);
                    } else {
                        const legacyRequest = store.get(url);
                        legacyRequest.onsuccess = () => {
                            if (legacyRequest.result) {
                                tile.src = URL.createObjectURL(legacyRequest.result);
                            } else {
                                tile.src = url;
                            }
                            done(null, tile);
                        };
                        legacyRequest.onerror = () => {
                            tile.src = url;
                            done(null, tile);
                        };
                    }
                };
                getRequest.onerror = () => {
                    tile.src = url;
                    done(null, tile);
                };
            } catch (err) {
                tile.src = url;
                done(null, tile);
            }
        });
        return tile;
    };

    offlineLayer.createTile = function(coords, done) {
        // Agora busca SATÉLITE no banco offline
        return window.createOfflineTile(coords, done, 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');
    };

    // Lógica de alternância: se online usa satélite, se offline usa o banco local
    function toggleMapLayer() {
        if (!map) return;
        
        // Verifica conexão real via fetch rápido (se possível)
        // Se falhar o fetch no próprio servidor, assume offline para o mapa
        fetch('/api/data-teste?check_server=' + Date.now(), { method: 'HEAD', cache: 'no-store' })
        .then(() => {
            // Online: Usa satélite padrão
            if (map.hasLayer(offlineLayer)) map.removeLayer(offlineLayer);
            satelliteLayer.addTo(map);
        })
        .catch(() => {
            // Offline ou servidor fora do ar: Usa banco local
            if (map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);
            offlineLayer.addTo(map);
        });
    }

    // Primeira execução
    toggleMapLayer();

    // Ouvir mudanças de conexão
    window.addEventListener('online', toggleMapLayer);
    window.addEventListener('offline', toggleMapLayer);

    // Forçar atualização do tamanho após inicialização
    setTimeout(() => {
        map.invalidateSize();
    }, 500);
    
    if (temSede) {
        L.marker([mapaLat, mapaLng], {
            icon: L.divIcon({
                className: 'fazenda-marker',
                html: '<i class="fa-solid fa-house" style="font-size:20px;color:#1a1a2e;"></i>',
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

    const displayPiquetes = getPiquetesParaRenderizar();
    const fmtArea = (v) => `${Number(v || 0).toFixed(2)} ha`;
    const fmtAltura = (v) => `${Number(v || 0).toFixed(1)} cm`;
    const fmtDias = (v) => `${Number(v || 0)} dias`;

    displayPiquetes.forEach(p => {
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
                    statusInfo = `<small style="color: #007bff;"><i class="fa-solid fa-ruler-vertical"></i> ${fmtAltura(p.altura_estimada)} (estimada)</small>`;
                    avisoMedicao = `<br><small style="color: #007bff;"><i class="fa-solid fa-ruler-combined"></i> ${fmtAltura(p.altura_estimada)} estimada</small>`;
                }
            } else if (p.estado === 'ocupado') {
                badgeClass = 'badge-blue';
                badgeText = '<i class="fa-solid fa-circle"></i> Em Ocupação';
                statusInfo = `<small style="color: #007bff;"><i class="fa-solid fa-ruler-vertical"></i> ${fmtAltura(p.altura_estimada || 0)} (est.)</small>`;
            } else if (p.altura_estimada >= p.altura_entrada || (temReal && p.altura_real_medida >= p.altura_entrada)) {
                badgeClass = 'badge-green';
                badgeText = '<i class="fa-solid fa-circle" style="color:#28a745;"></i> Disponível';
                const valorAltura = p.altura_real_medida || p.altura_estimada;
                const fonteLabel = (temReal && p.altura_real_medida !== null) ? '(medida)' : '(estimada)';
                statusInfo = `<small style="color: #28a745;"><i class="fa-solid fa-ruler-vertical"></i> ${fmtAltura(valorAltura)} ${fonteLabel}</small>`;
            } else {
                badgeClass = 'badge-orange';
                badgeText = '<i class="fa-solid fa-rotate-right"></i> Recuperando';
                statusInfo = `<small style="color: #c45a00;"><i class="fa-solid fa-ruler-vertical"></i> ${fmtAltura(Math.max(p.altura_real_medida || 0, p.altura_estimada || 0))}/${fmtAltura(p.altura_entrada || 0)} ${badgeFonte}</small>`;
            }

            if (!temAlgumaAltura) {
                diasRestantes = '';
            } else if (p.estado === 'ocupado') {
                diasRestantes = `<br><small style="color: #004085;"><i class="fa-solid fa-clock"></i> ${fmtDias(p.dias_tecnicos || 0)} técnicos</small>`;
            } else if (p.altura_estimada >= p.altura_entrada || (temReal && p.altura_real_medida >= p.altura_entrada)) {
                diasRestantes = `<br><small style="color: #155724;"><i class="fa-solid fa-check"></i> Pronto para receber!</small>`;
            } else {
                const diasDescanso = p.dias_descanso || 0;
                const crescimento = getCrescimentoComClima(p.capim);
                const faltaCm = Math.max(0, p.altura_entrada - (p.altura_estimada || 0));
                const diasNecessarios = Math.round(faltaCm / (crescimento || 1));
                diasRestantes = `<br><small style="color: #856404;"><i class="fa-regular fa-calendar"></i> ~${fmtDias(diasNecessarios)} necessário${diasNecessarios !== 1 ? 's' : ''} ${badgeFonte}</small><br><small style="color: #6c757d;"><i class="fa-solid fa-chart-line"></i> ${Number(crescimento).toFixed(2)} cm/dia | Falta: ${fmtAltura(faltaCm)}</small>`;
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
            }).addTo(map).bindPopup(`
                <div style="min-width:200px;">
                    <strong style="font-size:14px;">${p.nome}</strong><br>
                    <span class="badge ${badgeClass}" style="font-size:0.7rem;">${badgeText}</span><br>
                    <p style="margin:5px 0;"><i class="fa-solid fa-ruler-combined"></i> ${fmtArea(p.area)} | <i class="fa-solid fa-leaf"></i> ${p.capim || 'N/I'}</p>
                    ${p.animais_no_piquete > 0 ? `<p style="color:#007bff;margin:5px 0;"><strong><i class="fa-solid fa-cow"></i> ${p.animais_no_piquete} animais</strong></p>` : ''}
                    ${p.altura_real_medida ? `<p style="color:#28a745;margin:5px 0;"><i class="fa-solid fa-ruler-vertical"></i> ${fmtAltura(p.altura_real_medida)} (medida)</p>` : ''}
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
                L.marker([centerLat, centerLng], {icon: label}).addTo(map);
            }
        } catch (e) {
            console.log('Erro ao desenhar polígono', p.id, e);
        }
    });
}


function loadAll() {
    fetch('/api/piquetes?fazenda_id=' + fazendaId)
        .then(r => r.json())
        .then(data => {
            piquetes = Array.isArray(data) ? data : [];
            return carregarPiquetesOfflinePendentes();
        })
        .then(() => {
            renderPiquetesCards();
            if (typeof atualizarFiltroCapim === 'function') {
                atualizarFiltroCapim();
            }
            if (typeof renderResumoPiquetes === 'function') {
                renderResumoPiquetes();
            }
            if (typeof drawAllPiquetes === 'function') {
                drawAllPiquetes();
            }
            if (typeof drawAllPiquetesOnMap === 'function') {
                drawAllPiquetesOnMap();
            }
            if (typeof refreshOfflineQueueIndicator === 'function') {
                refreshOfflineQueueIndicator();
            }
        });
}

function renderPiquetesCards() {
    const listaPiquetes = document.getElementById('lista-piquetes');
    if (!listaPiquetes) return;
    let display = getPiquetesParaRenderizar();
    if (!display.length) {
        listaPiquetes.innerHTML = '<div class="piquete-card sem-altura" style="text-align:center;">Nenhum piquete cadastrado ainda.</div>';
        return;
    }

    const prioridadePiquete = (p) => {
        const isOffline = !!p.offlinePending;
        if (isOffline) return 5;

        const temReal = p.altura_real_medida !== null && p.altura_real_medida !== undefined;
        const temAlgumaAltura = temReal || (p.altura_estimada !== null && p.altura_estimada !== undefined);
        const semMedicao = !p.data_medicao && !temReal;

        if (!temAlgumaAltura || semMedicao) return 4; // sem altura
        if (p.estado === 'ocupado') return 1;
        if (p.altura_estimada >= p.altura_entrada || (temReal && p.altura_real_medida >= p.altura_entrada)) return 3; // disponível
        return 2; // recuperando
    };

    display = display.sort((a, b) => {
        const pa = prioridadePiquete(a);
        const pb = prioridadePiquete(b);
        if (pa !== pb) return pa - pb;

        const diasA = (a.dias_no_piquete || 0);
        const diasB = (b.dias_no_piquete || 0);
        if (pa === 1 && diasA !== diasB) return diasB - diasA; // ocupados: mais dias primeiro

        const faltaA = Math.max(0, (a.altura_entrada || 0) - (a.altura_estimada || 0));
        const faltaB = Math.max(0, (b.altura_entrada || 0) - (b.altura_estimada || 0));
        if (pa === 2 && faltaA !== faltaB) return faltaA - faltaB; // recuperando: mais perto da meta primeiro

        const areaA = a.area || 0;
        const areaB = b.area || 0;
        if (areaA !== areaB) return areaB - areaA; // desempate por área

        return (a.nome || '').localeCompare(b.nome || '');
    });

    listaPiquetes.innerHTML = display.map(p => {
        const isOffline = !!p.offlinePending;
        const temReal = p.altura_real_medida !== null && p.altura_real_medida !== undefined;
        const temAlgumaAltura = temReal || (p.altura_estimada !== null && p.altura_estimada !== undefined);
        const fonteAlt = p.fonte_altura || 'estimada';
        const alturaMostrada = temReal ? p.altura_real_medida : p.altura_estimada;
        const animaisNoPiquete = p.animais_no_piquete > 0;
        const taxaAnimaisHa = (p.area && p.area > 0) ? (p.animais_no_piquete / p.area) : 0;

        const fmtArea = (v) => `${Number(v || 0).toFixed(2)} ha`;
        const fmtAltura = (v) => `${Number(v || 0).toFixed(1)} cm`;
        const fmtDias = (v) => `${Number(v || 0)} dias`;

        let badgeClass = '';
        let badgeText = '';
        let statusInfo = '';
        let alertaUrgente = '';
        let diasRestantes = '';
        let badgeFonte = fonteAlt === 'real'
            ? '<span style="background:#28a745;color:white;padding:1px 5px;border-radius:8px;font-size:0.7rem;margin-left:3px;">MEDIDA</span>'
            : '<span style="background:#fd7e14;color:white;padding:1px 5px;border-radius:8px;font-size:0.7rem;margin-left:3px;">ESTIMADA</span>';

        if (isOffline) {
            const quando = p.offline_created_at ? new Date(p.offline_created_at).toLocaleString('pt-BR') : 'agora';
            badgeClass = 'badge-gray';
            badgeText = '<i class="fa-solid fa-cloud-arrow-down"></i> Offline pendente';
            statusInfo = `<small style="color:#6c757d;"><i class="fa-solid fa-cloud-arrow-down"></i> Salvo localmente em ${quando}</small>`;
            diasRestantes = `<small style="color:#6c757d;"><i class="fa-solid fa-clock"></i> Aguardando conexão</small>`;
            badgeFonte = '';
        } else {
            if (!temReal) {
                if (!temAlgumaAltura) {
                    badgeClass = 'badge-yellow';
                    badgeText = '<i class="fa-solid fa-triangle-exclamation"></i> SEM ALTURA';
                    statusInfo = '<small style="color: #856404;">Adicione a altura medida</small>';
                } else {
                    badgeClass = 'badge-yellow';
                    badgeText = '<i class="fa-solid fa-triangle-exclamation"></i> PRECISA MEDIR';
                    statusInfo = `<small style="color: #007bff;"><i class="fa-solid fa-ruler-vertical"></i> ${fmtAltura(alturaMostrada)} (estimada) - <a href="#" onclick="fecharModalVerPiquete(); setTimeout(()=>abrirModalEditarPiquete(${p.id}),300);return false;" style="color: #007bff;">Atualizar medição</a></small>`;
                }
            } else if (p.estado === 'ocupado') {
                const diasTecnicos = p.dias_tecnicos || 30;
                const diasOcupados = p.dias_no_piquete || 0;
                if (diasOcupados >= diasTecnicos) {
                    badgeClass = 'badge-red';
                    badgeText = '<i class="fa-solid fa-circle" style="color:#dc3545;"></i> SAIDA IMEDIATA';
                    statusInfo = `<small style="color: #dc3545;"><i class="fa-solid fa-triangle-exclamation"></i> Tempo tecnico ultrapassado!</small><br><small style="color: #007bff;"><i class="fa-solid fa-calendar-day"></i> ${fmtDias(diasOcupados)} desde ocupaçao</small>`;
                    if (animaisNoPiquete) {
                        alertaUrgente = `
                            <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 8px; margin-top: 8px; text-align: center;">
                                <strong style="color: #856404;"><i class="fa-solid fa-triangle-exclamation"></i> Tempo tecnico! ${fmtDias(diasOcupados)}/${fmtDias(diasTecnicos)}</strong><br>
                                <a href="/fazenda/${fazendaId}/lotes" class="btn btn-warning btn-sm" style="margin-top: 5px; font-size: 0.8rem;"><i class="fa-solid fa-rotate-right"></i> Ir para Lotes</a>
                            </div>
                        `;
                    }
                } else {
                    badgeClass = 'badge-blue';
                    badgeText = '<i class="fa-solid fa-circle" style="color:#007bff;"></i> Em Ocupação';
                    statusInfo = `<small style="color: #007bff;"><i class="fa-solid fa-ruler-vertical"></i> ${fmtAltura(p.altura_estimada || 0)} (est.)</small> <small style="color: #007bff;">• <i class="fa-solid fa-calendar-day"></i> ${fmtDias(diasOcupados)} desde ocupaçao</small>`;
                }
            } else if (p.altura_estimada >= p.altura_entrada) {
                badgeClass = 'badge-green';
                badgeText = '<i class="fa-solid fa-circle" style="color:#28a745;"></i> Disponível';
                statusInfo = `<small style="color: #007bff;"><i class="fa-solid fa-ruler-vertical"></i> ${fmtAltura(p.altura_estimada)} (estimada)</small>`;
            } else if (temReal && p.altura_real_medida >= p.altura_entrada) {
                badgeClass = 'badge-green';
                badgeText = '<i class="fa-solid fa-circle" style="color:#28a745;"></i> Disponível';
                statusInfo = `<small style="color: #28a745;"><i class="fa-solid fa-ruler-vertical"></i> ${p.altura_real_medida}cm (medida)</small>`;
            } else {
                badgeClass = 'badge-orange';
                badgeText = '<i class="fa-solid fa-rotate-right"></i> Recuperando';
                statusInfo = `<small style="color: #c45a00;"><i class="fa-solid fa-ruler-vertical"></i> ${Math.max(p.altura_real_medida || 0, p.altura_estimada || 0)}/${p.altura_entrada} cm ${badgeFonte}</small>`;
                if (animaisNoPiquete) {
                    alertaUrgente = `
                        <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 8px; margin-top: 8px; text-align: center;">
                            <strong style="color: #856404;"><i class="fa-solid fa-triangle-exclamation"></i> ${p.animais_no_piquete} animal(is) em recuperação!</strong><br>
                            <a href="/fazenda/${fazendaId}/lotes" class="btn btn-warning btn-sm" style="margin-top: 5px; font-size: 0.8rem;"><i class="fa-solid fa-rotate-right"></i> Ir para Lotes</a>
                        </div>
                    `;
                }
                if (!temAlgumaAltura) {
                    diasRestantes = '';
                } else if (p.estado === 'ocupado') {
                    diasRestantes = `<br><small style="color: #004085;"><i class="fa-solid fa-chart-simple"></i> ${fmtDias(p.dias_tecnicos || 0)} técnicos</small>`;
                } else if (p.altura_estimada >= p.altura_entrada) {
                    diasRestantes = `<br><small style="color: #155724;"><i class="fa-solid fa-check"></i> Pronto para receber!</small>`;
                } else {
                    const diasDescanso = p.dias_descanso || 0;
                    const crescimento = getCrescimentoComClima(p.capim);
                    const faltaCm = Math.max(0, p.altura_entrada - (p.altura_estimada || 0));
                    const diasNecessarios = Math.round(faltaCm / crescimento);
                    diasRestantes = `<br><small style="color: #856404;"><i class="fa-regular fa-calendar"></i> ~${fmtDias(diasNecessarios)} necessário${diasNecessarios !== 1 ? 's' : ''} ${badgeFonte}</small><br><small style="color: #6c757d;"><i class="fa-solid fa-chart-line"></i> ${Number(crescimento).toFixed(2)} cm/dia | Falta: ${fmtAltura(faltaCm)}</small>`;
                }
            }
        }

        let cardClass = 'piquete-card';
        if (isOffline) {
            cardClass += ' offline';
        } else if (!temAlgumaAltura) {
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

        const clickAttr = isOffline ? '' : `onclick="mostrarPiquete(${p.id})"`;
        const buttonGroup = isOffline
            ? `<div style="margin-top:10px; font-size:0.85rem; color:#6c757d; display:flex; align-items:center; gap:6px;"><i class="fa-solid fa-cloud-arrow-down"></i> Offline pendente</div>`
            : `<div style="margin-top: 10px; display: flex; gap: 5px;">
                    <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); abrirModalEditarPiquete(${p.id})"><i class="fa-solid fa-pen"></i> Editar</button>
                    <button class="btn btn-sm" style="background:#6c757d;color:white" onclick="event.stopPropagation(); mostrarPiquete(${p.id})"><i class="fa-solid fa-eye"></i> Ver</button>
                </div>`;

        const capimData = (p.capim || '').toLowerCase();
        const diasDescansoData = (p.dias_descanso || 0);
        const avisoLotacaoBaixa = (p.estado === 'ocupado' && animaisNoPiquete && taxaAnimaisHa < 2)
            ? `<span style="background:#fff3cd; border:1px solid #ffc107; color:#856404; border-radius:10px; padding:2px 8px; font-size:0.75rem; white-space:nowrap;">
                    <i class="fa-solid fa-triangle-exclamation"></i> Lotação baixa
               </span>`
            : '';

        return `
            <div class="${cardClass}" ${clickAttr} data-id="${p.id}" data-capim="${capimData}" data-dias-descanso="${diasDescansoData}" style="cursor:${isOffline ? 'default' : 'pointer'}">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                    <h4 style="margin:0;">${p.nome}</h4>
                    <span class="badge ${badgeClass}" style="white-space:nowrap;">${badgeText}</span>
                </div>
                ${avisoLotacaoBaixa ? `<div style="text-align:right; margin-top:4px;">${avisoLotacaoBaixa}</div>` : ''}
                <p><i class="fa-solid fa-ruler-combined"></i> ${fmtArea(p.area)}</p>
                <p><i class="fa-solid fa-leaf"></i> ${p.capim || 'N/I'}</p>
                ${animaisNoPiquete ? `<p style="color: #007bff;"><strong><i class="fa-solid fa-cow"></i> ${p.animais_no_piquete} animais</strong></p>` : ''}
                ${p.dias_tecnicos ? `<p style="color: #007bff;"><strong><i class="fa-solid fa-chart-simple"></i> ${fmtDias(p.dias_tecnicos)} técnicos</strong></p>` : ''}
                ${statusInfo ? `${statusInfo}` : ''}
                ${p.altura_real_medida ? `<small style="color: #28a745;"><i class="fa-solid fa-ruler-vertical"></i> ${fmtAltura(p.altura_real_medida)} (medida)</small>` : ''}
                ${p.data_medicao ? `<small style="color: #999; font-size: 0.7rem;"><br><i class="fa-regular fa-calendar"></i> ${new Date(p.data_medicao).toLocaleDateString('pt-BR')}</small>` : ''}
                ${diasRestantes}
                ${alertaUrgente}
                ${(p.data_saida_prevista && p.animais_no_piquete > 0 && p.dias_ate_saida !== undefined && p.dias_ate_saida !== null) ? (
                    p.dias_ate_saida < 0
                        ? `<div style="background: #dc3545; color: white; padding: 8px; border-radius: 4px; margin-top: 8px; text-align: center;"><strong><i class="fa-solid fa-triangle-exclamation"></i> RETIRAR JÁ! Atrasado ${fmtDias(Math.abs(p.dias_ate_saida))}</strong></div>`
                        : p.dias_ate_saida <= 1
                            ? `<div style="background: #fd7e14; color: white; padding: 8px; border-radius: 4px; margin-top: 8px; text-align: center;"><strong><i class="fa-solid fa-triangle-exclamation"></i> Preparar saída! Faltam ${fmtDias(p.dias_ate_saida)}</strong></div>`
                            : ''
                ) : ''}
                ${buttonGroup}
            </div>
        `;
    }).join('');
}


        fetch('/api/animais?fazenda_id=' + fazendaId).then(r => r.json()).then(data => {
        // Garantir que animais seja sempre um array
        animais = Array.isArray(data) ? data : [];
        const listaLotes = document.getElementById('lista-lotes');
        if (listaLotes) {
            listaLotes.innerHTML = animais.map(a => `
                <tr><td>${a.nome}</td><td>${a.quantidade || 0}</td><td>${a.categoria || '-'}</td><td>${a.peso_medio || 0} kg</td></tr>
            `).join('');
        }
        
        const movAnimal = document.getElementById('mov-animal');
        if (movAnimal) {
            const opts = animais.map(a => `<option value="${a.id}">${a.nome}</option>`).join('');
            movAnimal.innerHTML = '<option value="">Selecione...</option>' + opts;
        }
    });
    
    let movimentacoesCache = [];

    function normalizarTexto(valor) {
        return String(valor || '').toLowerCase();
    }

    let ordenarDirecao = 'desc';

    function ordenarMovimentacoes(lista) {
        const campo = document.getElementById('ordenar-por')?.value || 'data_movimentacao';
        const fator = ordenarDirecao === 'asc' ? 1 : -1;

        return [...lista].sort((a, b) => {
            const va = a[campo] ?? '';
            const vb = b[campo] ?? '';

            if (campo === 'data_movimentacao') {
                return (new Date(va) - new Date(vb)) * fator;
            }

            return String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' }) * fator;
        });
    }

    function getActiveChipValue(containerId) {
        const container = document.getElementById(containerId);
        const active = container?.querySelector('.chip.active');
        return active ? active.getAttribute('data-value') : '';
    }

    function filtrarMovimentacoes(lista) {
        const fLote = normalizarTexto(document.getElementById('filtro-lote')?.value);
        const fOrigem = normalizarTexto(document.getElementById('filtro-origem')?.value);
        const fDestino = normalizarTexto(document.getElementById('filtro-destino')?.value);
        const fUsuario = normalizarTexto(document.getElementById('filtro-usuario')?.value);
        const fMotivo = normalizarTexto(document.getElementById('filtro-motivo')?.value);
        const fTipo = normalizarTexto(getActiveChipValue('chips-tipo'));
        const fPeriodo = getActiveChipValue('chips-periodo');

        return lista.filter(m => {
            if (fLote && normalizarTexto(m.lote_nome) !== fLote) return false;
            if (fOrigem && normalizarTexto(m.origem_nome) !== fOrigem) return false;
            if (fDestino && normalizarTexto(m.destino_nome) !== fDestino) return false;
            if (fUsuario && normalizarTexto(m.usuario_nome) !== fUsuario) return false;
            if (fMotivo && normalizarTexto(m.motivo) !== fMotivo) return false;
            if (fTipo && normalizarTexto(m.tipo) !== fTipo) return false;

            if (fPeriodo) {
                const dias = parseInt(fPeriodo, 10);
                if (!Number.isNaN(dias)) {
                    const dataMov = new Date(m.data_movimentacao);
                    const limite = new Date();
                    limite.setHours(0, 0, 0, 0);
                    limite.setDate(limite.getDate() - (dias - 1));
                    if (dataMov < limite) return false;
                }
            }

            return true;
        });
    }

    function renderUltimasMovimentacoes() {
        const ultMov = document.getElementById('ultimas-mov');
        if (!ultMov) return;

        const filtradas = filtrarMovimentacoes(movimentacoesCache);
        const ordenadas = ordenarMovimentacoes(filtradas);

        ultMov.innerHTML = ordenadas.slice(0, 20).map(m => `
            <tr><td>${m.lote_nome || '-'}</td><td>${m.origem_nome || '-'}</td><td>${m.destino_nome || '-'}</td><td>${new Date(m.data_movimentacao).toLocaleDateString()}</td><td>${m.usuario_nome || '-'}</td><td>${m.motivo || '-'}</td></tr>
        `).join('');
    }

    function atualizarSelect(id, valores, placeholder) {
        const select = document.getElementById(id);
        if (!select) return;
        const unique = Array.from(new Set(valores.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
        select.innerHTML = `<option value="">${placeholder}</option>` + unique.map(v => `<option value="${v}">${v}</option>`).join('');
    }

    function bindChips(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', () => {
                container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                renderUltimasMovimentacoes();
            });
        });
    }

    function bindMovimentacoesFilters() {
        const ids = [
            'filtro-lote',
            'filtro-origem',
            'filtro-destino',
            'filtro-usuario',
            'filtro-motivo',
            'ordenar-por'
        ];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', renderUltimasMovimentacoes);
                el.addEventListener('change', renderUltimasMovimentacoes);
            }
        });

        bindChips('chips-tipo');
        bindChips('chips-periodo');

        const ordenarBtn = document.getElementById('ordenar-btn');
        if (ordenarBtn) {
            ordenarBtn.addEventListener('click', () => {
                ordenarDirecao = ordenarDirecao === 'asc' ? 'desc' : 'asc';
                ordenarBtn.textContent = `Ordenar: ${ordenarDirecao === 'asc' ? 'Asc' : 'Desc'}`;
                renderUltimasMovimentacoes();
            });
        }

        const limparBtn = document.getElementById('limpar-filtros');
        if (limparBtn) {
            limparBtn.addEventListener('click', () => {
                ['filtro-lote','filtro-origem','filtro-destino','filtro-usuario','filtro-motivo'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
                document.getElementById('ordenar-por').value = 'data_movimentacao';
                ordenarDirecao = 'desc';
                const ordenarBtn = document.getElementById('ordenar-btn');
                if (ordenarBtn) ordenarBtn.textContent = 'Ordenar: Desc';

                document.querySelectorAll('#chips-tipo .chip').forEach((c, idx) => {
                    c.classList.toggle('active', idx === 0);
                });
                document.querySelectorAll('#chips-periodo .chip').forEach((c, idx) => {
                    c.classList.toggle('active', idx === 0);
                });
                renderUltimasMovimentacoes();
            });
        }
    }

    fetch('/api/movimentacoes?fazenda_id=' + fazendaId).then(r => r.json()).then(data => {
        movimentacoesCache = Array.isArray(data) ? data : [];

        atualizarSelect('filtro-lote', movimentacoesCache.map(m => m.lote_nome), 'Lote (todos)');
        atualizarSelect('filtro-origem', movimentacoesCache.map(m => m.origem_nome), 'Origem (todas)');
        atualizarSelect('filtro-destino', movimentacoesCache.map(m => m.destino_nome), 'Destino (todos)');
        atualizarSelect('filtro-usuario', movimentacoesCache.map(m => m.usuario_nome), 'Usuário (todos)');
        atualizarSelect('filtro-motivo', movimentacoesCache.map(m => m.motivo), 'Motivo (todos)');

        bindMovimentacoesFilters();
        renderUltimasMovimentacoes();
    });
    
    fetch('/api/piquetes?fazenda_id=' + fazendaId).then(r => r.json()).then(data => {
        // Garantir que data seja sempre um array
        const piquetesData = Array.isArray(data) ? data : [];
        const opts = piquetesData.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
        const movOrigem = document.getElementById('mov-origem');
        if (movOrigem) movOrigem.innerHTML = '<option value="">Nenhum</option>' + opts;
        const movDestino = document.getElementById('mov-destino');
        if (movDestino) movDestino.innerHTML = '<option value="">Selecione...</option>' + opts;
        
        if (map) {
            drawAllPiquetesOnMap();
        }
    });

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
                        html: '<i class="fa-solid fa-location-dot" style="font-size:20px;color:#007bff;"></i>',
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
                    html: '<i class="fa-solid fa-location-dot" style="font-size:20px;color:#dc3545;"></i>',
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
                const statusEl = document.getElementById('lotacao-status');
                const msgEl = document.getElementById('lotacao-msg');
                const status = data.status_lotacao;

                if (status === 'BAIXA') {
                    statusEl.textContent = 'BAIXA';
                    statusEl.style.color = '#1976d2';
                    msgEl.textContent = 'Lotação abaixo do ideal';
                } else if (status === 'MODERADA') {
                    statusEl.textContent = 'MODERADA';
                    statusEl.style.color = '#388e3c';
                    msgEl.textContent = 'Lotação adequada';
                } else if (status === 'ALTA') {
                    statusEl.textContent = 'ALTA';
                    statusEl.style.color = '#f57c00';
                    msgEl.textContent = 'Atenção: lotação alta';
                } else if (status === 'MUITO_ALTA') {
                    statusEl.textContent = 'MUITO ALTA';
                    statusEl.style.color = '#d32f2f';
                    msgEl.textContent = 'Risco de sobrecarga';
                } else {
                    statusEl.textContent = '-';
                    statusEl.style.color = '#c2185b';
                    msgEl.textContent = 'Sem classificação';
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
            <h5 style="color: #1976d2; margin-bottom: 8px;">Peso total estimado</h5>
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
        <div data-lotacao-status-card style="text-align: center; padding: 15px; background: #fce4ec; border-radius: 10px; cursor: pointer;">
            <h5 style="color: #c2185b; margin-bottom: 8px;">Status</h5>
            <strong id="lotacao-status" style="font-size: 1.1rem; color: #c2185b;">-</strong>
            <p style="color: #666; font-size: 0.75rem;" id="lotacao-msg">carregando...</p>
            <p style="color: #999; font-size: 0.7rem; margin-top: 6px;">Clique para detalhes</p>
        </div>
    `;
    statsGrid.parentNode.insertBefore(lotacaoHTML, statsGrid.nextSibling);

    const detalhes = document.createElement('div');
    detalhes.id = 'lotacao-detalhes';
    detalhes.style.cssText = 'display:none; margin-top: 12px; padding: 12px; border: 1px solid #eee; border-radius: 10px; background: #fafafa;';
    detalhes.innerHTML = '<strong>Detalhes da lotação baixa</strong><div id="lotacao-detalhes-lista" style="margin-top:8px; color:#666;">Carregando...</div>';
    lotacaoHTML.parentNode.insertBefore(detalhes, lotacaoHTML.nextSibling);

    const ref = document.createElement('p');
    ref.style.cssText = 'color: #666; font-size: 0.8rem; margin-top: 12px; margin-bottom: 20px;';
    ref.innerHTML = '<i class="fa-solid fa-lightbulb"></i> <strong>Referência:</strong> 2-4 UA/ha = ideal | Abaixo de 2 = subutilizado | Acima de 4 = sobrecarga';
    detalhes.parentNode.insertBefore(ref, detalhes.nextSibling);

    const statusCard = lotacaoHTML.querySelector('[data-lotacao-status-card]');
    if (statusCard) {
        statusCard.addEventListener('click', () => {
            toggleDetalhesLotacao();
        });
    }
}

function toggleDetalhesLotacao() {
    const detalhes = document.getElementById('lotacao-detalhes');
    const lista = document.getElementById('lotacao-detalhes-lista');
    if (!detalhes || !lista || typeof fazendaId === 'undefined') return;

    const isOpen = detalhes.style.display === 'block';
    detalhes.style.display = isOpen ? 'none' : 'block';
    if (isOpen) return;

    lista.textContent = 'Carregando...';
    fetch(`/api/lotacao/baixa/${fazendaId}`)
        .then(r => r.json())
        .then(data => {
            if (!Array.isArray(data) || data.length === 0) {
                lista.innerHTML = '<em>Nenhum piquete com lotação baixa.</em>';
                return;
            }
            const html = data.map(p => `
                <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #eee;">
                    <div><strong>${p.nome}</strong> • ${Number(p.area).toFixed(1)} ha</div>
                    <div>${p.total_animais} animais • ${p.taxa_animais_ha} animais/ha</div>
                </div>
            `).join('');
            lista.innerHTML = html;
        })
        .catch(() => {
            lista.innerHTML = '<em>Erro ao carregar detalhes.</em>';
        });
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
            container.innerHTML = '<p style="color: #666; text-align: center; padding: 30px;">Nenhum alerta! <i class="fa-solid fa-party-horn"></i></p>';
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
        case 'ocupacao_max': return '<i class="fa-solid fa-triangle-exclamation" style="color:#dc3545;font-size:1.2rem;"></i>';
        case 'pronto_entrada': return '<i class="fa-solid fa-leaf" style="color:#28a745;font-size:1.2rem;"></i>';
        case 'pronto_saida': return '<i class="fa-solid fa-bell" style="color:#fd7e14;font-size:1.2rem;"></i>';
        default: return '<i class="fa-solid fa-bullhorn" style="color:#007bff;font-size:1.2rem;"></i>';
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
