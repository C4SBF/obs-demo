# Open Building Stack Demo

Interactive visualization and discovery tool for building automation networks with ontology mapping and AI classification.

## Features

- **Network Discovery**: Scan BACnet networks to discover devices and points
- **Graph Visualization**: Interactive canvas with zoom, pan, and node connections
- **Ontology Mapping**: Classify discovered entities using building ontologies (Brick, ASHRAE 223P)
- **AI Enhancement**: Improve low-confidence classifications with LLM-powered suggestions
- **Schema Editor**: View and edit raw discovery data in YAML format

## Getting Started

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 to view the application.

## Building for Production

```bash
npm run build
npm run preview  # Preview the production build
```

## License

See [License.md](License.md) for details.
