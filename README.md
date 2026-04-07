# Installation Guide for macOS

Follow these instructions to build and install this Electron application locally on your Mac.

## Prerequisites

Before you begin, ensure you have **Node.js** and **npm** (Node Package Manager) installed on your system. 
* You can download them from the [official Node.js website](https://nodejs.org/).
* To verify they are installed, open your terminal and run:
  ```bash
  node -v
  npm -v
  ```

## Build and Install Instructions

### 1. Install Dependencies
Open your terminal, navigate to the root directory of this project, and install the required Node modules:
```bash
npm install
```

### 2. Package the Application
Once the dependencies are installed, run the packaging script. This will compile the code and bundle it into a standalone macOS `.app` file.

*Note: This project is configured for local deployment (`"identity": null`), meaning it will perform an ad-hoc signature to run on your specific machine without requiring an Apple Developer account.*

```bash
npm run package
```

### 3. Locate the App
When the build process finishes, it will generate a new directory (usually named `dist/` or `out/`). 
Navigate to this folder to find your bundled application:
* Look for `dist/mac-arm64/YourAppName.app` (for Apple Silicon Macs) or `dist/mac/YourAppName.app` (for Intel Macs).

### 4. Install to Applications
To "install" the app, simply drag and drop the `.app` file into your Mac's **Applications** folder. You can now launch it via Launchpad or Spotlight search.
