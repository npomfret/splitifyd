export const baseLayout = {
  head: () => `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="theme-color" content="#000000">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' https://kzpzeqsgcbxicsgmzztk.supabase.co wss://kzpzeqsgcbxicsgmzztk.supabase.co https://www.gstatic.com https://apis.google.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://firebaseapp.com https://*.firebaseio.com; script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self' https://kzpzeqsgcbxicsgmzztk.supabase.co wss://kzpzeqsgcbxicsgmzztk.supabase.co https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebaseapp.com https://*.firebaseio.com http://127.0.0.1:* http://localhost:* ws://localhost:* ws://127.0.0.1:*;">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="manifest" href="/manifest.json">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="/css/styles.css">
  `,

  warningBanner: () => `
    <div id="warningBanner" class="warning-banner" style="display: none;">
      <div class="warning-content">
        <i class="fas fa-exclamation-triangle"></i>
        <span id="warningMessage"></span>
      </div>
    </div>
  `,

  scripts: () => `
    <script type="module" src="/js/firebase-config.js"></script>
    <script type="module" src="/js/warning-banner.js"></script>
  `,

  render: (config) => {
    const { title, bodyContent, additionalScripts = '', additionalStyles = '', bodyClass = '' } = config;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    ${baseLayout.head()}
    <title>${title}</title>
    ${additionalStyles}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
    ${baseLayout.warningBanner()}
    ${bodyContent}
    ${baseLayout.scripts()}
    ${additionalScripts}
</body>
</html>`;
  }
};