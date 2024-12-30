# Obsidian Asana Plugin

This plugin integrates Asana tasks with Obsidian, allowing you to:
- Fetch tasks from your Asana projects
- View tasks in your Obsidian vault
- Mark tasks as complete/incomplete, syncing with Asana
- Add completion notes in Asana when tasks are completed via Obsidian

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

## Usage

1. Click the checkbox icon in the left ribbon or use the command palette to fetch Asana projects
2. Select a project from the modal
3. Tasks will be imported as a new note in your vault
4. Check/uncheck tasks in the note to update their status in Asana

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
