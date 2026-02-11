// Script para adicionar seção de lotação no dashboard
(function() {
    // Esperar o DOM carregar
    document.addEventListener('DOMContentLoaded', function() {
        // Encontrar o stats-grid e adicionar cards de lotação
        const statsGrid = document.querySelector('.stats-grid');
        if (!statsGrid) return;
        
        // Adicionar cards de lotação ao stats-grid
        const lotacaoCards = document.createElement('div');
        lotacaoCards.style.cssText = 'grid-column: span 4; display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 15px;';
        lotacaoCards.innerHTML = `
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
        
        statsGrid.parentNode.insertBefore(lotacaoCards, statsGrid.nextSibling);
        
        // Adicionar label de referência
        const refLabel = document.createElement('p');
        refLabel.style.cssText = 'color: #666; font-size: 0.8rem; margin-top: 12px;';
        refLabel.innerHTML = '💡 <strong>Referência:</strong> 2-4 UA/ha = ideal | Abaixo de 2 = subutilizado | Acima de 4 = sobrecarga';
        lotacaoCards.parentNode.insertBefore(refLabel, lotacaoCards.nextSibling);
    });
})();
