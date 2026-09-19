/* --- ANTIGRAVITY QUOTA BADGE INTEGRATION START --- */
(() => {
    // This integration runs inside the Antigravity renderer.
    // It dynamically displays real-time Gemini / Claude quotas matching the model button's font.
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (typeof document.createElement !== 'function' ||
        typeof document.querySelectorAll !== 'function' ||
        typeof document.addEventListener !== 'function') return;
    if (window.__AG_QUOTA_INJECTED__) return;
    window.__AG_QUOTA_INJECTED__ = true;

    const MODEL_FONT_STACK = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

    const pageEngine = function() {
        if (window.__AG_QUOTA_PAGE_ENGINE_RUNNING__) return;
        window.__AG_QUOTA_PAGE_ENGINE_RUNNING__ = true;

        const QUOTA_ENDPOINT = '/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary';
        let quotaCache = null;
        let pendingFetch = null;
        let hideTimer = null;
        let csrfToken = null;
        let hasQuotaBadge = false;
        let badgeScanScheduled = false;
        let badgePollTimer = null;

        function getCsrfToken() {
            if (csrfToken) return csrfToken;
            if (window.__APP_CONFIG__ && window.__APP_CONFIG__.csrfToken) {
                csrfToken = window.__APP_CONFIG__.csrfToken;
                return csrfToken;
            }
            const html = document.documentElement && document.documentElement.innerHTML;
            const match = html && html.match(/"csrfToken"\s*:\s*"([^"]+)"/);
            csrfToken = match ? match[1] : null;
            return csrfToken;
        }

        async function fetchQuota() {
            if (pendingFetch) return pendingFetch;
            pendingFetch = (async () => {
                try {
                    if (typeof fetch !== 'function') return null;
                    const csrf = getCsrfToken();
                    if (!csrf) return null;
                    const response = await fetch(QUOTA_ENDPOINT, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Connect-Protocol-Version': '1',
                            'x-codeium-csrf-token': csrf
                        },
                        body: JSON.stringify({})
                    });
                    if (!response.ok) return null;
                    const data = await response.json();
                    quotaCache = data && data.response ? data.response : null;
                    updateAllBadges();
                    return quotaCache;
                } catch (error) {
                    return null;
                } finally {
                    pendingFetch = null;
                }
            })();
            return pendingFetch;
        }

        function formatRemainingTime(resetTime) {
            if (!resetTime) return '';
            const diffMs = new Date(resetTime).getTime() - Date.now();
            if (diffMs <= 0) return '即将重置';
            const minutes = Math.floor(diffMs / 60000);
            if (minutes < 60) return minutes + '分钟后重置';
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            if (hours < 24) {
                return hours + '小时' + (remainingMinutes ? remainingMinutes + '分' : '') + '后重置';
            }
            const days = Math.floor(hours / 24);
            const remainingHours = hours % 24;
            return days + '天' + (remainingHours ? remainingHours + '小时' : '') + '后重置';
        }

        function getColor(fraction) {
            if (fraction === undefined || fraction === null) return '#9ca3af';
            const percent = fraction * 100;
            if (percent >= 50) return '#10b981';
            if (percent >= 20) return '#f59e0b';
            return '#ef4444';
        }

        function findGroup(keyword) {
            const groups = quotaCache && Array.isArray(quotaCache.groups) ? quotaCache.groups : [];
            return groups.find(group => {
                return group.displayName &&
                    group.displayName.toLowerCase().includes(keyword);
            }) || null;
        }

        function findBucket(group, names) {
            const buckets = group && Array.isArray(group.buckets) ? group.buckets : [];
            return buckets.find(bucket => {
                const bucketId = String(bucket.bucketId || '').toLowerCase();
                return names.includes(bucket.window) || names.some(name => bucketId.includes(name));
            }) || null;
        }

        function clearChildren(node) {
            while (node.firstChild) node.removeChild(node.firstChild);
        }

        function createTextElement(tagName, value, style) {
            const node = document.createElement(tagName);
            node.textContent = String(value);
            if (style) node.style.cssText = style;
            return node;
        }

        function createOrGetTooltip() {
            let tooltip = document.getElementById('ag-quota-popover');
            if (tooltip) return tooltip;
            if (!document.body) return null;

            tooltip = document.createElement('div');
            tooltip.id = 'ag-quota-popover';
            tooltip.style.cssText = [
                'position: fixed',
                'z-index: 999999',
                'display: none',
                'padding: 12px 14px',
                'border-radius: 10px',
                'background: rgba(24, 24, 27, 0.95)',
                'backdrop-filter: blur(12px)',
                '-webkit-backdrop-filter: blur(12px)',
                'border: 1px solid rgba(255, 255, 255, 0.12)',
                'box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                'color: #f4f4f5',
                'font-family: ' + MODEL_FONT_STACK,
                'font-size: 12px',
                'line-height: 1.5',
                'min-width: 260px',
                'pointer-events: auto',
                'transition: opacity 0.15s ease, transform 0.15s ease',
                'opacity: 0',
                'transform: translateY(6px)'
            ].join(';');
            document.body.appendChild(tooltip);
            tooltip.addEventListener('mouseenter', () => clearTimeout(hideTimer));
            tooltip.addEventListener('mouseleave', scheduleHide);
            return tooltip;
        }

        function appendBucket(container, label, bucket) {
            if (!bucket) return;
            const fraction = bucket.remainingFraction == null ? 1 : bucket.remainingFraction;
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin:4px 0';
            row.appendChild(createTextElement('span', label, 'color:#a1a1aa'));
            const values = document.createElement('span');
            values.style.cssText = 'display:flex;align-items:center;gap:8px';
            values.appendChild(createTextElement('span', formatRemainingTime(bucket.resetTime), 'font-size:11px;color:#71717a'));
            values.appendChild(createTextElement(
                'span',
                Math.round(fraction * 100) + '%',
                'font-weight:600;font-family:inherit;color:' + getColor(bucket.remainingFraction)
            ));
            row.appendChild(values);
            container.appendChild(row);
        }

        function appendSectionHeader(container, label) {
            container.appendChild(createTextElement(
                'div',
                label,
                'font-weight:600;color:#fff;margin:10px 0 6px;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:5px'
            ));
        }

        function renderTooltip(target) {
            const tooltip = createOrGetTooltip();
            if (!tooltip) return;
            if (!quotaCache) {
                fetchQuota().then(() => {
                    if (quotaCache) renderTooltip(target);
                });
                return;
            }

            clearChildren(tooltip);
            const gemini = findGroup('gemini');
            appendSectionHeader(tooltip, 'Gemini 模型额度');
            appendBucket(tooltip, '五小时限制', findBucket(gemini, ['5h']));
            appendBucket(tooltip, '每周限制', findBucket(gemini, ['weekly']));

            const claude = findGroup('claude');
            if (claude) {
                appendSectionHeader(tooltip, 'Claude / GPT 模型额度');
                appendBucket(tooltip, '五小时限制', findBucket(claude, ['5h']));
                appendBucket(tooltip, '每周限制', findBucket(claude, ['weekly']));
            }

            const refresh = createTextElement('button', '🔄 刷新', 'border:0;background:none;color:#60a5fa;cursor:pointer;font-size:11px;padding:0');
            refresh.type = 'button';
            refresh.addEventListener('click', async event => {
                event.stopPropagation();
                refresh.textContent = '刷新中...';
                await fetchQuota();
                renderTooltip(target);
            });
            const header = tooltip.firstChild;
            if (header) {
                header.style.cssText = 'font-weight:600;color:#fff;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:5px';
                clearChildren(header);
                header.appendChild(createTextElement('span', 'Gemini 模型额度'));
                header.appendChild(refresh);
            }

            const rect = target.getBoundingClientRect();
            tooltip.style.display = 'block';
            const tooltipRect = tooltip.getBoundingClientRect();
            let left = rect.right - tooltipRect.width;
            let top = rect.top - tooltipRect.height - 8;
            if (top < 10) top = rect.bottom + 8;
            if (left < 10) left = 10;
            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
            requestAnimationFrame(() => {
                tooltip.style.opacity = '1';
                tooltip.style.transform = 'translateY(0)';
            });
        }

        function scheduleHide() {
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => {
                const tooltip = document.getElementById('ag-quota-popover');
                if (!tooltip) return;
                tooltip.style.opacity = '0';
                tooltip.style.transform = 'translateY(6px)';
                setTimeout(() => {
                    if (tooltip.style.opacity === '0') tooltip.style.display = 'none';
                }, 150);
            }, 200);
        }

        function renderBadge(badge) {
            clearChildren(badge);
            const gemini = findGroup('gemini');
            const fiveHour = findBucket(gemini, ['5h']);
            const weekly = findBucket(gemini, ['weekly']);
            const fiveHourText = fiveHour && fiveHour.remainingFraction != null
                ? Math.round(fiveHour.remainingFraction * 100) + '%'
                : '--';
            const weeklyText = weekly && weekly.remainingFraction != null
                ? Math.round(weekly.remainingFraction * 100) + '%'
                : '--';
            badge.appendChild(createTextElement('span', '5h:', 'font-size:10px;color:var(--muted-foreground,#71717a);font-weight:500;font-family:inherit'));
            badge.appendChild(createTextElement('span', fiveHourText, 'color:' + getColor(fiveHour && fiveHour.remainingFraction) + ';font-weight:600;font-family:inherit'));
            badge.appendChild(createTextElement('span', '|', 'opacity:.3;font-size:10px;margin:0 1px;font-family:inherit'));
            badge.appendChild(createTextElement('span', '周:', 'font-size:10px;color:var(--muted-foreground,#71717a);font-weight:500;font-family:inherit'));
            badge.appendChild(createTextElement('span', weeklyText, 'color:' + getColor(weekly && weekly.remainingFraction) + ';font-weight:600;font-family:inherit'));
        }

        function updateAllBadges() {
            document.querySelectorAll('.antigravity-gemini-quota-badge').forEach(renderBadge);
        }

        function isQuotaBadgeNode(node) {
            const element = node && (node.nodeType === 1 ? node : node.parentElement);
            return !!(element && element.classList && element.classList.contains('antigravity-gemini-quota-badge'));
        }

        function isQuotaOwnedNode(node) {
            let element = node && (node.nodeType === 1 ? node : node.parentElement);
            while (element) {
                if (isQuotaBadgeNode(element) || element.id === 'ag-quota-popover') return true;
                element = element.parentElement;
            }
            return false;
        }

        function mountBadgeIfNeeded() {
            if (document.querySelectorAll('.antigravity-gemini-quota-badge').length > 0) return true;

            let mounted = false;
            const buttons = Array.from(document.querySelectorAll('button'));
            buttons.forEach(button => {
                const aria = (button.getAttribute('aria-label') || '').toLowerCase();
                if (!aria.includes('voice') && !aria.includes('record') && !aria.includes('语音')) return;
                const micContainer = button.closest('.flex.items-center') || button.parentElement;
                const parentBar = micContainer && micContainer.parentElement;
                if (!parentBar) return;
                const previous = micContainer.previousElementSibling;
                if (previous && previous.classList.contains('antigravity-gemini-quota-badge')) {
                    mounted = true;
                    return;
                }

                const badge = document.createElement('div');
                badge.className = 'antigravity-gemini-quota-badge';
                badge.title = '查看 Antigravity 模型额度';
                badge.style.cssText = [
                    'display:inline-flex',
                    'align-items:center',
                    'height:24px',
                    'padding:0 7px',
                    'font-family:' + MODEL_FONT_STACK,
                    'font-size:11px',
                    'border-radius:6px',
                    'background:rgba(255,255,255,.05)',
                    'border:1px solid rgba(255,255,255,.08)',
                    'cursor:pointer',
                    'user-select:none',
                    'margin-right:4px',
                    'line-height:1',
                    'transition:all 0.2s ease'
                ].join(';');
                renderBadge(badge);
                badge.addEventListener('mouseenter', () => {
                    clearTimeout(hideTimer);
                    renderTooltip(badge);
                });
                badge.addEventListener('mouseleave', scheduleHide);
                badge.addEventListener('click', event => {
                    event.stopPropagation();
                    renderTooltip(badge);
                });
                parentBar.insertBefore(badge, micContainer);
                mounted = true;
            });
            return mounted;
        }

        function startQuotaPolling() {
            if (badgePollTimer || typeof setInterval !== 'function') return;
            badgePollTimer = setInterval(() => {
                if (!hasQuotaBadge) {
                    clearInterval(badgePollTimer);
                    badgePollTimer = null;
                    return;
                }
                fetchQuota();
            }, 30000);
        }

        function syncBadgeState() {
            const found = mountBadgeIfNeeded();
            if (found && !hasQuotaBadge) {
                hasQuotaBadge = true;
                fetchQuota();
                startQuotaPolling();
            }
            return found;
        }

        function scheduleBadgeScan() {
            if (badgeScanScheduled) return;
            badgeScanScheduled = true;
            const scan = () => {
                badgeScanScheduled = false;
                syncBadgeState();
            };
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(scan);
            } else {
                setTimeout(scan, 0);
            }
        }

        function mutationNeedsBadgeScan(mutations) {
            for (const mutation of mutations) {
                if (Array.from(mutation.removedNodes || []).some(isQuotaBadgeNode)) {
                    hasQuotaBadge = false;
                    return true;
                }
            }
            if (hasQuotaBadge) return false;
            return mutations.some(mutation => {
                return mutation.type === 'childList' && !isQuotaOwnedNode(mutation.target);
            });
        }

        function startPageEngine() {
            if (!document.body) return;
            syncBadgeState();
            if (typeof MutationObserver === 'function') {
                const observer = new MutationObserver(mutations => {
                    if (mutationNeedsBadgeScan(mutations)) scheduleBadgeScan();
                });
                observer.observe(document.body, { childList: true, subtree: true });
            }
            document.addEventListener('keydown', event => {
                if (hasQuotaBadge && event.key === 'Enter' && !event.shiftKey) setTimeout(fetchQuota, 4000);
            }, true);
            document.addEventListener('click', event => {
                const target = event.target;
                const button = target && target.closest &&
                    target.closest('button[aria-label="Send message"], button[aria-label="发送消息"]');
                if (hasQuotaBadge && button) setTimeout(fetchQuota, 4000);
            }, true);
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', startPageEngine, { once: true });
        } else {
            startPageEngine();
        }
    };

    const injectPageEngine = () => {
        if (window.__AG_QUOTA_PAGE_ENGINE_INJECTED__) return;
        window.__AG_QUOTA_PAGE_ENGINE_INJECTED__ = true;
        const script = document.createElement('script');
        script.id = 'ag-quota-engine-script';
        script.textContent = '(' + pageEngine.toString() + ')();';
        (document.head || document.documentElement).appendChild(script);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectPageEngine, { once: true });
    } else {
        injectPageEngine();
    }
    window.addEventListener('load', injectPageEngine, { once: true });
})();
/* --- ANTIGRAVITY QUOTA BADGE INTEGRATION END --- */
