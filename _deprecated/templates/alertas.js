// Scripts de Alertas para Sistema de Pastagens
// Adicionar no fazenda.html antes do </script>

// Carregar alertas ao iniciar
function carregarAlertas() {
    fetch('/api/alertas/contar')
        .then(r => r.json())
        .then(data => {
            const badge = document.getElementById('alerta-badge');
            if (badge) {
                if (data.total > 0) {
                    badge.textContent = data.total;
                    badge.style.display = 'inline-block';
                    badge.style.background = '#dc3545';
                    badge.style.color = 'white';
                    badge.style.borderRadius = '50%';
                    badge.style.padding = '2px 6px';
                    badge.style.fontSize = '0.7rem';
                } else {
                    badge.style.display = 'none';
                }
            }
        });
}

// Exibir alertas
function exibirAlertas() {
    fetch('/api/alertas')
        .then(r => r.json())
        .then(alertas => {
            const container = document.getElementById('alertas-container');
            if (!container) return;
            
            if (alertas.length === 0) {
                container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">Nenhum alerta! 🎉</p>';
                return;
            }
            
            container.innerHTML = alertas.map(a => `
                <div style="padding: 12px; border-bottom: 1px solid #eee; ${a.lido ? 'opacity: 0.5;' : ''}" onclick="marcarAlertaLido(${a.id})">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.2rem;">${getEmojiAlerta(a.tipo)}</span>
                        <div>
                            <strong style="color: #1a1a2e; font-size: 0.9rem;">${a.titulo}</strong>
                            <p style="color: #666; font-size: 0.8rem; margin: 3px 0;">${a.mensagem}</p>
                            <small style="color: #999; font-size: 0.75rem;">${formatarData(a.created_at)}</small>
                        </div>
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
    fetch('/api/alertas/' + id + '/ler', {method: 'POST'})
        .then(r => r.json())
        .then(data => {
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
    fetch('/api/alertas/verificar', {method: 'POST'})
        .then(r => r.json())
        .then(data => {
            alert('Verificação concluída! ' + (data.alertas_criados ? data.alertas_criados.length + ' alertas criados' : 'Nenhum alerta novo'));
            carregarAlertas();
            exibirAlertas();
        });
}

// Adicionar ao window.onload
// window.onload = function() {
//     initMap();
//     loadAll();
//     injetarLotacaoUI();
//     carregarLotacao();
//     carregarAlertas();
// };
