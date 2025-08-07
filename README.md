# BIM Viewer Application

A modern BIM (Building Information Modeling) viewer built with TypeScript, Three.js, and ThatOpen Components.

## Features

- **3D Model Viewing**: Interactive 3D visualization of BIM models
- **Measurement Tools**: Length and area measurement capabilities
- **Clipping Planes**: Section cutting tools for detailed model analysis
- **Model Management**: Load and manage multiple BIM models
- **Viewpoints**: Save and restore camera positions
- **Element Selection**: Interactive element highlighting and selection
- **Modern UI**: Clean, responsive interface built with ThatOpen UI components

## Technologies Used

- **TypeScript**: Type-safe development
- **Three.js**: 3D graphics rendering
- **ThatOpen Components**: BIM-specific tools and utilities
- **Vite**: Fast development build tool
- **ThatOpen UI**: Component library for BIM applications

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn package manager

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/tezparky01/Diss_viewer.git
   cd Diss_viewer
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Usage

### Loading Models

- Use the model loading interface to import BIM files
- Supported formats depend on ThatOpen Components capabilities

### Measurement Tools

- Click the "Measurements" button to access length and area measurement tools
- Select a measurement type and interact with the 3D model
- Use the delete functions to clear measurements

### Clipping Planes

- Click the "Section" button to enable clipping tools
- Create section cuts to analyze internal model details
- Manage clipping planes through the context menu

### Viewpoints

- Save current camera positions for easy navigation
- Restore saved viewpoints with a single click

## Project Structure

```
src/
├── main.ts                 # Application entry point
├── globals.ts             # Global constants and utilities
├── style.css              # Main stylesheet
├── bim-components/        # Custom BIM components
├── ui-templates/          # UI component templates
│   ├── buttons/          # Button components
│   ├── grids/            # Grid layout components
│   ├── groups/           # Grouped UI elements
│   ├── sections/         # Main UI sections
│   └── toolbars/         # Toolbar components
└── vite-env.d.ts         # Vite type declarations
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally

### Code Style

This project uses TypeScript with strict type checking enabled. Please ensure all code follows the established patterns and maintains type safety.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is part of a dissertation research project.

## Acknowledgments

- Built with [ThatOpen Components](https://github.com/ThatOpen/engine)
- Uses [Three.js](https://threejs.org/) for 3D rendering
- UI components from [ThatOpen UI](https://github.com/ThatOpen/ui)
