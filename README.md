# Obsidian Asana Plugin

This plugin integrates Asana tasks with Obsidian, allowing you to:
- Fetch tasks from your Asana projects directly into your Obsidian vault
- View and manage Asana tasks within Obsidian notes
- Two-way sync: Mark tasks as complete/incomplete in Obsidian and it updates in Asana
- Individual task files with rich metadata using frontmatter
- Full task details including descriptions, custom fields, and assignments
- Quick access via ribbon icon or command palette
- Task metadata support: View due dates and other task details
- Bulk task import from selected projects
- Customizable task formatting and organization

## Installation

1. Download the latest release from the releases page
2. Extract the zip file in your Obsidian vault's `.obsidian/plugins` folder
3. Enable the plugin in Obsidian's Community Plugins settings

## Configuration

1. Get your Asana Personal Access Token:
   - Go to Asana's Developer Console (https://app.asana.com/0/developer-console)
   - Create a new Personal Access Token
   - Copy the token

2. Configure the plugin:
   - Open Obsidian Settings
   - Go to "Asana Integration" in the Community Plugins section
   - Paste your Personal Access Token
   - Set your preferred task folder (default: "Asana Tasks")
   - Optionally set a template file for new tasks

## Usage

1. Click the checkbox icon in the left ribbon or use the command palette to fetch Asana projects
2. Select a project from the modal
3. Tasks will be imported as individual files in your specified task folder
4. Click on any task to open its detailed view
5. Edit task details and save to sync back to Asana

## Features

- **Project Integration**: 
  - Seamlessly import Asana projects into Obsidian
  - Filter and organize tasks by project
  - Maintain project hierarchy and structure

- **Task Synchronization**: 
  - Real-time sync between Obsidian and Asana
  - Automatic background updates
  - Conflict resolution handling

- **Individual Task Files**:
  - Each task gets its own Markdown file
  - Rich frontmatter with all task metadata
  - Custom fields support
  - Direct links to Asana tasks
  - Two-way sync of task content

- **Task Management**: 
  - Create, complete, and update tasks from within Obsidian
  - Support for due dates and task metadata
  - Batch task operations
  - Task completion tracking

- **Frontmatter Support**:
  - Task ID and status
  - Due dates and assignments
  - Project and tag information
  - Custom fields
  - Direct Asana URL
  - Automatic updates when syncing

- **Advanced Features**:
  - Open tasks directly in Asana browser
  - Customizable task folder structure
  - Template support for new tasks
  - Offline editing with sync queue

## Task File Structure

Each task is stored as a Markdown file with the following structure:

```markdown
---
asana_id: "1234567890"
status: "active"
due_date: "2024-01-15"
assignee: "John Doe"
projects: ["Project A", "Project B"]
tags: ["Priority", "In Progress"]
asana_url: "https://app.asana.com/..."
custom_fields:
  Priority: "High"
  Status: "In Progress"
---

# Task Title

Task description and notes go here...

## Comments

_Sync with Asana to see latest comments_
```

## Tips and Tricks

1. **Task Organization**:
   - Tasks are organized by project folders
   - Use Obsidian's native features (tags, links) with task files
   - Create task relationships using Obsidian links

2. **Editing Tasks**:
   - Edit the task content to update the description in Asana
   - Update frontmatter fields to change task metadata
   - Changes are automatically synced when you save

3. **Best Practices**:
   - Keep task descriptions up to date
   - Use frontmatter for structured data
   - Leverage Obsidian's search to find specific tasks

## Development

### Prerequisites
- Node.js
- npm

### Setup
1. Clone this repository
2. Run `npm install`
3. Run `npm run build` to compile the plugin

### Development Commands
- `npm run dev`: Start development build with watch mode
- `npm run build`: Build the plugin for production

## Troubleshooting

1. **Sync Issues**:
   - Verify your Asana token is valid
   - Check your internet connection
   - Ensure you have proper permissions in Asana

2. **Performance Tips**:
   - Limit the number of tasks per project
   - Regular cache clearing
   - Use the latest plugin version

3. **Common Issues**:
   - Token authentication errors
   - Task sync conflicts
   - Missing project access
