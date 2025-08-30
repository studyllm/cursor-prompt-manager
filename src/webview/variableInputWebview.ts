import * as vscode from 'vscode';
import { Variable } from '../types';

export class VariableInputWebview {
    private panel: vscode.WebviewPanel | undefined;
    private variables: Variable[] = [];
    private resolve: ((values: { [key: string]: string }) => void) | undefined;

    constructor(private context: vscode.ExtensionContext) {}

    async showVariableInput(variables: Variable[]): Promise<{ [key: string]: string }> {
        this.variables = variables;

        return new Promise((resolve) => {
            this.resolve = resolve;
            this.createWebview();
        });
    }

    private createWebview() {
        this.panel = vscode.window.createWebviewPanel(
            'variableInput',
            '变量输入',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getWebviewContent();

        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'submit':
                        if (this.resolve) {
                            this.resolve(message.values);
                        }
                        this.panel?.dispose();
                        break;
                    case 'cancel':
                        if (this.resolve) {
                            this.resolve({});
                        }
                        this.panel?.dispose();
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    private getWebviewContent(): string {
        const variableInputs = this.variables.map((variable, index) => {
            const commonProps = `
                id="${variable.name}"
                name="${variable.name}"
                placeholder="${variable.placeholder || variable.name}"
                value="${variable.defaultValue || ''}"
                ${variable.required ? 'required' : ''}
            `;

            switch (variable.type) {
                case 'text':
                    return `
                        <div class="form-group">
                            <label for="${variable.name}">${variable.name} ${variable.required ? '*' : ''}</label>
                            <input type="text" ${commonProps} />
                            ${variable.description ? `<small class="help-text">${variable.description}</small>` : ''}
                        </div>
                    `;
                case 'multiline':
                    return `
                        <div class="form-group">
                            <label for="${variable.name}">${variable.name} ${variable.required ? '*' : ''}</label>
                            <textarea ${commonProps} rows="4">${variable.defaultValue || ''}</textarea>
                            ${variable.description ? `<small class="help-text">${variable.description}</small>` : ''}
                        </div>
                    `;
                case 'select':
                    const options = variable.options?.map(option => 
                        `<option value="${option}" ${option === variable.defaultValue ? 'selected' : ''}>${option}</option>`
                    ).join('') || '';
                    return `
                        <div class="form-group">
                            <label for="${variable.name}">${variable.name} ${variable.required ? '*' : ''}</label>
                            <select ${commonProps}>
                                ${!variable.required ? '<option value="">请选择...</option>' : ''}
                                ${options}
                            </select>
                            ${variable.description ? `<small class="help-text">${variable.description}</small>` : ''}
                        </div>
                    `;
                case 'number':
                    return `
                        <div class="form-group">
                            <label for="${variable.name}">${variable.name} ${variable.required ? '*' : ''}</label>
                            <input type="number" ${commonProps} />
                            ${variable.description ? `<small class="help-text">${variable.description}</small>` : ''}
                        </div>
                    `;
                case 'date':
                    return `
                        <div class="form-group">
                            <label for="${variable.name}">${variable.name} ${variable.required ? '*' : ''}</label>
                            <input type="date" ${commonProps} />
                            ${variable.description ? `<small class="help-text">${variable.description}</small>` : ''}
                        </div>
                    `;
                default:
                    return `
                        <div class="form-group">
                            <label for="${variable.name}">${variable.name} ${variable.required ? '*' : ''}</label>
                            <input type="text" ${commonProps} />
                            ${variable.description ? `<small class="help-text">${variable.description}</small>` : ''}
                        </div>
                    `;
            }
        }).join('');

        return `
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>变量输入</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 20px;
                        margin: 0;
                    }
                    
                    .container {
                        max-width: 600px;
                        margin: 0 auto;
                    }
                    
                    h1 {
                        color: var(--vscode-foreground);
                        margin-bottom: 20px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                        padding-bottom: 10px;
                    }
                    
                    .form-group {
                        margin-bottom: 20px;
                    }
                    
                    label {
                        display: block;
                        margin-bottom: 5px;
                        font-weight: bold;
                        color: var(--vscode-foreground);
                    }
                    
                    input, textarea, select {
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid var(--vscode-input-border);
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border-radius: 3px;
                        font-family: inherit;
                        font-size: inherit;
                        box-sizing: border-box;
                    }
                    
                    input:focus, textarea:focus, select:focus {
                        outline: none;
                        border-color: var(--vscode-focusBorder);
                        box-shadow: 0 0 0 1px var(--vscode-focusBorder);
                    }
                    
                    textarea {
                        resize: vertical;
                        min-height: 80px;
                    }
                    
                    .help-text {
                        display: block;
                        margin-top: 5px;
                        color: var(--vscode-descriptionForeground);
                        font-size: 0.9em;
                    }
                    
                    .button-group {
                        display: flex;
                        justify-content: flex-end;
                        gap: 10px;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid var(--vscode-panel-border);
                    }
                    
                    button {
                        padding: 8px 16px;
                        border: none;
                        border-radius: 3px;
                        font-family: inherit;
                        font-size: inherit;
                        cursor: pointer;
                        min-width: 80px;
                    }
                    
                    .btn-primary {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                    }
                    
                    .btn-primary:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    
                    .btn-secondary {
                        background-color: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                    }
                    
                    .btn-secondary:hover {
                        background-color: var(--vscode-button-secondaryHoverBackground);
                    }
                    
                    .error {
                        color: var(--vscode-errorForeground);
                        font-size: 0.9em;
                        margin-top: 5px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>填写模板变量</h1>
                    <form id="variableForm">
                        ${variableInputs}
                        <div class="button-group">
                            <button type="button" class="btn-secondary" onclick="cancel()">取消</button>
                            <button type="submit" class="btn-primary">确定</button>
                        </div>
                    </form>
                </div>
                
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    document.getElementById('variableForm').addEventListener('submit', function(e) {
                        e.preventDefault();
                        
                        const formData = new FormData(e.target);
                        const values = {};
                        
                        // 收集所有表单值
                        for (const [key, value] of formData.entries()) {
                            values[key] = value;
                        }
                        
                        // 验证必填项
                        let isValid = true;
                        const requiredFields = ${JSON.stringify(this.variables.filter(v => v.required).map(v => v.name))};
                        
                        // 清除之前的错误信息
                        document.querySelectorAll('.error').forEach(el => el.remove());
                        
                        for (const field of requiredFields) {
                            if (!values[field] || values[field].trim() === '') {
                                isValid = false;
                                const input = document.getElementById(field);
                                const error = document.createElement('div');
                                error.className = 'error';
                                error.textContent = '此字段为必填项';
                                input.parentNode.appendChild(error);
                            }
                        }
                        
                        if (isValid) {
                            vscode.postMessage({
                                type: 'submit',
                                values: values
                            });
                        }
                    });
                    
                    function cancel() {
                        vscode.postMessage({
                            type: 'cancel'
                        });
                    }
                </script>
            </body>
            </html>
        `;
    }
} 