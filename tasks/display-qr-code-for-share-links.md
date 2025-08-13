# Feature: Display QR Code for Share Links

## Overview

To make it easier and faster to share a group invitation link with someone in person, a QR code will be displayed below the generated share link. This allows a user to simply show their screen to another person, who can then scan the code with their phone's camera to instantly access the join link.

## UI/UX Changes

### Share Link Modal/Page

1.  **QR Code Display:**
    -   When a share link is generated and displayed, a QR code image representing that same link will be rendered directly below it.
    -   The QR code should be of a reasonable size for easy scanning (e.g., 150x150 pixels).

2.  **Interaction:**
    -   The QR code is a visual representation of the link; no new interaction is required.
    -   If the share link is regenerated (e.g., by changing the expiration time), the QR code must also be regenerated instantly to match the new link.

## Implementation Details

-   **Client-Side Generation:** The QR code should be generated on the client-side to avoid unnecessary server requests.
-   **Library:** A lightweight, reliable QR code generation library for React should be used. A good candidate is `qrcode.react`.

### `qrcode.react` Implementation Example

1.  **Installation:**
    ```bash
    npm install qrcode.react
    ```

2.  **Usage in a React Component:**
    ```tsx
    import React from 'react';
    import { QRCodeCanvas } from 'qrcode.react';

    interface ShareLinkDisplayProps {
      shareLink: string;
    }

    const ShareLinkDisplay: React.FC<ShareLinkDisplayProps> = ({ shareLink }) => {
      return (
        <div>
          <p>Your share link:</p>
          <input type="text" value={shareLink} readOnly />
          <button>Copy Link</button>

          {/* QR Code Display */}
          <div style={{ marginTop: '20px' }}>
            <p>Or scan this QR code:</p>
            <QRCodeCanvas value={shareLink} size={150} />
          </div>
        </div>
      );
    };

    export default ShareLinkDisplay;
    ```

## Benefits

-   **Convenience:** Drastically improves the user experience for in-person sharing.
-   **Speed:** Eliminates the need to manually type or send a link via messaging apps when people are physically together.
-   **Modern Feel:** Adds a modern and professional touch to the sharing feature.
