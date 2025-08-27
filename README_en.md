# Cursor Prompt Manager

A powerful prompt management extension for Cursor IDE that helps developers organize, manage, and quickly insert AI prompts to improve coding efficiency.

## Features

- **📝 Prompt Management**: Create, edit, delete, and organize your AI prompts
- **🗂️ Category System**: Organize prompts into categories for better management
- **🔍 Search & Filter**: Quickly find prompts with search and category filtering
- **⚡ Smart Chat Integration**: Automatically load prompts into Cursor's AI chat with one click
- **🔧 Template Variables**: Support for dynamic variables like `{{selection}}`, `{{filename}}`, etc.
- **📤 Import/Export**: Backup and share your prompt libraries
- **📊 Usage Statistics**: Track how often you use each prompt
- **🎨 Modern UI**: Clean, responsive interface that matches VS Code themes
- **🗑️ Advanced Deletion**: Multiple ways to delete prompts with confirmation dialogs
## Installation

### From Source (Development)

1. Clone or download this repository
2. Open the project in VS Code
3. Run `npm install` to install dependencies
4. Press `F5` to launch the extension in a new Extension Development Host window

### From Marketplace (Coming Soon)

The extension will be available on the VS Code Marketplace once published.

## Quick Start

1. **Open Prompt Manager**: Click the Prompt Manager icon in the Activity Bar or use `Ctrl+Alt+P` (Cmd+Alt+P on Mac)

2. **Create Your First Prompt**:
   - Click the "+" button in the Prompt Manager panel
   - Enter a title, category, and content
   - Use variables like `{{selection}}` for dynamic content

3. **Use Prompts with AI Chat**:
   - Use `Ctrl+Shift+I` (Cmd+Shift+I on Mac) to open the quick picker
   - Click prompts directly in the Prompt Manager panel to load into chat
   - Prompts are automatically copied to clipboard and loaded into Cursor's AI chat
   - Fallback option to insert into editor if chat integration fails

## Default Prompts

The extension comes with several useful default prompts:

- **Code Review**: Request comprehensive code review
- **Bug Fix**: Get help identifying and fixing bugs
- **Explain Code**: Get explanations of complex code
- **Refactor Code**: Request refactoring suggestions

## Template Variables

Use these variables in your prompts for dynamic content:

- `{{selection}}` - Currently selected text
- `{{filename}}` - Current file name
- `{{filepath}}` - Full file path
- Custom variables will prompt for input when used

## Commands

- `Prompt Manager: Open Panel` - Open the prompt management panel
- `Prompt Manager: Insert Prompt` - Quick picker to load prompts into chat or editor
- `Prompt Manager: Create New Prompt` - Create a new prompt
- `Prompt Manager: Import Prompts` - Import prompts from JSON file
- `Prompt Manager: Export Prompts` - Export prompts to JSON file
- `Prompt Manager: Delete Prompt...` - Select and delete prompts with confirmation

## Keyboard Shortcuts

- `Ctrl+Alt+P` (Cmd+Alt+P) - Open Prompt Manager panel
- `Ctrl+Shift+I` (Cmd+Shift+I) - Quick picker to load prompts into chat
- Right-click in editor → "Insert Prompt" - Context menu access

## Configuration

Access settings via `File > Preferences > Settings` and search for "Prompt Manager":

- `promptManager.autoSave` - Automatically save prompts when modified
- `promptManager.showPreview` - Show prompt preview before insertion
- `promptManager.enableSync` - Enable cloud synchronization (future feature)
- `promptManager.defaultCategory` - Default category for new prompts

## Development

### Project Structure

```
cursor-prompt-manager/
├── src/
│   ├── extension.ts              # Main extension entry point
│   ├── promptManager.ts          # Core prompt management logic
│   ├── promptProvider.ts         # Tree view provider for sidebar
│   ├── types.ts                  # TypeScript type definitions
│   ├── webview/
│   │   └── promptWebviewProvider.ts  # Webview UI provider
│   └── test/                     # Test files
├── media/                        # CSS and JavaScript for webview
├── .vscode/                      # VS Code debug configuration
├── package.json                  # Extension manifest
└── tsconfig.json                # TypeScript configuration
```

### Building

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes during development
npm run watch

# Package for distribution
npm run package
```

### Testing

```bash
# Run tests
npm test

# Run linting
npm run lint
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Recent Updates

### v0.1.0 Features
- ✅ **Smart Chat Integration**: Prompts automatically load into Cursor's AI chat
- ✅ **Improved Keyboard Shortcuts**: Changed to `Ctrl+Shift+I` to avoid conflicts
- ✅ **Enhanced Deletion**: Multiple deletion methods with confirmation dialogs
- ✅ **Clipboard Integration**: Automatic copying for manual paste scenarios
- ✅ **Fallback Handling**: Graceful degradation when chat integration fails

## Roadmap

- [ ] Cloud synchronization
- [ ] Team collaboration features
- [ ] AI-powered prompt suggestions
- [ ] Multi-language support
- [ ] Advanced variable system
- [ ] Prompt templates marketplace
- [ ] Enhanced chat integration with better API support

## Support

If you encounter any issues or have feature requests, please create an issue on the GitHub repository.

---

**Happy Coding with AI! 🚀**
