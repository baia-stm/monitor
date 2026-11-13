const API_URL = '/api';

document.addEventListener('DOMContentLoaded', () => {
    loadDevicesSelect();
    loadLogs();
});

async function loadDevicesSelect() {
    try {
        const response = await fetch(`${API_URL}/devices`);
        const devices = await response.json();
        const select = document.getElementById('filterDevice');
        
        devices.forEach(dev => {
            const option = document.createElement('option');
            option.value = dev.id;
            option.textContent = dev.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Erro:', error);
    }
}

async function loadLogs() {
    const deviceId = document.getElementById('filterDevice').value;
    const dateFrom = document.getElementById('filterDateFrom').value;
    const dateTo = document.getElementById('filterDateTo').value;
    
    let url = `${API_URL}/logs?limit=200`;
    if (deviceId) url += `&device_id=${deviceId}`;
    if (dateFrom) url += `&date_from=${dateFrom}`;
    if (dateTo) url += `&date_to=${dateTo}`;
    
    try {
        const response = await fetch(url);
        const logs = await response.json();
        
        const tbody = document.querySelector('#logsTable tbody');
        tbody.innerHTML = logs.map(log => {
            const date = new Date(log.timestamp).toLocaleString();
            const statusClass = log.status === 'online' ? 'online' : 
                               (log.packet_loss > 0 ? 'warning' : 'offline');
            
            let packetLossClass = 'low';
            if (log.packet_loss > 10) packetLossClass = 'high';
            else if (log.packet_loss > 0) packetLossClass = 'medium';
            
            return `
                <tr>
                    <td>${date}</td>
                    <td>${log.device_name}</td>
                    <td>${log.ip_address}</td>
                    <td><span class="status-badge ${statusClass}">${log.status}</span></td>
                    <td>${log.ping_time} ms</td>
                    <td class="packet-loss ${packetLossClass}">${log.packet_loss}%</td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Erro ao carregar logs:', error);
    }
}

async function clearLogs() {
    const deviceId = document.getElementById('filterDevice').value;
    const scope = deviceId ? 'do equipamento selecionado' : 'de todos os equipamentos';

    if (!confirm(`Tem certeza que deseja apagar os registros ${scope}? Esta ação não pode ser desfeita.`)) return;

    try {
        let url = `${API_URL}/logs`;
        if (deviceId) url += `?device_id=${deviceId}`;

        const response = await fetch(url, { method: 'DELETE' });
        const data = await response.json();

        alert(data.message || 'Registros removidos com sucesso.');
        loadLogs();
    } catch (error) {
        alert('Erro ao limpar registros: ' + error.message);
    }
}

function exportCSV() {
    const table = document.getElementById('logsTable');
    let csv = [];
    
    // Headers
    const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent);
    csv.push(headers.join(';'));
    
    // Rows
    table.querySelectorAll('tbody tr').forEach(tr => {
        const row = Array.from(tr.querySelectorAll('td')).map(td => td.textContent);
        csv.push(row.join(';'));
    });
    
    // Download
    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-pings-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}