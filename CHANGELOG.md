# Change Log

All notable changes to the "cursor-prompt-manager" extension will be documented in this file.

## [0.1.1] - 2025-08-27

### Changed
- **Command Naming**: Renamed `promptManager.insertPrompt` to `promptManager.selectPrompt` for better clarity
- **UI Labels**: Updated command title from "Insert Prompt" to "Select Prompt" across all interfaces
- **Documentation**: Synchronized command names and descriptions in README files and documentation

### Improved
- **User Experience**: More intuitive command naming that better reflects the actual functionality (opening a selection dialog)
- **Consistency**: Unified naming convention across codebase, documentation, and user interface

## [0.1.0] - 2025-08-25

### Added
- Initial release of Cursor Prompt Manager
- Basic prompt management functionality (create, edit, delete, search)
- Category-based organization system
- Quick insert functionality via keyboard shortcuts and right-click menu
- Template variable support ({{selection}}, {{filename}}, {{filepath}})
- Import/Export functionality for prompt libraries
- Modern webview-based user interface
- Default prompts for common use cases:
  - Code Review
  - Bug Fix
  - Explain Code
  - Refactor Code
- Usage statistics tracking
- VS Code theme integration
- Command palette integration

### Features
- **Prompt Management**: Full CRUD operations for prompts
- **Smart Search**: Search prompts by title, content, description, or tags
- **Category Filtering**: Organize and filter prompts by categories
- **Quick Access**: Multiple ways to insert prompts (shortcuts, menus, commands)
- **Variable System**: Dynamic content replacement with template variables
- **Data Portability**: Import/export prompt libraries as JSON
- **User Experience**: Clean, responsive UI that matches VS Code themes

### Commands
- `promptManager.openPanel` - Open the prompt management panel
- `promptManager.selectPrompt` - Quick select prompt picker
- `promptManager.createPrompt` - Create a new prompt
- `promptManager.importPrompts` - Import prompts from JSON file
- `promptManager.exportPrompts` - Export prompts to JSON file

### Keyboard Shortcuts
- `Ctrl+Alt+P` (Cmd+Alt+P on Mac) - Open Prompt Manager panel
- `Ctrl+Shift+I` (Cmd+Shift+I on Mac) - Quick select prompt

### Configuration
- `promptManager.autoSave` - Automatically save prompts when modified
- `promptManager.showPreview` - Show prompt preview before insertion
- `promptManager.enableSync` - Enable cloud synchronization (future feature)
- `promptManager.defaultCategory` - Default category for new prompts
