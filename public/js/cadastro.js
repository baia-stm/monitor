const API_URL = '/api';
let categoriesData = [];

// Elementos
const categoryForm = document.getElementById('categoryForm');
const deviceForm = document.getElementById('deviceForm');
const categoriesList = document.getElementById('categoriesList');
const devicesList = document.getElementById('devicesList');
const devCategorySelect = document.getElementById('devCategory');
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const modalTitle = document.getElementById('modalTitle');
const editFields = document.getElementById('editFields');

document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
    loadDevices();
});

// ==================== CATEGORIAS ====================

categoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('catName').value;
    const description = document.getElementById('catDesc').value;

    try {
        await fetch(`${API_URL}/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description })
        });
        categoryForm.reset();
        loadCategories();
    } catch (error) {
        alert('Erro ao criar categoria');
    }
});

async function loadCategories() {
    try {
        const response = await fetch(`${API_URL}/categories`);
        categoriesData = await response.json();
        
        categoriesList.innerHTML = categoriesData.map(cat => `
            <div class="item">
                <div>
                    <strong>${cat.name}</strong>
                    <small style="display: block; color: #718096;">${cat.description || 'Sem descrição'}</small>
                </div>
                <div class="item-actions">
                    <button onclick="editCategory(${cat.id}, '${cat.name}', '${cat.description || ''}')" class="btn btn-edit">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button onclick="deleteCategory(${cat.id})" class="btn btn-danger">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
            </div>
        `).join('');

        updateCategorySelect();
    } catch (error) {
        console.error('Erro:', error);
    }
}

function editCategory(id, name, description) {
    modalTitle.textContent = 'Editar Categoria';
    document.getElementById('editId').value = id;
    document.getElementById('editType').value = 'category';
    
    editFields.innerHTML = `
        <div class="form-group" style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; color: #4a5568; font-weight: 600;">Nome</label>
            <input type="text" id="editCatName" value="${name}" required style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 6px;">
        </div>
        <div class="form-group">
            <label style="display: block; margin-bottom: 0.5rem; color: #4a5568; font-weight: 600;">Descrição</label>
            <input type="text" id="editCatDesc" value="${description}" style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 6px;">
        </div>
    `;
    
    editModal.classList.add('active');
}

async function deleteCategory(id) {
    if (!confirm('Excluir esta categoria?')) return;
    
    try {
        await fetch(`${API_URL}/categories/${id}`, { method: 'DELETE' });
        loadCategories();
        loadDevices();
    } catch (error) {
        alert('Erro ao excluir categoria');
    }
}

// ==================== EQUIPAMENTOS ====================

deviceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('devName').value;
    const ip_address = document.getElementById('devIP').value;
    const category_id = document.getElementById('devCategory').value;

    try {
        await fetch(`${API_URL}/devices`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, ip_address, category_id })
        });
        deviceForm.reset();
        loadDevices();
    } catch (error) {
        alert('Erro ao criar equipamento');
    }
});

async function loadDevices() {
    try {
        const response = await fetch(`${API_URL}/devices`);
        const devices = await response.json();
        
        devicesList.innerHTML = devices.map(dev => `
            <div class="item">
                <div>
                    <strong>${dev.name}</strong>
                    <small style="display: block; color: #718096;">
                        📍 ${dev.ip_address} | 📂 ${dev.category_name || 'Sem categoria'}
                    </small>
                </div>
                <div class="item-actions">
                    <button onclick="editDevice(${dev.id}, '${dev.name}', '${dev.ip_address}', ${dev.category_id})" class="btn btn-edit">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button onclick="deleteDevice(${dev.id})" class="btn btn-danger">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Erro:', error);
    }
}

function editDevice(id, name, ip, categoryId) {
    modalTitle.textContent = 'Editar Equipamento';
    document.getElementById('editId').value = id;
    document.getElementById('editType').value = 'device';
    
    const categoryOptions = categoriesData.map(cat => 
        `<option value="${cat.id}" ${cat.id == categoryId ? 'selected' : ''}>${cat.name}</option>`
    ).join('');
    
    editFields.innerHTML = `
        <div class="form-group" style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; color: #4a5568; font-weight: 600;">Nome do Equipamento</label>
            <input type="text" id="editDevName" value="${name}" required style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 6px;">
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; color: #4a5568; font-weight: 600;">Endereço IP</label>
            <input type="text" id="editDevIP" value="${ip}" required style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 6px;">
        </div>
        <div class="form-group">
            <label style="display: block; margin-bottom: 0.5rem; color: #4a5568; font-weight: 600;">Categoria</label>
            <select id="editDevCategory" required style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 6px;">
                <option value="">Selecione...</option>
                ${categoryOptions}
            </select>
        </div>
    `;
    
    editModal.classList.add('active');
}

async function deleteDevice(id) {
    if (!confirm('Excluir este equipamento?')) return;
    
    try {
        await fetch(`${API_URL}/devices/${id}`, { method: 'DELETE' });
        loadDevices();
    } catch (error) {
        alert('Erro ao excluir equipamento');
    }
}

// ==================== MODAL E EDIÇÃO ====================

editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('editId').value;
    const type = document.getElementById('editType').value;
    
    try {
        if (type === 'category') {
            const name = document.getElementById('editCatName').value;
            const description = document.getElementById('editCatDesc').value;
            
            const response = await fetch(`${API_URL}/categories/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description })
            });
            
            if (!response.ok) throw new Error('Erro ao atualizar categoria');
            
        } else if (type === 'device') {
            const name = document.getElementById('editDevName').value;
            const ip_address = document.getElementById('editDevIP').value;
            const category_id = document.getElementById('editDevCategory').value;
            
            const response = await fetch(`${API_URL}/devices/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, ip_address, category_id })
            });
            
            if (!response.ok) throw new Error('Erro ao atualizar equipamento');
        }
        
        closeModal();
        
        // Recarregar listas
        if (type === 'category') {
            loadCategories();
            loadDevices(); // Atualiza nomes de categoria nos devices
        } else {
            loadDevices();
        }
        
    } catch (error) {
        alert('Erro ao salvar: ' + error.message);
    }
});

function closeModal() {
    editModal.classList.remove('active');
    editForm.reset();
}

// Fechar modal ao clicar fora
editModal.addEventListener('click', (e) => {
    if (e.target === editModal) {
        closeModal();
    }
});

// Fechar com ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && editModal.classList.contains('active')) {
        closeModal();
    }
});

// ==================== UTILITÁRIOS ====================

function updateCategorySelect() {
    devCategorySelect.innerHTML = '<option value="">Selecione a categoria...</option>' +
        categoriesData.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
}