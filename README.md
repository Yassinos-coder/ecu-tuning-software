# ECU Tuning Software

A professional-grade ECU tuning desktop application built with Electron, React, and TypeScript.

## Features

- **BIN File Editing**: Load, edit, and save ECU binary files
- **XDF Definition Support**: Parse TunerPro XDF definition files for map identification
- **Calibration Map Editor**: Professional table editor with AG-Grid
  - Color-coded cells based on modification status
  - Risk level highlighting for dangerous values
  - Bulk editing (percentage changes, interpolation, smoothing)
  - Undo/redo support
- **Visualization**
  - 2D line charts for single-axis maps
  - Interactive 3D surface plots for dual-axis maps
- **Hex Editor**: View and navigate raw binary data
- **AI Tuning Assistant**: Get help understanding maps and safe tuning practices
- **Checksum Support**: Automatic checksum detection and correction
- **Safety Features**: Warnings for dangerous AFR, timing, and boost values

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
cd ecu-tuning-software

# Install dependencies
npm install

# Start development mode
npm run dev
```

### Development

```bash
# Start the Vite dev server (renderer process)
npm run dev:renderer

# In another terminal, compile TypeScript and start Electron
npm run dev:main
npm run electron:dev
```

### Building

```bash
# Build for production
npm run build

# Package for Windows
npm run package:win
```

## Project Structure

```
src/
├── main/           # Electron main process
│   ├── index.ts    # Main entry point
│   ├── preload.ts  # IPC bridge
│   ├── menu.ts     # Application menu
│   └── ipc/        # IPC handlers
│
├── core/           # Domain layer
│   ├── domain/     # Domain models (EcuFile, Map, Axis, etc.)
│   ├── services/   # Business logic (XdfInterpreter, BinMapper)
│   └── utils/      # Binary utilities
│
├── infrastructure/ # External integrations
│   └── ai/         # AI tuning service
│
├── renderer/       # React frontend
│   ├── components/ # UI components
│   ├── store/      # Zustand state management
│   └── styles/     # Global styles
│
└── shared/         # Shared types and constants
```

## Usage

1. **Open a BIN file**: Click "Open BIN" or use Ctrl+O
2. **Load XDF definition**: Click "Open XDF" to load map definitions
3. **Browse maps**: Use the Map Explorer on the left to navigate
4. **Edit values**: Double-click cells in the table to edit
5. **Use tools**: Select cells and use toolbar buttons for bulk operations
6. **Ask AI**: Use the AI panel to get help understanding maps
7. **Save changes**: Click "Save" - checksum will be automatically corrected

## Safety Warning

⚠️ **IMPORTANT**: Improper ECU tuning can cause serious engine damage. This software is intended for use by experienced tuners who understand the implications of calibration changes.

- Always make backups before modifying files
- Verify changes with proper diagnostic equipment
- Never tune on public roads
- Use a dynamometer for performance tuning

## AI Assistant

The AI assistant can help you:
- Explain what calibration maps do
- Suggest safe tuning adjustments
- Identify potentially dangerous values
- Generate tuning changelogs

Configure your OpenAI API key in the AI settings panel, or use offline mock mode for basic assistance.

## Checksum Support

Supported checksum algorithms:
- 8/16/32-bit sum
- CRC16 (CCITT)
- CRC32
- XOR
- Two's complement

The software will attempt to auto-detect checksum locations for common ECU types.

## Future Roadmap

- [ ] OBD-II live data integration
- [ ] Real-time flashing support
- [ ] Plugin architecture
- [ ] Map comparison tool
- [ ] Tuning profiles/presets
- [ ] Cloud sync for sessions
- [ ] Multi-language support

## License

MIT License - See LICENSE file for details.

## Disclaimer

This software is provided as-is without warranty. The authors are not responsible for any damage caused by improper use of this tool. Always ensure you have proper backups and understand the changes you are making to your ECU calibration.
