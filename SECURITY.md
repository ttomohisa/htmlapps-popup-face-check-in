# Security

Pop-up Face Check-in is a local-first browser app. Face images and face-matching data can identify individuals and must be handled carefully.

## Reporting

Please report security issues through GitHub. Do not attach real face images or exported `.popupface` files to public issues.

## Data handling

- Runtime processing is intended to remain on the device.
- The release build blocks runtime network connections with CSP.
- Original registration photos and camera frames are not stored by the app.
- Encrypted `.popupface` files may contain identifiable face-matching data; protect and delete them when no longer needed.
- This tool is not intended for high-assurance identity verification or security access control.
