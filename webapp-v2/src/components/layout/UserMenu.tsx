import { useAuthRequired } from '@/app/hooks/useAuthRequired.ts';
import { Tooltip } from '@/components/ui/Tooltip.tsx';
import { navigationService } from '@/services/navigation.service';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { type SystemUserRole, SystemUserRoles } from '@splitifyd/shared';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';

interface UserMenuProps {
    user: {
        uid: string;
        email: string;
        displayName?: string;
        role?: SystemUserRole;
    };
}

type DiagnosticsWindow = Window & {
    renderDiagnostics?: (payload: unknown) => void;
    renderDiagnosticsError?: (message: string) => void;
};

export function UserMenu({ user }: UserMenuProps) {
    const { t } = useTranslation();
    const authStore = useAuthRequired();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            // Use capture phase and add delay to prevent race conditions
            setTimeout(() => {
                document.addEventListener('click', handleClickOutside, true);
            }, 0);
            return () => document.removeEventListener('click', handleClickOutside, true);
        }
    }, [isOpen]);

    const userInitial = user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase();

    const userName = user.displayName || user.email.split('@')[0];
    const hasDiagnosticsAccess = user.role === SystemUserRoles.SYSTEM_USER || user.role === SystemUserRoles.SYSTEM_ADMIN;

    const openDiagnosticsWindow = (title: string, endpoint: string, heading: string, loadingMessage: string, errorLabel: string) => {
        if (typeof window === 'undefined') {
            return;
        }

        let targetUrl: string | null = null;
        let displayPath = '/diagnostics';

        try {
            const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
            displayPath = `/diagnostics${normalizedEndpoint}`;
            targetUrl = new URL(displayPath, window.location.origin).toString();
        } catch (error) {
            console.warn('Unable to compute diagnostics URL, falling back to about:blank', error);
        }

        const rawWindow = window.open(targetUrl ?? 'about:blank', '_blank');

        if (!rawWindow) {
            console.error('Failed to open diagnostics window');
            return;
        }

        const diagnosticsWindow = rawWindow as DiagnosticsWindow;
        diagnosticsWindow.opener = null;

        let diagnosticsDocument: Document | null = null;

        const timestamp = new Date().toLocaleString();
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const bodyClass = prefersDark ? ' class="dark-mode"' : '';

        try {
            diagnosticsDocument = diagnosticsWindow.document;
            if (!diagnosticsDocument) {
                throw new Error('Missing diagnostics document');
            }
            diagnosticsDocument.open('text/html', 'replace');
        } catch (error) {
            console.error('Unable to initialize diagnostics window', error);
            diagnosticsWindow.close();
            return;
        }

        diagnosticsDocument.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="utf-8" />
                <title>${title}</title>
                <script>
                    (function() {
                        try {
                            window.history.replaceState(null, '', '${displayPath.replace(/'/g, '\\\'')}');
                        } catch (error) {
                            console.warn('Unable to update diagnostics URL', error);
                        }
                    })();
                </script>
                <style>
                    :root {
                        color-scheme: light dark;
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                    }
                    body {
                        margin: 0;
                        background: var(--bg-color);
                        color: var(--text-color);
                        line-height: 1.6;
                        --bg-color: #f8fafc;
                        --surface-color: rgba(255, 255, 255, 0.92);
                        --border-color: rgba(148, 163, 184, 0.28);
                        --text-color: #0f172a;
                        --muted-color: #475569;
                        --accent-color: #6366f1;
                        --accent-bg: rgba(99, 102, 241, 0.12);
                        --badge-bg: rgba(148, 163, 184, 0.2);
                        --badge-text: #475569;
                        --card-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
                    }
                    body.dark-mode {
                        --bg-color: #0f172a;
                        --surface-color: rgba(30, 41, 59, 0.85);
                        --border-color: rgba(148, 163, 184, 0.18);
                        --text-color: #e2e8f0;
                        --muted-color: #94a3b8;
                        --accent-bg: rgba(99, 102, 241, 0.22);
                        --badge-bg: rgba(148, 163, 184, 0.3);
                        --badge-text: #cbd5f5;
                        --card-shadow: 0 24px 50px rgba(2, 6, 23, 0.45);
                    }
                    main.page {
                        max-width: 1200px;
                        margin: 0 auto;
                        padding: 32px 24px 80px;
                    }
                    .page-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        gap: 16px;
                        margin-bottom: 24px;
                    }
                    .page-header h1 {
                        margin: 0;
                        font-size: 28px;
                        font-weight: 600;
                    }
                    .page-header p {
                        margin: 6px 0 0;
                        color: var(--muted-color);
                        font-size: 14px;
                    }
                    .header-actions {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }
                    .ghost-button {
                        border: 1px solid var(--border-color);
                        background: var(--surface-color);
                        color: var(--text-color);
                        border-radius: 999px;
                        padding: 6px 16px;
                        font-size: 14px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    }
                    .ghost-button:hover {
                        border-color: var(--accent-color);
                        color: var(--accent-color);
                    }
                    .status-banner {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 12px;
                        align-items: center;
                        padding: 12px 16px;
                        border: 1px solid var(--border-color);
                        border-radius: 16px;
                        background: var(--surface-color);
                        box-shadow: var(--card-shadow);
                        margin-bottom: 24px;
                    }
                    .status-chip {
                        background: var(--accent-bg);
                        color: var(--accent-color);
                        border-radius: 999px;
                        padding: 4px 12px;
                        font-weight: 600;
                        font-size: 12px;
                        letter-spacing: 0.08em;
                        text-transform: uppercase;
                    }
                    .status-meta {
                        color: var(--muted-color);
                        font-size: 14px;
                    }
                    .summary-section {
                        margin-bottom: 32px;
                    }
                    .summary-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                        gap: 16px;
                    }
                    .card {
                        background: var(--surface-color);
                        border: 1px solid var(--border-color);
                        border-radius: 20px;
                        padding: 18px 20px;
                        box-shadow: var(--card-shadow);
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                    }
                    .card-title {
                        font-size: 12px;
                        text-transform: uppercase;
                        letter-spacing: 0.08em;
                        color: var(--muted-color);
                        margin: 0;
                    }
                    .card-value {
                        font-size: 20px;
                        font-weight: 600;
                        margin: 0;
                        word-break: break-word;
                    }
                    .card-hint {
                        font-size: 13px;
                        color: var(--muted-color);
                        margin: 0;
                    }
                    .detail-section {
                        margin-bottom: 32px;
                    }
                    .detail-section h2,
                    .env-section h2 {
                        margin: 0 0 16px;
                        font-size: 18px;
                    }
                    .detail-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                        gap: 16px;
                    }
                    .detail-card {
                        background: var(--surface-color);
                        border: 1px solid var(--border-color);
                        border-radius: 18px;
                        padding: 18px 20px;
                        box-shadow: var(--card-shadow);
                    }
                    .detail-card h3 {
                        margin: 0 0 12px;
                        font-size: 16px;
                    }
                    .detail-list {
                        margin: 0;
                        padding: 0;
                        list-style: none;
                    }
                    .detail-list li {
                        display: flex;
                        justify-content: space-between;
                        gap: 12px;
                        padding: 6px 0;
                        border-bottom: 1px solid var(--border-color);
                    }
                    .detail-list li:last-child {
                        border-bottom: none;
                    }
                    .detail-label {
                        font-size: 11px;
                        letter-spacing: 0.08em;
                        text-transform: uppercase;
                        color: var(--muted-color);
                    }
                    .detail-value {
                        font-size: 14px;
                        font-weight: 500;
                        color: var(--text-color);
                        text-align: right;
                        word-break: break-word;
                    }
                    .env-section,
                    .filesystem-section {
                        display: flex;
                        flex-direction: column;
                        gap: 16px;
                    }
                    .env-header {
                        display: flex;
                        flex-wrap: wrap;
                        align-items: center;
                        justify-content: space-between;
                        gap: 16px;
                    }
                    .filesystem-header {
                        display: flex;
                        flex-wrap: wrap;
                        align-items: center;
                        justify-content: space-between;
                        gap: 16px;
                    }
                    .env-controls {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }
                    .filesystem-controls {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        flex-wrap: wrap;
                    }
                    .filesystem-controls .badge {
                        max-width: 100%;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    .env-controls input {
                        padding: 8px 14px;
                        border-radius: 999px;
                        border: 1px solid var(--border-color);
                        background: var(--surface-color);
                        color: var(--text-color);
                        font-size: 14px;
                        min-width: 220px;
                    }
                    .env-controls input:focus {
                        outline: none;
                        border-color: var(--accent-color);
                        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
                    }
                    .badge {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        min-width: 44px;
                        padding: 4px 10px;
                        border-radius: 999px;
                        background: var(--badge-bg);
                        color: var(--badge-text);
                        font-size: 12px;
                        font-weight: 600;
                    }
                    .table-wrapper {
                        max-height: 300px;
                        overflow: auto;
                        border: 1px solid var(--border-color);
                        border-radius: 18px;
                        background: var(--surface-color);
                        box-shadow: var(--card-shadow);
                    }
                    .env-table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    .filesystem-table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    .env-table thead {
                        position: sticky;
                        top: 0;
                        background: var(--surface-color);
                    }
                    .filesystem-table thead {
                        position: sticky;
                        top: 0;
                        background: var(--surface-color);
                    }
                    .env-table th,
                    .env-table td,
                    .filesystem-table th,
                    .filesystem-table td {
                        padding: 8px 12px;
                        border-bottom: 1px solid var(--border-color);
                        font-size: 12px;
                        line-height: 1.4;
                        text-align: left;
                        vertical-align: top;
                    }
                    .env-table th {
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        font-size: 11px;
                        color: var(--muted-color);
                    }
                    .filesystem-table th {
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        font-size: 11px;
                        color: var(--muted-color);
                    }
                    .env-table td.env-key {
                        font-weight: 600;
                        color: var(--text-color);
                        width: 30%;
                    }
                    .env-table td.env-value {
                        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                        word-break: break-word;
                        white-space: pre-wrap;
                        color: var(--muted-color);
                        line-height: 1.4;
                    }
                    .filesystem-table td.file-name {
                        font-weight: 600;
                        color: var(--text-color);
                        width: 30%;
                    }
                    .filesystem-table td {
                        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                        word-break: break-word;
                        white-space: pre-wrap;
                        color: var(--muted-color);
                        line-height: 1.4;
                    }
                    .placeholder {
                        padding: 24px;
                        text-align: center;
                        color: var(--muted-color);
                        font-size: 14px;
                    }
                    .placeholder.error {
                        color: #ef4444;
                        font-weight: 600;
                    }
                    body.dark-mode .placeholder.error {
                        color: #fca5a5;
                    }
                    .toast {
                        font-size: 12px;
                        color: var(--accent-color);
                        opacity: 0;
                        transition: opacity 0.2s ease;
                    }
                    .sr-only {
                        position: absolute;
                        left: -9999px;
                        width: 1px;
                        height: 1px;
                        overflow: hidden;
                    }
                    @media (max-width: 640px) {
                        main.page {
                            padding: 24px 16px 64px;
                        }
                        .page-header {
                            flex-direction: column;
                            align-items: flex-start;
                        }
                        .status-banner {
                            flex-direction: column;
                            align-items: flex-start;
                        }
                        .detail-list li {
                            flex-direction: column;
                            align-items: flex-start;
                        }
                        .detail-value {
                            text-align: left;
                        }
                        .env-controls {
                            width: 100%;
                        }
                        .env-controls input {
                            flex: 1 1 auto;
                            width: 100%;
                        }
                        .filesystem-controls {
                            width: 100%;
                            justify-content: space-between;
                            gap: 8px;
                        }
                    }
                </style>
            </head>
            <body${bodyClass}>
                <main class="page">
                    <header class="page-header">
                        <div>
                            <h1 id="diagnostic-heading">${heading}</h1>
                            <p id="diagnostic-subheading">${timestamp}</p>
                        </div>
                        <div class="header-actions">
                            <button type="button" id="copy-json" class="ghost-button">Copy JSON</button>
                            <span id="copy-toast" class="toast" aria-live="polite"></span>
                        </div>
                    </header>
                    <div id="diagnostic-status" class="status-banner"></div>
                    <section class="summary-section">
                        <div id="summary-grid" class="summary-grid"></div>
                    </section>
                    <section class="detail-section">
                        <h2>System Details</h2>
                        <div id="detail-sections" class="detail-grid"></div>
                    </section>
                    <section class="env-section">
                        <div class="env-header">
                            <h2>Environment Variables</h2>
                            <div class="env-controls">
                                <input type="search" id="env-filter" placeholder="Filter variables..." aria-label="Filter environment variables" />
                                <span id="env-count" class="badge">0</span>
                            </div>
                        </div>
                        <div id="env-table-wrapper" class="table-wrapper">
                            <div class="placeholder">${loadingMessage}</div>
                        </div>
                    </section>
                    <section class="filesystem-section">
                        <div class="filesystem-header">
                            <h2>Filesystem</h2>
                            <div class="filesystem-controls">
                                <span id="filesystem-dir" class="badge">—</span>
                                <span id="filesystem-count" class="badge">0</span>
                            </div>
                        </div>
                        <div id="filesystem-table-wrapper" class="table-wrapper">
                            <div class="placeholder">${loadingMessage}</div>
                        </div>
                    </section>
                    <div id="diagnostic-content" class="sr-only"></div>
                </main>
                <script>
                    (function() {
                        var doc = document;
                        var state = {
                            payload: null,
                            envRows: [],
                            totalEnv: 0,
                            filesystemRows: [],
                            totalFilesystem: 0,
                            filterTerm: '',
                            toastTimer: null,
                        };
                        var summaryGrid = doc.getElementById('summary-grid');
                        var detailSections = doc.getElementById('detail-sections');
                        var envWrapper = doc.getElementById('env-table-wrapper');
                        var envCount = doc.getElementById('env-count');
                        var filesystemWrapper = doc.getElementById('filesystem-table-wrapper');
                        var filesystemDir = doc.getElementById('filesystem-dir');
                        var filesystemCount = doc.getElementById('filesystem-count');
                        var statusBanner = doc.getElementById('diagnostic-status');
                        var subheading = doc.getElementById('diagnostic-subheading');
                        var copyButton = doc.getElementById('copy-json');
                        var toast = doc.getElementById('copy-toast');
                        var rawJson = doc.getElementById('diagnostic-content');
                        var envFilter = doc.getElementById('env-filter');

                        function asText(value) {
                            return value === undefined || value === null || value === '' ? '—' : String(value);
                        }

                        function formatDuration(seconds) {
                            if (typeof seconds !== 'number' || !isFinite(seconds)) return '—';
                            var remaining = Math.max(0, Math.floor(seconds));
                            var parts = [];
                            var units = [
                                { unit: 86400, label: 'd' },
                                { unit: 3600, label: 'h' },
                                { unit: 60, label: 'm' },
                            ];
                            units.forEach(function(item) {
                                if (remaining >= item.unit) {
                                    var value = Math.floor(remaining / item.unit);
                                    parts.push(value + item.label);
                                    remaining -= value * item.unit;
                                }
                            });
                            parts.push(remaining + 's');
                            return parts.slice(0, Math.max(1, parts.length)).join(' ');
                        }

                        function formatDate(value) {
                            if (!value) return '—';
                            var date = new Date(value);
                            if (isNaN(date.valueOf())) {
                                return asText(value);
                            }
                            return date.toLocaleString();
                        }

                        function createCard(title, value, hint) {
                            var card = doc.createElement('div');
                            card.className = 'card';
                            var titleEl = doc.createElement('p');
                            titleEl.className = 'card-title';
                            titleEl.textContent = title;
                            var valueEl = doc.createElement('p');
                            valueEl.className = 'card-value';
                            valueEl.textContent = value;
                            card.appendChild(titleEl);
                            card.appendChild(valueEl);
                            if (hint) {
                                var hintEl = doc.createElement('p');
                                hintEl.className = 'card-hint';
                                hintEl.textContent = hint;
                                card.appendChild(hintEl);
                            }
                            return card;
                        }

                        function createDetailCard(title, entries) {
                            var card = doc.createElement('div');
                            card.className = 'detail-card';
                            var headingEl = doc.createElement('h3');
                            headingEl.textContent = title;
                            card.appendChild(headingEl);
                            var list = doc.createElement('ul');
                            list.className = 'detail-list';
                            var hasEntries = false;
                            entries.forEach(function(entry) {
                                if (!entry) return;
                                hasEntries = true;
                                var li = doc.createElement('li');
                                var label = doc.createElement('span');
                                label.className = 'detail-label';
                                label.textContent = entry.label;
                                var value = doc.createElement('span');
                                value.className = 'detail-value';
                                value.textContent = entry.value;
                                li.appendChild(label);
                                li.appendChild(value);
                                list.appendChild(li);
                            });
                            if (!hasEntries) {
                                var empty = doc.createElement('p');
                                empty.className = 'card-hint';
                                empty.textContent = 'No data available';
                                card.appendChild(empty);
                                return card;
                            }
                            card.appendChild(list);
                            return card;
                        }

                        function setStatus(payload) {
                            statusBanner.innerHTML = '';
                            var status = payload && payload.status ? payload.status : {};
                            var chip = doc.createElement('span');
                            chip.className = 'status-chip';
                            chip.textContent = status.environment ? String(status.environment) : 'unknown';
                            statusBanner.appendChild(chip);

                            var nodeMeta = doc.createElement('span');
                            nodeMeta.className = 'status-meta';
                            nodeMeta.textContent = 'Node ' + asText(status.nodeVersion);
                            statusBanner.appendChild(nodeMeta);

                            var uptimeMeta = doc.createElement('span');
                            uptimeMeta.className = 'status-meta';
                            var uptimeLabel = payload && payload.runtime && payload.runtime.uptimeHuman
                                ? payload.runtime.uptimeHuman
                                : formatDuration(status.uptimeSeconds);
                            uptimeMeta.textContent = 'Uptime ' + uptimeLabel;
                            statusBanner.appendChild(uptimeMeta);

                            if (status.memorySummary && status.memorySummary.heapUsedMb !== undefined) {
                                var memMeta = doc.createElement('span');
                                memMeta.className = 'status-meta';
                                memMeta.textContent = 'Heap ' + status.memorySummary.heapUsedMb + ' MB';
                                statusBanner.appendChild(memMeta);
                            }
                        }

                        function renderSummary(payload) {
                            summaryGrid.innerHTML = '';
                            var status = payload.status || {};
                            summaryGrid.appendChild(createCard('Environment', status.environment || 'unknown', 'Current instance'));
                            summaryGrid.appendChild(createCard('Node.js', status.nodeVersion || '—', 'Runtime engine'));
                            summaryGrid.appendChild(createCard('App version', asText(payload.build && payload.build.version), payload.build && payload.build.date ? 'Built ' + formatDate(payload.build.date) : undefined));
                            var uptimeLabel = payload.runtime && payload.runtime.uptimeHuman
                                ? payload.runtime.uptimeHuman
                                : formatDuration(payload.runtime && payload.runtime.uptime);
                            summaryGrid.appendChild(createCard('Uptime', uptimeLabel, 'Since last restart'));
                        }

                        function renderDetails(payload) {
                            detailSections.innerHTML = '';
                            detailSections.appendChild(createDetailCard('Runtime', [
                                { label: 'Started', value: formatDate(payload.runtime && payload.runtime.startTime) },
                                { label: 'Uptime', value: payload.runtime && payload.runtime.uptimeHuman ? payload.runtime.uptimeHuman : formatDuration(payload.runtime && payload.runtime.uptime) },
                                { label: 'Seconds', value: payload.runtime && typeof payload.runtime.uptime === 'number' ? payload.runtime.uptime.toLocaleString() : '—' },
                            ]));

                            detailSections.appendChild(createDetailCard('Build', [
                                { label: 'Version', value: asText(payload.build && payload.build.version) },
                                { label: 'Timestamp', value: formatDate(payload.build && payload.build.timestamp) },
                                { label: 'Date', value: formatDate(payload.build && payload.build.date) },
                            ]));

                            detailSections.appendChild(createDetailCard('Memory', [
                                { label: 'RSS', value: asText(payload.memory && payload.memory.rss) },
                                { label: 'Heap total', value: asText(payload.memory && payload.memory.heapTotal) },
                                { label: 'Heap used', value: asText(payload.memory && payload.memory.heapUsed) },
                                { label: 'External', value: asText(payload.memory && payload.memory.external) },
                                { label: 'Array buffers', value: asText(payload.memory && payload.memory.arrayBuffers) },
                                { label: 'Available', value: asText(payload.memory && payload.memory.heapAvailable) },
                                { label: 'Heap limit', value: asText(payload.memory && payload.memory.heapLimit) },
                                { label: 'Heap exec total', value: asText(payload.memory && payload.memory.totalHeapExecutableSize) },
                                { label: 'Heap physical', value: asText(payload.memory && payload.memory.totalPhysicalSize) },
                                { label: 'Heap available total', value: asText(payload.memory && payload.memory.totalAvailableSize) },
                                { label: 'Malloced', value: asText(payload.memory && payload.memory.mallocedMemory) },
                                { label: 'Peak malloced', value: asText(payload.memory && payload.memory.peakMallocedMemory) },
                            ]));

                            if (payload.memory && Array.isArray(payload.memory.heapSpaces) && payload.memory.heapSpaces.length) {
                                const heapSpaceEntries = payload.memory.heapSpaces.slice(0, 5).map((space) => ({
                                    label: space.spaceName || 'space',
                                    value: asText(space.spaceUsed) + ' used of ' + asText(space.spaceSize),
                                }));
                                detailSections.appendChild(createDetailCard('Heap Spaces', heapSpaceEntries));
                            }
                        }

                        function renderEnv(env) {
                            envWrapper.innerHTML = '';
                            state.envRows = [];
                            state.totalEnv = 0;

                            if (!env || typeof env !== 'object') {
                                envWrapper.innerHTML = '<div class="placeholder">No environment variables detected.</div>';
                                envCount.textContent = '0';
                                return;
                            }

                            var entries = Object.entries(env).sort(function(a, b) {
                                return a[0].localeCompare(b[0]);
                            });

                            state.totalEnv = entries.length;
                            envCount.textContent = String(entries.length);

                            if (!entries.length) {
                                envWrapper.innerHTML = '<div class="placeholder">No environment variables detected.</div>';
                                return;
                            }

                            var table = doc.createElement('table');
                            table.className = 'env-table';
                            var thead = doc.createElement('thead');
                            var headRow = doc.createElement('tr');
                            ['Variable', 'Value'].forEach(function(label) {
                                var th = doc.createElement('th');
                                th.textContent = label;
                                headRow.appendChild(th);
                            });
                            thead.appendChild(headRow);
                            table.appendChild(thead);

                            var tbody = doc.createElement('tbody');
                            entries.forEach(function(entry) {
                                var key = entry[0];
                                var value = entry[1];
                                var tr = doc.createElement('tr');
                                tr.dataset.search = (key + ' ' + value).toLowerCase();
                                var keyTd = doc.createElement('td');
                                keyTd.className = 'env-key';
                                keyTd.textContent = key;
                                var valueTd = doc.createElement('td');
                                valueTd.className = 'env-value';
                                valueTd.textContent = value === null || value === undefined ? '' : String(value);
                                tr.appendChild(keyTd);
                                tr.appendChild(valueTd);
                                tbody.appendChild(tr);
                                state.envRows.push(tr);
                            });
                            table.appendChild(tbody);
                            envWrapper.appendChild(table);
                        }

                        function renderFilesystem(filesystem) {
                            if (!filesystemWrapper) {
                                return;
                            }

                            filesystemWrapper.innerHTML = '';
                            state.filesystemRows = [];
                            state.totalFilesystem = 0;

                            if (filesystemDir) {
                                var directoryLabel = filesystem && filesystem.currentDirectory ? filesystem.currentDirectory : '—';
                                filesystemDir.textContent = directoryLabel;
                                filesystemDir.title = directoryLabel;
                            }

                            if (!filesystem || !Array.isArray(filesystem.files) || filesystem.files.length === 0) {
                                filesystemWrapper.innerHTML = '<div class="placeholder">No filesystem entries detected.</div>';
                                if (filesystemCount) {
                                    filesystemCount.textContent = '0';
                                }
                                return;
                            }

                            var entries = filesystem.files.slice().sort(function(a, b) {
                                var aType = a.type === 'dir' ? 0 : 1;
                                var bType = b.type === 'dir' ? 0 : 1;
                                if (aType !== bType) {
                                    return aType - bType;
                                }
                                return (a.name || '').localeCompare(b.name || '');
                            });
                            state.totalFilesystem = entries.length;
                            if (filesystemCount) {
                                filesystemCount.textContent = String(entries.length);
                            }

                            var table = doc.createElement('table');
                            table.className = 'filesystem-table';
                            var thead = doc.createElement('thead');
                            var headRow = doc.createElement('tr');
                            ['Name', 'Type', 'Size', 'Modified', 'Mode', 'Link'].forEach(function(label) {
                                var th = doc.createElement('th');
                                th.textContent = label;
                                headRow.appendChild(th);
                            });
                            thead.appendChild(headRow);
                            table.appendChild(thead);

                            var tbody = doc.createElement('tbody');
                            entries.forEach(function(entry) {
                                var tr = doc.createElement('tr');

                                var nameTd = doc.createElement('td');
                                nameTd.className = 'file-name';
                                nameTd.textContent = entry.name || '—';
                                tr.appendChild(nameTd);

                                var typeTd = doc.createElement('td');
                                typeTd.textContent = entry.type || (entry.isSymbolicLink ? 'symlink' : 'file');
                                tr.appendChild(typeTd);

                                var sizeTd = doc.createElement('td');
                                sizeTd.textContent = entry.size || (entry.type === 'dir' ? '—' : '');
                                tr.appendChild(sizeTd);

                                var modifiedTd = doc.createElement('td');
                                modifiedTd.textContent = entry.modified ? formatDate(entry.modified) : '—';
                                tr.appendChild(modifiedTd);

                                var modeTd = doc.createElement('td');
                                modeTd.textContent = entry.mode ? String(entry.mode) : '—';
                                tr.appendChild(modeTd);

                                var linkTd = doc.createElement('td');
                                linkTd.textContent = entry.isSymbolicLink ? 'Yes' : 'No';
                                tr.appendChild(linkTd);

                                tbody.appendChild(tr);
                                state.filesystemRows.push(tr);
                            });

                            table.appendChild(tbody);
                            filesystemWrapper.appendChild(table);
                        }

                        function filterEnvVars(term) {
                            state.filterTerm = term.toLowerCase();
                            if (!state.envRows.length) {
                                envCount.textContent = '0';
                                return;
                            }
                            var visible = 0;
                            state.envRows.forEach(function(row) {
                                var matches = !state.filterTerm || row.dataset.search.indexOf(state.filterTerm) !== -1;
                                row.style.display = matches ? '' : 'none';
                                if (matches) {
                                    visible += 1;
                                }
                            });
                            envCount.textContent = state.filterTerm ? visible + '/' + state.totalEnv : String(state.totalEnv);
                        }

                        function showToast(message) {
                            if (!toast) return;
                            toast.textContent = message;
                            toast.style.opacity = '1';
                            if (state.toastTimer) {
                                clearTimeout(state.toastTimer);
                            }
                            state.toastTimer = setTimeout(function() {
                                toast.style.opacity = '0';
                            }, 2200);
                        }

                        if (envFilter) {
                            envFilter.addEventListener('input', function(event) {
                                var value = event.target && event.target.value ? event.target.value : '';
                                filterEnvVars(value);
                            });
                        }

                        if (copyButton) {
                            copyButton.addEventListener('click', function() {
                                if (!state.payload) {
                                    showToast('No data yet');
                                    return;
                                }
                                var json = JSON.stringify(state.payload, null, 2);
                                var writePromise;
                                if (navigator.clipboard && navigator.clipboard.writeText) {
                                    writePromise = navigator.clipboard.writeText(json);
                                } else {
                                    writePromise = new Promise(function(resolve, reject) {
                                        try {
                                            var textarea = doc.createElement('textarea');
                                            textarea.value = json;
                                            textarea.style.position = 'fixed';
                                            textarea.style.opacity = '0';
                                            doc.body.appendChild(textarea);
                                            textarea.focus();
                                            textarea.select();
                                            var successful = doc.execCommand('copy');
                                            doc.body.removeChild(textarea);
                                            if (successful) {
                                                resolve();
                                            } else {
                                                reject(new Error('execCommand failed'));
                                            }
                                        } catch (error) {
                                            reject(error);
                                        }
                                    });
                                }
                                writePromise.then(function() {
                                    showToast('Copied JSON');
                                }).catch(function() {
                                    showToast('Copy failed');
                                });
                            });
                        }

                        window.renderDiagnostics = function(payload) {
                            state.payload = payload;
                            if (rawJson) {
                                rawJson.textContent = JSON.stringify(payload, null, 2);
                            }
                            if (subheading) {
                                subheading.textContent = new Date().toLocaleString();
                            }
                            renderSummary(payload || {});
                            renderDetails(payload || {});
                            renderEnv(payload ? payload.env : {});
                            renderFilesystem(payload ? payload.filesystem : null);
                            setStatus(payload || {});
                            filterEnvVars(state.filterTerm);
                        };

                        window.renderDiagnosticsError = function(message) {
                            state.payload = null;
                            state.envRows = [];
                            state.totalEnv = 0;
                            state.filesystemRows = [];
                            state.totalFilesystem = 0;
                            statusBanner.innerHTML = '';
                            var chip = doc.createElement('span');
                            chip.className = 'status-chip';
                            chip.textContent = 'Error';
                            statusBanner.appendChild(chip);
                            var meta = doc.createElement('span');
                            meta.className = 'status-meta';
                            meta.textContent = message;
                            statusBanner.appendChild(meta);
                            summaryGrid.innerHTML = '';
                            detailSections.innerHTML = '';
                            envWrapper.innerHTML = '<div class="placeholder error">' + message + '</div>';
                            envCount.textContent = '0';
                            if (filesystemWrapper) {
                                filesystemWrapper.innerHTML = '<div class="placeholder error">' + message + '</div>';
                            }
                            if (filesystemCount) {
                                filesystemCount.textContent = '0';
                            }
                            if (filesystemDir) {
                                filesystemDir.textContent = '—';
                                filesystemDir.title = '';
                            }
                            if (rawJson) {
                                rawJson.textContent = '';
                            }
                        };
                    })();
                </script>
            </body>
            </html>
        `);

        diagnosticsDocument.close();

        const contentElement = diagnosticsDocument.getElementById('diagnostic-content');

        void (async () => {
            try {
                const token = await authStore.refreshAuthToken();
                const response = await fetch(`/api${endpoint}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json',
                    },
                    credentials: 'omit',
                });

                if (diagnosticsWindow.closed) {
                    return;
                }

                if (!response.ok) {
                    const errorBody = await response.text();
                    const message = `${errorLabel} ${response.status} ${response.statusText}`;
                    if (typeof diagnosticsWindow.renderDiagnosticsError === 'function') {
                        diagnosticsWindow.renderDiagnosticsError(`${message}\n${errorBody}`);
                    } else if (contentElement) {
                        contentElement.textContent = `${message}\n${errorBody}`;
                    }
                    return;
                }

                const payload = await response.json();

                if (diagnosticsWindow.closed) {
                    return;
                }

                if (typeof diagnosticsWindow.renderDiagnostics === 'function') {
                    diagnosticsWindow.renderDiagnostics(payload);
                } else if (contentElement) {
                    contentElement.textContent = JSON.stringify(payload, null, 2);
                }
            } catch (error) {
                if (diagnosticsWindow.closed) {
                    return;
                }
                const message = error instanceof Error ? error.message : String(error);
                const fallbackMessage = `${errorLabel} ${message}`;

                if (typeof diagnosticsWindow.renderDiagnosticsError === 'function') {
                    diagnosticsWindow.renderDiagnosticsError(fallbackMessage);
                } else if (contentElement) {
                    contentElement.textContent = fallbackMessage;
                }
            }
        })();
    };

    return (
        <div class='relative' ref={menuRef}>
            <button
                data-testid='user-menu-button'
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                class='flex items-center space-x-2 hover:bg-gray-100 rounded-lg px-2 py-1 transition-colors'
                aria-expanded={isOpen}
                aria-haspopup='true'
                aria-controls='user-dropdown-menu'
            >
                <div class='w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center'>
                    <span class='text-sm font-medium'>{userInitial}</span>
                </div>
                <div class='hidden sm:block text-left'>
                    <p class='text-sm font-medium text-gray-700' data-testid='user-menu-display-name'>{userName}</p>
                    <p class='text-xs text-gray-500'>{user.email}</p>
                </div>
                <svg class='w-4 h-4 text-gray-500' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                    <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7' />
                </svg>
            </button>

            {isOpen && (
                <div
                    id='user-dropdown-menu'
                    data-testid='user-dropdown-menu'
                    class='absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50'
                    role='menu'
                    aria-orientation='vertical'
                    aria-labelledby='user-menu-button'
                >
                    <div class='px-4 py-2 border-b border-gray-100'>
                        <p class='text-sm font-medium text-gray-900'>{userName}</p>
                        <p class='text-xs text-gray-500'>{user.email}</p>
                    </div>

                    <button
                        onClick={() => {
                            setIsOpen(false);
                            navigationService.goToDashboard();
                        }}
                        class='block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors'
                        data-testid='user-menu-dashboard-link'
                        role='menuitem'
                    >
                        {t('userMenu.dashboard')}
                    </button>

                    <button
                        onClick={() => {
                            setIsOpen(false);
                            navigationService.goToSettings();
                        }}
                        class='block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors'
                        data-testid='user-menu-settings-link'
                        role='menuitem'
                    >
                        {t('userMenu.settings')}
                    </button>

                    {hasDiagnosticsAccess && (
                        <button
                            onClick={(event) => {
                                event.stopPropagation();
                                event.preventDefault();
                                setIsOpen(false);
                                openDiagnosticsWindow(
                                    t('userMenu.environmentLink'),
                                    '/env',
                                    t('userMenu.environmentLink'),
                                    t('userMenu.diagnosticsLoading'),
                                    t('userMenu.diagnosticsError'),
                                );
                            }}
                            class='block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors'
                            data-testid='user-menu-environment-link'
                            role='menuitem'
                            type='button'
                        >
                            <span class='flex items-center justify-between'>
                                <span>{t('userMenu.environmentLink')}</span>
                                <ArrowTopRightOnSquareIcon class='ml-2 h-4 w-4 text-gray-400' aria-hidden='true' />
                            </span>
                        </button>
                    )}

                    <hr class='my-1 border-gray-100' />

                    <button
                        data-testid='sign-out-button'
                        onClick={async (e) => {
                            e.stopPropagation();
                            try {
                                await authStore.logout();
                                // Force immediate redirect to login
                                navigationService.goToLogin();
                            } catch (error) {
                                // Error is already handled in authStore
                                console.error('Logout failed:', error);
                            }
                        }}
                        class='w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors'
                        disabled={authStore.loading}
                        role='menuitem'
                    >
                        {authStore.loading ? t('userMenu.signingOut') : t('userMenu.signOut')}
                    </button>
                </div>
            )}
        </div>
    );
}
