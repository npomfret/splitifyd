/**
 * AdminLayout - Layout component for admin pages
 *
 * This component is completely isolated from tenant theming.
 * It loads admin-specific styles (admin.css) instead of tenant themes.
 *
 * Key features:
 * - No tenant theme stylesheet loaded
 * - Fixed indigo/amber color scheme from admin.css
 * - Minimal AdminHeader (logout only)
 * - No magnetic hover effects
 * - No footer (admin-only UI)
 */

import adminCssUrl from '@/styles/admin.css?url';
import { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { AdminHeader } from './AdminHeader';

interface AdminLayoutProps {
    children: ComponentChildren;
}

export function AdminLayout({ children }: AdminLayoutProps) {
    // Load admin-specific stylesheet and hide tenant theme on mount
    useEffect(() => {
        // Remove tenant theme stylesheet (added in index.html)
        const tenantThemeLink = document.getElementById('tenant-theme-stylesheet') as HTMLLinkElement | null;
        const originalHref = tenantThemeLink?.href;

        if (tenantThemeLink) {
            // Disable tenant theme by removing href (but keep element for restoration)
            tenantThemeLink.href = '';
            tenantThemeLink.disabled = true;
        }

        // Create link element for admin.css (using Vite's ?url import for correct path in all environments)
        const adminStylesheet = document.createElement('link');
        adminStylesheet.rel = 'stylesheet';
        adminStylesheet.href = adminCssUrl;
        adminStylesheet.id = 'admin-stylesheet';
        document.head.appendChild(adminStylesheet);

        // Cleanup: remove admin stylesheet and restore tenant theme when unmounting
        return () => {
            const existingStylesheet = document.getElementById('admin-stylesheet');
            if (existingStylesheet) {
                existingStylesheet.remove();
            }

            // Restore tenant theme stylesheet
            const tenantThemeLinkOnUnmount = document.getElementById('tenant-theme-stylesheet') as HTMLLinkElement | null;
            if (tenantThemeLinkOnUnmount && originalHref) {
                tenantThemeLinkOnUnmount.href = originalHref;
                tenantThemeLinkOnUnmount.disabled = false;
            }
        };
    }, []);

    return (
        <div className='admin-layout min-h-screen flex flex-col'>
            <AdminHeader />

            <main className='flex-1'>
                {children}
            </main>

            {/* No footer for admin pages */}
        </div>
    );
}
