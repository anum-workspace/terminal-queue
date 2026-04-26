
---

# 🧬 GROMACS GUI (Electron + React)

A modern cross-platform graphical user interface for running and managing **GROMACS molecular dynamics simulations** using **ElectronJS, React, and TailwindCSS** .

---

## 🚀 Description

**GROMACS GUI** is designed to simplify complex molecular dynamics workflows by providing an intuitive desktop interface. It allows users to:

* Run full simulation pipelines (Energy Minimization → Equilibration → Production)
* Monitor simulation progress in real-time
* Resume interrupted simulations seamlessly
* Utilize GPU acceleration with pre-configured scripts
* Manage simulation jobs without needing deep command-line knowledge

This tool is especially useful for students, researchers, and computational physicists working with GROMACS.

---

## 📦 Installation & Setup

### 1️⃣ Install frontend dependencies

```bash
npm install
```

---

### 2️⃣ Generate icons (if applicable)

```bash
npm run generate-icons
```

---

### 3️⃣ Run development server

```bash
npm run dev
```

---

### 4️⃣ Build frontend

```bash
npm run build
```

---

## ⚡ Electron Setup

Navigate to the Electron directory:

```bash
cd electron
```

### Install Electron dependencies

```bash
npm install
```

---

### Rebuild native modules (important)

```bash
npx electron-rebuild
```

---

### Start Electron app

```bash
npm start
```

---

### Build Electron application

```bash
npm run electron:build
```

---

## 🧪 Simulation Pipeline

This GUI integrates shell-based GROMACS workflows:

### 🔹 Energy Minimization

* Prepares system and removes steric clashes
* Uses `grompp` and `mdrun`

### 🔹 Equilibration (Multi-step GPU optimized)

* Gradual stabilization of system
* Automated loop execution for multiple steps

### 🔹 Production Run

* Long MD simulation
* Supports checkpoint continuation

### 🔹 Resume Simulation

* Detects last completed step
* Continues from checkpoint automatically

---

## 🖥️ Requirements

* **GROMACS (CPU/GPU version installed)**
* Linux / WSL (recommended for Windows)
* Node.js (v18+ recommended)
* GPU (optional but recommended)

---

## 📁 Project Structure (Simplified)

```
root/
│
├── src/                # React frontend
├── electron/           # Electron backend
├── scripts/            # GROMACS shell scripts
├── public/             # Static assets
└── package.json
```

---

## 💡 Features

* 🧩 Modular architecture (React + Electron separation)
* ⚙️ Automated simulation workflow
* 🔄 Resume interrupted simulations
* 🚀 GPU acceleration support
* 🖥️ System tray integration (background execution)
* 📊 Future scope: Visualization & analysis tools

---

## 🛠️ Recommended Usage Flow

1. Load or prepare your simulation files
2. Run **Energy Minimization**
3. Proceed to **Equilibration**
4. Start **Production Run**
5. Use **Resume** if simulation stops

---

## 👨‍💻 Author

**Anum Hosen**\
📧 [anumhosen@gmail.com](mailto:anumhosen@gmail.com)\
🏫 Dept. of Physics,\
Jashore University of Science and Technology

---

## 📜 License

This project is open-source and available for academic and research use.

---

