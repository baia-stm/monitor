// Registrar Service Worker (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('✅ Service Worker registrado:', registration.scope);
      })
      .catch(error => {
        console.log('❌ Falha ao registrar SW:', error);
      });
  });
}

// Solicitar permissão de notificações
if ('Notification' in navigator) {
  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      console.log('🔔 Notificações permitidas');
    }
  });
}

// Função para notificar offline
function notifyOffline(device) {
  if (Notification.permission === 'granted' && document.visibilityState === 'hidden') {
    new Notification(`🔴 ${device.name} Offline`, {
      body: `O equipamento ${device.ip_address} está fora do ar!`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: `offline-${device.id}`,
      requireInteraction: true
    });
  }
}

// Função para notificar perda de pacotes
function notifyPacketLoss(device) {
  if (Notification.permission === 'granted' && document.visibilityState === 'hidden') {
    new Notification(`🟠 ${device.name} - Perda de Pacotes`, {
      body: `Perda de ${device.packet_loss}% detectada em ${device.ip_address}`,
      icon: '/icons/icon-192x192.png',
      tag: `loss-${device.id}`
    });
  }
}

const API_URL = '/api';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
let pingIntervalId;
let devicesData = [];
let categoriesData = [];

// Configurações salvas
let config = {
    viewMode: 'grid', // 'grid' ou 'list'
    sortBy: 'name',
    sortOrder: 'asc', // 'asc' ou 'desc'
    cardSize: 280,
    selectedCategories: [], // vazio = todas
    pingInterval: 10 // segundos
};

// Carregar config do localStorage
function loadConfig() {
    const saved = localStorage.getItem('dashboardConfig');
    if (saved) {
        config = { ...config, ...JSON.parse(saved) };
    }
    
    // Aplicar configs na UI
    document.getElementById('cardSize').value = config.cardSize;
    document.getElementById('sizeValue').textContent = config.cardSize + 'px';
    document.getElementById('sortBy').value = config.sortBy;
    document.getElementById('pingInterval').value = config.pingInterval;
    updateSortIcon();
    applyCardSize();
    
    if (config.viewMode === 'list') {
        document.getElementById('viewGrid').classList.remove('active');
        document.getElementById('viewList').classList.add('active');
        document.getElementById('devices-container').className = 'devices-list';
    }
}

function saveConfig() {
    localStorage.setItem('dashboardConfig', JSON.stringify(config));
}

// Atualizar tamanho dos cards
function applyCardSize() {
    document.documentElement.style.setProperty('--card-size', config.cardSize + 'px');
    document.getElementById('sizeValue').textContent = config.cardSize + 'px';
}

// Atualizar ícone de ordenação
function updateSortIcon() {
    const icon = document.querySelector('#sortOrder i');
    if (config.sortOrder === 'asc') {
        icon.className = 'fas fa-sort-amount-down';
    } else {
        icon.className = 'fas fa-sort-amount-up';
    }
}

// Carregar dados iniciais
async function loadDashboard() {
    await Promise.all([
        loadStats(),
        loadCategories(),
        loadDevices()
    ]);
}

// Estatísticas
async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/stats`);
        const stats = await response.json();
        
        document.getElementById('stat-online').textContent = stats.online || 0;
        document.getElementById('stat-warning').textContent = stats.warning || 0;
        document.getElementById('stat-offline').textContent = stats.offline || 0;
        document.getElementById('stat-total').textContent = stats.total || 0;
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
    }
}

// Carregar categorias para o filtro
async function loadCategories() {
    try {
        const response = await fetch(`${API_URL}/categories`);
        categoriesData = await response.json();
        
        const filterContainer = document.getElementById('categoryFilter');
        filterContainer.innerHTML = categoriesData.map(cat => `
            <label class="category-checkbox">
                <input type="checkbox" value="${cat.id}" 
                    ${config.selectedCategories.length === 0 || config.selectedCategories.includes(String(cat.id)) ? 'checked' : ''}>
                <span>${cat.name}</span>
            </label>
        `).join('');
        
        // Adicionar event listeners nos checkboxes
        filterContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', updateCategoryFilter);
        });
        
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
    }
}

function updateCategoryFilter() {
    const checkboxes = document.querySelectorAll('#categoryFilter input[type="checkbox"]');
    const selected = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    
    // Se todas marcadas, salva array vazio (mostra todas)
    if (selected.length === categoriesData.length) {
        config.selectedCategories = [];
    } else {
        config.selectedCategories = selected;
    }
    
    saveConfig();
    renderDevices();
}

// Carregar equipamentos
async function loadDevices() {
    try {
        const response = await fetch(`${API_URL}/devices`);
        devicesData = await response.json();
        renderDevices();
    } catch (error) {
        console.error('Erro ao carregar equipamentos:', error);
    }
}

// Ordenação
function sortDevices(devices) {
    return devices.sort((a, b) => {
        let valA, valB;
        
        switch(config.sortBy) {
            case 'ip':
                // Ordenar IP numericamente
                valA = a.ip_address.split('.').map(Number);
                valB = b.ip_address.split('.').map(Number);
                for (let i = 0; i < 4; i++) {
                    if (valA[i] !== valB[i]) {
                        valA = valA[i];
                        valB = valB[i];
                        break;
                    }
                }
                break;
            case 'category':
                valA = a.category_name || '';
                valB = b.category_name || '';
                break;
            case 'status':
                const statusOrder = { 'online': 0, 'warning': 1, 'offline': 2, 'unknown': 3 };
                valA = statusOrder[a.status] || 3;
                valB = statusOrder[b.status] || 3;
                break;
            default: // name
                valA = a.name.toLowerCase();
                valB = b.name.toLowerCase();
        }
        
        if (valA < valB) return config.sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return config.sortOrder === 'asc' ? 1 : -1;
        return 0;
    });
}

// Renderizar devices
function renderDevices() {
    let filtered = devicesData;
    
    // Aplicar filtro de categorias
    if (config.selectedCategories.length > 0) {
        filtered = devicesData.filter(d => 
            config.selectedCategories.includes(String(d.category_id))
        );
    }
    
    // Ordenar
    filtered = sortDevices([...filtered]);
    
    const container = document.getElementById('devices-container');
    
    // Atualizar contador
    document.getElementById('filtered-count').textContent = 
        `Exibindo ${filtered.length} de ${devicesData.length} equipamentos`;
    
    if (filtered.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #718096; padding: 2rem;">Nenhum equipamento encontrado</p>';
        return;
    }
    
    container.innerHTML = filtered.map(dev => createDeviceCard(dev)).join('');
}

function createDeviceCard(dev) {
    // Definir status visual
    let statusClass = dev.status || 'unknown';
    let statusIcon = '⚪';
    let statusText = 'Desconhecido';
    
    if (dev.status === 'online') {
        if (dev.packet_loss > 0) {
            statusClass = 'warning';
            statusIcon = '🟠';
            statusText = 'Online c/ Perda';
        } else {
            statusIcon = '🟢';
            statusText = 'Online';
        }
    } else if (dev.status === 'offline') {
        statusIcon = '🔴';
        statusText = 'Offline';
    }
    
    const isList = config.viewMode === 'list';
    
    if (isList) {
        return `
            <div class="device-card ${statusClass}">
                <div class="device-status-icon">${statusIcon}</div>
                <div class="device-info-group">
                    <div class="device-name">${dev.name}</div>
                    <div class="device-info">📍 ${dev.ip_address}</div>
                    <div class="device-info">📂 ${dev.category_name || 'Sem categoria'}</div>
                </div>
                <div class="device-meta">
                    <span>Status: <strong>${statusText}</strong></span>
                    ${dev.packet_loss > 0 ? `<span>Perda: ${dev.packet_loss}%</span>` : ''}
                    <span>Último check: ${dev.last_ping ? new Date(dev.last_ping).toLocaleTimeString() : 'Nunca'}</span>
                </div>
            </div>
        `;
    }
    
    // Modo Grid
    return `
        <div class="device-card ${statusClass}" style="min-height: ${config.cardSize * 0.65}px">
            <div class="device-status-icon">${statusIcon}</div>
            <div class="device-name">${dev.name}</div>
            <div class="device-info">📍 ${dev.ip_address}</div>
            <div class="device-info">📂 ${dev.category_name || 'Sem categoria'}</div>
            <div class="device-meta">
                Status: <strong>${statusText}</strong><br>
                ${dev.packet_loss > 0 ? `Perda: ${dev.packet_loss}%<br>` : ''}
                Último check: ${dev.last_ping ? new Date(dev.last_ping).toLocaleString() : 'Nunca'}
            </div>
        </div>
    `;
}

// Ping automático
let isPinging = false;

async function autoPing() {
    if (isPinging) return; // evita sobreposição de chamadas
    isPinging = true;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s máximo
        await fetch(`${API_URL}/ping-all`, { signal: controller.signal });
        clearTimeout(timeout);
        await loadDevices();
        await loadStats();
        document.getElementById('last-update').textContent =
            'Última atualização: ' + new Date().toLocaleTimeString();
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Erro no ping automático:', error);
        }
    } finally {
        isPinging = false;
    }
}

// Iniciar/reiniciar intervalo de ping
function startAutoPing() {
    if (pingIntervalId) {
        clearInterval(pingIntervalId);
    }
    
    const intervalMs = config.pingInterval * 1000;
    pingIntervalId = setInterval(autoPing, intervalMs);
    
    console.log(`⏱️ Ping automático: ${config.pingInterval}s`);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    loadDashboard();
    startAutoPing();
    
    // Toggle Grid/Lista
    document.getElementById('viewGrid').addEventListener('click', () => {
        config.viewMode = 'grid';
        document.getElementById('viewGrid').classList.add('active');
        document.getElementById('viewList').classList.remove('active');
        document.getElementById('devices-container').className = 'devices-grid';
        saveConfig();
        renderDevices();
    });
    
    document.getElementById('viewList').addEventListener('click', () => {
        config.viewMode = 'list';
        document.getElementById('viewList').classList.add('active');
        document.getElementById('viewGrid').classList.remove('active');
        document.getElementById('devices-container').className = 'devices-list';
        saveConfig();
        renderDevices();
    });
    
    // Ordenação
    document.getElementById('sortBy').addEventListener('change', (e) => {
        config.sortBy = e.target.value;
        saveConfig();
        renderDevices();
    });
    
    document.getElementById('sortOrder').addEventListener('click', () => {
        config.sortOrder = config.sortOrder === 'asc' ? 'desc' : 'asc';
        updateSortIcon();
        saveConfig();
        renderDevices();
    });
    
    // Tamanho dos cards
    document.getElementById('cardSize').addEventListener('input', (e) => {
        config.cardSize = parseInt(e.target.value);
        applyCardSize();
        saveConfig();
    });
    
    // Intervalo de Ping
    const pingInput = document.getElementById('pingInterval');
    
    pingInput.addEventListener('change', (e) => {
        let value = parseInt(e.target.value);
        
        if (isNaN(value) || value < 1) {
            value = 1;
            pingInput.value = 1;
        }
        if (value > 3600) {
            value = 3600;
            pingInput.value = 3600;
        }
        
        config.pingInterval = value;
        saveConfig();
        startAutoPing();
        
        // Feedback visual
        const statusText = document.querySelector('.monitor-status span:nth-child(2)');
        const original = statusText.textContent;
        statusText.textContent = `Intervalo atualizado para ${value}s`;
        setTimeout(() => {
            statusText.textContent = original;
        }, 2000);
    });
    
    // Prevenir caracteres inválidos no input de número
    pingInput.addEventListener('keydown', (e) => {
        if (e.key === '-' || e.key === 'e' || e.key === 'E') {
            e.preventDefault();
        }
    });
    
    // Reset
    document.getElementById('resetView').addEventListener('click', () => {
        config = {
            viewMode: 'grid',
            sortBy: 'name',
            sortOrder: 'asc',
            cardSize: 280,
            selectedCategories: [],
            pingInterval: 10
        };
        localStorage.removeItem('dashboardConfig');
        location.reload();
    });
});

// Limpar ao sair
window.addEventListener('beforeunload', () => {
    if (pingIntervalId) clearInterval(pingIntervalId);
});