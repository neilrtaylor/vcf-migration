# Future AI Improvements

This document outlines options for improving the AI features in the VCF Migration Tool by providing richer domain context to watsonx.ai. It covers the current state, evaluated options, and detailed research into IBM watsonx.ai's built-in document grounding capabilities.

## Current State

The AI integration currently has **no external knowledge base**. It relies entirely on:

- **System prompt instructions** baked into `functions/ai-proxy/prompts.js`
- **Aggregated environment data** passed per-request (VM counts, resource totals, workload breakdowns)
- **Granite model's pre-trained knowledge** (ibm/granite-3-8b-instruct)

There is no RAG (Retrieval-Augmented Generation), no document store, no vector database, and no document retrieval mechanism.

### What the AI currently knows

| Source | Content |
|--------|---------|
| System prompts | Migration expertise, workload categories, profile families, IBM Cloud concepts |
| Per-request context | Aggregated VM data (counts, totals, breakdowns), complexity summary, cost estimates |
| Conversation history | Last 20 messages (chat endpoint only) |
| VM batch data | VM specs per batch of 10 (classification and rightsizing endpoints only) |

### What the AI does NOT know

- IBM Cloud ROKS documentation (architecture, limitations, best practices)
- IBM Cloud VPC VSI documentation (profile details, networking, storage options)
- OpenShift Virtualization / KubeVirt technical details
- IBM Cloud pricing structures and regional availability
- Migration methodology guides and runbooks
- Customer-specific infrastructure documentation

---

## Options Evaluated

### Option 1: Embed documentation in system prompts

Add key ROKS/VPC facts directly into the prompt text in `functions/ai-proxy/prompts.js`.

| Pros | Cons |
|------|------|
| Simplest implementation | Limited by context window size |
| No infrastructure changes | Wastes tokens on every request |
| Works immediately | Manual maintenance required |
| No additional cost | Cannot scale to large doc sets |

### Option 2: RAG with a vector database

Chunk PDF docs into embeddings, store in a vector database (Milvus, Elasticsearch, etc.), retrieve relevant chunks per query.

| Pros | Cons |
|------|------|
| Scales to large doc sets | Significant infrastructure (vector DB, embedding pipeline) |
| Only retrieves relevant context | Ongoing maintenance |
| Most accurate retrieval | Code Engine proxy changes required |
| Industry-standard approach | Additional cost for vector DB hosting |

### Option 3: Static docs in the project with selective injection

Place markdown/text versions of ROKS and VPC docs in the project (e.g., `src/data/knowledge/` or `docs/knowledge/`). The proxy selects relevant sections based on the user's query or current page context.

| Pros | Cons |
|------|------|
| No external infrastructure | Manual chunking and organization |
| Docs are version-controlled | Keyword-based retrieval is less precise than vector search |
| Moderate implementation effort | Proxy needs topic-detection logic |
| Can be incrementally improved | Context window limits still apply |

**Implementation sketch:**

1. Place markdown files in `docs/knowledge/` organized by topic:
   - `roks-overview.md`
   - `vpc-vsi-profiles.md`
   - `openshift-virtualization.md`
   - `storage-options.md`
   - `network-planning.md`
2. Update the proxy to load these files at startup
3. Use keyword/topic matching to select relevant sections per request
4. Inject selected sections into the prompt alongside existing context
5. Upgrade to embeddings-based retrieval later if needed

### Option 4: watsonx.ai built-in document grounding (Recommended for investigation)

Use IBM watsonx.ai's native RAG capabilities to ground the model in uploaded documentation. See detailed analysis below.

### Option 5: Fine-tune or use a prompt template library

Create detailed prompt templates per topic area, select the right template based on query classification.

| Pros | Cons |
|------|------|
| No new infrastructure | Does not handle novel questions well |
| High quality for known topics | Requires significant prompt engineering |
| Fast response times | Ongoing maintenance of templates |

---

## Option 4: watsonx.ai Document Grounding (Detailed Analysis)

### Overview

watsonx.ai has a built-in feature called **"Chat with Documents"** that enables document-grounded RAG solutions. You upload PDFs/Word docs, watsonx.ai creates a vector index, and the model's responses are grounded in those documents.

### How it works

1. **Upload documents** (PDF, DOCX, PPTX, TXT) into a watsonx.ai project via the Prompt Lab UI
2. watsonx.ai automatically **chunks the documents and creates a vector index** using an embedding model
3. When a query comes in, it runs a **similarity search** against the vector index to find relevant passages
4. Those passages are injected into the prompt as context before the model generates a response
5. The whole setup can be **deployed as a REST API endpoint** via AI Services (`/ml/v4/deployments`)

### Three deployment paths

| Path | Description | Effort |
|------|-------------|--------|
| **Fast path (Prompt Lab)** | Upload docs in the UI, test grounding, one-click deploy as REST endpoint | Low |
| **Deployment notebook** | Auto-generated notebook you can customize, then deploy | Medium |
| **Manual coding** | Write Python AI Service, upload as gzip, deploy via REST API | High |

### Fast path workflow

1. Open Prompt Lab in **Chat mode** within the watsonx.ai project
2. Upload documents via the menu in the input section
3. watsonx.ai creates a vector index automatically
4. Test by asking migration-related questions and evaluating grounded answers
5. When satisfied, deploy as an AI Service (one-click)
6. The deployment creates a REST API endpoint at `/ml/v4/deployments/{deployment_id}/ai_service`
7. Update the proxy to call this endpoint instead of the raw text generation API

### Scaling beyond prototype

For the initial prototype, the built-in vector index works. For larger document sets:

- **Milvus** (via watsonx.data) — supports thousands of documents with high retrieval fidelity
- **Elasticsearch** — with IBM Slate embedding model support via the open inference API

AutoAI for RAG can also be used to automatically find the optimal RAG pipeline configuration (chunking strategy, embedding model, retrieval parameters).

### Impact on current proxy architecture

The current proxy (`functions/ai-proxy/`) calls watsonx.ai directly:

```
Current:  Proxy → /ml/v1/text/generation (text generation API)
          Proxy → /ml/v1/text/chat (chat API)
```

With AI Services deployment:

```
New:      Proxy → /ml/v4/deployments/{id}/ai_service (RAG endpoint)
```

The deployed AI Service handles document retrieval + generation in a single call. No vector DB code is needed in the proxy.

**Endpoint-specific changes:**

| Proxy Endpoint | Change Needed |
|----------------|---------------|
| `/api/chat` | Point to deployed RAG AI Service endpoint |
| `/api/insights` | Point to deployed RAG AI Service endpoint |
| `/api/classify` | Keep as raw model call (VM-data-specific, no doc grounding needed) |
| `/api/rightsizing` | Keep as raw model call (VM-data-specific, no doc grounding needed) |

### Documents to upload

For ROKS and VPC context, upload documentation covering:

| Topic | Source |
|-------|--------|
| IBM Cloud VPC VSI overview | IBM Cloud docs |
| VSI profiles (balanced, compute, memory, GPU, storage) | IBM Cloud docs |
| VPC networking (subnets, security groups, ACLs, VPN) | IBM Cloud docs |
| VPC block storage and file storage | IBM Cloud docs |
| ROKS / OpenShift on IBM Cloud overview | IBM Cloud docs |
| OpenShift Virtualization (KubeVirt) | Red Hat docs |
| KubeVirt migration guides (MTV) | Red Hat docs |
| IBM Cloud pricing and regional availability | IBM Cloud docs |
| Migration best practices for VMware to IBM Cloud | IBM Cloud docs |
| ODF (OpenShift Data Foundation) storage | Red Hat docs |

### Tradeoffs

| Pros | Cons |
|------|------|
| IBM-managed vector index and retrieval | Requires watsonx.ai project with sufficient plan/tier |
| No infrastructure to build or maintain | Documents managed in IBM Cloud, not in the git repo |
| Deployable as REST API endpoint | Less control over chunking strategy and retrieval logic |
| Handles embedding, chunking, similarity search automatically | Additional cost for AI Service deployments |
| Can scale to Milvus/Elasticsearch later | Adds dependency on watsonx.ai deployment lifecycle |
| Works with Granite model already in use | Latency may increase (retrieval + generation per call) |

### Practical next steps

1. Log into the watsonx.ai project (same project used by the current proxy)
2. Open Prompt Lab in Chat mode
3. Upload a few ROKS/VPC PDFs to test grounding quality
4. Ask migration-related questions and evaluate whether grounded answers improve quality
5. If satisfied, deploy as AI Service and obtain the REST endpoint URL
6. Update the proxy's chat and insights endpoints to call the deployed AI Service
7. Test end-to-end through the application's chat and insights features
8. Consider connecting Milvus or Elasticsearch if the document set grows large

### Key IBM resources

- [watsonx.ai RAG Development](https://www.ibm.com/products/watsonx-ai/rag-development)
- [Chat with Documents announcement](https://www.ibm.com/new/announcements/chat-with-documents)
- [RAG pattern documentation](https://dataplatform.cloud.ibm.com/docs/content/wsj/analyze-data/fm-rag.html?context=wx)
- [Deploying AI services with Prompt Lab](https://dataplatform.cloud.ibm.com/docs/content/wsj/analyze-data/ai-services-prompt-lab.html?context=wx)
- [Manual coding and deploying AI services](https://dataplatform.cloud.ibm.com/docs/content/wsj/analyze-data/ai-services-manual-coding.html?context=wx)
- [Vector index for document grounding](https://dataplatform.cloud.ibm.com/docs/content/wsj/analyze-data/fm-prompt-data-index.html?context=wx)
- [Creating a vector index](https://dataplatform.cloud.ibm.com/docs/content/wsj/analyze-data/fm-prompt-data-index-create.html?context=wx)
- [AutoAI for RAG](https://dataplatform.cloud.ibm.com/docs/content/wsj/analyze-data/autoai-programming-rag.html?context=wx)
- [Using AutoAI RAG to chat with documents](https://dataplatform.cloud.ibm.com/docs/content/wsj/analyze-data/autoai-rag-chat-with-docs.html?context=wx)
- [watsonx.ai REST API reference](https://cloud.ibm.com/apidocs/watsonx-ai)
- [AI Knowledge Management](https://www.ibm.com/products/watsonx-ai/knowledge-management)

---

## Recommendation

**Option 4 (watsonx.ai document grounding)** is recommended as the primary investigation path because:

1. It is fully IBM-managed, reducing infrastructure and maintenance burden
2. It integrates with the existing watsonx.ai project and Granite model
3. The fast path (Prompt Lab) allows rapid prototyping before committing to changes
4. It can be deployed as a REST API endpoint with minimal proxy changes
5. It scales to Milvus/Elasticsearch if the document set grows

**Option 3 (static docs with selective injection)** is a good fallback or complement:

- Useful for domain knowledge that should be version-controlled alongside the application
- Can be implemented incrementally without any IBM Cloud dependencies
- Works well for structured reference data (e.g., profile specs, pricing tables) that change infrequently

A hybrid approach is also viable: use watsonx.ai document grounding for the chat and insights endpoints (which benefit most from broad domain knowledge), and use static in-repo docs for classification and rightsizing prompts (which benefit from structured, curated reference data).

---

## Implemented AI Features (v2.1.0)

The following AI features have been implemented and are available in the application:

### AI-Enhanced Reports

AI insights from the `/api/insights` endpoint are integrated into all export formats:

| Format | Integration |
|--------|-------------|
| **DOCX** | AI sections added to Executive Summary (2.5), Migration Readiness (3.5), Migration Strategy (5.5), Cost Estimation (8.4), and Next Steps (9.5) with purple italic disclaimers |
| **PDF** | Dedicated "AI Migration Insights" page after Resource Pools section |
| **Excel** | "AI Recommendations" sheet after Executive Summary with all insight categories |
| **BOM Excel** | "AI Notes" sheet with cost optimization bullet points (both VSI and ROKS BOM) |

All AI content includes a disclaimer: "The following content was generated by AI (IBM watsonx.ai) and should be reviewed for accuracy."

Reports generate identically when AI is disabled or unavailable (graceful degradation).

### AI Wave Planning Suggestions

- **Proxy endpoint**: `POST /api/wave-suggestions`
- **Hook**: `useAIWaveSuggestions`
- **UI**: `AIWaveAnalysisPanel` in Wave Planning tabs (ROKS and VSI)
- Analyzes wave balance, risk, dependencies, and ordering
- Returns per-wave risk narratives and dependency warnings

### AI Cost Optimization

- **Proxy endpoint**: `POST /api/cost-optimization`
- **Hook**: `useAICostOptimization`
- **UI**: `AICostAnalysisPanel` in VSI Cost Estimation tab
- Recommends right-sizing, reserved pricing, and architecture changes
- Prioritized recommendations with estimated savings

### AI Remediation Guidance

- **Proxy endpoint**: `POST /api/remediation`
- **Hook**: `useAIRemediation`
- **UI**: `AIRemediationPanel` in Pre-Flight Checks tabs (ROKS and VSI)
- Step-by-step remediation for each blocker type (RDM, snapshots, old HW, etc.)
- Estimated effort and alternative approaches per blocker

---

## Deferred: AI Pre-Migration Runbook (Feature 7)

A future enhancement to generate structured pre-migration runbooks per wave:

- New endpoint `/api/runbook` generating structured runbook content
- New DOCX generator for runbook format (separate from assessment report)
- Multiple LLM calls per wave (rate limit concern)
- High implementation effort — deferred

### Proposed approach

1. Accept wave data + VM details as input
2. Generate per-wave sections: pre-checks, migration steps, validation, rollback
3. Output as structured JSON, rendered into DOCX format
4. Requires careful rate limiting (one LLM call per wave, potentially 5-10 waves)
