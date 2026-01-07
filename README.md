# VCF Migration

A modern **React + TypeScript + Vite** web UI to support VMware Cloud Foundation (VCF) migration workflows — planning, execution and reporting to IBM Cloud Red Hat Open Shift Kubernetes (ROKs) and/or IBM Cloud Virtual Private Cloud (VPC) Virtual Server Instances (VSI).

This project provides an interactive interface for visualizing, configuring, and driving migration actions related to VCF environments. Whether you’re assessing workloads for brownfield import, exporting inventory data, or orchestrating migration steps, this UI is designed to be a lightweight but powerful companion to your tooling.


This project leverages RVTools, which is a widely-used **Windows utility for VMware vSphere inventory and reporting**, designed to connect to a vCenter Server or individual ESXi hosts and pull detailed configuration and status information across your virtual environment. It displays data about VMs, hosts, datastores, networks, snapshots, VMware Tools status and more in an easy-to-navigate interface, with rich export options (CSV/XLSX) that make it ideal for audits, health checks, capacity planning, and migration planning. RVTools has long been a go-to for VMware administrators who need fast, comprehensive environment insights without installing agents on the infrastructure. See [RVTools – VMware Infrastructure Management​ | Dell USA](https://rvtoolit.com/rvtools.htm)

For official details and downloads, see the RVTools page on Dell’s site, the current authorized host for the tool, [https://www.dell.com/en-us/shop/vmware/sl/rvtools](https://www.dell.com/en-us/shop/vmware/sl/rvtools). Also see [RVTools – VMware Infrastructure Management​ | Dell USA](https://www.dell.com/en-us/shop/vmware/sl/rvtools)

---

## Features

- **Interactive Migration Dashboard** – See at-a-glance status and history  
- **Inventory Reporting** – Parse and present data (ex: exported RVTools inventory)  
- **Configuration UI** – Provide inputs needed for migration operations  
- **Extensible Frontend Toolkit** – Built with React + TypeScript + Vite

---

## Getting Started

These instructions will get the project up and running on your local machine for development and testing.

### Prerequisites

Make sure you have the following installed:

- **Node.js** (>= 18.x)
- **npm** (>= 9.x) or **yarn**

---

## Installation

Clone the repo:

```bash
git clone https://github.com/neilrtaylor/vcf-migration.git
cd vcf-migration
````

Install dependencies:

```bash
npm install
# or
yarn install
```

---

## Development

Run a local development server with hot reload:

```bash
npm run dev
# or
yarn dev
```

This will open the app at `http://localhost:5173` (default Vite host/port).

---

## Build for Production

Create an optimized production build:

```bash
npm run build
# or
yarn build
```

Serve the build locally for testing:

```bash
npm run preview
# or
yarn preview
```

---

## Project Structure

```text
vcf-migration/
├─ public/                 # Static assets
├─ src/                    # Source code
│   ├─ components/         # Reusable UI components
│   ├─ pages/              # Route pages
│   ├─ services/           # API and migration services
│   ├─ styles/             # SCSS / styled sheets
│   └─ index.tsx           # App entrypoint
├─ .gitignore
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
└─ README.md
```

---

## Testing

*(Add this section if you include tests later)*

```bash
npm run test
# or
yarn test
```

---

## Backend Integration

This UI expects a backend API that supports endpoints for:

* Fetching migration inventories
* Submitting migration jobs
* Retrieving job status/progress
* Serving configuration metadata

You can stub/mock these endpoints during early development, or point to a live service matching your VCF migration tooling.

---

## Tips

* Use your browser’s dev tools to inspect network requests while integrating with real APIs.
* Leverage React DevTools for UI component state debugging.
* If you’re working with Excel or CSV exports (like RVTools), consider using a client library (e.g., SheetJS) to parse files in the browser.

---

## Contributing

Thanks for considering contributing! We follow a standard fork-and-pull request workflow:

1. Fork the project
2. Create your feature branch (`git checkout -b feature/foo`)
3. Commit your changes
4. Push to your branch (`git push origin feature/foo`)
5. Open a Pull Request

Please make sure your changes are linted and formatted consistently.

---

## Technologies

This project uses a number of technologies — see the [TECHNOLOGIES](TECHNOLOGIES.md) file for details.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## Acknowledgements

Inspired by real-world VMware Cloud Foundation migration needs and built using:

* React
* TypeScript
* Vite

