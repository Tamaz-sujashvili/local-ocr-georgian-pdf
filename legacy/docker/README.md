# Legacy Docker setup (optional)

End users should install **Local OCR** from the desktop release (`.dmg` or `.exe`).
That installer is a single app and does not use Docker.

These files are kept only for maintainers who want to run the Flask backend in a container
during development. They are not part of the normal user install path.

```bash
cd legacy/docker
docker compose up --build
```

The app will listen on port 8765.
