# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User / CLI                              │
│                      (src/index.ts)                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Agent (src/core/agent.ts)                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  - Manages conversation history                           │  │
│  │  - Calls OpenAI with available tools                      │  │
│  │  - Handles function calling loop                          │  │
│  │  - Validates & executes selected tools                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────┬──────────────────────────────────┬─────────────────────┘
         │                                  │
         │                                  │
         ▼                                  ▼
┌─────────────────────────┐    ┌──────────────────────────────────┐
│  OpenAI API             │    │  Workflow Engine                 │
│  (GPT-4 / GPT-3.5)      │    │  (src/core/workflow-engine.ts)   │
│                         │    │  - Execute predefined sequences  │
│  - Function calling     │    │  - Parameter resolution          │
│  - Tool selection       │    │  - Step-by-step execution        │
└─────────────────────────┘    └──────────────────────────────────┘
                                              │
         ┌────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│             Plugin Loader (src/core/plugin-loader.ts)           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  - Auto-discovers plugins from plugins/ directory         │  │
│  │  - Loads and initializes plugins                          │  │
│  │  - Registers tools and workflows                          │  │
│  │  - Manages plugin lifecycle                               │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
┌───────────────────┐ ┌──────────────┐ ┌─────────────────┐
│  Docker Plugin    │ │ Script Runner│ │  Your Plugin    │
│  (plugins/docker) │ │ Plugin       │ │  (plugins/xxx)  │
├───────────────────┤ ├──────────────┤ ├─────────────────┤
│ Tools:            │ │ Tools:       │ │ Tools:          │
│ - list containers │ │ - run command│ │ - custom tool   │
│ - start container │ │ - run script │ │ - ...           │
│ - stop container  │ │ - check proc │ │                 │
│ - get logs        │ │ - system info│ │ Workflows:      │
│ - exec command    │ │              │ │ - custom flow   │
│                   │ │ Workflows:   │ │ - ...           │
│ Workflows:        │ │ - health chk │ │                 │
│ - restart         │ └──────────────┘ └─────────────────┘
│ - health check    │
└───────────────────┘
```

## Data Flow

### Chat Message Flow

```
1. User types message
   │
   ▼
2. Agent adds to conversation history
   │
   ▼
3. Agent converts all tools to OpenAI function schemas
   │
   ▼
4. Agent calls OpenAI API with:
   - Conversation history
   - Available functions
   │
   ▼
5. OpenAI returns response with optional function call
   │
   ├─ No function call? ──────────┐
   │                              │
   ├─ Function call requested     │
   │  │                           │
   │  ▼                           │
   │  Agent finds tool in         │
   │  Plugin Loader               │
   │  │                           │
   │  ▼                           │
   │  Validate params with Zod    │
   │  │                           │
   │  ▼                           │
   │  Execute tool                │
   │  │                           │
   │  ▼                           │
   │  Add result to history       │
   │  │                           │
   │  └──> Loop back to step 4    │
   │                              │
   └──────────────────────────────┤
                                  ▼
6. Return final response to user
```

### Workflow Execution Flow

```
1. User executes /workflow command
   │
   ▼
2. Workflow Engine finds workflow by name
   │
   ▼
3. For each step in workflow:
   │
   ├─> Resolve parameters (${variables})
   │   │
   │   ▼
   ├─> Find tool in Plugin Loader
   │   │
   │   ▼
   ├─> Validate params with Zod
   │   │
   │   ▼
   ├─> Execute tool
   │   │
   │   ▼
   ├─> Store result as ${stepN_result}
   │   │
   │   ▼
   └─> Continue to next step
       │
       ▼
4. Return workflow result
```

### Plugin Loading Flow

```
1. Agent starts
   │
   ▼
2. Plugin Loader scans plugins/ directory
   │
   ▼
3. For each subdirectory:
   │
   ├─> Import plugins/*/index.js
   │   │
   │   ▼
   ├─> Validate Plugin interface
   │   │
   │   ▼
   ├─> Call plugin.initialize()
   │   │
   │   ▼
   ├─> Register tools in tool registry
   │   │
   │   ▼
   └─> Register workflows in workflow registry
       │
       ▼
4. Plugins ready for use
```

## Component Responsibilities

### Agent
- Maintain conversation context
- Convert tools to OpenAI format
- Handle LLM communication
- Execute tool calls
- Manage conversation loop

### Plugin Loader
- Discover plugins automatically
- Load and validate plugins
- Maintain tool registry
- Maintain workflow registry
- Handle plugin lifecycle

### Workflow Engine
- Execute predefined sequences
- Resolve parameter variables
- Track execution context
- Handle step failures

### Plugin
- Implement tools (functionality)
- Define tool schemas (validation)
- Create workflows (automation)
- Manage plugin-specific state

## Type System

```
Plugin Interface
├─ metadata: PluginMetadata
├─ initialize(): Promise<void>
├─ getTools(): Tool[]
├─ getWorkflows(): Workflow[]
└─ cleanup?(): Promise<void>

Tool
├─ definition: ToolDefinition
│  ├─ name: string
│  ├─ description: string
│  └─ parameters: ZodObject
└─ execute: (params) => Promise<any>

Workflow
├─ name: string
├─ description: string
└─ steps: WorkflowStep[]
   ├─ toolName: string
   ├─ params: Record<string, any>
   └─ description?: string
```

## Key Design Decisions

### 1. Plugin Auto-Discovery
**Why**: Eliminates manual registration, makes adding plugins trivial
**How**: Directory scanning + dynamic imports

### 2. Zod for Validation
**Why**: Runtime validation + TypeScript types + auto-conversion to JSON Schema
**How**: Tools define Zod schemas, validated before execution

### 3. OpenAI Function Calling
**Why**: LLM automatically selects appropriate tools based on context
**How**: Tools converted to OpenAI function schemas, agent handles call loop

### 4. Workflow Variable System
**Why**: Enable parameter passing between steps
**How**: String interpolation with ${varName} syntax

### 5. Modular Core
**Why**: Separation of concerns, easier to test and extend
**How**: Agent, PluginLoader, WorkflowEngine as independent modules

## Extension Points

### Adding New Capabilities
1. **New Tool Type**: Create plugin with tools
2. **New Workflow Pattern**: Add workflow to plugin
3. **Custom Validation**: Use Zod transformers
4. **State Management**: Add state to plugin class
5. **External Services**: Initialize in plugin.initialize()

### Integration Points
- **OpenAI API**: Change model, add new parameters
- **Tool Registry**: Query available tools
- **Workflow Registry**: List and execute workflows
- **Plugin Lifecycle**: Hook into initialize/cleanup

## Why This Architecture?

### Key Advantages

**1. Plugin Auto-Discovery**
- Drop plugins in folder and restart - zero boilerplate
- No manual registration needed
- Enables future plugin marketplace

**2. LLM-Powered Tool Selection**
- No brittle keyword matching required
- Handles natural language variations
- Understands context across conversation
- Zero maintenance for new tools

**3. Type-Safe Parameter Validation**
- Single source of truth (Zod schemas)
- Automatic TypeScript types
- Runtime validation guaranteed
- Auto-converts to OpenAI format

**4. Modular Architecture**
- Easy to test components in isolation
- Can replace components (e.g., switch LLM providers)
- Clear responsibilities
- Easier to understand and maintain

### Trade-offs Made

**Dynamic Loading over Static Imports**
- Pro: Auto-discovery, plugin marketplace ready
- Con: Need build step, harder to tree-shake

**OpenAI Function Calling over Manual Routing**
- Pro: Natural language, context-aware, maintainable
- Con: Requires OpenAI API, some latency

**Zod over TypeScript-only**
- Pro: Runtime validation, auto-schema generation
- Con: Additional dependency, learning curve

## Comparison with Alternatives

### vs. LangChain
- **Ours**: Lightweight, simple abstractions, 30-min learning curve
- **LangChain**: Heavy framework, many abstractions, steep learning curve

### vs. Semantic Kernel
- **Ours**: Platform agnostic, simple, TypeScript/Node.js
- **Semantic Kernel**: Microsoft ecosystem, complex, Java/C# focused

### vs. Custom Solution
- **Ours**: Best practices built-in, clear structure, well documented
- **Custom**: Reinvent the wheel, no structure, maintenance burden
