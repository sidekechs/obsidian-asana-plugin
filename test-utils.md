# Testing Utilities

## Quick Test Snippets

### 1. Test Task Creation
```markdown
- [ ] Test task 1: Basic task
- [ ] Test task 2: Task with special chars !@#$%
- [ ] Test task 3: Task with 📅 2024-12-31
```

### 2. Test Long Description
```markdown
# Project Planning Meeting Notes

This is a longer task description that includes:
- Multiple bullet points
- **Bold text** and *italic text*
- [Links](https://example.com)
- Code blocks

\```javascript
console.log("test");
\```
```

### 3. Test Commands
- Select text and use `Cmd/Ctrl + Shift + A` to create task
- Use Command Palette (`Cmd/Ctrl + P`) → "Asana: Create Task"
- Right-click → "Create Asana Task"

### 4. Monitor Network Requests
In Developer Tools → Network tab, filter by "asana" to see API calls

### 5. Test Data Reset
To start fresh:
1. Delete all files in your test vault's Asana folder
2. Clear plugin settings
3. Re-enter API token