# Archaeopteryx Migration Guide

The new Asana Integration (Enovara Dev) plugin includes all archaeopteryx functionality with the same keyboard shortcuts!

## Features Implemented

### 1. Get Daily Tasks (`Alt+Shift+D`)
- Fetches all tasks due today or overdue from all your Asana projects
- Creates a "Daily Tasks" note with organized tasks by project
- Shows priority indicators (🔴 High, 🟡 Medium, 🟢 Low)
- Marks overdue tasks with 🔴 OVERDUE

### 2. Save Task (`Alt+Shift+S`)
- Works with inline checkbox tasks: `- [ ] Task name`
- Creates new tasks in Asana if no GID exists
- Updates existing tasks if GID is present
- Automatically adds metadata after saving:
  ```markdown
  - [ ] My task
    - asana_gid:: 1234567890
    - permalink:: https://app.asana.com/...
    - assignee:: John Doe
  ```

### 3. Complete Task (`Alt+Shift+C`)
- Marks the task at cursor as complete in Asana
- Updates the checkbox to `[x]`
- Works with both new and existing tasks

### 4. Update Task (`Alt+Shift+U`)
- Updates an existing task's name and metadata in Asana
- Only works with tasks that have an asana_gid

## Task Format

The plugin recognizes tasks in this format:
```markdown
- [ ] Task title
  - asana_gid:: 1234567890
  - permalink:: https://app.asana.com/0/...
  - assignee:: John Doe
  - notes:: Task description
  - due_date:: 2024-01-15
```

## Additional Features

The new plugin also includes:
- Project-based task organization
- Two-way sync capabilities
- Task templates
- Comments viewing
- Better error handling

## Migration Steps

1. Disable the old archaeopteryx plugin
2. Enable "Asana Integration (Enovara Dev)"
3. Add your Asana API token in settings
4. All your keyboard shortcuts will work the same way!

## Testing the Features

1. Create a test task: `- [ ] Test task`
2. Press `Alt+Shift+S` to save it to Asana
3. Press `Alt+Shift+C` to mark it complete
4. Press `Alt+Shift+D` to get your daily tasks