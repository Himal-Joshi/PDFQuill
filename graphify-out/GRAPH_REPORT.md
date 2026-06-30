# Graph Report - .  (2026-06-11)

## Corpus Check
- Corpus is ~9,796 words - fits in a single context window. You may not need a graph.

## Summary
- 176 nodes · 193 edges · 13 communities (12 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Backend Server (Express & PDF Editing)|Backend Server (Express & PDF Editing)]]
- [[_COMMUNITY_Client TypeScript Configuration|Client TypeScript Configuration]]
- [[_COMMUNITY_Client Development Dependencies|Client Development Dependencies]]
- [[_COMMUNITY_Node TypeScript Configuration|Node TypeScript Configuration]]
- [[_COMMUNITY_Frontend React Components & Pages|Frontend React Components & Pages]]
- [[_COMMUNITY_Backend Server Dependencies|Backend Server Dependencies]]
- [[_COMMUNITY_Root Workspace Configuration|Root Workspace Configuration]]
- [[_COMMUNITY_Client Frontend Package Configuration|Client Frontend Package Configuration]]
- [[_COMMUNITY_Client Frontend Dependencies|Client Frontend Dependencies]]
- [[_COMMUNITY_Client TypeScript References|Client TypeScript References]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 17 edges
2. `compilerOptions` - 16 edges
3. `scripts` - 8 edges
4. `registerAccount()` - 8 edges
5. `scripts` - 5 edges
6. `loginAccount()` - 5 edges
7. `copyPages()` - 4 edges
8. `splitPdf()` - 4 edges
9. `organizePdf()` - 4 edges
10. `cn()` - 3 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (13 total, 1 thin omitted)

### Community 0 - "Backend Server (Express & PDF Editing)"
Cohesion: 0.11
Nodes (17): addPageNumbers(), compressPdf(), copyPages(), imagesToPdf(), mergePdfs(), organizePdf(), parsePageList(), rotatePdf() (+9 more)

### Community 1 - "Client TypeScript Configuration"
Cohesion: 0.08
Nodes (14): app, archiver, cors, express, fs, fsp, multer, outputsDir (+6 more)

### Community 2 - "Client Development Dependencies"
Cohesion: 0.10
Nodes (19): dependencies, axios, clsx, framer-motion, jszip, lucide-react, pdf-lib, react (+11 more)

### Community 3 - "Node TypeScript Configuration"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 4 - "Frontend React Components & Pages"
Cohesion: 0.11
Nodes (18): devDependencies, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, postcss (+10 more)

### Community 5 - "Backend Server Dependencies"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 6 - "Root Workspace Configuration"
Cohesion: 0.24
Nodes (13): ALLOWED_DOMAINS, ALLOWED_EDU_SUFFIXES, AuthResult, generateToken(), getAccounts(), hashPassword(), loginAccount(), PasswordValidation (+5 more)

### Community 7 - "Client Frontend Package Configuration"
Cohesion: 0.14
Nodes (13): dependencies, archiver, cors, express, multer, pdf-lib, description, main (+5 more)

### Community 8 - "Client Frontend Dependencies"
Cohesion: 0.15
Nodes (12): description, name, private, scripts, build, check:server, dev:client, dev:server (+4 more)

## Knowledge Gaps
- **114 isolated node(s):** `name`, `version`, `private`, `description`, `install:all` (+109 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `Frontend React Components & Pages` to `Client Development Dependencies`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _114 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Backend Server (Express & PDF Editing)` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `Client TypeScript Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Should `Client Development Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Node TypeScript Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `Frontend React Components & Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._