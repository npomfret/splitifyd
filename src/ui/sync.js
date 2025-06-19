export function updateSyncIndicator(status) {
    const indicator = document.getElementById('syncIndicator');
    const statusText = document.getElementById('syncStatus');
    const spinner = indicator.querySelector('.spinner');
    
    indicator.className = 'sync-indicator';
    spinner.classList.add('hidden');
    
    switch (status) {
        case 'syncing':
            indicator.classList.add('syncing');
            spinner.classList.remove('hidden');
            statusText.textContent = 'Syncing...';
            break;
        case 'success':
            statusText.textContent = 'Synced';
            break;
        case 'error':
            indicator.classList.add('error');
            statusText.textContent = 'Sync error';
            break;
        default:
            statusText.textContent = 'Ready';
    }
}