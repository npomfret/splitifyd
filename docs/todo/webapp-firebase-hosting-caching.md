# Webapp Issue: Firebase Hosting CDN and Caching Headers

## Issue Description

Firebase Hosting costs are primarily driven by data transfer (egress). Configuring `firebase.json` to set long `Cache-Control` `max-age` headers for static assets (CSS, JS, images) can reduce these costs.

## Recommendation

Configure `firebase.json` to set long `Cache-Control` `max-age` headers for your static assets (CSS, JS, images). This instructs browsers and the CDN to cache content for longer, reducing requests to the origin and lowering data transfer costs.

## Implementation Suggestions

1.  **Modify `firebase.json`:**
    *   Add a `headers` array within the `hosting` configuration in your `firebase.json` file.
    *   Define `Cache-Control` headers for different types of static assets.

    ```json
    {
      "hosting": {
        "public": "./firebase/public", // Or wherever your webapp static files are served from
        "ignore": [
          "firebase.json",
          "**/.*",
          "**/node_modules/**"
        ],
        "headers": [
          {
            "source": "**/*.@(js|css)",
            "headers": [
              {
                "key": "Cache-Control",
                "value": "public, max-age=31536000, immutable" // Cache for 1 year
              }
            ]
          },
          {
            "source": "**/*.@(jpg|jpeg|gif|png|webp|svg|ico)",
            "headers": [
              {
                "key": "Cache-Control",
                "value": "public, max-age=31536000, immutable" // Cache for 1 year
              }
            ]
          },
          {
            "source": "**/*.html",
            "headers": [
              {
                "key": "Cache-Control",
                "value": "public, max-age=300, must-revalidate" // HTML can change more often, revalidate after 5 mins
              }
            ]
          }
        ]
      }
    }
    ```

2.  **Asset Optimization:**
    *   **Compress images:** Use modern formats like WebP.
    *   **Minify:** Minify your JavaScript, CSS, and HTML files.
    *   **Compression:** Ensure Gzip or Brotli compression is enabled (Firebase Hosting does this automatically).

**Next Steps:**
1.  Update `firebase.json` with the recommended `Cache-Control` headers.
2.  Implement asset optimization techniques (image compression, minification) as part of your build process (if any).
