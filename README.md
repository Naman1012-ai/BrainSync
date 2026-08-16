# Convia

### Where Ideas Converge into Action.

Convia is a collaborative workspace designed to help teams move from scattered ideas to a clear direction and actionable project.

Instead of keeping brainstorming, discussions, decisions, and execution across different places, Convia brings them together into one structured workspace.

---

## 🚀 What is Convia?

Team brainstorming often produces a lot of ideas, but the difficult part comes afterward:

- Which idea should we actually build?
- What do other team members think?
- Which idea has the most potential?
- What should become the MVP?
- What should we build first?
- How do we turn the selected idea into an actionable plan?

**Convia focuses on this transition — from ideas to execution.**

Teams can create workspaces, share ideas, discuss them, vote on them, select an MVP, and turn the selected direction into a structured project through tasks and AI-assisted project blueprints.

---

## ✨ Core Features

### 💡 Idea Management

Create and organize ideas inside a collaborative workspace.

Each idea can contain relevant information such as:

- Title
- Description
- Problem statement
- Tech stack
- Suggestions
- Comments
- Questions
- Votes

---

### 🗳️ Idea Evaluation

Teams can interact with ideas before deciding what to build.

Members can:

- Vote on ideas
- Discuss ideas
- Add suggestions
- Ask questions
- Compare different ideas
- Identify promising directions

This helps teams make decisions based on collective input rather than a single person's preference.

---

### 🏆 MVP Selection

Once the team evaluates its ideas, the workspace can select an idea as the **MVP**.

The selected MVP becomes the team's primary direction for execution.

The selected MVP is visible to workspace members so everyone has a shared understanding of what the team is building.

---

### 🤖 AI Project Blueprint

Convia can generate an AI-assisted project blueprint for the selected MVP.

The blueprint can use information such as:

- Idea title
- Problem statement
- Description
- Tech stack
- Team members
- Relevant suggestions
- Relevant comments
- Relevant questions

The AI can distinguish between relevant and irrelevant discussions and incorporate useful information into the project plan.

The resulting blueprint is intended to help the team move from:

**Idea → Decision → Plan → Execution**

---

### 📋 Task & Project Execution

After deciding what to build, teams can move into execution.

Tasks help convert the selected idea into smaller actionable pieces of work.

---

### 💬 Workspace Chat

Convia provides a dedicated workspace communication channel for team members.

The workspace chat is independent from idea-specific discussions, allowing members to have broader project conversations.

---

### 📎 File Sharing

Workspace conversations can support file attachments such as:

- Images
- PDFs
- Documents
- Other supported files

File uploads are handled through external file storage rather than relying on Firebase Storage.

---

### 🔔 Notifications

Convia provides notifications for relevant workspace activity and system events.

The application aims to keep notifications centralized so users do not receive duplicate success or error messages from multiple notification systems.

---

### 📢 Announcements

Platform administrators can publish announcements that appear across user dashboards.

Announcements can include:

- Title
- Content
- Timestamp

Users can dismiss announcements, while administrators can manage their lifecycle.

---

### ⚙️ Platform Administration

Convia includes administrative controls for managing platform-wide behavior.

Depending on the configured permissions, administrators can manage areas such as:

- Workspace limits
- Idea limits
- MVP-related settings
- Import functionality
- Announcements
- Platform-level configuration

Platform settings are intended to apply consistently across the application.

---

## 🏗️ Application Architecture

Convia follows a separated frontend/backend architecture.

```text
Convia/
│
├── frontend/          # React + Vite application
│
├── backend/           # Node.js + Express API
│
├── common/            # Shared code/constants where required
│
├── ...
│
└── README.md
```

### Frontend

The frontend is responsible for:

- User interface
- Routing
- Workspace interaction
- Idea management
- Dashboard
- Authentication UI
- API communication
- Client-side state and interactions

**Technology:**
- React
- Vite
- JavaScript / TypeScript as used by the existing modules
- CSS / UI framework used by the project

### Backend

The backend provides the server-side application layer.

It handles functionality such as:

- API endpoints
- Server-side validation
- AI requests
- Secure handling of API keys
- Business logic that should not run in the browser
- Integration with external services

**Technology:**
- Node.js
- Express.js

The backend runs as a standalone service and is designed for deployment separately from the frontend.

### Common

The `common/` directory contains reusable code shared between application layers where appropriate.

The goal is to avoid duplicating:
- Constants
- Shared definitions
- Reusable structures
- Common configuration

Shared functionality should be implemented once and reused rather than duplicated between frontend and backend.

### 🔥 Firebase

Firebase is used for core application services such as:

- Authentication
- Realtime Database

Firebase provides the application's persistent data layer for users, workspaces, ideas, discussions, tasks, notifications, and related entities.

The application uses a structured data model designed to avoid unnecessary nesting and excessive data duplication.

### 🧠 AI Integration

Convia uses Google Gemini for AI-powered project blueprint generation.

The AI integration is handled through the backend.

The Gemini API key must remain server-side.

**Important:**
Never expose the Gemini API key through frontend environment variables.

Use:
`GEMINI_API_KEY=your_gemini_api_key`

Do not use:
`VITE_GEMINI_API_KEY=...`

Frontend environment variables prefixed with `VITE_` can be exposed to the browser.

### 📦 File Storage

Convia uses UploadThing for file uploads.

This allows workspace users to attach supported files without depending on Firebase Storage.

Typical supported content can include:
- Images
- PDFs
- Documents
- Other configured file types

UploadThing configuration and secrets should remain server-side where applicable.

### 🔐 Authentication & Authorization

Authentication is handled using Firebase Authentication.

The application also uses application-level authorization to determine what users are allowed to access or modify.

Important security principles include:
- Users should only access workspaces they belong to.
- Workspace-level actions should verify membership.
- Administrative actions require appropriate permissions.
- Server-side operations must not trust identifiers supplied by the client.
- Sensitive API keys must never be exposed to the frontend.

---

## 🗂️ Core Data Concepts

The application is structured around several primary entities:

```text
Users
│
├── Workspaces
│   │
│   ├── Members
│   ├── Ideas
│   │   ├── Comments
│   │   ├── Suggestions
│   │   ├── Questions
│   │   └── Votes
│   │
│   ├── Selected MVP
│   │   ├── Blueprint
│   │   └── Tasks
│   │
│   └── Workspace Chat
│
├── Notifications
│
└── Profile / Account
```

The exact Firebase schema should be treated as the source of truth for the implementation.

---

## 🔄 Core Workflow

The primary Convia workflow can be summarized as:

```text
Create / Join Workspace
          │
          ▼
      Share Ideas
          │
          ▼
   Discuss & Evaluate
          │
          ▼
      Vote on Ideas
          │
          ▼
      Select MVP
          │
          ▼
   Generate Blueprint
          │
          ▼
     Create Tasks
          │
          ▼
       Execute
```

This workflow represents the core purpose of Convia:

**Bring different ideas and perspectives together, converge on a direction, and turn that direction into action.**

---

## 🛠️ Local Development

### Prerequisites

Make sure you have installed:
- Node.js
- npm
- Git

You will also need the required Firebase, UploadThing, and Gemini configuration values.

### 📥 Clone the Repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd Convia
```

### 📦 Install Dependencies

Install frontend dependencies:
```bash
cd frontend
npm install
```

Install backend dependencies:
```bash
cd ../backend
npm install
```

If the repository uses a workspace/root-level package manager configuration, follow the package manager configuration already present in the repository instead of installing dependencies separately.

### 🔐 Environment Variables

Create the required environment files based on the environment variable examples provided by the project.

#### Frontend

Example:
```env
VITE_API_URL=http://localhost:5000
```

Additional Firebase client configuration should be added according to the application's Firebase setup.

Example structure:
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Only values intended for client-side use should use the `VITE_` prefix.

#### Backend

Example:
```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key
```

Add the required Firebase Admin / UploadThing configuration used by the backend implementation.

Never commit real secrets to Git.

### ▶️ Running the Application

#### Start the Backend
```bash
cd backend
npm install
npm run dev
```

The backend development server runs using Node's watch mode according to the current backend configuration.

For production-style execution:
```bash
npm start
```

#### Start the Frontend
In another terminal:
```bash
cd frontend
npm install
npm run dev
```

Vite will provide the local development URL in the terminal.

---

## 🌐 Production Deployment

Convia uses a separated deployment architecture:

```text
                   ┌─────────────────────┐
                   │       User          │
                   └──────────┬──────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │      Vercel         │
                   │      Frontend       │
                   └──────────┬──────────┘
                              │
                         API Requests
                              │
                              ▼
                   ┌─────────────────────┐
                   │       Render        │
                   │       Backend       │
                   └──────────┬──────────┘
                              │
             ┌────────────────┼────────────────┐
             ▼                ▼                ▼
        Firebase           Gemini         UploadThing
```

### Frontend

The React/Vite frontend can be deployed through **Vercel**.

Configure the frontend API URL using:
```env
VITE_API_URL=https://your-backend-url
```

### Backend

The Node.js/Express backend can be deployed through **Render**.

Current backend configuration:
- **Root Directory**: `backend`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

Do not use `npm install; npm run build` unless a build script is actually added to the backend package configuration.

---

## 🔒 Security Principles

Convia follows several important security principles:

1. **Never expose secrets**: Do not commit `.env`, `.env.local`, `.env.production`, service-account credentials, API keys, or private tokens to the repository.
2. **Server-side API keys**: AI and other private service credentials must remain on the backend. For example, `GEMINI_API_KEY=...` should only exist in the backend environment.
3. **Authorization**: Every sensitive operation should verify authentication, user identity, workspace membership, required permissions, and ownership where applicable. Never assume that because a user can send an ID, they are authorized to access that resource.

---

## 🧪 Testing

Before deploying changes, verify the major application flows:

- **Authentication**: Sign up, Login, Logout, Password recovery, Session persistence, Unauthorized access handling
- **Workspaces**: Create workspace, Join workspace, Workspace membership, Workspace settings, Workspace limits
- **Ideas**: Create idea, Edit idea, View idea, Vote, Comment, Suggestion, Question, Public ideas
- **MVP**: Select MVP, Selected MVP visible to members, MVP state persists correctly
- **Blueprint**: Generate blueprint, Correct MVP is sent to AI, Relevant discussion context is included, Gemini request occurs server-side, Blueprint is stored correctly, Blueprint can be regenerated where supported, Blueprint export works
- **Chat & Files**: Workspace chat, Send messages, Upload files, View attachments, Handle failed uploads
- **Administration**: Admin authentication, Platform settings, Global limits, Announcement creation, Announcement dismissal, Announcement deletion

---

## 📱 Responsive Design

Convia is intended to work across:
- Desktop
- Laptop
- Tablet
- Mobile

Important UI considerations include:
- Responsive navigation
- Mobile sidebar behavior
- No horizontal overflow
- Flexible dashboard layouts
- Responsive workspace views
- Readable typography
- Touch-friendly controls

---

## 🧹 Development Principles

The project follows a few important development principles:

1. **Reuse before duplicating**: If functionality already exists, reuse it. Avoid creating multiple implementations of the same feature.
2. **Single source of truth**: Important application behavior should have a clear source of truth (Notifications, Platform settings, Authentication state, Workspace state, MVP state, Branding, API configuration).
3. **Keep frontend and backend responsibilities separate**: Frontend handles UI, interaction, client state, and API consumption. Backend handles business logic, validation, authorization, secrets, and external API calls.
4. **Avoid unrelated changes**: When implementing a feature or fixing a bug, keep changes scoped to the actual problem unless an architectural dependency requires otherwise.

---

## 📁 Project Status

Convia is an actively developed project.

The application is being built around the complete journey:

```text
Brainstorm ──► Discuss ──► Evaluate ──► Decide ──► Select MVP ──► Plan ──► Execute
```

The goal is not simply to create another idea board. The goal is to help teams manage the difficult middle ground between having an idea and actually building it.

---

## 🗺️ Future Direction

Potential areas for future development include:
- Improved team collaboration
- More advanced project planning
- Better AI-generated blueprints
- Blueprint version history
- Deeper task management
- Advanced workspace analytics
- Improved notifications
- More export formats
- Better integrations with development tools
- Enhanced administrative controls

---

## 🤝 Contributing

Contributions, suggestions, and feedback are welcome.

### Basic Workflow
```bash
git checkout -b feature/your-feature
```

Make your changes, test them locally, and commit:
```bash
git add .
git commit -m "feat: add your feature"
```

Push the branch:
```bash
git push origin feature/your-feature
```
Then open a Pull Request.

### Guidelines
- Keep changes focused.
- Avoid unnecessary dependencies.
- Do not commit secrets.
- Preserve existing architecture.
- Test affected functionality.
- Avoid duplicating existing functionality.

---

<p align="center">
  <strong>Convia</strong> — <em>Where Ideas Converge into Action.</em><br />
  Built with React, Node.js, Express, Firebase, Gemini and modern web technologies.
</p>
