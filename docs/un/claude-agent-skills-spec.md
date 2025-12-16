---
reference_urls:
- https://claude.com/blog/skills
- https://github.com/anthropics/skills
- https://code.claude.com/docs/en/skills
- https://support.claude.com/en/articles/12512176-what-are-skills
- https://platform.claude.com/docs/en/build-with-claude/skills-guide
- https://support.claude.com/en/articles/12512180-using-skills-in-claude
- https://support.claude.com/en/articles/12512198-how-to-create-custom-skills
- https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
- https://support.claude.com/en/articles/12580051-teach-claude-your-way-of-working-using-skills
undoc_prompt: "Read all URLs in reference_urls[]. Synthesize them into ONE ultra-detailed Markdown technical specification of Claude/Anthropic Agent Skills as a standalone reference. Use a single merged conceptual model with explicit surface variants (focus on Claude Code, Claude Agent SDK, no Claude API, no Claude.ai). Add normative guidance (MUST/SHOULD) where helpful, keep examples minimal, and include a nice-to-have mapping section translating Skills concepts into PromptWareOS primitives (capabilities, syscalls, containers, paging). Output ONLY the final Markdown document (no extra commentary), preserving as much structure and content as possible each time you regenerate. Keep the original YAML front matter in the generated markdown."
---

# Claude / Anthropic Agent Skills — Unified Technical Specification

> **Scope**: This document defines the **Agent Skills** system as a portable, filesystem-based packaging format for agent expertise, with **explicit surface variants** for:
>
> * **Claude Code** (primary)
> * **Claude Agent SDK** (primary)
>
> Out of scope (discussed only briefly for conceptual completeness): **Claude API** and **Claude.ai**.

---

## 1) Executive model

### 1.1 Definition

A **Skill** is a **directory** that contains:

* **`SKILL.md`** (**required**) — a Markdown file with **YAML frontmatter** (metadata) plus the **instructions** for the agent.
* **Supporting files** (**optional**) — additional Markdown references, templates, scripts, datasets, etc.

Skills let Claude (or Claude-based agents) load **procedural knowledge**, **organizational context**, and **deterministic code** *only when relevant*, rather than stuffing everything into every prompt.

### 1.2 Core properties

Skills are designed to be:

* **Model-invoked**: Claude decides when to use a skill based primarily on `description`.
* **Composable**: multiple skills may be used in one task.
* **Portable**: a consistent directory format across agent surfaces.
* **Efficient** via **progressive disclosure**: load *metadata always*, load *instructions only when triggered*, load *resources only if needed*.

### 1.3 Progressive disclosure (3-tier loading)

Skills load content in stages:

1. **Level 1 — Metadata** (always loaded)

   * The agent preloads the `name` and `description` from each skill’s YAML frontmatter into the system prompt.
2. **Level 2 — Instructions** (loaded when triggered)

   * When the current task matches the skill, the agent reads the full `SKILL.md` body.
3. **Level 3+ — Resources & code** (loaded/used as needed)

   * The agent may open referenced files (e.g. `FORMS.md`, `REFERENCE.md`) or execute scripts.

**Design intent**: you can install many skills without paying a large context-window cost, because only a small piece of each skill is always present.

---

## 2) Normative terminology

* **MUST / MUST NOT / SHOULD / SHOULD NOT / MAY** are used in the RFC sense.
* **Loader**: the component (Claude Code / Agent SDK runtime) that discovers skills, parses metadata, and makes them available to the model.
* **Trigger**: any user/task content that makes a skill relevant according to its `description` (and any additional conventions you encode).
* **Tool**: an action capability (e.g., filesystem read/write, bash, code execution). Tool availability differs by surface.

---

## 3) Unified conceptual architecture

### 3.1 Discovery and invocation semantics

**Discovery** is primarily metadata-driven:

* The Loader MUST index all installed skills by reading **only** YAML frontmatter from each `SKILL.md`.
* The Loader MUST expose each skill’s `name` and `description` to the model at startup (typically in the system prompt).

**Invocation** is model-driven:

* The model MUST be allowed to decide whether to activate a skill.
* A skill MUST NOT require explicit user invocation (unlike slash commands); it can be activated implicitly when relevant.

**Activation**:

* When a skill is chosen, the Loader (or Claude) MUST load the full `SKILL.md` content into context (Level 2).
* Any referenced resources MAY then be loaded (Level 3+) based on the instructions in `SKILL.md` and the task.

### 3.2 Skill composition

* The system SHOULD allow multiple skills to be “in play” for a single task.
* Skill authors MUST assume their skill may run alongside others.
* If two skills conflict (overlapping triggers / contradictory procedures), authors SHOULD resolve it through:

  * sharper `description` triggers,
  * explicitly scoped instructions,
  * or an internal “conflict resolution” section in SKILL.md.

### 3.3 Environment model (high-level)

Skills assume Claude has an execution environment with:

* **filesystem access** (skills live on disk as directories)
* **a way to read files** (commonly via a shell / bash tool or an internal file reader)
* **optional execution** for deterministic code (scripts)

**Important**: the exact toolset and permission model is **surface-dependent**.

---

## 4) Skill package format

### 4.1 Directory layout

A skill is a directory whose **top-level contains `SKILL.md`**.

Recommended layout:

```
my-skill/
├── SKILL.md               # REQUIRED
├── REFERENCE.md           # optional (deep reference)
├── EXAMPLES.md            # optional
├── templates/             # optional
│   └── template.txt
└── scripts/               # optional
    └── helper.py
```

Rules:

* A Skill directory MUST contain `SKILL.md` at the top level.
* Files SHOULD use Unix-style paths and forward slashes in references.
* Filenames SHOULD be stable and descriptive; avoid renaming frequently if users rely on them.

### 4.2 The entrypoint: `SKILL.md`

`SKILL.md` is the canonical entrypoint.

* The Loader MUST parse YAML frontmatter at the top of the file.
* The remainder MUST be treated as Markdown instructions.

A minimal compliant structure:

```md
---
name: your-skill-name
description: Brief description of what this Skill does and when to use it
---

# Your Skill Name

## Instructions
[Clear, step-by-step guidance]
```

### 4.3 YAML frontmatter (required + optional)

#### 4.3.1 Required fields

`name` (required)

* MUST be ≤ 64 characters.
* MUST contain only lowercase letters, numbers, and hyphens (`[a-z0-9-]`).
* MUST NOT include XML tags.
* MUST NOT use reserved words such as `anthropic` or `claude`.

`description` (required)

* MUST be non-empty.
* SHOULD explain both:

  * what the skill does, and
  * when it should be used (include likely user phrases / triggers).
* MUST be ≤ 1024 characters.
* MUST NOT include XML tags.

#### 4.3.2 Optional fields (surface-dependent)

Because the ecosystem spans multiple runtimes, some frontmatter keys may be supported only on specific surfaces.

`allowed-tools` (optional; **Claude Code only**)

* A comma-separated list of tool names.
* When set, Claude Code may allow the skill to use those tools without asking for permission under the standard permission model.
* If omitted, Claude Code follows its default tool permission behavior (it may ask for permission as usual).

Example:

```md
---
name: safe-file-reader
description: Read files without making changes. Use when you need read-only file access.
allowed-tools: Read, Grep, Glob
---
```

**Forward-compatibility rule**:

* Skill authors SHOULD NOT invent new frontmatter keys unless the target surface explicitly supports them.
* Loaders SHOULD ignore unknown keys (fail-soft) *unless* they are explicitly configured to validate strictly.

> Note: The broader Skills ecosystem includes other management metadata on some surfaces (e.g., “display title” in upload-based systems). This spec intentionally focuses on filesystem-based Skills (Claude Code / Agent SDK).

### 4.4 Markdown body conventions

The Markdown body is the procedural “manual” Claude will follow once the skill is loaded.

The skill body SHOULD be structured for **human-readability** and **agent reliability**:

* Use clear headings.
* Separate “Quick start” (common path) from “Edge cases”.
* Prefer explicit step-by-step procedures.

Recommended sections:

* `## Quick start`
* `## Instructions` (normative procedures)
* `## Inputs / assumptions`
* `## Outputs`
* `## Safety / guardrails`
* `## Debugging`
* `## Version history` (optional but recommended)

---

## 5) Authoring guidance (normative)

### 5.1 Write for discovery: `description` is your router

The `description` is the primary trigger mechanism.

A skill description MUST:

* include **what** the skill does,
* include **when** to use it,
* include **distinctive trigger terms** users are likely to say.

A good pattern:

* “Do X and Y. Use when the user mentions A/B/C or when working with file types D/E.”

Bad patterns:

* too generic (“Helps with documents”, “For files”)
* overlapping duplicates (“For data analysis” vs “For analyzing data”) that increase conflict.

### 5.2 Keep skills focused

* One skill SHOULD cover one capability (single responsibility).
* If a skill grows large, you SHOULD split it into multiple skills or use progressive disclosure (extra files).

### 5.3 Use progressive disclosure intentionally

Rules of thumb:

* Keep `SKILL.md` body **lean**.
* Move rarely-used detail into:

  * `REFERENCE.md`
  * scenario-specific docs (`FORMS.md`, `ERRORS.md`, etc.)
  * scripts (when deterministic computation is better)

Your `SKILL.md` SHOULD link to extra files explicitly:

* “For advanced form filling, see [FORMS.md](FORMS.md).”

### 5.4 When to use scripts

Skills MAY include executable scripts for tasks where:

* determinism is required,
* correctness is easier to guarantee in code,
* or the operation is too verbose/fragile to do with pure text instructions.

Guidelines:

* Scripts SHOULD be small, auditable, and purpose-built.
* Scripts SHOULD validate inputs and fail loudly.
* Scripts SHOULD print machine-readable output when useful.
* Scripts SHOULD avoid surprising side effects (e.g., deleting files) unless explicitly required.

### 5.5 Dependencies (operational, surface-dependent)

The Skills pattern often needs third-party libraries (e.g., PDF parsing, spreadsheet analysis).

* If your surface supports runtime dependency installation, the skill MAY rely on it.
* If runtime installation is not available, the skill MUST restrict itself to preinstalled packages or vendor dependencies alongside the skill.

**Practical guidance (portable across surfaces)**:

* Document required packages in `SKILL.md` (e.g., “Requires `pdfplumber`”).
* Provide a “dependency check” step and expected error messages.
* Prefer pinned versions in a `requirements.txt` / `package.json` when the surface can install them.

> Claude Code notes: it may automatically install required dependencies or ask for permission to install them when needed.

---

## 6) Tool access and permissions

### 6.1 Principle of least privilege

Skills can instruct Claude to read files, write files, run commands, and execute code. This power implies risk.

* Skill authors SHOULD minimize tool requirements.
* Operators SHOULD install skills only from trusted sources.

### 6.2 Claude Code: `allowed-tools`

In Claude Code, `allowed-tools` can limit what tools Claude can use when the skill is active.

Normative behavior (Claude Code):

* If `allowed-tools` is present, Claude Code SHOULD restrict the skill’s tool usage to the listed tools without needing further permission.
* If absent, Claude Code follows its default permission model.

Operational uses:

* Read-only reviewer skills
* Security-sensitive workflows
* Minimizing blast radius

### 6.3 Agent SDK: enabling the Skill tool

In the Claude Agent SDK:

* Skills are filesystem-based in `.claude/skills/`.
* Skills are enabled by including the `"Skill"` tool in your `allowed_tools` configuration.

Normative behavior (Agent SDK):

* If `Skill` is not enabled, the agent MUST NOT be able to discover or load skills.
* If enabled, the SDK runtime SHOULD automatically discover filesystem skills at startup.

---

## 7) Surface variants

### 7.1 Claude Code (primary)

#### 7.1.1 Skill sources

Claude Code discovers skills from three sources:

1. **Personal skills**: `~/.claude/skills/`
2. **Project skills**: `.claude/skills/`
3. **Plugin skills**: bundled with installed Claude Code plugins

#### 7.1.2 Personal vs project skills

* Personal skills are cross-project, user-local, and good for personal workflows.
* Project skills are repository-local, sharable via git, and good for team/project conventions.

#### 7.1.3 Distribution and sharing

Recommended sharing mechanisms:

* **Plugins** (preferred for org/team distribution)
* **Git** (project skills committed to the repo)

If sharing via git:

* Store skills under `.claude/skills/`.
* Commit them like any other code asset.

#### 7.1.4 Reload semantics

* Changes to skills take effect the next time Claude Code starts.
* If Claude Code is already running, it SHOULD be restarted to load updates.

#### 7.1.5 Debugging

Common checks:

* Ensure the skill is in the correct path.
* Ensure YAML frontmatter is valid (opening `---` on line 1, closing `---` before content, spaces not tabs).
* Ensure scripts have executable permissions where applicable (`chmod +x`).
* Use Unix-style forward slashes in paths.

Claude Code supports running with debug mode:

* `claude --debug`

#### 7.1.6 Skill conflicts

If multiple skills conflict:

* Make descriptions more distinct.
* Add explicit scopes (“Use for sales spreadsheets” vs “Use for log files”).

### 7.2 Claude Agent SDK (primary)

#### 7.2.1 Installation path

* Place skills in `.claude/skills/` alongside your agent/project configuration.

#### 7.2.2 Enabling skills

* The agent configuration MUST include `"Skill"` in `allowed_tools` (or equivalent SDK config) to allow skills.

#### 7.2.3 Operational semantics

The Agent SDK skill lifecycle should mirror the unified architecture:

* Startup: preload skill metadata (`name`, `description`).
* Task time: load `SKILL.md` when triggered.
* As needed: load resources / execute scripts.

> Implementation details differ by SDK language/version; treat this as behavioral intent.

### 7.3 Out-of-scope surfaces (for conceptual completeness)

#### 7.3.1 Claude API (out of scope)

The Claude API supports pre-built skills and custom skills via container configuration and Skills APIs.

This spec does not define API request/response schemas.

#### 7.3.2 Claude.ai (out of scope)

Claude.ai supports skills and offers upload-based workflows (often as zip). This document omits product UI steps.

---

## 8) Security model and threat guidance

### 8.1 Treat skills like installing software

Skills can add instructions and executable code.

* You SHOULD only use skills from trusted sources.
* You SHOULD audit all bundled files before installing.

### 8.2 Common risk vectors

* **Tool misuse**: a malicious skill can instruct tool usage that violates user intent.
* **Data exposure**: reading or leaking sensitive files.
* **External content**: skills that fetch external URLs can be compromised by upstream changes.

### 8.3 Recommended mitigations

Operators SHOULD:

* Prefer least privilege (`allowed-tools` where available).
* Review scripts for unexpected behavior.
* Avoid skills that fetch arbitrary external content unless strictly necessary.
* Maintain a curated internal marketplace / vetted skill set for teams.

Authors SHOULD:

* Clearly state the intended scope and tools.
* Add “Safety / guardrails” section describing what the skill MUST NOT do.
* Include “Verification” steps so outputs can be checked.

---

## 9) Operational playbook

### 9.1 Versioning

Skills are file-based; therefore versioning is operational:

* Teams SHOULD version skills through git tags/releases (Claude Code) and document changes in a `## Version History` section.
* Breaking changes SHOULD be called out explicitly.

### 9.2 Testing strategy

* Test triggers: does the skill activate when expected?
* Test edge cases: does the skill behave safely under unusual inputs?
* Test composition: does it behave when other skills are present?

### 9.3 Documentation strategy

* Keep “Quick start” short.
* Keep “Reference” comprehensive but in separate files.
* Write as if onboarding a new teammate.

---

## 10) Minimal templates

### 10.1 Minimal single-file skill

```md
---
name: my-skill
description: Do X. Use when the user mentions Y or when working with Z files.
---

# My Skill

## Instructions
1. Do the thing.
2. Validate output.
3. Report results.
```

### 10.2 Multi-file skill pattern

`SKILL.md` should point to additional files:

```md
---
name: pdf-processing
description: Extract text, fill forms, merge PDFs. Use when working with PDF files, forms, or document extraction.
---

# PDF Processing

## Quick start
- If the task is text extraction, follow the extraction steps below.
- If the task involves forms, read [FORMS.md](FORMS.md).

## Instructions
1. Identify the PDF path.
2. Extract text/tables.
3. If form filling is required, load FORMS.md and run scripts.
```

---

## 11) Mapping Skills to PromptWareOS primitives (nice-to-have)

This section translates the Agent Skills design into a PromptWareOS mental model.

### 11.1 Concept mapping table

| Agent Skills concept   | PromptWareOS analogue                  | Notes                                                  |
| ---------------------- | -------------------------------------- | ------------------------------------------------------ |
| Skill directory        | **Capability package**                 | A self-contained module that extends the OS.           |
| `SKILL.md` frontmatter | **Capability manifest**                | Minimal metadata for discovery/routing.                |
| `description`          | **Capability router rule**             | Primary dispatch predicate.                            |
| `SKILL.md` body        | **Capability manual**                  | Procedural spec executed by the agent.                 |
| Supporting `.md` files | **Paged docs**                         | Lazy-loaded “pages” in the capability’s address space. |
| Scripts                | **Userland executables**               | Deterministic helpers invoked via syscalls.            |
| “Skill tool”           | **`os_skill_load()` syscall**          | Loads a capability into the current context.           |
| `allowed-tools`        | **Syscall allowlist / capability set** | Capability-based security model.                       |
| Progressive disclosure | **Demand paging**                      | Metadata pinned; instructions/resources paged in.      |
| Plugin marketplace     | **Package repository**                 | Signed/curated capability distribution.                |

### 11.2 Paging model

Skills’ progressive disclosure maps cleanly to paging:

* **Metadata** is like a resident page table entry: always mapped, tiny.
* **Instructions** are like code pages: faulted in on first use.
* **Resources** are like memory-mapped files: present only when accessed.

A PromptWareOS-style loader could implement:

* `os_cap_scan()` → builds the “skill metadata index”.
* `os_cap_pagein(cap, path)` → loads specific files.
* `os_exec(cap, script, args)` → executes helpers in a sandbox.

### 11.3 Containers and isolation

* “Skills run in a VM-like environment” corresponds to PromptWareOS **containers**.
* A skill that includes scripts implies a **sandbox contract**:

  * filesystem namespace
  * tool/syscall namespace
  * resource limits

`allowed-tools` becomes the direct analogue of a per-capability **syscall filter**.

### 11.4 Capability discipline (normative)

If you implement Skills as PromptWareOS capabilities:

* Capabilities MUST declare minimal privileges.
* Capabilities SHOULD default to read-only unless mutation is required.
* “Install only from trusted sources” SHOULD become “signed packages only” for production.

---

## 12) Quick checklist (author/operator)

### Author checklist

* [ ] `name` matches the required pattern and length.
* [ ] `description` includes both **what** and **when**, with distinct triggers.
* [ ] Instructions are step-by-step and auditable.
* [ ] Rare details moved into separate files.
* [ ] Scripts are minimal, deterministic, and validated.
* [ ] Safety section: what the skill MUST NOT do.

### Operator checklist

* [ ] Install only from trusted sources.
* [ ] Audit `SKILL.md` and all bundled files.
* [ ] Use least privilege (`allowed-tools` where available).
* [ ] Test triggers and edge cases.
* [ ] Version skills and document changes.

## Simple Naming Rubric you can reuse

### Recommended templates

1) **Default (most common):** `object-role`  
   - Examples: `brand-guidelines`, `skill-creator`

2) **When scope/platform matters:** `scope-object-role`  
   - Examples: `slack-gif-creator`, `web-artifacts-builder`

3) **When it’s basically a file format:** `pdf`, `xlsx`, `pptx`, `docx`

### Hard limits (to keep cognitive load low)

- Prefer **2 tokens**; allow **3 max**
- Each token should be a **common English word** or a **universally-known abbreviation**
- Keep the suffix vocabulary consistent across the catalog (pick one: `builder` *or* `creator`, not both for the same class)

### Quick checklist

**Do**
- Use `kebab-case` and lowercase
- Put the recognition hook first (domain/platform/object)
- End with a stable role word (`builder`, `creator`, `testing`, `design`, `guidelines`)

**Don’t**
- Add “skill” unless it’s a meta-skill (e.g., `skill-creator`)
- Use internal jargon or “cute” names that don’t self-describe
- Encode too much detail in the name (details belong in `description`)