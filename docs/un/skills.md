---
urls:
  - https://claude.com/blog/skills
  - https://github.com/anthropics/skills
  - https://code.claude.com/docs/en/skills
  - https://support.claude.com/en/articles/12512176-what-are-skills
  - https://platform.claude.com/docs/en/build-with-claude/skills-guide
  - https://support.claude.com/en/articles/12512180-using-skills-in-claude
  - https://support.claude.com/en/articles/12512198-how-to-create-custom-skills
  - https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
  - https://support.claude.com/en/articles/12580051-teach-claude-your-way-of-working-using-skills
prompt: "Read all URLs in urls[]. Synthesize them into ONE ultra-detailed Markdown technical specification of Claude/Anthropic Agent Skills as a standalone reference. Use a single merged conceptual model with explicit surface variants (Claude.ai, Claude Code, Claude API, Claude Agent SDK). Add normative guidance (MUST/SHOULD) where helpful, keep examples minimal, and include a nice-to-have mapping section translating Skills concepts into PromptWareOS primitives (capabilities, syscalls, containers, paging). Output ONLY the final Markdown document (no extra commentary), preserving as much structure and content as possible each time you regenerate."
---

# Claude Agent Skills — Unified Technical Specification (Merged Model with Surface Variants)

**Status:** Synthesized “single source of truth” spec derived from Anthropic/Claude documentation & guides (Claude Code, Claude.ai, Claude API, Agent SDK) as of **December 2025**.

**Goal:** You should be able to **author**, **operate**, and **implement** an Agent Skills system (or a compatible one) using this document alone, without referring back to the original sources.

---

## 0. Executive summary

**Agent Skills (“Skills”)** are **filesystem-like packages**: a directory containing a required `SKILL.md` file (YAML frontmatter + Markdown instructions) plus optional scripts/resources. Claude **autonomously** decides **when** to use a Skill (“model-invoked”), using only the Skill’s metadata at first, then progressively loading more content when it becomes relevant.

Skills exist across multiple product “surfaces,” each with different **distribution**, **permissions**, and **runtime constraints**:

* **Claude.ai (Apps):** Pre-built Skills available; users can upload custom Skills (ZIP). Custom Skills are **per-user**, not org-managed.
* **Claude API:** Pre-built Skills + workspace-wide custom Skills via `/v1/skills` endpoints. Skills require **Code Execution**.
* **Claude Code:** Custom Skills only, discovered from the local filesystem (`~/.claude/skills/`, `.claude/skills/`) and from plugins. Supports an additional capability: `allowed-tools` (Skill-scoped tool allowlisting).
* **Claude Agent SDK:** Filesystem-based custom Skills (same `.claude/skills/` layout), enabled via `allowed_tools` including the special `"Skill"` tool.

---

## 1. Core concepts & terminology

### 1.1 Skill

A **Skill** is a **directory** that defines a reusable capability. Minimum requirement:

* A `SKILL.md` file at the root of the directory.

A Skill may also include:

* Additional Markdown reference files (`reference.md`, `forms.md`, etc.)
* Scripts (`scripts/*.py`, `scripts/*.js`, etc.)
* Templates, assets, or data files (`templates/`, `resources/`, images, JSON, CSV, etc.)

### 1.2 SKILL.md

`SKILL.md` is the canonical entrypoint:

* **YAML frontmatter (required):** `name`, `description` (and surface-specific optional fields).
* **Markdown body (recommended):** structured instructions, workflows, examples, references to additional files.

### 1.3 Progressive disclosure (3-level loading model)

Skills scale via **progressive disclosure**—Claude loads only what’s needed:

* **Level 1: Metadata (always loaded at startup)**

  * Only `name` and `description` (and possibly a small amount of essential metadata) are preloaded.
  * Purpose: allow discovery without consuming the full context window.

* **Level 2: Core instructions (loaded when triggered)**

  * Claude reads full `SKILL.md` body if it decides the Skill is relevant.

* **Level 3+: Resources and code (loaded/executed as needed)**

  * Claude reads additional reference files selectively.
  * Claude may execute scripts directly (preferred for deterministic operations) without loading script contents into the model context.

### 1.4 Model-invoked vs user-invoked

* **Skills are model-invoked:** Claude decides to use them automatically when relevant.
* In Claude Code, this differs from **slash commands**, which are explicitly user-invoked (e.g., `/command`).

### 1.5 “Surface” (product context)

A Skill can exist on multiple surfaces, but **custom Skills do not automatically sync across surfaces**.

* Claude.ai uploads ≠ API uploads ≠ Claude Code local Skills.

### 1.6 Pre-built vs custom

* **Anthropic-managed / pre-built Skills:** delivered by Anthropic, e.g. document skills.
* **Custom Skills:** authored by you/your org.

### 1.7 Skill versioning (API)

On the Claude API, custom Skills have explicit versioning:

* You can reference `version: "latest"` or a specific version identifier.
* Skills and versions are managed with `/v1/skills` endpoints (and corresponding SDK helpers).

### 1.8 Skill container (API)

In the Claude API, Skills are enabled per request (or per reusable container) via the `container` parameter:

* `container.skills` specifies which Skills are available.
* A `container.id` can be reused across multiple Messages API calls.

---

## 2. Canonical architecture

### 2.1 Startup phase

At startup, Claude/agent runtime:

1. **Enumerates installed Skills** (surface-dependent).
2. **Extracts metadata** (YAML frontmatter → `name`, `description` and any small metadata used for discovery).
3. **Preloads metadata into the system prompt** (or equivalent system context), so the model knows which Skills exist.

### 2.2 Runtime decision & activation

When the user asks for a task:

1. Claude uses the **Skill descriptions** as an internal “catalog index” and decides whether any Skill is relevant.
2. If a Skill is relevant, Claude reads the Skill’s `SKILL.md` (Level 2).
3. Claude follows the Skill’s instructions.
4. Claude may read additional referenced files (Level 3+).
5. Claude may run scripts or tools.

### 2.3 Relationship to tools and code execution

Skills become much more powerful when paired with tools:

* File I/O (read/write)
* Bash or shell execution
* Code execution environment (sandbox)
* MCP tools (external service integrations)

A Skill may:

* **Explain how** to use these tools (“procedural knowledge”)
* **Provide code** to run deterministically

---

## 3. Skill package anatomy

### 3.1 Directory layout

A recommended layout:

```
my-skill/
├── SKILL.md                # Required
├── reference.md            # Optional
├── examples.md             # Optional
├── resources/              # Optional assets
│   ├── logo.png
│   └── brand_colors.json
├── templates/              # Optional templates
│   └── report_template.md
└── scripts/                # Optional scripts
    ├── analyze.py
    └── validate.py
```

Key rule: **Everything the Skill needs should live in the Skill directory** (or be clearly retrievable via surface-appropriate means).

### 3.2 Referencing bundled files

`SKILL.md` should explicitly link/reference other files by path:

* Markdown links: `[reference](reference.md)`
* Script instructions with exact commands: `python scripts/analyze.py input.csv`

**Avoid deeply nested references** (see §8.6): keep references **one level deep from **************************************************************************************``.

### 3.3 Folder name conventions

Different surfaces impose different requirements:

* **Claude.ai upload:** your ZIP typically must contain a single top-level folder that represents the Skill; common validation includes “folder name matches skill name”.
* **Claude Code / Agent SDK:** the directory name is technically flexible, but **should match** the Skill `name` for clarity and portability.
* **API upload:** the server assigns a `skill_id` object; the internal folder name still matters for tool references and sanity, but the authoritative identifier is the API `skill_id`.

---

## 4. SKILL.md format specification

### 4.1 File format

`SKILL.md` MUST:

1. Be valid Markdown.
2. Start with valid YAML frontmatter, delimited by `---`.
3. Include required fields in the YAML frontmatter.

Example skeleton:

```md
---
name: processing-pdfs
description: Extracts text and tables from PDF files, fills forms, and merges documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.
---

# PDF Processing

## Instructions
1. ...

## Examples
- ...
```

### 4.2 YAML frontmatter schema (canonical)

#### 4.2.1 Required fields

``** (string, required)**

Validation rules (canonical):

* Length: **≤ 64 characters**
* Allowed characters: **lowercase letters**, **numbers**, **hyphens** (`[a-z0-9-]`)
* Must not contain XML tags
* Must not contain reserved words: `"anthropic"`, `"claude"`

``** (string, required)**

Validation rules (canonical):

* Must be **non-empty**
* Length: **≤ 1024 characters**
* Must not contain XML tags

**Normative authoring rule:** `description` MUST include:

* **What** the Skill does
* **When** Claude should use it (trigger terms / contexts)

Additionally, authoring guidance recommends:

* Write in **third person** (because the description is injected into the system prompt).

#### 4.2.2 Optional fields (cross-surface)

``** (string or list; optional, surface-dependent)**

Used to express required packages (e.g. Python or Node). Guidance:

* Claude.ai / Claude Code may install packages from standard repos **when loading Skills** (subject to permissions/settings).
* Claude API Skills run in a container where **runtime package installation is not allowed**; dependencies must be **preinstalled**.

#### 4.2.3 Optional fields (Claude Code only)

``** (list or comma-separated string; optional)**

Purpose: restrict which Claude Code tools are available when the Skill is active.

Example:

```yaml
allowed-tools: Read, Grep, Glob
```

Semantics:

* When present, Claude can use only the specified tools without additional permission prompts.
* When absent, Claude follows the standard permission model.

Note: `allowed-tools` is explicitly supported **only** for Skills in Claude Code.

### 4.3 Markdown body recommendations

The Markdown body SHOULD provide:

* A high-level purpose statement
* Clear step-by-step workflows
* Concrete examples
* Pointers to optional reference files
* Deterministic scripts to execute (when appropriate)

A strong SKILL.md tends to resemble an **onboarding manual**:

* “Quick start” section
* “Workflow checklist” for complex tasks
* “Validation / verification” steps for safety-critical operations

---

## 5. Skill discovery & selection

### 5.1 The description is the index

Claude uses `description` as the primary discovery mechanism.

Implication:

* Skill selection is fundamentally “prompt-based”: there is no guaranteed algorithmic intent classifier selecting Skills; the model reads descriptions and decides.

### 5.2 Trigger design

A good `description` includes:

* Domain nouns: “PDF”, “.xlsx”, “PowerPoint”, “OKRs”, “JIRA”, etc.
* Task verbs: “extract”, “fill”, “merge”, “analyze”, “generate”, etc.
* Context cues: “when working with…”, “when user mentions…”, “when asked to…”

### 5.3 Resolving conflicts between Skills

If two Skills are too similar (e.g., “For data analysis” vs “For analyzing data”), Claude may pick the wrong Skill.

Rule:

* Make descriptions **distinct** by naming different domain cues and use-cases.

---

## 6. Tooling, code, and execution

### 6.1 Skills and tools: what Skills can do

A Skill can:

* Instruct Claude to read/write files
* Provide “recipes” for using tools
* Provide scripts that Claude executes
* Produce artifacts (documents) programmatically

### 6.2 Deterministic scripts vs “generate code on the fly”

Normative guidance:

* Prefer **scripts** for deterministic operations.
* “Solve, don’t punt”: scripts should solve the task rather than instructing Claude to improvise core logic.

Scripts can be executed without loading their content into the model context; only the output is consumed.

### 6.3 Script intent must be explicit

When referencing a script, clearly indicate whether Claude should:

* **Execute** it
* Or **read** it as reference

Example:

* Execute: “Run `python scripts/analyze_form.py input.pdf > fields.json`.”
* Read: “See `scripts/analyze_form.py` for the extraction algorithm.”

### 6.4 Path conventions

* Use **forward slashes** in paths (`scripts/helper.py`) even on Windows.
* Avoid Windows-style backslashes (`scripts\helper.py`).

### 6.5 Executable permissions (Claude Code)

If scripts need to be executed directly, ensure execute permissions are set (e.g., `chmod +x`).

### 6.6 MCP tool references

If a Skill relies on MCP tools, **use fully qualified tool names**:

* Format: `ServerName:tool_name`

This avoids “tool not found” errors when multiple MCP servers are available.

---

## 7. Surface variants

This section defines how the same conceptual Skill model manifests differently in each product sur.face

* Primary risks: **prompt injection** and **data exfiltration**, including via malicious dependencies.

### 7.2 Claude Code

#### 7.2.1 Locations

Skills are discovered from:

* **User Skills:** `~/.claude/skills/`
* **Project Skills:** `.claude/skills/`
* **Plugin Skills:** bundled with installed Claude Code plugins

#### 7.2.2 Sharing

Two main approaches:

* **Recommended:** distribute Skills via **Claude Code plugins**.
* **Also supported:** commit `.claude/skills/` into git so teammates automatically get Skills on pull.

#### 7.2.3 allowed-tools (Claude Code only)

`allowed-tools` limits which tools are usable when the Skill is active.

Use cases:

* Enforce read-only behaviors
* Reduce accidental destructive actions
* Constrain a Skill to a minimal capability set

#### 7.2.4 Debugging

If a Skill doesn’t load or isn’t used:

* Make the description more specific
* Verify file path and directory placement
* Validate YAML syntax (`---` delimiters, indentation, no tabs)
* Run `claude --debug` to view Skill loading errors

### 7.4 Claude Agent SDK

#### 7.4.1 Core constraints

* Skills are **filesystem artifacts**; the SDK does not provide a programmatic “register skill” API.

#### 7.4.2 Enabling Skills

You must:

1. Add `"Skill"` to `allowed_tools`
2. Load filesystem settings by setting `settingSources` / `setting_sources`

TypeScript conceptually:

* `settingSources: ['user', 'project']`

Python conceptually:

* `setting_sources=["user", "project"]`

#### 7.4.3 Locations

* Project Skills: `.claude/skills/`
* User Skills: `~/.claude/skills/`
* Plugin Skills: via Claude Code plugins

---

## 8. Authoring specification (normative guidance)

This section is intentionally prescriptive.

### 8.1 Keep Skills focused

Rule:

* One Skill SHOULD address **one capability**.

Rationale:

* Focus improves discovery.
* Composability beats monoliths.

### 8.2 Be concise

Norm:

* Assume Claude knows the basics; don’t spend tokens explaining obvious definitions.

### 8.3 Choose the right degre7.3 Claude API

#### 7.3.1 Prerequisites

Skills require:

* An Anthropic API key
* **Beta headers** (as of Dec 2025):

  * `code-execution-2025-08-25` (required)
  * `skills-2025-10-02`
  * `files-api-2025-04-14` (for uploading/downloading files)

And you must enable **code execution tool** in you`lls`.quest.

####

es of freedom

Guideline:

* **High freedom** (text-based guidance) for creative or variable tasks.
* **Low freedom** (precise commands/scripts) for fragile, error-prone, or safety-critical tasks.

### 8.4 Write descriptions for discovery

Rules:

* Write in **third person**.
* Include both **what** and **when**.
* Include distinct trigger terms to avoid collisions.

### 8.5 Token/size budgets

Guideline:

* Keep SKILL.md body **under ~500 lines** for best performance.
* Split content into separate files as you approach that limit.

### 8.6 Progressive disclosure patterns

Rules:

* SKILL.md should act as an “overview + table of contents.”
* Put large material into separate files.

Avoid nested references:

* Keep references **one level deep** from SKILL.md.

Long reference files:

* If a reference file is > 100 lines, include a **table of contents** near the top.

### 8.7 Workflows and feedback loops

For complex tasks:

* Provide a checklist workflow Claude can copy and check off.
* Include explicit validation steps and “if fails, go back to step X” loops.

### 8.8 Avoid time-sensitive information

If you must include legacy info:

* Put it in an “Old patterns” section (e.g., inside `<details>`).

### 8.9 Use consistent terminology

Pick one term per concept and stick to it.

### 8.10 Scripts: solve, don’t punt

Rules:

* Provide utility scripts for deterministic tasks.
* Ensure scripts have clear I/O formats.
* Include verification scripts where correctness matters.
* Make error handling explicit.

### 8.11 Dependencies

Rules:

* Do not assume packages exist.
* If installation is allowed (surface-dependent), explicitly instruct installation with exact commands.

### 8.12 Testing & evaluation

Norm:

* Build evaluations first.
* Create at least **three** evaluation cases.
* Test with the models you plan to deploy (e.g., Haiku, Sonnet, Opus).
* Iterate based on observed model behavior.

Note: there is no built-in evaluation runner provided; users must build their own evaluation harness.

---

## 9. Troubleshooting & operational playbook

### 9.1 Skill not being used

Checklist:

* Is it present in the right folder? (Claude Code / SDK)
* Is `description` specific enough?
* Ask explicitly: “Use my  skill to …”

### 9.2 Skill fails to load

Common causes:

* Invalid YAML frontmatter
* Missing `SKILL.md`
* Invalid name characters
* Incorrect folder structure in ZIP

### 9.4 Conflicts between Skills

Solution:

* Make descriptions distinct with different domain keywords and triggers.

###

---

## 10. Security model

### 10.1 Threats

Skills can introduce risk because they:

* Provide instructions that can be prompt-injected
* May include or install dependencies that exfiltrate data
* May invoke tools to access files or run commands

Primary risks:

* **Prompt injection**
* **Data exfiltration**
* **Tool misuse** (unexpected file operations, system commands)
* **Supply-chain risk** (dependencies and external URLs)

### 10.2 Security posture

Treat Skills like installing software:

* Only use Skills from trusted sources.
* Audit everything bundled:

  * `SKILL.md`
  * scripts
  * resources
  * any network-fetch patterns

### 10.3 Surface constraints as mitigations

* Claude Code: has full local access; author responsibly; discourage global installs.
* Claude Code `allowed-tools`: capability restriction.

---

## 11. Comparative positioning

### 11.1 Skills vs Projects

* **Projects:** static background knowledge, always loaded in that Project.
* **Skills:** dynamic procedural knowledge, loaded only when relevant, available across chats.

### 11.2 Skills vs Custom Instructions

* **Custom instructions:** broad, always applied.
* **Skills:** task-specific, avoids cluttering all conversations.

### 11.3 Skills vs MCP

* **MCP:** connects to external services/tools and data sources.
* **Skills:** teach procedures (how to do a workflow), including how to use MCP tools effectively.
* Best together: MCP = hands, Skills = playbook.

---

## 12. Minimal examples

### 12.1 Minimal single-file Skill

```md
---
name: generating-commit-messages
description: Generates clear commit messages from git diffs. Use when writing commit messages or reviewing staged changes.
---

# Generating Commit Messages

## Instructions
1. Run `git diff --staged` to see changes.
2. Produce:
   - A summary under 50 characters
   - A detailed description
   - Affected components

## Best practices
- Use present tense.
- Explain what and why, not how.
```

### 12.2 Multi-file Skill (one-level references)

```md
---
name: brand-guidelines
description: Applies Acme brand standards (colors, fonts, layouts) to docs and slides. Use when creating presentations/documents for external sharing.
---

# Brand Guidelines

## Quick start
- Use palette and typography in [reference.md](reference.md).
- Use slide layouts in [templates/](templates/).

## Workflow
1. Determine artifact type (pptx/docx/pdf).
2. Apply brand color palette.
3. Apply typography rules.
4. Validate logo usage.

## Validation
- Confirm contrast meets accessibility.
- Confirm logo spacing.12.3 API request sketch
```

```json
{
  "model": "claude-sonnet-4-5-20250929",
  "max_tokens": 4096,
  "betas": ["code-execution-2025-08-25", "skills-2025-10-02"],
  "container": {
    "skills": [
      {"type": "anthropic", "skill_id": "pptx", "version": "latest"}
    ]
  },
  "tools": [{"type": "code_execution_20250825", "name": "code_execution"}],
  "messages": [{"role": "user", "content": "Create a deck on Q3 results."}]
}
```

---

## 13. Formal specification (implementer view)

This section is for building a compatible system.

### 13.1 Abstract data types

#### 13.1.1 SkillPackage

A SkillPackage is a tuple:

* `root_path`: directory
* `entrypoint`: `SKILL.md` file
* `files`: all files under root

#### 13.1.2 SkillMetadata

Extracted from YAML frontmatter:

* `name: string`
* `description: string`
* `dependencies?: string | string[]`
* `allowed_tools?: string[]` (Claude Code only)
* `extensions?: map<string, any>` (future metadata)

### 13.2 Loading algorithm (conceptual)

**Startup:**

1. Enumerate Skills (surface-dependent).
2. For each Skill:

   * Read first N lines of `SKILL.md` until YAML frontmatter closes.
   * Parse YAML.
   * Validate `name` and `description`.
3. Inject all SkillMetadata into the system prompt (or equivalent).

**On each user message:**

1. Model chooses whether to activate Skill(s).
2. When activating a Skill:

   * Read full `SKILL.md` body into context.
   * Follow instructions.
3. If referenced files are needed:

   * Read those files, preferring complete reads.
4. If scripts are specified:

   * Execute scripts in the appropriate runtime environment.

### 13.3 Validation rules

Implementers SHOULD enforce:

* YAML parsing correctness
* `name` and `description` constraints
* Optional surface-specific constraints (e.g., `allowed-tools` only in Claude Code)
* ZIP structural rules for uploads (Claude.ai)

###
