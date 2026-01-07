# Product Requirements Document: RVTools Analysis Web Application

**Version:** 1.1
**Date:** January 6, 2026
**Author:** Neil (IBM Cloud Technical Specialist)
**Status:** Ready for Development
**Next Review:** Upon completion of Phase 1

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Capabilities](#2-product-capabilities)
3. [User Experience Design](#3-user-experience-design)
4. [Technical Architecture](#4-technical-architecture)
5. [Feature Specifications](#5-feature-specifications)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Development Phases](#7-development-phases)
8. [Success Criteria](#8-success-criteria)
9. [Out of Scope](#9-out-of-scope-future-considerations)
10. [Appendix](#10-appendix)
11. [Glossary](#11-glossary)

---

## Quick Reference

### Key Features

1. **File Upload & Parsing** - RVTools Excel export analysis
2. **Executive Dashboard** - High-level metrics with MTV readiness score
3. **Compute Analysis** - CPU/Memory with Red Hat overcommitment guidelines
4. **Storage Analysis** - Datastore utilization, MTV blocker detection
5. **Network Analysis** - Port groups, NIC types, OpenShift Virtualization compatibility
6. **Cluster & Host Analysis** - Physical infrastructure capacity planning
7. **Configuration Analysis** - VMware Tools, hardware versions, MTV pre-flight checks
8. **Migration Readiness** - Dual-target analysis (ROKS + VPC VSI) with MTV workflow
9. **Interactive Tables** - All RVTools tabs with MTV status filtering
10. **Export Reports** - PDF, Excel, MTV Migration Plan with YAML templates

### Technology Stack

| Category | Technology |
|----------|------------|
| Frontend | React 18+ with TypeScript |
| UI Library | IBM Carbon Design System |
| Charts | Chart.js (primary), D3.js (complex visualizations) |
| Tables | TanStack Table v8 with virtual scrolling |
| Excel Parsing | SheetJS (xlsx) |
| Export | jsPDF + html2canvas (PDF), SheetJS (Excel) |
| State | React Context API + useReducer |
| Processing | Web Workers for file parsing |

### Development Phases

| Phase | Focus | Duration |
|-------|-------|----------|
| Phase 1 (MVP) | Core analysis, basic MTV validation, Red Hat OS matrix | 4-6 weeks |
| Phase 2 (Enhanced) | Full MTV workflow, migration planning, Red Hat references | 3-4 weeks |
| Phase 3 (Advanced) | MTV YAML templates, advanced visualizations, comparison mode | 4-6 weeks |
| Phase 4 (Polish) | Performance optimization, accessibility audit, partner branding | 2-3 weeks |

---

## 1. Executive Summary

### 1.1 Product Overview

A modern, web-based application that transforms RVTools Excel exports into comprehensive, interactive visual dashboards. The application enables IT professionals to quickly understand VMware virtual infrastructure environments through intuitive data visualization and analysis, with specific focus on migration readiness to IBM Cloud targets (ROKS and VPC VSI). The application incorporates Red Hat validated migration methodologies and aligns with Migration Toolkit for Virtualization (MTV) workflows.

### 1.2 Problem Statement

RVTools exports contain valuable infrastructure data but require manual analysis across multiple Excel tabs. Users need hours to extract insights, create reports, and identify optimization opportunities. When planning migrations to IBM Cloud, architects must manually calculate sizing requirements for both ROKS (Red Hat OpenShift Kubernetes Service) and VPC VSI (Virtual Private Cloud Virtual Server Instances) targets, analyze workload compatibility, and determine network requirements. This application automates analysis and presents findings through modern, interactive visualizations with intelligent migration recommendations based on Red Hat validated architectures and best practices.

### 1.3 Target Users

- VMware infrastructure specialists
- Cloud migration consultants
- Infrastructure architects
- IT capacity planners
- Technical sales engineers
- IBM Cloud architects
- Migration project managers
- Red Hat partners and field engineers

### 1.4 Success Metrics

| Metric | Target |
|--------|--------|
| Time to insight | <2 minutes from upload to actionable dashboard |
| User satisfaction | >4/5 rating on usability |
| Analysis completeness | 100% coverage of critical RVTools data points |
| Export usage | >70% of users export generated reports |
| Migration accuracy | Sizing recommendations within 10% of actual requirements |
| MTV alignment | 100% compatibility with MTV migration workflow phases |

### 1.5 Red Hat Alignment

This application aligns with Red Hat's validated migration approaches:

- **Migration Toolkit for Virtualization (MTV):** Wave planning aligns with MTV phases (analysis → preparation → migration → validation)
- **Reference Architectures:** Sizing calculations based on Red Hat validated architectures for OpenShift Virtualization
- **Best Practices:** Incorporates lessons learned from Red Hat field migrations and partner enablement programs
- **Compatibility Matrix:** Uses Red Hat's tested OS compatibility data for accuracy

---

## 2. Product Capabilities

### 2.1 Core Features

#### 2.1.1 File Upload & Processing

**Description:** Secure upload and parsing of RVTools Excel exports

**Requirements:**
- Accept `.xlsx` files up to 50MB
- Validate file structure matches RVTools format (versions 4.x+)
- Parse all standard RVTools tabs:
  - vInfo, vCPU, vMemory, vDisk, vPartition
  - vNetwork, vFloppy, vCD, vSnapshot, vTools
  - vRP, vCluster, vHost, vHBA, vNic
  - vSwitch, vPort, vDatastore, vMultiPath
  - vLicense
- Display upload progress with percentage complete
- Validate data integrity and provide clear error messages for malformed files
- Process files client-side (no server upload required for MVP)
- Extract collection date and vCenter version from metadata

**User Flow:**
1. User lands on upload page with drag-drop zone
2. User drags RVTools export or clicks to browse
3. Application validates file type and size
4. Progress indicator shows parsing status (0-100%)
5. On success, redirect to dashboard view
6. On error, display specific validation message with guidance

#### 2.1.2 Executive Dashboard

**Description:** High-level overview of the entire virtual infrastructure

**Infrastructure Summary Metrics:**
- Total VMs (count and breakdown: powered on/off/suspended)
- Total vCPUs (allocated vs. consumed)
- Total memory (allocated vs. consumed, in GB)
- Total storage (provisioned vs. consumed, in TB)
- Host count and ESXi version distribution
- Cluster count with HA/DRS status
- Datastore count by type (VMFS, NFS, VSAN, VVOL)

**Health Indicators:**
- VMs with snapshots (count, total age, oldest snapshot)
- Orphaned VMDKs (count and total size)
- VMs with CD-ROM connected (count)
- VMs with floppy drives connected (count)
- Oversized VMs (>80% resource allocation)
- VMs with outdated VMware Tools (count and percentage)
- VMs with unsupported hardware versions (count)
- Datastores >80% capacity (count)

**Migration Readiness Summary:**
- Total VMs suitable for migration (count and percentage)
- OS distribution (Windows vs. Linux vs. Other)
- Complexity breakdown (Simple/Moderate/Complex/Blocker counts)
- Top migration blockers (ranked list)
- MTV compatibility score (0-100)

**Presentation Requirements:**
- Modern card-based layout with visual hierarchy
- Color-coded indicators: green (healthy), yellow (warning), red (critical), blue (informational)
- Icons for each metric category
- Sparklines or mini-charts showing trends where applicable
- Responsive grid layout (4 columns desktop, 2 tablet, 1 mobile)
- Click-through navigation to detailed sections

#### 2.1.3 Compute Analysis

**Description:** Detailed analysis of CPU and memory utilization

**CPU Visualization:**
- Horizontal bar chart: vCPU allocation per VM (top 20 consumers)
- Pie chart: vCPU distribution by cluster
- Histogram: vCPU count distribution (1, 2, 4, 8, 16+ vCPUs)
- Line chart: CPU ready time by VM (if available in data)
- Table: All VMs sorted by vCPU count with filtering
- Heat map: vCPU to physical core ratio by host

**Memory Visualization:**
- Horizontal bar chart: Memory allocation per VM (top 20 consumers)
- Stacked bar chart: Memory overcommitment ratio by cluster
- Histogram: Memory size distribution (bins: <4GB, 4-8GB, 8-16GB, 16-32GB, 32-64GB, 64GB+)
- Pie chart: Memory configuration types (standard, reservation, limit)
- Table: VMs sorted by memory with search/filter
- Scatter plot: vCPU vs. Memory ratio (identify imbalanced VMs)

**Optimization Insights:**
- Identify VMs with excessive vCPU allocation (>8 vCPUs single-threaded workloads)
- Flag VMs with memory reservations (potential migration issues per MTV guidelines)
- Calculate right-sizing opportunities (vCPUs or memory significantly overprovisioned)
- Show CPU/memory ratios for workload profiling
- Identify potential candidates for CPU hot-add/memory hot-plug
- List VMs with CPU affinity settings (may impact vMotion/migration per Red Hat best practices)

**Data Tables:**
- Sortable/filterable table with columns:
  - VM Name, Power State, vCPU Count, Memory (GB)
  - CPU Ready (%), Memory Active (MB), Memory Consumed (MB)
  - CPU Reservation, Memory Reservation
  - Cluster, Host, Guest OS

#### 2.1.4 Storage Analysis

**Description:** Comprehensive storage utilization and datastore analysis

**Datastore Overview:**
- Stacked bar chart: Capacity vs. free space per datastore
- Pie chart: Storage type breakdown (VMFS, NFS, VSAN, VVOL)
- Heat map: Datastore utilization percentages (color-coded by capacity)
- Treemap: Storage distribution across datastores (size-based visualization)
- Line chart: Provisioned vs. consumed storage trend by datastore

**Disk Analysis:**
- Bar chart: Top 20 storage consumers by VM
- Pie chart: Thin vs. thick provisioning distribution
- Donut chart: Disk type distribution (SCSI, SATA, NVMe, etc.)
- Bar chart: Orphaned disk identification with sizes
- Stacked bar chart: Snapshot storage consumption by VM
- Table: Guest partition analysis (C:, D:, E: drives with utilization %)

**Storage Configuration:**
- Storage controller types per VM (LSI Logic, Paravirtual, etc.)
- Disk sharing configurations (multi-writer disks) - flagged as MTV blocker
- Independent disk identification (persistent vs. non-persistent)
- RDM (Raw Device Mapping) identification - flagged as migration blocker
- Disk mode analysis (persistent, independent, etc.)

**Storage Optimization:**
- Datastores >80% capacity (flagged with warning per Red Hat recommendations)
- Thin provisioning overhead calculation (provisioned - consumed)
- VMs with excessive disk counts (>10 disks)
- Potential savings from snapshot removal (size and count)
- Orphaned VMDK cleanup opportunities (estimated savings)
- Storage reclamation candidates (guest partitions >30% free)

**Data Tables:**
- Datastore table: Name, Type, Capacity, Free, Provisioned, Number of VMs
- VM disk table: VM Name, Disk Label, Capacity, Provisioned, Consumed, Thin/Thick
- Partition table: VM Name, Drive Letter, Capacity, Free Space, % Free

#### 2.1.5 Network Analysis

**Description:** Network configuration and connectivity visualization

**Network Topology:**
- Sunburst diagram: Port group hierarchy and VM distribution
- Bar chart: VMs per port group/VLAN
- Pie chart: Network adapter types (VMXNET3, E1000, E1000E, etc.)
- Network diagram: Virtual switch to port group relationships
- Bar chart: VMs with multiple NICs (count by NIC quantity)

**Network Configuration:**
- Port group usage statistics (VM count per port group)
- VLAN distribution across infrastructure
- Network adapter count per VM (distribution histogram)
- Virtual switch types (Standard vs. Distributed)
- NIC teaming and failover configurations
- MTU settings analysis (identify jumbo frame usage)

**Network Health:**
- VMs with disconnected NICs (count and list) - potential MTV issue
- Port group misconfigurations (inconsistent VLAN IDs)
- VMs with legacy adapter types (E1000 on modern OS) - flag for upgrade
- Inconsistent network configurations across clusters
- VMs without network connectivity (no adapters)

**Subnet Planning:**
- Analyze current IP addressing patterns (from VM tools data if available)
- Calculate required subnet sizes based on VM network distribution
- Identify VMs on same network segments (migration grouping per MTV recommendations)
- Network isolation requirements (VMs on isolated port groups)
- Subnet recommendations for IBM Cloud VPC migration
- OpenShift Virtualization network requirements (pod/service networks)

**Data Tables:**
- Network table: VM Name, Network Label, VLAN ID, Adapter Type, MAC Address, Connected
- Port group table: Name, VLAN ID, VM Count, vSwitch, Type
- VM network summary: VM Name, NIC Count, Networks, Adapter Types

#### 2.1.6 Cluster & Host Analysis

**Description:** Physical infrastructure and cluster resource analysis

**Cluster View:**
- Bar chart: Physical CPU cores vs. vCPU allocation per cluster
- Stacked bar chart: Memory capacity vs. allocation per cluster
- Resource pool hierarchy visualization (treemap or sunburst)
- Cluster configuration table: HA status, DRS status, EVC mode
- vMotion compatibility groups identification
- Cluster capacity planning metrics (headroom calculations)
- Overcommitment ratios per cluster (CPU and memory per Red Hat guidelines)

**Host View:**
- Table: Physical host specifications (CPU model, cores, memory, version)
- Bar chart: Host resource allocation (percentage of capacity used)
- ESXi version distribution (pie chart with build numbers)
- Host vendor/model distribution
- CPU architecture analysis (Intel vs. AMD, CPU generations)
- Host uptime statistics (identify hosts needing maintenance)
- Overcommitment ratios per host

**High Availability Analysis:**
- HA admission control policy compliance
- Failover capacity calculations
- DRS automation level distribution
- DRS recommendations compliance (if available)
- vMotion compatibility across hosts

**Data Tables:**
- Cluster table: Name, Hosts, VMs, Total Cores, Total Memory, HA Status, DRS Status
- Host table: Name, Cluster, CPU Model, Cores, Memory, Version, Build, Vendor
- Resource pool table: Name, Cluster, CPU Limit, Memory Limit, VM Count

#### 2.1.7 Configuration Analysis

**Description:** VM configuration standards and compliance

**VM Configuration:**
- Pie chart: Hardware version distribution (v10, v11, v13, v14, v15, v17, v19, v20, v21)
- Bar chart: Guest OS distribution (grouped by family: Windows, Linux, Other)
- Detailed OS version breakdown (Windows Server versions, Linux distributions)
- VMware Tools status distribution (current, outdated, not installed, not running)
- Stacked bar chart: VM compatibility modes
- VM template identification (annotations containing "template")
- Custom attributes analysis

**Hardware Configuration:**
- VMs with CD-ROM drives connected (count and list) - MTV requires disconnection
- VMs with floppy drives configured (count and list) - remove before migration
- VMs with USB controllers (count and list) - potential MTV compatibility issue
- VMs with serial/parallel ports (count and list)
- VMs with PCI pass-through devices (count and list) - migration blocker
- Video memory allocation distribution
- 3D graphics enablement analysis - not supported in OpenShift Virtualization

**Compliance Checks:**
- VMs with outdated hardware versions (<v14) - recommend upgrade for OpenShift Virtualization
- VMs with outdated VMware Tools (not current)
- VMs without VMware Tools installed - required for MTV migration
- Unsupported guest OS versions (EOL operating systems per Red Hat compatibility matrix)
- VMs without annotations/documentation
- VMs with boot delays configured
- VMs with high latency sensitivity settings

**Snapshot Analysis:**
- Snapshot age distribution (histogram: <7 days, 7-30 days, 30-90 days, >90 days)
- Snapshots >30 days old (critical - require attention per MTV best practices)
- Total snapshot storage consumption
- VMs with snapshot chains (multiple snapshots) - must be consolidated before migration
- Oldest snapshots (top 10 by age)

**Data Tables:**
- Configuration table: VM Name, HW Version, Guest OS, Tools Status, Tools Version
- Compliance table: VM Name, Issues (list of compliance violations)
- Snapshot table: VM Name, Snapshot Name, Created Date, Age (days), Size (GB)

#### 2.1.8 Migration Readiness Assessment

**Description:** Comprehensive dual-target migration analysis for both OpenShift ROKS and IBM Cloud VPC VSI, with intelligent OS compatibility analysis aligned with Red Hat Migration Toolkit for Virtualization (MTV) workflows

**Migration Target Selection:**
- User can toggle between three views:
  - **ROKS Analysis** (OpenShift Virtualization target)
  - **VPC VSI Analysis** (Virtual Server Instance target)
  - **Comparison View** (side-by-side comparison)
- Automatic workload categorization by suitability:
  - Best for ROKS (containerizable, modern Linux, stateless)
  - Best for VPC VSI (traditional Windows, legacy apps, stateful databases)
  - Flexible (can go either way based on business requirements)

**MTV Workflow Alignment:**
- Analysis phase: Compatibility and complexity assessment (this tool)
- Preparation phase: Prerequisites and validation checks
- Migration phase: Wave planning and execution
- Validation phase: Post-migration verification

---

**A. ROKS (OpenShift Virtualization) Migration Analysis**

**Sizing Calculations (Based on Red Hat validated architectures):**

- Recommended OpenShift cluster configuration:
  - Worker node count (minimum 3, recommended based on workload)
  - Worker node profile (bx2-16x64, bx2-32x128, bx2-48x192, etc.)
  - Master node profile (fixed: bx2-4x16 typically)
  - Total cluster cores and memory
  - Overcommitment assumptions:
    - CPU: 1.5x typical, 2x maximum (per Red Hat guidelines)
    - Memory: 1.2x typical, 1.5x maximum

- Storage class mapping and sizing:
  - RWO (ReadWriteOnce) requirements - standard VM disks
  - RWX (ReadWriteMany) requirements - shared storage needs
  - Total ODF storage capacity needed (with 3x replication factor per Red Hat default)
  - Storage class performance tiers (custom, bronze, silver, gold)

- Network configuration requirements:
  - Cluster subnet sizing (recommend /24 minimum per Red Hat best practices)
  - Pod network CIDR recommendations (default: 172.30.0.0/16)
  - Service network CIDR recommendations (default: 172.21.0.0/16)
  - Ingress/egress requirements

**ROKS Sizing Formula:**
```
Worker Nodes = ceil(Total vCPUs / (Worker Node vCPUs * CPU Overcommit))
CPU Overcommit = 1.5x (typical), 2.0x (maximum per Red Hat)
Memory Overcommit = 1.2x (typical), 1.5x (maximum per Red Hat)

ODF Storage = (Total Consumed Storage * 1.3) / Efficiency Factor / 3
Efficiency Factor = 0.7 (accounts for overhead)
Replication = 3x (Red Hat default)

Recommended Profiles:
- General: bx2-32x128 (32 vCPU, 128GB)
- Compute: cx2-32x64 (32 vCPU, 64GB)
- Memory: mx2-32x256 (32 vCPU, 256GB)
```

**Workload Compatibility Analysis (Based on Red Hat's tested OS compatibility matrix):**

- **Fully Supported Operating Systems:**
  - RHEL 8.x, 9.x (optimal for OpenShift Virtualization)
  - CentOS Stream 8, 9
  - Ubuntu 20.04 LTS, 22.04 LTS, 24.04 LTS
  - Debian 10, 11, 12
  - SLES 15 SP3+
  - Windows Server 2016, 2019, 2022 (with VirtIO drivers)
  - Windows 10/11 (with VirtIO drivers)
  - Assign compatibility score: 90-100

- **Supported with Caveats:**
  - RHEL 7.x (older, but still supported - recommend in-place upgrade to RHEL 8+)
  - CentOS 7 (EOL but functional - recommend migration to CentOS Stream or RHEL)
  - Ubuntu 18.04 LTS (approaching EOL - recommend upgrade)
  - Windows Server 2012 R2 (recommend upgrade to 2019/2022)
  - Assign compatibility score: 60-89

- **Unsupported/Problematic Scenarios (per Red Hat documentation):**
  - Windows Server 2012 and earlier (requires upgrade path to 2016+)
  - Legacy Linux distributions (RHEL 6, CentOS 6, Ubuntu 16.04)
  - Solaris, FreeBSD, or other Unix variants (not supported)
  - VMs with GPU pass-through (not supported in OpenShift Virtualization)
  - VMs with USB device requirements (limited support)
  - VMs with physical RDM disks (must be converted)
  - Assign compatibility score: 0-59 (blockers: 0)

---

**B. VPC VSI (Virtual Server Instance) Migration Analysis**

**Sizing Calculations:**

- **Instance Profile Recommendations:**
  - Map each VM to appropriate VSI profile family:
    - **Balanced (bx2 family):** General workloads, 1:4 CPU:memory ratio
    - **Compute (cx2 family):** CPU-intensive, 1:2 CPU:memory ratio
    - **Memory (mx2 family):** Memory-intensive, 1:8 CPU:memory ratio
    - **Very High Memory (vx2 family):** Large databases, 1:14 CPU:memory ratio
    - **Ultra High Memory (ux2 family):** SAP HANA, 1:28 CPU:memory ratio

**VPC VSI Profile Selection:**
```
CPU:Memory Ratio → Profile Family
1:4 → Balanced (bx2)
1:2 → Compute (cx2)
1:8 → Memory (mx2)
1:14 → Very High Memory (vx2)
1:28 → Ultra High Memory (ux2)
```

- **Resource Aggregation:**
  - Total vCPUs required across all VMs
  - Total memory required (GB)
  - Total primary storage required (boot volumes)
  - Total secondary storage required (data volumes)
  - Instance count by profile type
  - Overprovisioning recommendations (15% headroom for growth)

**Storage Configuration:**
- **Boot Volume Sizing:**
  - Minimum 100GB per instance (VSI requirement)
  - Map VM boot disk to appropriate boot volume size
  - Performance tier recommendations (3, 5, or 10 IOPS/GB)

- **Data Volume Sizing:**
  - Map each VM data disk to separate data volume
  - Volume count per instance
  - Total data volume capacity
  - Performance tier mapping based on current datastore performance
  - Block Storage for VPC volume recommendations

**Network Configuration:**
- **Subnet Planning:**
  - Calculate required subnet sizes per tier:
    - Web tier VMs → public-facing subnet
    - App tier VMs → private subnet
    - Database tier VMs → private subnet
    - Management VMs → management subnet
  - Recommended subnet sizes: /28 (16 IPs) to /24 (256 IPs)
  - Subnet per zone requirements (for HA across zones)

- **Security Groups:**
  - Default security group rules per tier
  - Inbound/outbound rule recommendations
  - Management access rules

---

**Migration Complexity Scoring (Aligned with MTV pre-flight checks):**

Calculate complexity score (0-100) based on weighted factors:

| Factor | Weight | Scoring |
|--------|--------|---------|
| Operating System | 30% | RHEL 8+/Ubuntu 20+: 5, RHEL 7: 20, Win 2019+: 20, Win 2016: 30, Win 2012 R2: 60, Legacy: 85-100 |
| Network Complexity | 20% | 1 NIC: 5, 2 NICs: 15, 3 NICs: 30, 4+ NICs: 50 |
| Storage Complexity | 20% | 1-2 disks: 5, 3-5: 15, 6-10: 30, 10+: 50, RDM: 100, Shared: 100 |
| Hardware Config | 15% | Standard: 0, CD-ROM: 10, Floppy: 15, USB: 25, PCI pass-through: 100 |
| Tools/Version | 10% | HW v14+/Tools OK: 0, HW v13: 10, HW v10-12: 25, Tools outdated: +15 |
| App Dependencies | 5% | Based on annotations: Web: 5, Database: 30, AD/DC: 60 |

**Complexity Categories:**
- **Simple (0-25 points):** Modern OS, single NIC, 1-2 disks, no special hardware, current tools
- **Moderate (26-50 points):** Recent OS, 2-3 NICs, 3-5 disks, standard hardware, may need updates
- **Complex (51-75 points):** Older OS (needs upgrade), 4+ NICs, 6+ disks, special configurations
- **Blocker (76-100 points):** Unsupported OS, pass-through devices, RDM, fundamental incompatibilities

**Migration Wave Planning:**
- Automatic grouping of VMs into migration waves based on:
  - Complexity score (simple VMs in early waves)
  - Application dependencies (inferred from network groups)
  - Cluster/host grouping (VMs on same infrastructure together)
  - Storage dependencies (VMs on same datastores)
- Recommended wave size: 10-20 VMs per wave
- Critical path identification (blockers that must be resolved first)

**Cost Estimation Inputs:**
- Total worker node hours per month
- Total storage capacity (ODF) in TB
- Data transfer estimates (ingress/egress)
- Reserved capacity vs. on-demand recommendations
- Link to IBM Cloud Cost Estimator with pre-filled values

#### 2.1.9 Interactive Data Tables

**Description:** Searchable, sortable, filterable data tables for detailed analysis

**Requirements:**
- Implement tables for each RVTools tab with:
  - Column sorting (ascending/descending)
  - Global search across all columns
  - Per-column filtering
  - Column visibility toggle
  - Export to CSV functionality
  - Pagination with configurable page size (10/25/50/100)
  - Row selection for bulk actions
  - Responsive design with horizontal scrolling
  - Virtual scrolling for large datasets (>1000 rows)

- Preserve key columns from RVTools:
  - VM name, power state, OS, vCPU, memory, storage
  - Cluster, host, datastore assignments
  - Network configurations
  - Hardware version, tools status
  - All timestamp fields

#### 2.1.10 Report Generation

**Description:** Export analysis results in multiple formats

**PDF Export:**
- Cover page with branding
- Executive summary with key metrics (1 page)
- Analysis sections with charts (10-15 pages)
- MTV workflow diagram (1 page)
- Migration waves table (2-3 pages)
- Appendices (5-10 pages)

**Excel Export:**
- 11+ tabs (Executive, Compute, Storage, Network, Config, ROKS, VPC VSI, Waves, Cost, MTV Pre-Flight, Raw Data)
- Conditional formatting (red/yellow/green)
- Formulas protected
- Links to IBM Cloud Cost Estimator

**MTV Migration Plan Export:**
- Project overview tab
- Sizing & architecture tab
- Wave details (one tab per wave)
- MTV configuration tab with YAML examples
- Network architecture tab
- Pre-migration checklist
- Post-migration validation
- Issue tracking

---

## 3. User Experience Design

### 3.1 Design Principles

- **Clarity:** Information hierarchy guides users to key insights
- **Modern:** Contemporary UI with smooth animations and transitions
- **Responsive:** Full functionality on desktop, tablet, and mobile
- **Accessible:** WCAG 2.1 AA compliance for accessibility
- **Performant:** Sub-second interactions, lazy loading for large datasets

### 3.2 Visual Design Requirements

#### 3.2.1 Color Scheme

| Purpose | Color | Hex |
|---------|-------|-----|
| Primary (Actions) | IBM Blue | #0f62fe |
| Secondary (Success) | Teal | #009d9a |
| Warning | Amber | #f1c21b |
| Error | Red | #da1e28 |
| Neutral | Gray Scale | Various |

Use colorblind-safe palette (IBM Design Language colors) for data visualization.

#### 3.2.2 Typography

- **Primary font:** IBM Plex Sans (or system default sans-serif)
- **Headings:** Bold, 24-32px for H1, 18-24px for H2
- **Body:** Regular, 14-16px for primary content
- **Monospace:** IBM Plex Mono for data values and technical content

#### 3.2.3 Layout Components

**Navigation:**
- Top navigation bar with app branding (48px height)
- Side navigation for dashboard sections (256px expanded, 48px collapsed)
- Breadcrumb navigation for context

**Cards:**
- Metric cards with icon, value, label, and trend indicator
- Chart cards with title, visualization, and optional controls
- Consistent padding (16-24px), shadows, and border radius (4px)

**Charts:**
- Use Chart.js for standard visualizations
- D3.js for custom visualizations (heatmaps, topology diagrams)
- Tooltips on hover with detailed information
- Legend controls for toggling data series
- Responsive sizing that adapts to container
- Export to PNG/SVG button

### 3.3 Page Structure

#### 3.3.1 Landing Page

```
+----------------------------------------------------------+
|  [Logo] RVTools Analyzer                   [Help] [About] |
+----------------------------------------------------------+
|                                                           |
|              HERO SECTION                                 |
|    Analyze Your VMware Environment in Minutes             |
|                                                           |
|    [Large Drag-Drop Upload Zone]                          |
|    "Drag your RVTools export here or click to browse"     |
|                                                           |
|    [Download Sample RVTools File]                         |
+----------------------------------------------------------+
|         QUICK START GUIDE (3 STEPS)                       |
|   [1] Export RVTools  [2] Upload File  [3] Analyze        |
+----------------------------------------------------------+
```

#### 3.3.2 Dashboard Layout

```
+----------------------------------------------------------+
| [Logo] RVTools Analyzer [Env Name] [Export] [New Analysis]|
+----------------------------------------------------------+
|        |                                                  |
| EXEC   |  BREADCRUMB: Home > Executive Summary           |
| COMP   |                                                  |
| STOR   |  [Metric Cards Grid - 4 columns]                |
| NET    |                                                  |
| CLUST  |  HEALTH INDICATORS                               |
| CONFIG |  [Warning/Issue List]                            |
| MIGR   |                                                  |
|  ROKS  |  CHARTS                                          |
|  VSI   |  [Chart Grid - 2 columns]                        |
| TABLES |                                                  |
+----------------------------------------------------------+
```

#### 3.3.3 Migration Readiness Layout

```
+----------------------------------------------------------+
| MIGRATION READINESS ASSESSMENT                            |
+----------------------------------------------------------+
| [Tab: ROKS Analysis] [Tab: VPC VSI] [Tab: Compare]        |
+----------------------------------------------------------+
|  SIZING SUMMARY                                           |
|  [Worker Nodes] [ODF Storage] [Network]                   |
|                                                           |
|  COMPATIBILITY BREAKDOWN                                  |
|  [Progress Bar: Supported | Needs Review | Blockers]      |
|                                                           |
|  MIGRATION COMPLEXITY                                     |
|  [Simple: X VMs] [Moderate: X] [Complex: X]               |
|                                                           |
|  MIGRATION WAVES                                          |
|  [Wave 1] [Wave 2] [Wave 3] ...                           |
|                                                           |
|  DETAILED VM TABLE                                        |
|  [Filterable table with MTV status]                       |
+----------------------------------------------------------+
```

### 3.4 Interaction Patterns

**Chart Interactions:**
- Hover: Display tooltip with detailed information
- Click legend: Toggle visibility of data series
- Click element: Filter related data table
- Zoom/Pan: For large datasets
- Export: Save as PNG/SVG

**Table Interactions:**
- Click header: Sort ascending/descending
- Type in search: Global filter with debounce (300ms)
- Column filter: Per-column dropdown filters
- Row selection: Checkbox for bulk actions
- Pagination: 10/25/50/100 rows per page

**Navigation:**
- Side nav click: Smooth scroll to section
- Breadcrumb: Quick navigation context
- Back to top: Button appears after 500px scroll
- Keyboard: Full keyboard navigation support

---

## 4. Technical Architecture

### 4.1 Technology Stack

#### 4.1.1 Frontend Framework

**Recommended:** React 18+ with TypeScript

**Rationale:**
- Component reusability across sections
- Strong typing reduces bugs, improves maintainability
- Excellent ecosystem for charts, tables, UI components
- Great performance with virtual DOM
- Large community and documentation

**Key React Libraries:**
- `react-router-dom` - Client-side routing
- `react-hook-form` - Form handling and validation
- `@tanstack/react-query` - Data fetching and caching (if API added later)

#### 4.1.2 UI Component Library

**Recommended:** Carbon Design System (IBM official)

**Rationale:**
- Built for data-dense enterprise applications
- Excellent table and data visualization components
- Accessibility built-in (WCAG compliant)
- Consistent with IBM branding
- Responsive by default

**Installation:**
```bash
npm install @carbon/react @carbon/charts @carbon/charts-react
```

#### 4.1.3 Data Visualization

**Primary Library: Chart.js 4.x with react-chartjs-2**

Use for:
- Bar charts (horizontal and vertical)
- Line charts
- Pie/Donut charts
- Histograms
- Area charts
- Scatter plots

**Secondary Library: D3.js 7.x**

Use for:
- Custom visualizations (heatmaps, treemaps)
- Network topology diagrams
- Sunburst diagrams
- Complex hierarchical visualizations

#### 4.1.4 Data Processing

**Excel Parsing:** SheetJS (xlsx package)
- Parse Excel files in browser
- Extract data from multiple sheets
- Convert to JSON for processing

**Data Manipulation:** Lodash
- Array/object manipulation
- Grouping, sorting, filtering operations
- Statistical calculations

#### 4.1.5 State Management

**Recommended:** React Context API + useReducer (for MVP)
- Built-in React feature
- Sufficient for single-page analysis app
- **Alternative:** Redux Toolkit (if app grows complex)

#### 4.1.6 Table Component

**Recommended:** TanStack Table (formerly React Table) v8
- Headless UI for maximum flexibility
- Built-in sorting, filtering, pagination
- Excellent performance with virtual scrolling (react-window)

#### 4.1.7 Export Libraries

- **PDF:** jsPDF + html2canvas
- **Excel:** SheetJS (xlsx package)
- **CSV:** Papa Parse

### 4.2 Application Architecture

#### 4.2.1 Architecture Pattern

**Single Page Application (SPA)** with client-side processing

```
┌─────────────────────────────────────┐
│         Browser Client              │
│  ┌───────────────────────────────┐  │
│  │     React Application         │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │  Upload Component       │  │  │
│  │  └─────────────────────────┘  │  │
│  │           ↓                    │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │  Parser Module          │  │  │
│  │  │  (SheetJS + Web Worker) │  │  │
│  │  └─────────────────────────┘  │  │
│  │           ↓                    │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │  Analysis Engine        │  │  │
│  │  │  (Data Processing)      │  │  │
│  │  └─────────────────────────┘  │  │
│  │           ↓                    │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │  Dashboard Components   │  │  │
│  │  │  (Visualizations)       │  │  │
│  │  └─────────────────────────┘  │  │
│  │           ↓                    │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │  Export Module          │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

#### 4.2.2 Data Flow

```
1. File Upload → Validate → Parse (SheetJS in Web Worker)
2. Raw Data → Transform → Normalize → Store (Context)
3. Normalized Data → Analyze → Calculate Metrics
4. Metrics → Render → Visualizations + Tables
5. User Interaction → Filter/Sort → Update Views
6. Export Request → Generate Report → Download
```

#### 4.2.3 Component Structure

```
src/
├── components/
│   ├── common/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   └── MTVStatusBadge.tsx
│   ├── layout/
│   │   ├── TopNav.tsx
│   │   ├── SideNav.tsx
│   │   └── RedHatResourcesPanel.tsx
│   ├── upload/
│   │   ├── FileUpload.tsx
│   │   ├── DropZone.tsx
│   │   └── ProgressModal.tsx
│   ├── dashboard/
│   │   ├── DashboardLayout.tsx
│   │   ├── MetricCard.tsx
│   │   ├── MTVScoreCard.tsx
│   │   └── HealthIndicator.tsx
│   ├── sections/
│   │   ├── ExecutiveSummary.tsx
│   │   ├── ComputeAnalysis.tsx
│   │   ├── StorageAnalysis.tsx
│   │   ├── NetworkAnalysis.tsx
│   │   ├── ClusterAnalysis.tsx
│   │   ├── ConfigurationAnalysis.tsx
│   │   └── MigrationReadiness.tsx
│   ├── charts/
│   │   ├── BarChart.tsx
│   │   ├── PieChart.tsx
│   │   ├── LineChart.tsx
│   │   ├── Heatmap.tsx
│   │   └── Treemap.tsx
│   ├── tables/
│   │   ├── DataTable.tsx
│   │   ├── MTVPreFlightTable.tsx
│   │   └── FilterableTable.tsx
│   └── export/
│       ├── PDFExport.tsx
│       ├── ExcelExport.tsx
│       └── MTVMigrationPlanExport.tsx
├── services/
│   ├── parser.ts
│   ├── analyzer.ts
│   ├── migrationCalculator/
│   │   ├── roks.ts
│   │   ├── vpcVsi.ts
│   │   ├── complexity.ts
│   │   ├── mtv.ts
│   │   ├── redhat.ts
│   │   └── subnet.ts
│   ├── exportService.ts
│   └── validators.ts
├── types/
│   ├── rvtools.ts
│   ├── analysis.ts
│   ├── migration.ts
│   ├── mtv.ts
│   └── redhat.ts
├── data/
│   ├── redhatOSCompatibility.json
│   ├── ibmCloudProfiles.json
│   ├── mtvRequirements.json
│   └── redhatLinks.json
├── context/
│   └── DataContext.tsx
├── workers/
│   └── parserWorker.ts
└── App.tsx
```

### 4.3 Data Model

#### 4.3.1 Parsed RVTools Data Structure

```typescript
interface RVToolsData {
  metadata: {
    fileName: string;
    collectionDate: Date;
    vCenterVersion: string;
    environment: string;
  };

  vInfo: VirtualMachine[];
  vCPU: VCPUInfo[];
  vMemory: VMemoryInfo[];
  vDisk: VDiskInfo[];
  vPartition: VPartitionInfo[];
  vNetwork: VNetworkInfo[];
  vCluster: ClusterInfo[];
  vHost: HostInfo[];
  vDatastore: DatastoreInfo[];
  vSnapshot: SnapshotInfo[];
  vTools: VToolsInfo[];
  vCD: VCDInfo[];
  // Additional tabs as needed
}

interface VirtualMachine {
  vmName: string;
  powerState: 'poweredOn' | 'poweredOff' | 'suspended';
  cpus: number;
  memory: number; // MB
  numDisks: number;
  provisioned: number; // MB
  inUse: number; // MB
  guestOS: string;
  vmVersion: string;
  toolsStatus: string;
  cluster: string;
  host: string;
  // ... other fields from vInfo tab
}
```

#### 4.3.2 Analysis Results Structure

```typescript
interface AnalysisResults {
  executive: {
    totalVMs: number;
    poweredOnVMs: number;
    totalVCPUs: number;
    totalMemoryGB: number;
    totalStorageTB: number;
    clusterCount: number;
    hostCount: number;
    datastoreCount: number;
    healthMetrics: HealthMetrics;
    mtvScore: number; // 0-100
  };

  compute: ComputeAnalysis;
  storage: StorageAnalysis;
  network: NetworkAnalysis;
  clusters: ClusterAnalysis;
  configuration: ConfigurationAnalysis;
  migration: MigrationReadiness;
}

interface MigrationReadiness {
  roks: ROKSSizing;
  vpcVsi: VPCVSISizing;

  compatibility: {
    supportedVMs: number;
    unsupportedVMs: number;
    unsupportedReasons: { [key: string]: string[] };
  };

  complexity: {
    simple: VM[];
    moderate: VM[];
    complex: VM[];
    blockers: VM[];
  };

  mtvPreFlight: MTVPreFlightResult[];
  waves: MigrationWave[];
}
```

### 4.4 Performance Considerations

#### 4.4.1 Large File Handling
- Use Web Workers for file parsing (offload from main thread)
- Implement chunked processing for files >10MB
- Show progress indicators during parsing
- Lazy load visualization data as user navigates

#### 4.4.2 Rendering Optimization
- Virtual scrolling for tables with >100 rows (use react-window)
- Memoize chart components to prevent unnecessary re-renders
- Debounce search/filter inputs (300ms delay)
- Use React.memo() for expensive components

#### 4.4.3 Memory Management
- Clear large data structures when navigating away
- Implement data pagination for very large datasets
- Use browser storage carefully (IndexedDB for persistence if needed)

---

## 5. Feature Specifications

### 5.1 File Upload Feature

**Acceptance Criteria:**
- [ ] User can drag and drop .xlsx file onto upload zone
- [ ] User can click upload zone to open file browser
- [ ] Upload zone provides visual feedback on hover and during drag
- [ ] File size validation occurs before parsing (reject >50MB)
- [ ] File type validation ensures .xlsx extension
- [ ] Progress bar shows parsing progress (0-100%)
- [ ] Clear error messages display for invalid files
- [ ] Success message appears before redirecting to dashboard
- [ ] Sample RVTools file available for download to test

### 5.2 Executive Dashboard Feature

**Acceptance Criteria:**
- [ ] Dashboard loads within 2 seconds after parsing
- [ ] Displays 8-12 key metric cards in grid layout
- [ ] Each metric card shows: icon, value, label, change indicator
- [ ] Color coding: green for healthy, yellow for warning, red for critical
- [ ] Health indicators section highlights issues (snapshots, orphaned disks)
- [ ] MTV readiness score displayed prominently (0-100)
- [ ] Clicking metric card navigates to detailed section
- [ ] Layout is responsive and adapts to mobile/tablet screens
- [ ] All metrics accurately calculated from RVTools data

### 5.3 Migration Readiness Feature

**Acceptance Criteria:**
- [ ] Recommended OpenShift cluster size calculated based on total resources
- [ ] Worker node count and profile suggestions displayed
- [ ] Storage class mapping shows RWO/RWX requirements
- [ ] Guest OS compatibility analysis categorizes by Red Hat compatibility matrix
- [ ] VMs categorized by migration complexity (simple/moderate/complex/blocker)
- [ ] MTV pre-flight checks run for each VM
- [ ] Unsupported VMs identified with specific reasons
- [ ] Migration waves generated grouping VMs logically
- [ ] IBM Cloud ROKS worker node profiles recommended
- [ ] ODF storage size calculated with 3x replication factor
- [ ] VPC VSI profile mapping based on CPU:memory ratios
- [ ] Cost estimation inputs provided for IBM Cloud calculator
- [ ] Export migration plan as separate document with YAML templates

### 5.4 Interactive Tables Feature

**Acceptance Criteria:**
- [ ] All RVTools tabs available as interactive tables
- [ ] Column sorting works ascending and descending
- [ ] Global search filters rows across all columns
- [ ] Per-column filters allow specific value selection
- [ ] Column visibility toggle allows showing/hiding columns
- [ ] Pagination controls with 10/25/50/100 rows per page options
- [ ] Export to CSV button generates downloadable file
- [ ] Table responsive design works on mobile with horizontal scroll
- [ ] Row selection allows selecting multiple rows
- [ ] Table loads quickly even with 1000+ rows (virtual scrolling)

### 5.5 Export Feature

**Acceptance Criteria:**
- [ ] PDF export generates within 10 seconds for typical report
- [ ] PDF includes executive summary with key metrics
- [ ] PDF includes all charts and visualizations
- [ ] PDF formatted professionally with consistent styling
- [ ] Excel export creates multi-tab workbook
- [ ] Excel includes analysis results with conditional formatting
- [ ] Excel embeds charts in relevant tabs
- [ ] Excel preserves raw data for further analysis
- [ ] Migration plan export includes wave breakdown
- [ ] Migration plan export includes sizing recommendations
- [ ] Migration plan export includes MTV YAML templates
- [ ] Export buttons clearly labeled and accessible from navigation

---

## 6. Non-Functional Requirements

### 6.1 Performance

| Requirement | Target |
|-------------|--------|
| Page Load | Initial page load <2 seconds |
| File Processing | Parse 10MB file in <5 seconds |
| Chart Rendering | Render charts in <1 second |
| Table Filtering | Filter 1000 rows in <500ms |
| Export Generation | Generate PDF in <10 seconds |

### 6.2 Browser Support

- Chrome 90+ (primary)
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome Mobile)

### 6.3 Accessibility

- WCAG 2.1 AA compliance
- Keyboard navigation for all interactive elements
- Screen reader support with ARIA labels
- Color contrast ratios meet AA standards (4.5:1 for text)
- Focus indicators visible on all interactive elements

### 6.4 Security

- No server-side data storage (client-side processing only)
- No data transmission over network (unless optional cloud save feature added)
- Input validation to prevent malicious file uploads
- Content Security Policy headers implemented

### 6.5 Usability

- First-time users can complete full analysis in <5 minutes
- Clear error messages with actionable guidance
- Intuitive navigation requiring no training
- Consistent UI patterns throughout application

---

## 7. Development Phases

### Phase 1: MVP (Minimum Viable Product)

**Goal:** Core functionality for basic RVTools analysis with MTV validation

**Features:**
- File upload and validation
- Parsing of all standard RVTools tabs
- Executive dashboard with key metrics and MTV score
- Compute analysis (CPU/memory charts and tables)
- Storage analysis (datastore and disk usage)
- Basic MTV pre-flight validation
- Red Hat OS compatibility checking
- Interactive data tables with sort/filter
- PDF export (basic report)

### Phase 2: Enhanced Analysis

**Goal:** Comprehensive analysis and full MTV workflow

**Features:**
- Network analysis section
- Cluster and host analysis
- Configuration analysis and compliance checks
- Full migration readiness assessment
- OpenShift/ROKS sizing calculator with Red Hat formulas
- VPC VSI profile mapping
- Migration wave planning aligned with MTV workflow
- Excel export functionality
- Red Hat documentation links throughout UI

### Phase 3: Advanced Features

**Goal:** Professional-grade analysis tool with MTV integration

**Features:**
- Advanced visualizations (heatmaps, topology diagrams)
- Drill-down capabilities (click chart to filter)
- Comparison mode (compare multiple RVTools exports)
- MTV YAML template generation
- Customizable report templates
- Save/load analysis sessions
- Migration plan export with detailed breakdown
- Cost estimation integration with IBM Cloud calculator

### Phase 4: Polish & Optimization

**Goal:** Production-ready application

**Features:**
- Performance optimization for large datasets (10,000+ VMs)
- Enhanced mobile experience
- Additional export formats (Word, PowerPoint)
- Help documentation and tooltips
- Video tutorials
- User feedback collection
- Analytics integration
- Accessibility audit and remediation
- Red Hat partner branding options

---

## 8. Success Criteria

### 8.1 User Acceptance

- 90% of users can upload file and view dashboard without assistance
- 85% of users find the insights valuable for their work
- 80% of users prefer this tool over manual Excel analysis
- 75% of users complete export of report or migration plan

### 8.2 Technical Performance

- 99% uptime for hosted version
- <3 second load time for 90th percentile
- Zero data loss during processing
- <0.1% error rate on file parsing

### 8.3 Business Impact

- Reduces analysis time from hours to minutes
- Enables standardized reporting across teams
- Accelerates migration planning timelines
- Improves accuracy of sizing and scoping

### 8.4 Red Hat Alignment

**MTV Workflow Alignment:**
- [ ] 100% of MTV pre-flight checks implemented and accurate
- [ ] MTV workflow phases clearly visualized and documented
- [ ] Migration waves align with MTV best practices

**Red Hat Validation:**
- [ ] OS compatibility matches Red Hat official matrix (100% accuracy)
- [ ] Sizing calculations within 10% of Red Hat validated architectures
- [ ] All Red Hat documentation links valid and current

**Partner Readiness:**
- [ ] Exports suitable for Red Hat partner customer presentations
- [ ] Professional quality matching Red Hat standards
- [ ] Positive feedback from Red Hat field engineers (>4/5 rating)

---

## 9. Out of Scope (Future Considerations)

### 9.1 Not Included in Initial Release

- Multi-user collaboration features
- Cloud storage/sync capabilities
- Direct vCenter API integration (live data)
- Automated recommendations engine (AI/ML)
- Integration with CMDB or ticketing systems
- Scheduled/automated data collection
- Custom dashboard builder
- Advanced predictive analytics
- Mobile native applications
- Multi-language support

### 9.2 Potential Future Enhancements

- API for programmatic access
- Webhook integrations
- SSO/LDAP authentication
- Role-based access control
- Audit logging
- White-labeling capabilities
- Plugin architecture for extensibility

### 9.3 Red Hat Integration Enhancements

**Future Red Hat Integrations:**
- Direct integration with Red Hat Hybrid Cloud Console
- Automated MTV operator deployment
- Red Hat Insights integration for recommendations
- RHACM integration for multi-cluster management
- Red Hat SSO integration for partner access

---

## 10. Appendix

### 10.1 RVTools Tab Reference

Standard RVTools tabs to parse:

| Tab | Description |
|-----|-------------|
| vInfo | Virtual machine information |
| vCPU | CPU configuration details |
| vMemory | Memory configuration |
| vDisk | Virtual disk information |
| vPartition | Guest OS partition details |
| vNetwork | Network adapter configuration |
| vFloppy | Floppy drive configuration |
| vCD | CD/DVD drive configuration |
| vSnapshot | Snapshot information |
| vTools | VMware Tools status |
| vRP | Resource pool information |
| vCluster | Cluster configuration |
| vHost | ESXi host information |
| vHBA | Host bus adapter information |
| vNic | Physical network adapter information |
| vSwitch | Virtual switch configuration |
| vPort | Port group configuration |
| vDatastore | Datastore information |
| vMultiPath | Multipath configuration |
| vLicense | License information |

### 10.2 Key Metrics Definitions

- **Overcommitment Ratio:** Virtual resources allocated / Physical resources available
- **Provisioned Storage:** Total storage allocated to VMs (thin + thick)
- **Consumed Storage:** Actual storage used by VMs
- **CPU Ready:** Time VM waited for physical CPU resources
- **Memory Balloon:** Memory reclaimed by VMware balloon driver
- **Right-sizing Opportunity:** VM allocated significantly more resources than consumed
- **MTV Score:** Composite score (0-100) indicating overall migration readiness

### 10.3 IBM Cloud Instance Profiles Reference

**VPC VSI Profile Families:**

| Family | Ratio | Use Case |
|--------|-------|----------|
| Balanced (bx2) | 1:4 | General purpose workloads |
| Compute (cx2) | 1:2 | CPU-intensive workloads |
| Memory (mx2) | 1:8 | Memory-intensive workloads |
| Very High Memory (vx2) | 1:14 | Large databases |
| Ultra High Memory (ux2) | 1:28 | SAP HANA, in-memory |

**ROKS Worker Node Profiles:**

| Profile | vCPU | Memory | Use Case |
|---------|------|--------|----------|
| bx2-16x64 | 16 | 64 GB | Small clusters |
| bx2-32x128 | 32 | 128 GB | Standard production |
| bx2-48x192 | 48 | 192 GB | Large workloads |
| mx2-32x256 | 32 | 256 GB | Memory-intensive VMs |

### 10.4 MTV Pre-Flight Validation Rules

**MTV Operator Requirements (enforced by our tool):**

| Check | Requirement | Our Validation | Remediation |
|-------|-------------|----------------|-------------|
| VMware Tools | Installed and running | Tools Status = "toolsOk" or "toolsOld" | Install VMware Tools |
| Snapshots | None or <7 days old | vSnapshot tab empty or age <7 days | Consolidate snapshots |
| CD-ROM | Disconnected | vCD connected = false | Disconnect CD-ROM |
| Hardware Version | v10+ (v14+ recommended) | VM Version >= 10 | Upgrade hardware version |
| Storage | No RDM, no shared disks | No RDM paths, shared = false | Convert RDM to VMDK |
| Network | VMXNET3 preferred | Adapter type check | Upgrade to VMXNET3 |

**MTV Status Calculation:**
```typescript
function calculateMTVStatus(vm): 'ready' | 'prep' | 'blocker' {
  // Blockers: Tools not installed, RDM, shared disks, PCI pass-through
  // Prep needed: CD-ROM connected, snapshots, outdated tools, legacy NIC
  // Ready: All checks pass
}
```

### 10.5 Red Hat OS Compatibility Matrix

**Fully Supported (Score: 90-100):**

| OS | Score | Notes |
|----|-------|-------|
| RHEL 8.x, 9.x | 100 | Optimal for OpenShift Virtualization |
| CentOS Stream 8, 9 | 95 | Fully supported |
| Ubuntu 20.04+, 22.04+, 24.04+ | 95 | LTS versions fully supported |
| Windows Server 2019, 2022 | 95 | Fully supported with VirtIO drivers |
| Windows Server 2016 | 85 | Supported, recommend newer version |

**Supported with Caveats (Score: 60-89):**

| OS | Score | Notes |
|----|-------|-------|
| RHEL 7.x | 70 | Approaching EOL, recommend upgrade |
| CentOS 7 | 65 | EOL, migrate to Stream or RHEL |
| Ubuntu 18.04 | 65 | Approaching EOL |
| Windows Server 2012 R2 | 50 | Extended support ended, upgrade required |

**Unsupported (Score: 0-59):**

| OS | Score | Notes |
|----|-------|-------|
| RHEL 6.x | 20 | EOL, must upgrade |
| Windows Server 2012 and earlier | 10 | Unsupported |
| Solaris, FreeBSD, AIX | 0 | Not supported in OpenShift Virtualization |

### 10.6 Red Hat Reference Architectures and Resources

**Red Hat OpenShift Virtualization:**
- **Architecture Course:** [RedHatQuickCourses/architect-the-ocpvirt](https://github.com/RedHatQuickCourses/architect-the-ocpvirt)
- **Migration Course:** [RedHatQuickCourses/ocpvirt-migration](https://github.com/RedHatQuickCourses/ocpvirt-migration)
- **HPE Reference Implementation:** [RHEPDS/ocp4hpe](https://github.com/RHEPDS/ocp4hpe)
- **Roadshow Labs:** [rhpds/roadshow_ocpvirt_instructions](https://github.com/rhpds/roadshow_ocpvirt_instructions)

**Migration Toolkit for Virtualization (MTV):**
- **Official Documentation:** [OpenShift Docs - Importing VMware VMs](https://docs.openshift.com/container-platform/latest/virt/virtual_machines/importing_vms/virt-importing-vmware-vm.html)

**Red Hat Partner Resources:**
- RHEPDS Training Repositories: [github.com/RHEPDS](https://github.com/RHEPDS)

### 10.7 Data Files to Create

**`/src/data/redhatOSCompatibility.json`**
```json
{
  "rhel-9": {
    "displayName": "Red Hat Enterprise Linux 9.x",
    "compatibilityStatus": "fully-supported",
    "compatibilityScore": 100,
    "notes": "Optimal for OpenShift Virtualization",
    "docLink": "https://access.redhat.com/articles/973163"
  },
  "windows-server-2022": {
    "displayName": "Windows Server 2022",
    "compatibilityStatus": "fully-supported",
    "compatibilityScore": 95,
    "notes": "Fully supported with VirtIO drivers",
    "docLink": "https://docs.openshift.com/container-platform/latest/virt/"
  }
}
```

**`/src/data/ibmCloudProfiles.json`**
```json
{
  "balanced": [
    {"profile": "bx2-2x8", "vcpu": 2, "memory": 8},
    {"profile": "bx2-4x16", "vcpu": 4, "memory": 16},
    {"profile": "bx2-32x128", "vcpu": 32, "memory": 128}
  ],
  "compute": [
    {"profile": "cx2-2x4", "vcpu": 2, "memory": 4}
  ]
}
```

**`/src/data/mtvRequirements.json`**
```json
{
  "version": "2.6",
  "checks": {
    "tools": {
      "required": true,
      "description": "VMware Tools must be installed and running",
      "remediation": "Install VMware Tools via vCenter"
    },
    "snapshots": {
      "required": "none or consolidated",
      "blocker": "snapshots older than 30 days",
      "remediation": "Consolidate snapshots via vCenter"
    }
  }
}
```

---

## 11. Glossary

### General Terms

| Term | Definition |
|------|------------|
| RVTools | Rob de Veij's Tools - free VMware inventory reporting tool |
| vCPU | Virtual CPU assigned to a virtual machine |
| Thin Provisioning | Storage allocated dynamically as needed |
| Thick Provisioning | Storage pre-allocated at VM creation |
| VMDK | Virtual Machine Disk file format |

### IBM Cloud Terms

| Term | Definition |
|------|------------|
| ROKS | Red Hat OpenShift Kubernetes Service on IBM Cloud |
| VPC | Virtual Private Cloud - isolated cloud network |
| VSI | Virtual Server Instance - IBM Cloud VM offering |
| ODF | OpenShift Data Foundation - Ceph-based storage |

### Red Hat / OpenShift Terms

| Term | Definition |
|------|------------|
| MTV | Migration Toolkit for Virtualization |
| OCP-V | OpenShift Container Platform - Virtualization |
| RWO | ReadWriteOnce - volume access mode (single pod) |
| RWX | ReadWriteMany - volume access mode (multiple pods) |
| Multus | CNI plugin for multiple network interfaces |
| VirtIO | Paravirtualized device drivers for KVM |

### VMware Terms

| Term | Definition |
|------|------------|
| vCenter | VMware centralized management platform |
| ESXi | VMware bare-metal hypervisor |
| DRS | Distributed Resource Scheduler |
| HA | High Availability |
| vMotion | Live migration of running VMs |
| RDM | Raw Device Mapping |
| VMFS | Virtual Machine File System |

---

## Document Control

**Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | January 5, 2026 | Neil (IBM Cloud Technical Specialist) | Initial PRD creation |
| 1.1 | January 6, 2026 | Neil (IBM Cloud Technical Specialist) | Added Red Hat MTV integration, OS compatibility matrix, reference architectures |

**Approval:**

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | | | |
| Technical Lead | | | |
| Red Hat Partner Liaison | | | |
| IBM Cloud Stakeholder | | | |

**Distribution:**
- Development Team
- Product Management
- UX/UI Design
- QA/Testing
- Documentation Team
- Red Hat Partner Teams
- IBM Cloud Field Engineers

**Related Documents:**
- Technical Design Document (TDD) - To be created during Phase 1
- User Guide - To be created during Phase 4
- Red Hat Partner Enablement Guide - To be created during Phase 3
- MTV Integration Guide - To be created during Phase 2
- Test Plan - To be created during Phase 1

**Next Steps:**
1. Review and approve PRD with stakeholders
2. Validate Red Hat OS compatibility matrix against latest documentation
3. Verify MTV validation rules against latest MTV operator version
4. Prioritize features for Phase 1 MVP
5. Create detailed technical design document
6. Set up development environment
7. Begin Phase 1 development
8. Create sample RVTools file for testing

---

**END OF PRODUCT REQUIREMENTS DOCUMENT**
