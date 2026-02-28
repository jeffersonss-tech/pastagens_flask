const pesosCategorias = {
    'Bezerro(a)': 200,
    'Garrote / Novilho(a)': 325,
    'Boi Magro / Engorda': 475,
    'Vaca': 500,
    'Touro': 850,
    'Personalizado': null
};

// Função para calcular dias passados desde a entrada
function calcularDiasPassados(dataEntrada) {
    if (!dataEntrada) return null;
    try {
        const entrada = new Date(dataEntrada);
        const agora = dataTeste || new Date();
        const diffTime = Math.abs(agora - entrada);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    } catch (e) {
        console.error('Erro ao calcular dias:', e);
        return null;
    }
}

// Função para formatar data para DD/MM/AAAA
function formatarData(dataEntrada) {
    if (!dataEntrada) return null;
    try {
        const raw = String(dataEntrada).trim();

        // Já está no formato BR dd/mm/yyyy
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
            return raw;
        }

        const date = new Date(raw);
        if (isNaN(date.getTime())) return null;
        const dia = String(date.getDate()).padStart(2, '0');
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const ano = date.getFullYear();
        if (!Number.isFinite(ano)) return null;
        return `${dia}/${mes}/${ano}`;
    } catch (e) {
        return null;
    }
}

// Função para verificar se é Personalizado e abrir modal
function verificarPersonalizado() {
    const select = document.getElementById('lote-categoria');
    if (select.value === 'Personalizado') {
        document.getElementById('lote-peso').value = '';
        document.getElementById('modal-personalizado').classList.add('active');
    } else {
        atualizarPesoMedio();
    }
}

// Função para verificar Personalizado na edição
function verificarPersonalizadoEdit() {
    const select = document.getElementById('edit-lote-categoria');
    if (select.value === 'Personalizado') {
        document.getElementById('edit-lote-peso').value = '';
        document.getElementById('modal-personalizado').classList.add('active');
        const pesoEdit = document.getElementById('edit-lote-peso').value;
        if (pesoEdit && pesoEdit > 0) {
            document.getElementById('param-peso-medio').value = pesoEdit;
        }
    } else {
        atualizarPesoMedioEdit();
    }
}

// Função para confirmar Personalizado na edição
function confirmarPersonalizadoEdit() {
    const peso = parseFloat(document.getElementById('param-peso-medio').value) || 0;
    const consumo = parseFloat(document.getElementById('param-consumo-base').value) || 0.8;
    if (!peso || peso < 50 || peso > 1200) {
        alert('Peso médio deve ser entre 50 e 1200 kg');
        return;
    }
    window.personalizadoParamsEdit = { peso_medio: peso, consumo_base: consumo };
    document.getElementById('edit-lote-peso').value = peso;
    fecharModal('modal-personalizado');
}

// Sobrescrever confirmarPersonalizado para edição também
function confirmarPersonalizado() {
    const peso = parseFloat(document.getElementById('param-peso-medio').value) || 0;
    const consumo = parseFloat(document.getElementById('param-consumo-base').value) || 0.8;
    if (!peso || peso < 50 || peso > 1200) {
        alert('Peso médio deve ser entre 50 e 1200 kg');
        return;
    }
    if (consumo < 0.1 || consumo > 3.0) {
        alert('Consumo base deve ser entre 0.1 e 3.0 cm/dia');
        return;
    }
    window.personalizadoParams = { peso_medio: peso, consumo_base: consumo };
    document.getElementById('lote-peso').value = peso;
    fecharModal('modal-personalizado');
}

// Função para atualizar peso médio baseado na categoria (CRIAÇÃO)
function atualizarPesoMedio() {
    const categoriaSelect = document.getElementById('lote-categoria');
    const pesoInput = document.getElementById('lote-peso');
    if (!categoriaSelect || !pesoInput) return;
    const categoria = categoriaSelect.value;
    if (categoria === 'Personalizado') return;
    const peso = pesosCategorias[categoria];
    if (peso !== undefined && peso !== null) pesoInput.value = peso;
}

// Função para atualizar peso médio (EDIÇÃO)
function atualizarPesoMedioEdit() {
    const categoriaSelect = document.getElementById('edit-lote-categoria');
    const pesoInput = document.getElementById('edit-lote-peso');
    if (!categoriaSelect || !pesoInput) return;
    const categoria = categoriaSelect.value;
    if (categoria === 'Personalizado') return;
    const peso = pesosCategorias[categoria];
    if (peso !== undefined && peso !== null) pesoInput.value = peso;
}

// Inicialização
window.addEventListener('load', function() {
    fetch('/api/data-teste')
        .then(r => {
            if (!r.ok) throw new Error('Offline/Server Error');
            return r.json();
        })
        .then(data => {
            if (data.modo === 'teste' && data.data) dataTeste = new Date(data.data + 'T12:00:00');
        })
        .catch((err) => {
            console.warn('Usando data local (offline):', err);
            dataTeste = null;
        })
        .finally(() => {
            carregarLotesComDataTeste();
            // Aumentar intervalo para 1 minuto quando offline ou reduzir frequência
            setInterval(() => carregarLotesComDataTeste(), 60000);
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) carregarLotesComDataTeste();
            });
        });
});

function carregarLotesComDataTeste() {
    fetch('/api/data-teste')
        .then(r => {
            if (!r.ok) throw new Error('API Error');
            return r.json();
        })
        .then(data => {
            if (data.modo === 'teste' && data.data) dataTeste = new Date(data.data + 'T12:00:00');
            else dataTeste = null;
        })
        .catch(() => { dataTeste = null; })
        .finally(() => {
            carregarLotes();
            carregarPiquetesSelect();
        });
}

function carregarLotes() {
    const status = document.getElementById('filtro-status').value;
    const categoria = document.getElementById('filtro-categoria').value;
    const busca = (document.getElementById('filtro-busca-lote')?.value || '').toLowerCase();
    fetch(`/api/lotes?fazenda_id=${fazendaId}&status=${status}&categoria=${categoria}`)
        .then(r => r.json())
        .then(data => {
            // Garantir que lotes seja sempre um array para não quebrar o .filter/.map
            lotes = Array.isArray(data) ? data : [];
            if (busca) {
                lotes = lotes.filter(l => {
                    const texto = `${l.nome || ''} ${l.categoria || ''}`.toLowerCase();
                    return texto.includes(busca);
                });
            }
            renderizarTabela();
            atualizarStats();
        })
        .catch(err => {
            console.error('Erro ao carregar lotes:', err);
            lotes = [];
            renderizarTabela();
        });
}

function atualizarStats() {
    if (!Array.isArray(lotes)) {
        document.getElementById('stat-total').textContent = '0';
        document.getElementById('stat-ocupacao').textContent = '0';
        document.getElementById('stat-saida').textContent = '0';
        document.getElementById('stat-animais').textContent = '0';
        return;
    }
    document.getElementById('stat-total').textContent = lotes.length;
    const emOcupacao = lotes.filter(l => l.piquete_atual_id).length;
    document.getElementById('stat-ocupacao').textContent = emOcupacao;
    const precisaSair = lotes.filter(l => l.piquete_atual_id && (l.status_info?.status === 'RETIRAR')).length;
    document.getElementById('stat-saida').textContent = precisaSair;
    const totalAnimais = lotes.reduce((sum, l) => sum + (l.quantidade || 0), 0);
    document.getElementById('stat-animais').textContent = totalAnimais;
}

function renderizarTabela() {
    const tbody = document.getElementById('lista-lotes');
    if (!Array.isArray(lotes) || lotes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><h3><i class="fa-solid fa-face-frown"></i> Nenhum lote encontrado</h3><p>Cadastre o primeiro lote ou ajuste os filtros.</p></td></tr>`;
        return;
    }
    // Buscar todos os piquetes de uma vez
    fetch(`/api/piquetes?fazenda_id=${fazendaId}&_=${Date.now()}`)
        .then(r => r.json())
        .then(data => {
            // Garantir que data seja sempre um array
            const allPiquetes = Array.isArray(data) ? data : [];
            
            // Processar piquetes para adicionar status calculado
            const piquetesProcessados = allPiquetes.map(p => {
                const altura = p.altura_estimada || 0;
                const entrada = p.altura_entrada || 25;
                p.statusCalc = altura >= entrada ? 'APTO' : 'RECUPERANDO';
                return p;
            });
            
            // Criar mapa de sugestoes por lote (todos os disponíveis para cada lote)
            const sugestoesMap = {};
            lotes.forEach(l => {
                // Filtrar disponíveis (sem animais) E com medição (altura_real_medida OU data_medicao)
                const disponiveis = piquetesProcessados.filter(p => 
                    (!p.animais_no_piquete || p.animais_no_piquete === 0) && 
                    (p.altura_real_medida || p.data_medicao)
                );
                sugestoesMap[l.id] = disponiveis;
            });
            
            tbody.innerHTML = lotes.map((lote, idx) => {
            const sugestoes = sugestoesMap[lote.id] || [];
            const temPiquete = !!lote.piquete_atual_id;
            const statusCalc = lote.status_info ? lote.status_info.status : (lote.status_calculado || '');
            
            let statusBadge = !temPiquete ? '<span class="status-badge aguardando"><i class="fa-regular fa-circle"></i> Aguardando Alocação</span>' : 
                (statusCalc === 'RETIRAR' ? '<span class="status-badge retirar"><i class="fa-solid fa-circle" style="color:#dc3545;"></i> Retirar</span>' : 
                (statusCalc === 'ATENCAO' ? '<span class="status-badge atencao"><i class="fa-solid fa-circle" style="color:#fd7e14;"></i> Atenção</span>' : 
                '<span class="status-badge ocupacao"><i class="fa-solid fa-circle" style="color:#007bff;"></i> Em Ocupação</span>'));
            
            let diasHtml = !temPiquete ? '<span style="color: #999;">—</span>' : (function(){
                const diasPassados = calcularDiasPassados(lote.data_entrada);
                const dataFormatada = formatarData(lote.data_entrada);
                const diasRestantes = Math.max(0, (lote.dias_tecnicos || 0) - diasPassados);
                return `<div class="dias-info"><span class="atual">${lote.dias_tecnicos || 0}</span> dias técnicos${dataFormatada ? `<br><small><i class="fa-regular fa-calendar"></i> Entrada: ${dataFormatada}</small>` : ''}${diasPassados !== null ? `<br><small style="color: #007bff;"><i class="fa-solid fa-clock"></i> ${diasPassados} dia(s)</small>` : ''}${diasRestantes > 0 ? `<br><small style="color: #28a745;"><i class="fa-solid fa-chart-simple"></i> ${diasRestantes} dias restantes</small>` : ''}</div>`;
            })();
            
            let piqueteInfo = temPiquete ? `${lote.piquete_nome}<br><small style="color: #28a745;"><i class="fa-solid fa-ruler-vertical"></i> ${lote.altura_estimada || '?'}cm</small>` : '<span style="color: #999;">Sem piquete</span>';
            
            let proximoHtml = sugestoes.length > 0 ? (function(){
                const aptos = sugestoes.filter(p => p.statusCalc === 'APTO').length;
                const emRecup = sugestoes.filter(p => p.statusCalc === 'RECUPERANDO').length;
                return `<button class="btn btn-sm" style="background: #6c757d; color: white;" onclick="abrirModalTodosPiquetes(${lote.id})"><i class="fa-solid fa-list"></i> Ver ${sugestoes.length} opções</button><br><small style="color: #28a745;"><i class="fa-solid fa-circle" style="color:#28a745;"></i> ${aptos} aptos</small>${emRecup > 0 ? `<br><small style="color: #856404;"><i class="fa-solid fa-circle" style="color:#ffc107;"></i> ${emRecup} em recup.</small>` : ''}`;
            })() : '<span style="font-size: 0.85rem; color: #999;"><i class="fa-solid fa-triangle-exclamation"></i> Nenhum disponível</span>';
            
            let actions = (function(){
                const aptos = sugestoes.filter(p => p.statusCalc === 'APTO');
                if (temPiquete) return `<button class="btn-mover" onclick="abrirModalMover(${lote.id}, '${lote.nome}')"><i class="fa-solid fa-arrow-right"></i> Mover</button><button class="btn-sair" onclick="registrarSaida(${lote.id})"><i class="fa-solid fa-right-from-bracket"></i> Sair</button><button class="btn-edit" onclick="abrirModalEditar(${lote.id})"><i class="fa-solid fa-pen"></i> Edit</button>`;
                if (aptos.length > 0) return `<button class="btn-mover" onclick="abrirModalMover(${lote.id}, '${lote.nome}')"><i class="fa-solid fa-arrow-right"></i> Alocar</button><button class="btn-edit" onclick="abrirModalEditar(${lote.id})"><i class="fa-solid fa-pen"></i> Edit</button>`;
                return `<button class="btn-edit" onclick="abrirModalEditar(${lote.id})"><i class="fa-solid fa-pen"></i> Edit</button>`;
            })();
            
            return `<tr><td style="cursor: pointer;" onclick="abrirModalDetalhes(${lote.id})"><strong style="color: #007bff;">${lote.nome}</strong><br><small style="color: #666;">${lote.categoria || '-'} • ${lote.quantidade || 0} animai(s)</small></td><td>${piqueteInfo}</td><td>${diasHtml}</td><td>${statusBadge}</td><td>${proximoHtml}</td><td>${actions}</td></tr>`;
        }).join('');
    });
}

function carregarPiquetesSelect() {
    fetch('/api/piquetes?fazenda_id=' + fazendaId + '&_=' + Date.now())
        .then(r => r.json())
        .then(data => {
            console.log('[DEBUG] Piquetes recebidos:', data);
            const select = document.getElementById('lote-piquete');
            if (!select) return;
            
            // Garantir que data seja sempre um array
            const piquetes = Array.isArray(data) ? data : [];
            
            // Filtrar disponíveis (sem animais) E com medição (altura_real_medida OU data_medicao)
            const disponiveis = piquetes.filter(p => 
                (!p.animais_no_piquete || p.animais_no_piquete === 0) && 
                (p.altura_real_medida || p.data_medicao)
            );
            select.innerHTML = '<option value="">Nenhum (lote sem piquete)</option>' +
                disponiveis.map(p => {
                    // Calcular status localmente: APTO se altura_estimada >= altura_entrada
                    const altura = p.altura_estimada || 0;
                    const entrada = p.altura_entrada || 25;
                    const statusCalc = altura >= entrada ? 'APTO' : 'RECUPERANDO';
                    const emoji = p.bloqueado ? '<i class="fa-solid fa-circle" style="color:#dc3545;"></i>' : (statusCalc === 'APTO' ? '<i class="fa-solid fa-circle" style="color:#28a745;"></i>' : '<i class="fa-solid fa-circle" style="color:#ffc107;"></i>');
                    return `<option value="${p.id}">${p.nome} (${p.capim || 'N/I'}) ${emoji} ${p.bloqueado ? 'BLOQUEADO' : statusCalc}</option>`;
                }).join('');
        });
}

function abrirModalNovoLote() {
    window.personalizadoParams = null;
    document.getElementById('lote-nome').value = '';
    document.getElementById('lote-quantidade').value = '1';
    document.getElementById('lote-categoria').selectedIndex = 0;
    document.getElementById('lote-peso').value = 200;
    document.getElementById('modal-lote').classList.add('active');
    carregarPiquetesSelect();
}

async function salvarLote() {
    const nome = document.getElementById('lote-nome').value;
    if (!nome) return alert('Digite o nome do lote!');
    const categoria = document.getElementById('lote-categoria').value;
    let peso_medio = parseFloat(document.getElementById('lote-peso').value) || 0;
    let payload = {
        nome, categoria,
        quantidade: parseInt(document.getElementById('lote-quantidade').value) || 1,
        peso_medio,
        piquete_id: document.getElementById('lote-piquete').value || null
    };
    if (categoria === 'Personalizado') {
        if (!window.personalizadoParams) return alert('Configure os parâmetros técnicos do Personalizado!');
        payload.peso_medio = window.personalizadoParams.peso_medio;
        payload.consumo_base = window.personalizadoParams.consumo_base;
    }
    try {
        const r = await fetch('/api/lotes', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        if (!r.ok) {
            const msg = await parseErrorResponse(r, 'Erro ao criar lote');
            throw new Error(msg);
        }
        const data = await r.json();
        if (data.status === 'ok') { fecharModal('modal-lote'); carregarLotes(); alert('Lote criado com sucesso!'); }
    } catch (err) {
        alert(err.message || 'Erro ao criar lote');
    }
}

function abrirModalMover(loteId, nome) {
    document.getElementById('mover-lote-id').value = loteId;
    document.getElementById('mover-lote-nome').textContent = nome;
    document.getElementById('modal-mover').classList.add('active');
    fetch(`/api/piquetes?fazenda_id=${fazendaId}&_=${Date.now()}`)
        .then(r => r.json()).then(allPiquetes => {
            // Processar e calcular status E filtrar com medição (altura_real_medida OU data_medicao)
            const disponiveis = allPiquetes
                .filter(p => (!p.animais_no_piquete || p.animais_no_piquete === 0) && (p.altura_real_medida || p.data_medicao))
                .map(p => {
                    const altura = p.altura_estimada || 0;
                    const entrada = p.altura_entrada || 25;
                    p.statusCalc = altura >= entrada ? 'APTO' : 'RECUPERANDO';
                    return p;
                });
            
            const container = document.getElementById('sugestoes-piquetes');
            const aptos = disponiveis.filter(p => p.statusCalc === 'APTO');
            if (aptos.length === 0) {
                container.innerHTML = '';
                document.getElementById('sem-piquetes-aptos').style.display = 'block';
            } else {
                document.getElementById('sem-piquetes-aptos').style.display = 'none';
                container.innerHTML = aptos.map(p => `
                    <div class="sugestao-item apto" onclick="selecionarPiquete(${p.id}, this)">
                        <div class="sugestao-header"><span class="sugestao-nome">${p.nome}</span><span class="sugestao-badge badge-apto"><i class="fa-solid fa-circle" style="color:#28a745;"></i> APTO</span></div>
                        <div class="sugestao-info">${p.capim} • ${p.area} ha • ${p.dias_descanso} dias descanso</div>
                    </div>
                `).join('');
            }
        });
}

async function parseErrorResponse(response, fallback = 'Erro') {
    try {
        const js = await response.json();
        return js?.error || js?.message || fallback;
    } catch (e) {
        const txt = await response.text().catch(() => '');
        return txt || fallback;
    }
}

let piqueteSelecionado = null;
function selecionarPiquete(id, el) {
    document.querySelectorAll('.sugestao-item').forEach(i => i.classList.remove('selecionado'));
    el.classList.add('selecionado');
    piqueteSelecionado = id;
}

async function confirmarMovimentacao() {
    if (!piqueteSelecionado) return alert('Selecione um piquete!');
    try {
        const r = await fetch(`/api/lotes/${document.getElementById('mover-lote-id').value}/mover?fazenda_id=${fazendaId}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ piquete_destino_id: piqueteSelecionado })
        });
        if (!r.ok) {
            const msg = await parseErrorResponse(r, 'Erro ao mover lote');
            throw new Error(msg);
        }
        const data = await r.json();
        if (data.status === 'ok') { fecharModal('modal-mover'); carregarLotes(); alert('Lote movido!'); piqueteSelecionado = null; }
    } catch (err) {
        alert(err.message || 'Erro ao mover lote');
    }
}

async function registrarSaida(loteId) {
    if (!confirm('Registrar saída do lote?')) return;
    try {
        const r = await fetch(`/api/lotes/${loteId}/sair?fazenda_id=${fazendaId}`, {method: 'POST'});
        if (!r.ok) {
            const msg = await parseErrorResponse(r, 'Erro ao registrar saída');
            throw new Error(msg);
        }
        const data = await r.json();
        if (data.status === 'ok') carregarLotes();
    } catch (err) {
        alert(err.message || 'Erro ao registrar saída');
    }
}

function abrirModalEditar(loteId) {
    const lote = lotes.find(l => l.id === loteId);
    if (!lote) return;
    document.getElementById('edit-lote-id').value = lote.id;
    document.getElementById('edit-lote-nome').value = lote.nome;
    document.getElementById('edit-lote-categoria').value = lote.categoria || '';
    document.getElementById('edit-lote-quantidade').value = lote.quantidade || 1;
    document.getElementById('edit-lote-peso').value = lote.peso_medio || 0;
    document.getElementById('aviso-piquete-recuperacao').style.display = 'none';
    window.personalizadoParamsEdit = lote.categoria === 'Personalizado' ? { peso_medio: lote.peso_medio, consumo_base: lote.consumo_base } : null;
    
    fetch('/api/piquetes?fazenda_id=' + fazendaId + '&_=' + Date.now())
        .then(r => r.json()).then(allPiquetes => {
            // Filtrar disponíveis (sem animais ou o atual do lote) E com medição (altura_real_medida OU data_medicao)
            const disponiveis = allPiquetes.filter(p => 
                (!p.animais_no_piquete || p.animais_no_piquete === 0 || p.id === lote.piquete_atual_id) && 
                (p.altura_real_medida || p.data_medicao)
            );
            // Calcular status
            disponiveis.forEach(p => {
                const altura = p.altura_estimada || 0;
                const entrada = p.altura_entrada || 25;
                p.statusCalc = altura >= entrada ? 'APTO' : 'RECUPERANDO';
            });
            
            const select = document.getElementById('edit-lote-piquete');
            let html = '<option value=""><i class="fa-solid fa-ban"></i> Sem piquete</option>';
            disponiveis.forEach(p => {
                const isRecuperando = !p.bloqueado && p.statusCalc === 'RECUPERANDO';
                const emoji = p.bloqueado ? '<i class="fa-solid fa-circle" style="color:#dc3545;"></i>' : (p.statusCalc === 'APTO' ? '<i class="fa-solid fa-circle" style="color:#28a745;"></i>' : '<i class="fa-solid fa-circle" style="color:#ffc107;"></i>');
                html += `<option value="${p.id}" ${lote.piquete_atual_id === p.id ? 'selected' : ''} style="${isRecuperando ? 'background:#f8d7da;' : ''}">${p.nome} (${p.capim || 'N/I'}) ${emoji} ${p.bloqueado ? 'BLOQUEADO' : p.statusCalc}</option>`;
            });
            select.innerHTML = html;
        });
    document.getElementById('modal-editar').classList.add('active');
}

function verificarPiqueteRecuperacao() {
    const id = document.getElementById('edit-lote-piquete').value;
    if (!id) { document.getElementById('aviso-piquete-recuperacao').style.display = 'none'; return; }
    fetch('/api/piquetes/' + id).then(r => r.json()).then(p => {
        const emRecup = p.altura_atual && p.altura_atual < p.altura_entrada && !p.bloqueado;
        document.getElementById('aviso-piquete-recuperacao').style.display = emRecup ? 'block' : 'none';
    });
}

function limparPiqueteEdicao() { document.getElementById('edit-lote-piquete').value = ''; document.getElementById('aviso-piquete-recuperacao').style.display = 'none'; }

function abrirModalDetalhes(loteId) {
    const lote = lotes.find(l => l.id === loteId);
    if (!lote) return;

    const quantidade = lote.quantidade || 0;
    const pesoMedio = lote.peso_medio || 0;
    const pesoTotal = quantidade * pesoMedio;
    const ua = pesoTotal / 450;
    const statusCalc = lote.status_info ? lote.status_info.status : (lote.status_calculado || 'OK');
    const statusLabel = String(statusCalc)
        .replaceAll('_', ' ')
        .replace('OCUPACAO', 'OCUPAÇÃO');
    const diasTecnicos = lote.dias_tecnicos || 0;
    const diasPassados = calcularDiasPassados(lote.data_entrada);
    const diasRestantes = diasPassados !== null ? Math.max(0, diasTecnicos - diasPassados) : null;

    const dataEntradaFmt = formatarData(lote.data_entrada) || '-';

    let dataSaidaPrevistaFmt = '-';
    if (lote.data_saida_prevista) {
        const saidaFmt = formatarData(lote.data_saida_prevista);
        dataSaidaPrevistaFmt = saidaFmt || '-';
    } else if (lote.data_entrada && Number.isFinite(diasTecnicos) && diasTecnicos > 0) {
        const d = new Date(lote.data_entrada);
        if (!isNaN(d.getTime())) {
            d.setDate(d.getDate() + Number(diasTecnicos));
            const dia = String(d.getDate()).padStart(2, '0');
            const mes = String(d.getMonth() + 1).padStart(2, '0');
            const ano = d.getFullYear();
            if (Number.isFinite(ano)) {
                dataSaidaPrevistaFmt = `${dia}/${mes}/${ano}`;
            }
        }
    }

    const consumoBase = lote.consumo_base || 0.8;
    const areaPiquete = lote.piquete_area || lote.area_piquete || lote.area || null;
    let consumoEstimado = null;
    if (areaPiquete && areaPiquete > 0) {
        const uaHa = ua / areaPiquete;
        consumoEstimado = +(consumoBase * (uaHa / 2)).toFixed(2);
    }

    const alturaCapim = (lote.altura_estimada !== null && lote.altura_estimada !== undefined)
        ? `${lote.altura_estimada} cm`
        : 'N/I';

    const html = `
        <div style="text-align:center;margin-bottom:20px;">
            <h2 style="color:#007bff;">${lote.nome}</h2>
            <span class="status-badge ${String(statusCalc).toLowerCase()}">${statusLabel}</span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;">
            <div style="background:#e3f2fd;padding:12px;border-radius:10px;text-align:center;"><strong>${quantidade}</strong><br><small>Animais</small></div>
            <div style="background:#fff3cd;padding:12px;border-radius:10px;text-align:center;"><strong>${(pesoMedio).toFixed(0)} kg</strong><br><small>Peso médio</small></div>
            <div style="background:#d1ecf1;padding:12px;border-radius:10px;text-align:center;"><strong>${(pesoTotal).toFixed(0)} kg</strong><br><small>Peso total estimado</small></div>
            <div style="background:#e8f5e9;padding:12px;border-radius:10px;text-align:center;"><strong>${ua.toFixed(2)}</strong><br><small>UA total</small></div>
        </div>

        <div style="background:#f8f9fa;padding:15px;border-radius:10px;margin-bottom:12px;">
            <strong><i class="fa-solid fa-map-location-dot"></i> Piquete:</strong> ${lote.piquete_nome || 'Sem piquete'}<br>
            <strong><i class="fa-solid fa-ruler-vertical"></i> Altura estimada do capim:</strong> ${alturaCapim}<br>
            <strong><i class="fa-solid fa-tags"></i> Categoria:</strong> ${lote.categoria || '-'}<br>
            <strong><i class="fa-solid fa-flask"></i> Consumo base:</strong> ${consumoBase} cm/dia
            ${consumoEstimado !== null ? `<br><strong><i class="fa-solid fa-chart-line"></i> Consumo diário estimado do lote:</strong> ${consumoEstimado} cm/dia` : ''}
        </div>

        <div style="background:#fff8e1;padding:15px;border-radius:10px;margin-bottom:15px;">
            <strong><i class="fa-solid fa-arrow-right-to-bracket"></i> Entrada:</strong> ${dataEntradaFmt}<br>
            <strong><i class="fa-solid fa-calendar-day"></i> Saída prevista:</strong> ${dataSaidaPrevistaFmt}<br>
            <strong><i class="fa-solid fa-chart-simple"></i> Dias técnicos:</strong> ${diasTecnicos}<br>
            <strong><i class="fa-solid fa-clock"></i> Dias passados:</strong> ${diasPassados !== null ? diasPassados : '-'}<br>
            <strong><i class="fa-solid fa-hourglass-half"></i> Dias restantes:</strong> ${diasRestantes !== null ? diasRestantes : '-'}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <button class="btn btn-primary" onclick="fecharModal('modal-detalhes'); abrirModalEditar(${lote.id});"><i class="fa-solid fa-pen"></i> Editar</button>
            <button class="btn btn-warning" onclick="fecharModal('modal-detalhes'); registrarSaida(${lote.id});"><i class="fa-solid fa-right-from-bracket"></i> Sair</button>
        </div>`;

    document.getElementById('detalhes-lote-conteudo').innerHTML = html;
    document.getElementById('modal-detalhes').classList.add('active');
}

async function salvarEdicaoLote() {
    const id = document.getElementById('edit-lote-id').value;
    const payload = {
        nome: document.getElementById('edit-lote-nome').value,
        categoria: document.getElementById('edit-lote-categoria').value,
        quantidade: parseInt(document.getElementById('edit-lote-quantidade').value) || 1,
        peso_medio: parseFloat(document.getElementById('edit-lote-peso').value) || 0,
        piquete_atual_id: document.getElementById('edit-lote-piquete').value || null
    };
    try {
        const r = await fetch(`/api/lotes/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        if (!r.ok) {
            const msg = await parseErrorResponse(r, 'Erro ao atualizar lote');
            throw new Error(msg);
        }
        const data = await r.json();
        if (data.status === 'ok') { fecharModal('modal-editar'); carregarLotes(); alert('Lote atualizado!'); }
    } catch (err) {
        alert(err.message || 'Erro ao atualizar lote');
    }
}

async function excluirLote() {
    const id = document.getElementById('edit-lote-id').value;
    if (!confirm(`Excluir lote?`)) return;
    try {
        const r = await fetch(`/api/lotes/${id}`, {method: 'DELETE'});
        if (!r.ok) {
            const msg = await parseErrorResponse(r, 'Erro ao excluir lote');
            throw new Error(msg);
        }
        const data = await r.json();
        if (data.status === 'ok') { fecharModal('modal-editar'); carregarLotes(); }
    } catch (err) {
        alert(err.message || 'Erro ao excluir lote');
    }
}

async function atualizarStatus() {
    try {
        const r = await fetch(`/api/lotes/atualizar-status?fazenda_id=${fazendaId}`, {method: 'POST'});
        if (!r.ok) {
            const msg = await parseErrorResponse(r, 'Erro ao atualizar status');
            throw new Error(msg);
        }
        const data = await r.json();
        if (data.status === 'ok') carregarLotes();
    } catch (err) {
        alert(err.message || 'Erro ao atualizar status');
    }
}

function abrirModalTodosPiquetes(loteId) {
    document.getElementById('modal-todos-piquetes').classList.add('active');
    fetch(`/api/piquetes?fazenda_id=${fazendaId}&_=${Date.now()}`)
        .then(r => r.json()).then(allPiquetes => {
            // Processar e calcular status E filtrar com medição (altura_real_medida OU data_medicao)
            const disponiveis = allPiquetes
                .filter(p => (!p.animais_no_piquete || p.animais_no_piquete === 0) && (p.altura_real_medida || p.data_medicao))
                .map(p => {
                    const altura = p.altura_estimada || 0;
                    const entrada = p.altura_entrada || 25;
                    p.statusCalc = altura >= entrada ? 'APTO' : 'RECUPERANDO';
                    return p;
                });
            
            const container = document.getElementById('lista-todos-piquetes');
            container.innerHTML = disponiveis.map(p => `
                <div class="sugestao-item ${p.statusCalc === 'APTO' ? 'apto' : 'quase'}" onclick="selecionarPiquete(${p.id}, this)">
                    <div class="sugestao-header"><span class="sugestao-nome">${p.nome}</span><span class="sugestao-badge ${p.statusCalc === 'APTO' ? 'badge-apto' : 'badge-quase'}">${p.statusCalc}</span></div>
                    <div class="sugestao-info">${p.capim} • ${p.area} ha • ${p.dias_descanso} dias descanso</div>
                </div>
            `).join('');
        });
}

function fecharModal(id) { document.getElementById(id).classList.remove('active'); }
function fecharModalLote() { fecharModal('modal-lote'); }