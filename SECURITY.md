# Security

Pop-up Face Check-in is a local-first browser app. Face images and face-matching data can identify individuals and must be handled carefully.

## Reporting

Please report security issues through GitHub. Do not attach real face images or exported `.popupface` files to public issues.

## Data handling

- Runtime processing is intended to remain on the device.
- The release build blocks HTTP and HTTPS runtime connections with CSP. The embedded WASM module loads from a local `blob:` URL.
- Original registration photos and camera frames are not stored by the app.
- A name-only record contains a name and optional group or ticket detail. A photo record can also contain a small face thumbnail and up to three matching vectors. The selected retention period applies to the browser copy.
- History CSV/JSON files include attendance details and participant names. The participant-list CSV contains names only. These exports are unencrypted. The password-encrypted `.popupface` roster can include thumbnails, matching vectors and distinguishing details. It excludes attendance history. Delete exported files separately when no longer needed.
- This tool is not intended for high-assurance identity verification or security access control.

Imported registration identifiers and stored event identifiers are escaped at HTML attribute boundaries in cards, history and manual reception. Their original values remain unchanged for local actions. Run `node --test tests/registration-rendering.test.cjs` to verify this boundary.
