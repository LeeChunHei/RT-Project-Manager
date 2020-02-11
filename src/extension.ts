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
		if (doc.fileName.split('.').pop() === 'h' && doc.uri.scheme === "file") {
			if (fs.readFileSync(doc.uri.fsPath, 'utf8') === '') {
				if (doc.uri.fsPath) {
					if (vscode.workspace.workspaceFolders) {
						for(let folder of vscode.workspace.workspaceFolders){
							if(doc.uri.fsPath.indexOf(folder.uri.fsPath)!==-1){
								let file_name = doc.uri.fsPath.replace(folder.uri.fsPath, '').substr(1).split(path.sep).join('_').split('.').join('_').toUpperCase();
								fs.writeFileSync(doc.uri.fsPath, '#ifndef ' + file_name + '\n#define ' + file_name + '\n\n\n\n#endif');
							}
						}
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
	const open_options: vscode.OpenDialogOptions = {
		canSelectMany: false,
		canSelectFiles: false,
		canSelectFolders: true,
		openLabel: 'Open RTLib Folder',
		filters: {
			'All files': ['*']
		}
	};
	vscode.window.showSaveDialog(options).then(uri => {
		if (uri) {
			let path = uri.fsPath;
			if (path.split('.').pop() !== 'code-workspace') {
				path = path + '.code-workspace';
				uri = vscode.Uri.file(path);
			}
			vscode.window.showOpenDialog(open_options).then(rt_uri => {
				if (rt_uri && rt_uri[0] && uri) {
					let rt_path = rt_uri[0].fsPath;
					rt_path = rt_path.split('\\').join('\\\\');
					fs.writeFileSync(uri.fsPath, util.format('{\n"folders": [\n{\n"path": "%s"\n}\n],\n"settings": {\n"rt-project-manager.rtlibPath": "%s"\n}}', rt_path, rt_path));
					vscode.commands.executeCommand('vscode.openFolder', uri);
				}
			});
		}
	});
}

// this method is called when your extension is deactivated
export function deactivate() { }
