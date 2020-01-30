// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as util from 'util';
import * as os from 'os';
import * as path from 'path';
import { ManagerNode, Project } from './managerNode';
import { ProjectPanel } from './project_panel';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	vscode.window.showInformationMessage('started');
	console.log(vscode.window);
	const manager_node = new ManagerNode();
	vscode.window.registerTreeDataProvider('rt-project-manager-view', manager_node);
	vscode.commands.registerCommand('rt-project-manager-view.refresh', () => manager_node.refresh());
	ProjectPanel.extension_context = context;
	context.subscriptions.push(vscode.commands.registerCommand('rt-project-manager-view.new_project', () => {
		if (vscode.workspace.workspaceFile === undefined) {
			vscode.window.showWarningMessage('A workspace is needed for new project operation');
			return;
		}
		ProjectPanel.create_project_panel();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('rt-project-manager-view.property', (project: Project) => {
		if (project.location) {
			ProjectPanel.project_property_panel(project.label, project.location);
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand('rt-project-manager-view.project_item_click', (label: string, location: vscode.Uri) => {
		if (label === 'Click to init RT workspace') {
			initWorkspace();
		}
	}));

	vscode.workspace.onDidOpenTextDocument((doc: vscode.TextDocument) => {
		if (doc.fileName.indexOf('.h') !== -1 && doc.uri.scheme === "file") {
			if (fs.readFileSync(doc.uri.fsPath, 'utf8') === '') {
				if (doc.uri.fsPath) {
					let temp = doc.uri.fsPath.split('\\').pop();
					if (temp) {
						let file_name = String(temp.split('/').pop()).replace('.', '_').toUpperCase();
						fs.writeFileSync(doc.uri.fsPath, '#ifndef ' + file_name + '\n#define ' + file_name + '\n\n\n\n#endif');
					}
				}
			}
		}
	});

}

function initWorkspace() {
	const options: vscode.SaveDialogOptions = {
		filters: {
			'VSCode Workspace': ['code-workspace']
		}
	};
	if (vscode.workspace.workspaceFolders !== undefined) {
		if (vscode.workspace.workspaceFolders.length > 0) {
			options.defaultUri = vscode.workspace.workspaceFolders[0].uri;
		} else if (vscode.workspace.workspaceFile?.scheme !== 'untitled') {
			options.defaultUri = vscode.workspace.workspaceFile;
		}
	}
	vscode.window.showSaveDialog(options).then(uri => {
		if (uri) {
			let path = uri.fsPath;
			if (path.split('.').pop() !== 'code-workspace') {
				path = path + '.code-workspace';
				uri = vscode.Uri.file(path);
			}
			fs.writeFileSync(uri.fsPath, '{\n"folders": []\n}');
			vscode.commands.executeCommand('vscode.openFolder', uri);
		}
	});
}

// this method is called when your extension is deactivated
export function deactivate() { }
