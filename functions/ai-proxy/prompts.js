/**
 * Prompt templates for each AI use case
 *
 * Each function returns a formatted prompt string for watsonx.ai
 */

/**
 * Build a workload classification prompt for a batch of VMs
 *
 * @param {Array<Object>} vms - VM summaries
 * @param {Array<string>} categories - Available workload categories
 * @returns {string} Formatted prompt
 */
function buildClassificationPrompt(vms, categories) {
  const categoryList = categories.join(', ');

  const vmDescriptions = vms.map((vm, i) =>
    `${i + 1}. Name: "${vm.vmName}", OS: "${vm.guestOS || 'unknown'}", Annotation: "${vm.annotation || 'none'}", vCPUs: ${vm.vCPUs}, Memory MB: ${vm.memoryMB}, Disks: ${vm.diskCount}, NICs: ${vm.nicCount}`
  ).join('\n');

  return `You are a VMware workload classification expert. Classify each VM into EXACTLY one of these workload categories: ${categoryList}.

IMPORTANT: Your classification must be consistent with your reasoning. If your reasoning identifies a VM as an enterprise application, classify it as "Enterprise Applications", not as a different category.

Category definitions:
- "Databases": VMs running database engines (Oracle, SQL Server, PostgreSQL, MySQL, MongoDB, Redis, etc.)
- "Middleware / Application Servers": Web servers, app servers, reverse proxies (Tomcat, WebSphere, JBoss, Nginx, Apache, IIS, HAProxy)
- "Enterprise Applications": Business applications like SAP, SharePoint, Exchange, Dynamics, PeopleSoft, Cognos, Splunk, or general-purpose application VMs with significant resource allocation
- "Backup & Recovery": Backup software (Veeam, Veritas, Commvault, Rubrik, Cohesity, Zerto)
- "Security & Compliance": Security tools only - firewalls, antivirus, vulnerability scanners, SIEM (Palo Alto, CrowdStrike, Qualys, CyberArk, Tenable, Nessus)
- "Monitoring & Management": Monitoring and observability tools (Nagios, Zabbix, Prometheus, Grafana, Datadog, SolarWinds)
- "Virtualization Infrastructure": VMware management VMs (vCenter, NSX, vRealize, HCX, Horizon, VDI)
- "Container Platforms": Kubernetes, OpenShift, Docker, Rancher, Tanzu
- "Messaging & Integration": Message queues and integration middleware (Kafka, RabbitMQ, MQ, TIBCO, MuleSoft)
- "Storage Systems": Storage appliances and NAS/SAN VMs (NetApp, Pure, EMC, Ceph, MinIO)
- "Network Equipment": Network appliances, load balancers, DNS, DHCP, virtual edge routers (F5, Cisco, Infoblox, cust-edge, service-edge)
- "Cloud Services": Cloud management and automation tools (Terraform, Ansible, Puppet, Chef)
- "DevOps & CI/CD": CI/CD and development tools (Jenkins, GitLab, Artifactory, SonarQube, Jira)
- "Identity & Access": Directory services and identity management (Active Directory, LDAP, Okta, Keycloak)
- "Other": VMs that don't clearly fit any other category

Common name patterns:
- Database VMs often have "db", "sql", "oracle", "postgres", "mongo" in names and have high memory
- Web servers often have "web", "www", "apache", "nginx", "iis" in names
- Application servers may have "app", "api", "svc", "service" in names
- Infrastructure VMs include "dns", "dhcp", "ad", "dc", "ldap", "ntp"
- Development VMs may have "dev", "test", "qa", "staging" in names
- VMs with generic names and high resource allocation are typically "Enterprise Applications", not security tools

VMs to classify:
${vmDescriptions}

Respond with a JSON array. Each element must have:
- "vmName": exact VM name from input
- "workloadType": one of the categories listed above
- "confidence": number 0.0-1.0 indicating classification certainty
- "reasoning": brief explanation (1 sentence)
- "alternatives": array of up to 2 alternative classifications with workloadType and confidence

Respond ONLY with valid JSON, no other text.`;
}

/**
 * Build a right-sizing recommendation prompt
 *
 * @param {Array<Object>} vms - VM specs with workload types
 * @param {Array<Object>} profiles - Available IBM Cloud profiles
 * @returns {string} Formatted prompt
 */
function buildRightsizingPrompt(vms, profiles) {
  const profileList = profiles.map(p =>
    `  - ${p.name}: ${p.vcpus} vCPUs, ${p.memoryGiB} GiB RAM, family: ${p.family}`
  ).join('\n');

  const vmDescriptions = vms.map((vm, i) =>
    `${i + 1}. Name: "${vm.vmName}", vCPUs: ${vm.vCPUs}, Memory MB: ${vm.memoryMB}, Storage MB: ${vm.storageMB}, Workload: "${vm.workloadType || 'unknown'}", OS: "${vm.guestOS || 'unknown'}"${vm.avgCpuUsage !== undefined ? `, Avg CPU: ${vm.avgCpuUsage}%` : ''}${vm.avgMemUsage !== undefined ? `, Avg Mem: ${vm.avgMemUsage}%` : ''}`
  ).join('\n');

  return `You are an IBM Cloud migration specialist. For each VM, recommend the optimal IBM Cloud VPC VSI profile.

Consider:
- Workload type affects optimal profile family (databases need memory-optimized mx2, compute workloads need cx2, general use needs balanced bx2)
- VMs with low CPU/memory usage may be over-provisioned and can use smaller profiles
- Always recommend a profile that meets or exceeds the VM's resource requirements
- Prefer the smallest profile that satisfies requirements for cost optimization

Available IBM Cloud VSI profiles:
${profileList}

VMs to evaluate:
${vmDescriptions}

Respond with a JSON array. Each element must have:
- "vmName": exact VM name from input
- "recommendedProfile": profile name from the available list
- "reasoning": brief explanation of why this profile fits
- "costSavingsEstimate": if the VM appears over-provisioned, describe potential savings
- "alternativeProfile": second-best profile option (or null)
- "alternativeReasoning": why the alternative could work (or null)
- "isOverprovisioned": boolean indicating if the VM appears to have more resources than needed

Respond ONLY with valid JSON, no other text.`;
}

/**
 * Build a migration insights prompt
 *
 * @param {Object} data - Aggregated migration data
 * @returns {string} Formatted prompt
 */
function buildInsightsPrompt(data) {
  const workloadList = Object.entries(data.workloadBreakdown)
    .map(([type, count]) => `  - ${type}: ${count} VMs`)
    .join('\n');

  const complexity = data.complexitySummary;
  const blockers = data.blockerSummary.length > 0
    ? data.blockerSummary.map(b => `  - ${b}`).join('\n')
    : '  None identified';

  let costInfo = '';
  if (data.costEstimate) {
    costInfo = `\nEstimated costs:
  Monthly: $${data.costEstimate.monthly.toLocaleString()}
  Annual: $${data.costEstimate.annual.toLocaleString()}
  Region: ${data.costEstimate.region}`;
  }

  let networkInfo = '';
  if (data.networkSummary && data.networkSummary.length > 0) {
    const netLines = data.networkSummary
      .sort((a, b) => b.vmCount - a.vmCount)
      .map(n => `  - Port group "${n.portGroup}": ${n.vmCount} VMs, subnet ${n.subnet}`)
      .join('\n');
    networkInfo = `\nNetwork topology (${data.networkSummary.length} port groups):
${netLines}`;
  }

  return `You are a cloud migration strategist specializing in VMware to IBM Cloud migrations. Analyze the following environment and provide actionable insights.

Environment summary:
  Total VMs: ${data.totalVMs} (${data.totalExcluded} excluded from migration)
  Total vCPUs: ${data.totalVCPUs}
  Total Memory: ${Math.round(data.totalMemoryGiB)} GiB
  Total Storage: ${Number(data.totalStorageTiB).toFixed(2)} TiB
  Clusters: ${data.clusterCount}
  Hosts: ${data.hostCount}
  Datastores: ${data.datastoreCount}
  Migration target: ${data.migrationTarget || 'not specified'}

Workload breakdown:
${workloadList}

Complexity assessment:
  Simple: ${complexity.simple} VMs
  Moderate: ${complexity.moderate} VMs
  Complex: ${complexity.complex} VMs
  Blockers: ${complexity.blocker} VMs

Migration blockers:
${blockers}
${networkInfo}
${costInfo}

Migration wave planning context:
- VMs sharing the same subnet/port group often need to migrate together to retain IP addresses and avoid network disruptions.
- A subnet-based migration strategy groups VMs by network segment so that each wave migrates an entire subnet, preserving IP connectivity within the group.
- Smaller subnets (fewer VMs) are lower risk and should migrate first. Larger subnets with critical workloads should migrate later.

Provide a JSON response with:
- "executiveSummary": 2-3 sentence high-level summary for stakeholders. MUST include the total vCPU count, total memory (GiB), and total storage (TiB) alongside the VM count.
- "riskAssessment": Assessment of migration risks including network complexity (2-3 sentences)
- "recommendations": array of 3-5 specific, actionable recommendations (include subnet/network-aware migration advice when network data is available)
- "costOptimizations": array of 2-3 cost optimization suggestions
- "migrationStrategy": Recommended migration approach describing a subnet-based wave strategy when network data is available, explaining how to group VMs by port group/subnet to retain IP addresses and minimize network disruption (3-4 sentences)

Focus on practical advice specific to this environment. Reference specific numbers from the data including resource totals (vCPUs, memory, storage) and network/subnet details when available.

Respond ONLY with valid JSON, no other text.`;
}

/**
 * Build a system prompt for the chat endpoint
 *
 * @param {Object} context - Current app context (aggregated data)
 * @returns {string} System prompt
 */
function buildChatSystemPrompt(context) {
  let envInfo = '';
  if (context && context.summary) {
    const s = context.summary;
    envInfo = `
The user has loaded an RVTools export with the following environment:
- ${s.totalVMs} total VMs (${s.totalExcluded} excluded from migration scope)
- ${s.totalVCPUs} total vCPUs
- ${Math.round(s.totalMemoryGiB)} GiB total memory
- ${Number(s.totalStorageTiB).toFixed(2)} TiB total storage
- ${s.clusterCount} clusters, ${s.hostCount} hosts, ${s.datastoreCount} datastores`;

    if (context.workloadBreakdown && Object.keys(context.workloadBreakdown).length > 0) {
      envInfo += '\nWorkload breakdown: ' + Object.entries(context.workloadBreakdown)
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ');
    }

    if (context.complexitySummary) {
      const c = context.complexitySummary;
      envInfo += `\nComplexity: ${c.simple} simple, ${c.moderate} moderate, ${c.complex} complex, ${c.blocker} blockers`;
    }

    if (context.blockerSummary && context.blockerSummary.length > 0) {
      envInfo += '\nKey blockers: ' + context.blockerSummary.join('; ');
    }

    if (context.costEstimate) {
      envInfo += `\nEstimated monthly cost: $${context.costEstimate.monthly.toLocaleString()} (${context.costEstimate.region})`;
    }

    envInfo += `\nUser is currently on the "${context.currentPage}" page.`;
  }

  return `You are a migration planning assistant for VMware Cloud Foundation (VCF) to IBM Cloud migrations. You help users understand their VMware environment and plan migrations to IBM Cloud.

Your expertise includes:
- IBM Cloud Red Hat OpenShift on IBM Cloud (ROKS) with OpenShift Virtualization
- IBM Cloud VPC Virtual Server Instances (VSI)
- VMware workload assessment and complexity analysis
- Migration planning including wave planning and risk assessment
- IBM Cloud VPC networking, storage, and pricing
- OpenShift Virtualization (KubeVirt) for running VM workloads on Kubernetes

Key concepts:
- ROKS migration uses bare metal worker nodes with OpenShift Virtualization to run VMs as pods
- VSI migration maps each VMware VM to an IBM Cloud VPC Virtual Server Instance
- Migration complexity considers OS compatibility, hardware version, snapshots, shared disks, and other factors
- Wave planning groups VMs into migration waves based on dependencies and risk

When answering:
- Reference specific data from the user's environment when available
- Provide practical, actionable guidance
- Be concise but thorough
- If the user asks about something outside your expertise, say so
- Use markdown formatting for clarity (lists, bold, code blocks)
${envInfo}`;
}

/**
 * Build a wave planning suggestions prompt
 *
 * @param {Object} data - Wave planning data
 * @returns {string} Formatted prompt
 */
function buildWaveSuggestionsPrompt(data) {
  const waveDescriptions = data.waves.map((w, i) =>
    `${i + 1}. "${w.name}": ${w.vmCount} VMs, ${w.totalVCPUs} vCPUs, ${Math.round(w.totalMemoryGiB)} GiB RAM, ${Math.round(w.totalStorageGiB)} GiB storage, avg complexity: ${w.avgComplexity.toFixed(1)}, blockers: ${w.hasBlockers ? 'yes' : 'no'}, workloads: ${w.workloadTypes.join(', ') || 'mixed'}`
  ).join('\n');

  return `You are a cloud migration wave planning expert specializing in VMware to IBM Cloud migrations. Analyze the following migration wave plan and provide optimization suggestions.

Migration target: ${data.migrationTarget || 'not specified'}
Total VMs: ${data.totalVMs}

Current wave plan:
${waveDescriptions}

Analyze the wave plan for:
1. Balance - Are waves roughly balanced in size and complexity?
2. Risk - Which waves have the highest risk and why?
3. Dependencies - Are there potential dependency issues between waves?
4. Ordering - Is the wave order optimal (simple/low-risk first)?

Provide a JSON response with:
- "suggestions": array of 3-5 specific, actionable suggestions for improving the wave plan
- "riskNarratives": array of objects with "waveName" and "narrative" (1-2 sentence risk assessment per wave)
- "dependencyWarnings": array of potential dependency issues between waves (empty array if none)

Focus on practical advice. Reference specific wave names and numbers from the data.

Respond ONLY with valid JSON, no other text.`;
}

/**
 * Build a cost optimization prompt
 *
 * @param {Object} data - Cost and profile data
 * @returns {string} Formatted prompt
 */
function buildCostOptimizationPrompt(data) {
  const profileList = data.vmProfiles
    .map(p => `  - Profile "${p.profile}": ${p.count} VMs, workload: ${p.workloadType}`)
    .join('\n');

  return `You are an IBM Cloud cost optimization specialist. Analyze the following migration cost profile and provide optimization recommendations.

Migration target: ${data.migrationTarget || 'not specified'}
Region: ${data.region || 'us-south'}
Total estimated monthly cost: $${data.totalMonthlyCost.toLocaleString()}

VM profile allocation:
${profileList}

Consider:
- Right-sizing opportunities (are VMs over-provisioned for their workload type?)
- Reserved instance pricing vs on-demand
- Profile family optimization (balanced vs compute vs memory-optimized)
- Storage tier optimization
- Regional pricing differences
- Workload-specific recommendations

Provide a JSON response with:
- "recommendations": array of objects, each with:
  - "category": category name (e.g., "Right-sizing", "Reserved Pricing", "Storage Optimization")
  - "description": specific, actionable recommendation
  - "estimatedSavings": estimated savings description (e.g., "10-15% monthly reduction")
  - "priority": "high", "medium", or "low"
- "architectureRecommendations": array of 2-3 architecture-level suggestions for cost efficiency

Sort recommendations by priority (high first). Reference specific profiles and numbers from the data.

Respond ONLY with valid JSON, no other text.`;
}

/**
 * Build a remediation guidance prompt for migration blockers
 *
 * @param {Object} data - Blocker data
 * @returns {string} Formatted prompt
 */
function buildRemediationPrompt(data) {
  const blockerList = data.blockers.map((b, i) =>
    `${i + 1}. Type: "${b.type}", Affected VMs: ${b.affectedVMCount}, Details: ${b.details}`
  ).join('\n');

  return `You are a VMware migration remediation expert. Provide step-by-step remediation guidance for the following migration blockers.

Migration target: ${data.migrationTarget || 'vsi'} (${data.migrationTarget === 'roks' ? 'Red Hat OpenShift on IBM Cloud with OpenShift Virtualization' : 'IBM Cloud VPC Virtual Server Instances'})

Migration blockers:
${blockerList}

For each blocker, provide:
1. Step-by-step remediation instructions specific to the migration target
2. Estimated effort level
3. Alternative approaches if direct remediation is not feasible

Common blocker types and remediation context:
- RDM (Raw Device Mapping) disks: Cannot be directly migrated; need to convert to VMDK or use alternative storage
- Snapshots: Must be consolidated/removed before migration
- Old hardware versions: May need VM hardware upgrade
- Missing VMware Tools: Install or update before migration
- Unsupported guest OS: May need OS upgrade or alternative migration path
- Shared VMDK: Need to separate shared disks or migrate dependent VMs together
- vGPU: GPU workloads require special handling on IBM Cloud

Provide a JSON response with:
- "guidance": array of objects, each with:
  - "blockerType": the blocker type from input
  - "steps": array of step-by-step remediation instructions (3-6 steps)
  - "estimatedEffort": effort description (e.g., "1-2 hours per VM", "requires maintenance window")
  - "alternatives": array of alternative approaches if direct remediation is not possible

Respond ONLY with valid JSON, no other text.`;
}

module.exports = {
  buildClassificationPrompt,
  buildRightsizingPrompt,
  buildInsightsPrompt,
  buildChatSystemPrompt,
  buildWaveSuggestionsPrompt,
  buildCostOptimizationPrompt,
  buildRemediationPrompt,
};
