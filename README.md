# Open Building Stack Demo

Interactive visualization and discovery tool for building automation networks with ontology mapping and AI classification.

## Features

- **Network Discovery**: Scan BACnet networks to discover devices and points
- **Graph Visualization**: Interactive canvas with zoom, pan, and node connections
- **Ontology Mapping**: Classify discovered entities using building ontologies (Brick, ASHRAE 223P)
- **AI Enhancement**: Improve low-confidence classifications with LLM-powered suggestions
- **Schema Editor**: View and edit raw discovery data in YAML format

## Quick Start

Run the demo with Docker Compose (requires Docker):

```bash
# Start demo (discovery + classification only)
make demo

# Start demo with AI enhancement (larger image, ~4GB)
make demo-ai

# Stop all services
make stop
```

Open http://localhost:3000 to view the application.

The services run on the `bacnet_net` Docker network by default for BACnet device communication. Use `NETWORK=mynet make demo` to specify a different network.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│   Frontend  │────▶│   Backend   │
│             │     │  (nginx)    │     │  (FastAPI)  │
│             │     │  :3000      │     │  :8000      │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
                                        ┌───────────┐
                                        │ Simulator │
                                        │ (BACnet)  │
                                        └───────────┘
```

The demo includes a BACnet building simulator (`ghcr.io/c4sbf/obs-simulators-building`) that provides virtual devices for discovery.

## Development

### Frontend

```bash
cd frontend
npm install
npm run dev          # Development server with hot reload
npm run dev:demo     # Demo mode with sample data
```

### Backend

```bash
cd backend
uv sync              # Install dependencies
uv run uvicorn main:app --reload
```

For AI enhancement support, install optional dependencies:

```bash
uv sync --extra ai
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/discover` | GET | Network census - discover BACnet devices |
| `/discover/{device_id}/objects` | GET | Scan device objects |
| `/classify` | POST | Classify graph with ontology |
| `/enhance` | POST | Enhance classifications with LLM |
| `/llm/status` | GET | Check AI availability |
| `/ontologies` | GET | List available ontologies |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `INSTALL_AI` | Build with AI dependencies (`true`/`false`) |
| `HF_TOKEN` | HuggingFace token for model downloads |
| `NETWORK` | Docker network name (default: `bacnet_net`) |

## License

See [License.md](License.md) for details.
