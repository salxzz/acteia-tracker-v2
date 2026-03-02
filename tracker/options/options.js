document.addEventListener('DOMContentLoaded', () => {
    const exportBtn = document.getElementById('export-btn');
    const importInput = document.getElementById('import-input');
    const clearBtn = document.getElementById('clear-btn');
    const status = document.getElementById('status');

    exportBtn.onclick = async () => {
        const data = await chrome.storage.local.get(null);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `acteia-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        showStatus('Dados exportados com sucesso!', 'success');
    };

    importInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                await chrome.storage.local.set(data);
                showStatus('Backup restaurado com sucesso!', 'success');
            } catch (err) {
                showStatus('Erro ao importar arquivo JSON.', 'error');
            }
        };
        reader.readAsText(file);
    };

    clearBtn.onclick = () => {
        if (confirm('Tem certeza que deseja apagar TODOS os seus dados? Esta ação não pode ser desfeita.')) {
            chrome.storage.local.clear(() => {
                showStatus('Todos os dados foram removidos.', 'success');
            });
        }
    };

    function showStatus(message, type) {
        status.innerText = message;
        status.className = type;
        setTimeout(() => {
            status.innerText = '';
            status.className = '';
        }, 3000);
    }
});
