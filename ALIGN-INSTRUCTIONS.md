# Instruction Alignment Report

## Overview
This document lists the instruction files found in `.github/instructions/` and other locations, their purpose, and any modifications made to align them with the current repository structure and best practices.

## Instruction Files

### Root & Global
- **`AGENTS.md`**: The primary entry point for AI agents. Contains project specifics, setup, and key conventions. *Aligned with repo state.*
- **`.github/copilot-instructions.md`**: Workspace-level instructions. **MODIFIED**: Updated "Tests & validation" section to reflect the presence of `vitest` and `tests/` directory, correcting a previous statement that "no test harness" existed.

### Tech Stack Instructions
- **`.github/instructions/nodejs-javascript-vitest.instructions.md`**: Best practices for Node.js and Vitest. *Aligned.*
- **`.github/instructions/reactjs.instructions.md`**: Best practices for React 19+. *Aligned.*
- **`.github/instructions/typescript-5-es2022.instructions.md`**: TypeScript guidelines. *Aligned.*
- **`.github/instructions/playwright-typescript.instructions.md`**: E2E testing guidelines. *Aligned (though E2E tests are yet to be fully implemented, the guidance is correct).*
- **`.github/instructions/powershell.instructions.md`**: PowerShell best practices. *Context specific (likely for Windows users), left as is.*

### Process & Workflow
- **`.github/instructions/memory-bank.instructions.md`**: Instructions for maintaining project context in `memory/`. *Aligned.*
- **`.github/instructions/spec-driven-workflow-v1.instructions.md`**: A structured workflow guide. *Aligned.*
- **`.github/instructions/tasksync.instructions.md`**: Specific protocol for "TaskSync" agents. *Left as is, assuming it is used by a specific agent type. Note: This file contains strong directives that might conflict with standard PR flows if interpreted globally, but usually safe if specific to a separate tool.*

### General Best Practices
- **`.github/instructions/ai-prompt-engineering-safety-best-practices.instructions.md`**: Prompt engineering guide. *Aligned.*
- **`.github/instructions/code-review-generic.instructions.md`**: Code review guidelines. *Aligned.*
- **`.github/instructions/github-actions-ci-cd-best-practices.instructions.md`**: CI/CD guidelines. *Aligned.*
- **`.github/instructions/markdown.instructions.md`**: Markdown formatting rules. *Aligned.*
- **`.github/instructions/performance-optimization.instructions.md`**: Performance tips. *Aligned.*
- **`.github/instructions/prompt.instructions.md`**: Guide for creating prompt files. *Aligned.*
- **`.github/instructions/taming-copilot.instructions.md`**: Rules for Copilot behavior. *Aligned.*

## Discrepancies Resolved

### Testing Framework
- **Issue**: `.github/copilot-instructions.md` stated "There is no test harness", contradicting `AGENTS.md` and `package.json` which show `vitest`.
- **Resolution**: Updated `.github/copilot-instructions.md` to explicitly mention Vitest and the `tests/` directory.

### Package Manager
- **Issue**: System prompt memory mentioned "Strictly enforces pnpm", but the repository contains `package-lock.json` (implying npm) and `AGENTS.md` uses `npm` commands.
- **Resolution**: Prioritized the actual repository state (`package-lock.json`) and `AGENTS.md` instructions. No changes made to files to force `pnpm` to avoid breaking the current working environment. Future alignment might be needed if `pnpm` is indeed the intended standard, but for now, instructions reflect the `npm` reality.
