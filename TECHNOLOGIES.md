# Technologies Used

This application is built using a modern frontend stack focused on building consistent, accessible, and data-driven user interfaces for infrastructure and migration workflows. The technologies below were selected to support rapid development, strong typing, UI consistency, and long-term maintainability.

---

## React

**React** is the core UI framework used to build the application. It enables a component-based architecture that allows complex migration workflows and dashboards to be decomposed into reusable, composable UI elements.

React’s declarative rendering model and mature ecosystem make it particularly well suited for applications that must handle frequent state changes, such as inventory filtering, migration planning steps, and progress monitoring.

🔗 https://react.dev/

---

## TypeScript

**TypeScript** adds static typing to JavaScript, improving correctness, maintainability, and developer confidence. It helps catch data shape mismatches early, which is critical when dealing with structured inputs such as RVTools exports and API responses.

Strong typing also makes the codebase easier to refactor as migration logic and UI complexity grow.

🔗 https://www.typescriptlang.org/

---

## Vite

**Vite** is used for development and build tooling. It provides extremely fast startup times and hot module replacement by leveraging native ES modules in the browser.

For production builds, Vite generates optimized bundles using Rollup, ensuring the application remains lightweight while maintaining a fast development feedback loop.

🔗 https://vitejs.dev/

---

## IBM Carbon Design System

The **IBM Carbon Design System** provides the UI foundation for the application, including layout patterns, visual styling, and pre-built React components. Carbon ensures visual consistency, accessibility compliance, and a professional enterprise look and feel across the UI.

Using Carbon allows the application to focus on migration logic and data presentation while relying on a proven design system for usability, accessibility (WCAG), and responsive behavior.

🔗 https://carbondesignsystem.com/  
🔗 https://react.carbondesignsystem.com/

---

## Node.js

**Node.js** is required for running the development server, build tooling, and package scripts. While the application executes in the browser at runtime, Node.js underpins the entire development and build workflow.

Its widespread adoption ensures compatibility across development environments and CI pipelines.

🔗 https://nodejs.org/

---

## npm

**npm** is used to manage project dependencies, development tools, and build scripts. It ensures consistent dependency versions across developers and environments and provides access to the broader JavaScript ecosystem.

🔗 https://www.npmjs.com/

---

## HTML5

**HTML5** provides the semantic structure rendered by the React components. Proper use of semantic HTML is important for accessibility, keyboard navigation, and screen reader support, especially in data-heavy enterprise applications.

🔗 https://developer.mozilla.org/en-US/docs/Web/HTML

---

## CSS3

**CSS3** is used for layout, styling, and responsive behavior. It complements the Carbon Design System by handling application-specific styling, layout overrides, and custom visual elements.

Modern CSS capabilities help keep styling scalable and maintainable as the UI evolves.

🔗 https://developer.mozilla.org/en-US/docs/Web/CSS

---

## Git

**Git** is the distributed version control system used to track changes, manage feature development, and maintain a clear history of the codebase.

🔗 https://git-scm.com/

---

## GitHub

**GitHub** hosts the repository and provides collaboration features such as pull requests, issue tracking, and code review workflows. It serves as the primary platform for development and future CI/CD integration.

🔗 https://github.com/

---

## VMware RVTools

**RVTools** is a widely used VMware utility for collecting detailed inventory data from vCenter Server and ESXi hosts. Its exported reports (CSV/XLSX) provide a structured snapshot of the environment, commonly used for audits, health checks, and migration planning.

This application is designed to consume RVTools exports and transform raw inventory data into actionable insights for VMware Cloud Foundation migration workflows.

🔗 https://www.dell.com/en-us/shop/vmware/sl/rvtools

---

## Web APIs & Browser Standards

The application relies on standard **Web APIs** provided by modern browsers, including:
- File upload and parsing APIs
- Fetch API for backend communication
- Local storage for UI state and preferences

Using native browser APIs reduces external dependencies and improves portability.

🔗 https://developer.mozilla.org/en-US/docs/Web/API

---

## Parsing & Data Handling (CSV / Excel)

Because a core use case for this application is **ingesting and interpreting exported VMware inventory data** (for example RVTools CSV or Excel workbooks), we include libraries that make reading and transforming those file formats in the browser reliable and performant.

### PapaParse

**PapaParse** is one of the most robust CSV parsers for JavaScript. It runs in the browser or Node and is optimized for large files, streaming, header parsing, and type inference. It’s widely used in React applications that need to read CSV data without a backend service.  
Key benefits:
- Fast streaming parser for large datasets  
- Header row mapping  
- Async/file streaming support

🔗 https://www.papaparse.com/

---

### SheetJS / xlsx

**SheetJS (xlsx)** is a popular JavaScript library for reading and writing spreadsheet formats, including `.xlsx`, `.xls`, and other Excel variants directly in the browser or Node. For RVTools exports in Excel, SheetJS lets you parse sheets into JSON arrays or other programmatic data structures for UI consumption.

SheetJS is particularly useful when RVTools exports have multiple tabs (e.g. `vInfo`, `vCPU`, `vDisk`, etc.), enabling fine-grained control over how inventory data is consumed and presented.

🔗 https://sheetjs.com/

---

### FileReader API (Web Standard)

The native **FileReader** Web API is used under the hood to read user-selected files (CSV/Excel) from disk into memory, creating binary or text blobs that parsing libraries (like PapaParse and SheetJS) turn into usable data structures.

Key features:
- Browser-native, no extra dependency
- Works with `File` objects from `<input type="file">` or drag-and-drop
- Supports text and binary reads

🔗 https://developer.mozilla.org/en-US/docs/Web/API/FileReader

---

### JSON & Utility Transformations

Once raw sheets or CSV are parsed, the app will typically normalize that data into JavaScript objects/arrays for use throughout the UI. This often uses:

- **Array/Map transformations** via native JS (`Array.map`, `reduce`, etc.)
- **Date and numeric coercion** where columns are expected to be typed
- Optional utility libraries (e.g., Lodash) for deep data manipulation

For the simple normalization of parsed data into consistent table models, native JS is usually sufficient; utility libs are only added for cross-browser convenience or performance.

🔗 https://lodash.com/

---

### Why These Matter

Enterprise-scale exports like those from RVTools can be *large* and *tabular*, with inconsistent column naming between versions. Using the combination of native FileReader + PapaParse + SheetJS enables:

- Browser-side parsing without server service
- Support for both CSV and Excel formats
- Mapping tabs to specific inventory views
- Safe, asynchronous handling of large files

This parsing layer is one of the hearts of the app’s ability to turn infrastructure snapshots into actionable UI data.

## PDF Generation

The application includes client-side **PDF generation** to allow users to export reports, summaries, and migration-related data in a portable, shareable format. Generating PDFs directly in the browser avoids the need for backend rendering services and enables fast, interactive export workflows.

### jsPDF

**jsPDF** is a lightweight JavaScript library used to generate PDF documents in the browser. It allows the application to programmatically create PDFs containing text, tables, and basic layout elements derived from parsed inventory data and user selections.

Common use cases include:
- Exporting migration summaries
- Generating inventory or assessment reports
- Creating downloadable artifacts from UI views

jsPDF integrates cleanly with React and works well alongside data parsed from RVTools exports.

🔗 https://github.com/parallax/jsPDF

---

### jsPDF AutoTable

**jsPDF AutoTable** is an extension for jsPDF that simplifies rendering tabular data into PDF documents. It is particularly useful for exporting structured inventory data (such as VM lists, datastore summaries, or host configurations) into readable, paginated tables.

This is especially valuable when working with large RVTools datasets where consistent column layout and automatic pagination are required.

🔗 https://github.com/simonbengtsson/jsPDF-AutoTable

---

## Excel Generation with ExcelJS

**ExcelJS** is a powerful JavaScript library for creating, reading, and manipulating Excel workbooks in the browser and Node.js. Unlike SheetJS (which is primarily for reading), ExcelJS provides full support for:

- **Cell Styling** — Background colors, font styles, borders, and number formats
- **Formulas** — Excel formulas that calculate when the file is opened
- **Multiple Worksheets** — Complex workbooks with multiple tabs
- **Column Widths** — Automatic and manual column sizing

### Why ExcelJS for BOM Export

The Bill of Materials (BOM) export feature requires styled spreadsheets with formulas that users can modify. ExcelJS enables:

- Color-coded headers (blue for main headers, black for section headers)
- Currency formatting (`$#,##0.00`)
- Formulas like `=B5*C5` for price calculations
- SUM formulas for totals that update when values change
- Professional styling matching IBM Cloud cost estimator format

This allows exported BOMs to be fully editable — users can adjust quantities or prices and see totals recalculate automatically.

🔗 https://github.com/exceljs/exceljs

---

## Data Visualization with Chart.js

**Chart.js** is a flexible JavaScript charting library used to create interactive, responsive charts and graphs. The application uses Chart.js for visualizing VMware environment data and migration analysis results.

### Chart Types Used

- **Doughnut Charts** — OS distribution, VM status breakdown
- **Bar Charts** — Resource utilization, profile distribution
- **Horizontal Bar Charts** — Complexity scoring, wave planning

### Integration with React

Chart.js integrates with React through wrapper components that handle:
- Canvas rendering and cleanup
- Responsive resizing
- Theme-aware styling (IBM Carbon colors)
- Interactive tooltips and legends

🔗 https://www.chartjs.org/

---

### Why Client-Side PDF Generation

Using browser-based PDF generation provides:
- No backend dependencies for report rendering
- Immediate feedback and downloads
- Reduced infrastructure complexity
- Easier offline or air-gapped usage

This aligns well with the goal of keeping the application lightweight while still producing professional, distributable artifacts.

---

## IBM watsonx.ai

**IBM watsonx.ai** provides AI-powered features for the migration tool, including workload classification, right-sizing recommendations, migration insights, and a context-aware chatbot. The integration uses IBM Granite foundation models via the watsonx.ai text generation and chat APIs.

### Architecture

AI features are optional and follow the same Code Engine proxy pattern as the pricing and profiles integrations:

- **Code Engine AI Proxy** (`functions/ai-proxy/`) — Express.js server that authenticates with IBM Cloud IAM, manages prompts, and caches responses to control API costs
- **Client Services** (`src/services/ai/`) — TypeScript API clients, caching, and context builders
- **React Hooks** (`src/hooks/useAI*.ts`) — State management for AI features with loading states and fallback behavior

### Use Cases

| Feature | Description |
|---------|-------------|
| **Workload Classification** | LLM-based VM workload detection with confidence scores, complementing regex-based pattern matching |
| **Right-Sizing** | AI-recommended IBM Cloud VSI profiles considering workload context and over-provisioning detection |
| **Migration Insights** | Executive summaries, risk assessments, and actionable recommendations generated from environment data |
| **Chat Assistant** | Conversational interface for migration planning questions, aware of the user's loaded environment data |

### Privacy

Only aggregated environment summaries (VM counts, resource totals, workload categories) are sent to watsonx.ai. Individual VM names, IP addresses, and raw RVTools data are never transmitted.

---

## Summary

This technology stack combines a modern React frontend with strong typing, fast build tooling, and an enterprise-grade design system. Together, these technologies provide a scalable foundation for building a robust UI to support VMware Cloud Foundation migration and infrastructure analysis workflows.

### Data Import & Parsing

| Responsibility | Technology |
|----------------|------------|
| Read file from user device | FileReader API |
| Parse CSV content | PapaParse |
| Parse Excel/Sheets | SheetJS (`xlsx`) |
| Transform & normalize | JavaScript / Utility libs |

### Export & Reporting

| Responsibility | Technology |
|----------------|------------|
| Generate styled Excel with formulas | ExcelJS |
| Generate PDF reports | jsPDF + AutoTable |
| Read/write basic Excel | SheetJS (`xlsx`) |

### Visualization

| Responsibility | Technology |
|----------------|------------|
| Charts and graphs | Chart.js |
| UI components | IBM Carbon Design System |
| Responsive layout | CSS3 / Carbon Grid |

Each of these has broad community support and clear documentation, so you can extend or swap them as the project evolves without large rewrites.
